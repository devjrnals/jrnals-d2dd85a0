import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CommandMenu } from "./CommandMenu";
import { FormattingToolbar, saveSelectionForToolbar } from "./FormattingToolbar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { GripVertical, X, Edit, ChevronRight, ChevronDown, Copy, AlertCircle, Quote, Trash2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

// Notion-like Block Types
type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'numberedList'
  | 'quote'
  | 'code'
  | 'divider'
  | 'toggle'
  | 'callout'
  | 'image';

type BaseBlock = {
  id: string;
  type: BlockType;
  content: string;
  children?: Block[];
  collapsed?: boolean;
  level?: number; // For nested blocks
};

// Legacy types for backward compatibility
type QuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: number;
};

type QuizData = {
  title: string;
  questions: QuizQuestion[];
};

type FlashcardData = {
  title: string;
  cards: Array<{
    id: string;
    front: string;
    back: string;
  }>;
};

type QuizResult = {
  questionIndex: number;
  userAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
};

// Legacy block types (will be phased out)
type TextBlock = {
  id: string;
  type: 'text';
  content: string;
};

type QuizBlock = {
  id: string;
  type: 'quiz';
  quiz: QuizData;
  currentQuestionIndex: number;
  quizResults: QuizResult[];
  showResults: boolean;
};

type FlashcardBlock = {
  id: string;
  type: 'flashcards';
  flashcards: FlashcardData;
  currentCardIndex: number;
  isFlipped: boolean;
  isEditing: boolean;
  editingCardIndex: number | null;
  inlineEditingCardIndex: number | null;
  inlineEditingFront: string;
  inlineEditingBack: string;
};

type WhiteboardBlock = {
  id: string;
  type: 'whiteboard';
  canvasData: string | null; // Base64 encoded canvas image data
  prompt: string;
  isGenerating: boolean;
};

type ImageBlock = {
  id: string;
  type: 'image';
  content: string; // Base64 encoded image data or image URL
  alt?: string;
  width?: number; // Optional width in pixels
  height?: number; // Optional height in pixels
};

type DesmosBlock = {
  id: string;
  type: 'calculator';
  calculatorState?: string; // JSON string of full calculator state (includes all expressions, equations, etc.)
  width?: number; // Optional width, default 600px
  height?: number; // Optional height, default 400px
};

type NotionBlock = BaseBlock;

// Row block for horizontal layouts (max 3 columns)
type RowBlock = {
  id: string;
  type: 'row';
  blocks: Block[]; // Blocks inside the row (max 3)
};

type Block = NotionBlock | TextBlock | QuizBlock | FlashcardBlock | WhiteboardBlock | ImageBlock | DesmosBlock | RowBlock;

// Slash command definitions
type SlashCommand = {
  command: string;
  label: string;
  description: string;
  type: BlockType;
  icon?: string;
};

const SLASH_COMMANDS: SlashCommand[] = [
  { command: 'text', label: 'Text', description: 'Just start writing with plain text', type: 'paragraph' },
  { command: 'h1', label: 'Heading 1', description: 'Big section heading', type: 'heading1' },
  { command: 'h2', label: 'Heading 2', description: 'Medium section heading', type: 'heading2' },
  { command: 'h3', label: 'Heading 3', description: 'Small section heading', type: 'heading3' },
  { command: 'bullet', label: 'Bulleted List', description: 'Create a simple bulleted list', type: 'bulletList' },
  { command: 'number', label: 'Numbered List', description: 'Create a numbered list', type: 'numberedList' },
  { command: 'quote', label: 'Quote', description: 'Capture a quote', type: 'quote' },
  { command: 'code', label: 'Code', description: 'Capture a code snippet', type: 'code' },
  { command: 'divider', label: 'Divider', description: 'Visual separator', type: 'divider' },
  { command: 'toggle', label: 'Toggle List', description: 'Toggles can hide and show content', type: 'toggle' },
  { command: 'callout', label: 'Callout', description: 'Make text stand out', type: 'callout' },
  { command: 'quiz', label: 'Quiz', description: 'Generate a quiz on a topic', type: 'paragraph' },
  { command: 'flashcards', label: 'Flashcards', description: 'Generate flashcards on a topic', type: 'paragraph' },
  { command: 'calculator', label: 'Calculator', description: 'Insert a Desmos graphing calculator', type: 'paragraph' },
];

// @ Command definitions
type AtCommand = {
  command: string;
  label: string;
  description: string;
  icon?: string;
};

const AT_COMMANDS: AtCommand[] = [
  { command: 'quiz', label: 'Quiz', description: 'Generate a quiz from your content' },
  { command: 'flashcards', label: 'Flashcards', description: 'Create flashcards from your content' },
  { command: 'summary', label: 'Summary', description: 'Generate a summary of your content' },
  { command: 'whiteboard', label: 'Whiteboard', description: 'Create a whiteboard to draw and collaborate' },
];

type EditorProps = {
  journalId?: string;
  initialContent?: string;
  onWordCountChange?: (count: number) => void;
  currentQuiz?: QuizData | null;
  currentQuestionIndex?: number;
  quizResults?: QuizResult[];
  showQuizResults?: boolean;
  onQuizAnswer?: (answer: number) => void;
  onExitQuiz?: () => void;
  onQuizAdded?: () => void;
  currentFlashcards?: FlashcardData | null;
  onFlashcardsAdded?: () => void;
  onInsertContentReady?: (insertFn: (content: string) => void) => void;
  onGenerateQuiz?: (content: string) => Promise<void>;
};

// Slash Command Component
function SlashCommandMenu({
  position,
  filter,
  onSelect,
  onClose
}: {
  position: { top: number; left: number };
  filter: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}) {
  const filteredCommands = SLASH_COMMANDS.filter(cmd =>
    cmd.command.toLowerCase().includes(filter.toLowerCase()) ||
    cmd.label.toLowerCase().includes(filter.toLowerCase())
  );

  // Hide menu if user is typing topic after /quiz or /flashcards
  const isTypingTopic = filter.startsWith('quiz ') || filter.startsWith('flashcards ');
  if (isTypingTopic) return null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && filteredCommands.length > 0) {
        e.preventDefault();
        onSelect(filteredCommands[0]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredCommands, onSelect, onClose]);

  if (filteredCommands.length === 0) return null;

  return (
    <div
      className="fixed z-50 w-72 rounded-md border bg-popover text-popover-foreground shadow-md outline-none max-h-[300px] overflow-y-auto"
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-1">
        {filteredCommands.map((cmd, index) => (
          <button
            key={cmd.command}
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            onClick={() => onSelect(cmd)}
          >
            <div className="mr-2 flex h-4 w-4 items-center justify-center">
              <div className="flex h-4 w-4 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                {cmd.command.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="flex flex-col items-start">
              <div className="font-medium">{cmd.label}</div>
              <div className="text-xs text-muted-foreground">{cmd.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// @ Command Component
function AtCommandMenu({
  position,
  filter,
  onSelect,
  onClose,
  selectedIndex,
  onSelectedIndexChange
}: {
  position: { top: number; left: number };
  filter: string;
  onSelect: (command: AtCommand) => void;
  onClose: () => void;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
}) {
  const filteredCommands = AT_COMMANDS.filter(cmd =>
    cmd.command.toLowerCase().includes(filter.toLowerCase()) ||
    cmd.label.toLowerCase().includes(filter.toLowerCase())
  );

  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Update selected index when filtered commands change
  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      onSelectedIndexChange(0);
    }
  }, [filteredCommands.length, selectedIndex, onSelectedIndexChange]);

  // Scroll selected item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onSelectedIndexChange((selectedIndex + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onSelectedIndexChange((selectedIndex - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter' && filteredCommands.length > 0) {
        e.preventDefault();
        onSelect(filteredCommands[selectedIndex]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredCommands, selectedIndex, onSelect, onClose, onSelectedIndexChange]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (filteredCommands.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-72 rounded-md border bg-popover text-popover-foreground shadow-md outline-none max-h-[300px] overflow-y-auto"
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-1">
        {filteredCommands.map((cmd, index) => (
          <button
            key={cmd.command}
            ref={(el) => { itemRefs.current[index] = el; }}
            className={cn(
              "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
              selectedIndex === index && "bg-accent text-accent-foreground"
            )}
            onClick={() => onSelect(cmd)}
            onMouseEnter={() => onSelectedIndexChange(index)}
          >
            <div className="mr-2 flex h-4 w-4 items-center justify-center">
              <div className="flex h-4 w-4 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                {cmd.command.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="flex flex-col items-start">
              <div className="font-medium">{cmd.label}</div>
              <div className="text-xs text-muted-foreground">{cmd.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Whiteboard Component
function WhiteboardComponent({
  blockId,
  initialCanvasData,
  prompt,
  isGenerating,
  onCanvasUpdate
}: {
  blockId: string;
  initialCanvasData: string | null;
  prompt: string;
  isGenerating: boolean;
  onCanvasUpdate: (canvasData: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size based on container
    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = 400 * dpr;
      ctx.scale(dpr, dpr);
      
      // Set drawing styles
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Load initial canvas data if available
      if (initialCanvasData) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, rect.width, 400);
          ctx.drawImage(img, 0, 0, rect.width, 400);
        };
        img.src = initialCanvasData;
      } else {
        // Clear canvas with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, 400);
      }
    };

    updateCanvasSize();
    
    // Handle window resize
    const handleResize = () => updateCanvasSize();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [initialCanvasData, color, brushSize]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Save canvas state
    const canvas = canvasRef.current;
    if (canvas) {
      const canvasData = canvas.toDataURL();
      onCanvasUpdate(canvasData);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const canvasData = canvas.toDataURL();
    onCanvasUpdate(canvasData);
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `whiteboard-${blockId}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="space-y-4">
      {prompt && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
          <span className="font-medium">Prompt:</span> {prompt}
        </div>
      )}

      {isGenerating && (
        <div className="text-sm text-primary bg-primary/10 p-2 rounded">
          Generating whiteboard content...
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-10 h-10 rounded border border-border cursor-pointer"
          title="Color"
        />
        <input
          type="range"
          min="1"
          max="20"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-24"
          title="Brush Size"
        />
        <span className="text-xs text-muted-foreground">{brushSize}px</span>
        <Button
          variant="outline"
          size="sm"
          onClick={clearCanvas}
          className="gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={downloadCanvas}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Download
        </Button>
      </div>

      {/* Canvas */}
      <div className="border border-border rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="w-full cursor-crosshair touch-none"
          style={{ height: '400px' }}
        />
      </div>
    </div>
  );
}

// Desmos Calculator Component
function DesmosCalculator({ 
  blockId, 
  calculatorState, 
  width = 600, 
  height = 400,
  onStateChange
}: { 
  blockId: string; 
  calculatorState?: string; // JSON string of full calculator state
  width?: number; 
  height?: number;
  onStateChange?: (state: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const initialStateRef = useRef<string | undefined>(calculatorState);

  // Update initial state ref when calculatorState prop changes (for external updates)
  useEffect(() => {
    initialStateRef.current = calculatorState;
  }, [calculatorState]);

  useEffect(() => {
    if (containerRef.current && typeof (window as any).Desmos !== 'undefined') {
      const Desmos = (window as any).Desmos;
      calculatorRef.current = Desmos.GraphingCalculator(containerRef.current);
      
      // Restore saved state if available (only on initial mount)
      if (initialStateRef.current) {
        try {
          const state = JSON.parse(initialStateRef.current);
          calculatorRef.current.setState(state);
        } catch (error) {
          console.error('Failed to parse calculator state:', error);
        }
      }

      // Listen for changes and save state
      const handleChange = () => {
        if (calculatorRef.current && onStateChange) {
          // Debounce saves to avoid too frequent updates
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          
          saveTimeoutRef.current = setTimeout(() => {
            try {
              const state = calculatorRef.current.getState();
              const stateString = JSON.stringify(state);
              onStateChange(stateString);
            } catch (error) {
              console.error('Failed to save calculator state:', error);
            }
          }, 500); // Debounce 500ms
        }
      };

      calculatorRef.current.observeEvent('change', handleChange);
      
      return () => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        if (calculatorRef.current) {
          calculatorRef.current.destroy();
        }
      };
    }
  }, [onStateChange]); // Only depend on onStateChange, not calculatorState

  // Handle resize to update calculator dimensions
  useEffect(() => {
    if (calculatorRef.current && containerRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        if (calculatorRef.current && containerRef.current) {
          calculatorRef.current.resize();
        }
      });
      
      resizeObserver.observe(containerRef.current);
      
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [calculatorRef.current]);

  return (
    <div 
      ref={containerRef}
      data-desmos-calculator="true"
      style={{ width: '100%', height: `${height}px` }}
      className="overflow-hidden bg-white"
    />
  );
}

export const Editor = ({
  journalId,
  initialContent = "",
  onWordCountChange,
  currentQuiz,
  currentQuestionIndex = 0,
  quizResults = [],
  showQuizResults = false,
  onQuizAnswer,
  onExitQuiz,
  onQuizAdded,
  currentFlashcards,
  onFlashcardsAdded,
  onInsertContentReady,
  onGenerateQuiz
}: EditorProps) => {
  // Block-based state - inline version of getBlocksFromContent for initial state
  const [blocks, setBlocks] = useState<Block[]>(() => {
    if (initialContent.trim()) {
      // Inline version of getBlocksFromContent for initial state
      try {
        const parsed = JSON.parse(initialContent);
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) {
            return [{ id: 'paragraph-0', type: 'paragraph', content: '', children: [], collapsed: false }];
          }
          const restoredBlocks = parsed.map((block: any, index: number) => {
            if (!block.id) {
              block.id = block.type === 'quiz'
                ? `quiz-${Date.now()}-${index}`
                : block.type === 'flashcards'
                ? `flashcards-${Date.now()}-${index}`
                : block.type === 'whiteboard'
                ? `whiteboard-${Date.now()}-${index}`
                : block.type === 'calculator'
                ? `calculator-${Date.now()}-${index}`
                : `text-${index}`;
            }

            if (block.type === 'quiz') {
              return {
                id: block.id,
                type: 'quiz' as const,
                quiz: block.quiz || { title: '', questions: [] },
                currentQuestionIndex: 0,
                quizResults: [],
                showResults: false
              } as QuizBlock;
            } else if (block.type === 'flashcards') {
              if (!block.flashcards) return null;
              return {
                id: block.id,
                type: 'flashcards' as const,
                flashcards: block.flashcards,
                currentCardIndex: 0,
                isFlipped: false,
                isEditing: false,
                editingCardIndex: null,
                inlineEditingCardIndex: null,
                inlineEditingFront: '',
                inlineEditingBack: ''
              } as FlashcardBlock;
            } else if (block.type === 'whiteboard') {
              return {
                id: block.id,
                type: 'whiteboard' as const,
                canvasData: (block as any).canvasData || null,
                prompt: (block as any).prompt || '',
                isGenerating: false
              } as WhiteboardBlock;
            } else if (block.type === 'calculator') {
              return {
                id: block.id,
                type: 'calculator' as const,
                calculatorState: (block as any).calculatorState, // Full calculator state (all expressions, equations, etc.)
                width: (block as any).width || 600,
                height: (block as any).height || 400
              } as DesmosBlock;
            } else if (block.type === 'text') {
              return {
                id: block.id,
                type: 'text' as const,
                content: block.content || ''
              } as TextBlock;
            } else if (block.type === 'row') {
              // Handle row blocks - recursively restore nested blocks
              if (!block.blocks || !Array.isArray(block.blocks)) {
                console.warn('Row block missing blocks array:', block);
                return {
                  id: block.id || `row-${Date.now()}`,
                  type: 'row' as const,
                  blocks: [{ id: 'text-0', type: 'text', content: '' }]
                } as RowBlock;
              }
              // Recursively restore nested blocks
              const nestedBlocks = block.blocks.map((nestedBlock: any, nestedIndex: number) => {
                if (nestedBlock.type === 'text') {
                  return {
                    id: nestedBlock.id || `text-${nestedIndex}`,
                    type: 'text' as const,
                    content: nestedBlock.content || ''
                  } as TextBlock;
                } else if (['paragraph', 'heading1', 'heading2', 'heading3', 'code', 'quote'].includes(nestedBlock.type)) {
                  return {
                    id: nestedBlock.id || `${nestedBlock.type}-${nestedIndex}`,
                    type: nestedBlock.type,
                    content: nestedBlock.content || '',
                    children: nestedBlock.children || [],
                    collapsed: nestedBlock.collapsed || false,
                    level: nestedBlock.level || 0
                  } as NotionBlock;
                } else {
                  return {
                    id: nestedBlock.id || `text-${nestedIndex}`,
                    type: 'text' as const,
                    content: typeof nestedBlock.content === 'string' ? nestedBlock.content : ''
                  } as TextBlock;
                }
              });
              return {
                id: block.id || `row-${Date.now()}`,
                type: 'row' as const,
                blocks: nestedBlocks
              } as RowBlock;
            } else if (['paragraph', 'heading1', 'heading2', 'heading3', 'code', 'quote'].includes(block.type)) {
              // Handle NotionBlock types
              return {
                id: block.id,
                type: block.type,
                content: block.content || '',
                children: block.children || [],
                collapsed: block.collapsed || false,
                level: block.level || 0
              } as NotionBlock;
            }
            // Fallback - check if it's a row block structure before stringifying
            if (block.type === 'row' || (block.blocks && Array.isArray(block.blocks))) {
              return {
                id: block.id || `row-${Date.now()}`,
                type: 'row' as const,
                blocks: block.blocks || []
              } as RowBlock;
            }
            // Fallback
            return {
              id: block.id || `text-${index}`,
              type: 'text' as const,
              content: typeof block.content === 'string' ? block.content : JSON.stringify(block)
            } as TextBlock;
          }).filter(Boolean) as Block[];

          return restoredBlocks;
        }
      } catch (e) {
        // If not JSON, treat as plain text
        return [{ id: 'paragraph-0', type: 'paragraph', content: initialContent, children: [], collapsed: false }];
      }
    }
    return [{ id: 'paragraph-0', type: 'paragraph', content: '', children: [], collapsed: false }];
  });

  // Slash command state
  const [slashCommand, setSlashCommand] = useState<{
    isOpen: boolean;
    position: { top: number; left: number };
    filter: string;
    blockId: string;
  } | null>(null);

  // @ command state
  const [atCommand, setAtCommand] = useState<{
    isOpen: boolean;
    position: { top: number; left: number };
    filter: string;
    blockId: string;
    startOffset: number;
  } | null>(null);
  const [atCommandSelectedIndex, setAtCommandSelectedIndex] = useState(0);

  // Drag and drop state
  const [draggedBlock, setDraggedBlock] = useState<Block | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [horizontalDropTarget, setHorizontalDropTarget] = useState<{
    blockIndex: number;
    side: 'left' | 'right';
  } | null>(null);

  // UI state
  const [focusedBlockId, setFocusedBlockId] = useState<string>('paragraph-0');
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
  const [content, setContent] = useState(initialContent);
  const [isUpdatingBlockType, setIsUpdatingBlockType] = useState(false);

  // Formatting toolbar state
  const [formattingToolbar, setFormattingToolbar] = useState<{
    isVisible: boolean;
    position: { top: number; left: number };
    activeFormats: {
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
      code?: boolean;
    };
    blockId?: string; // Store the block ID when toolbar is shown
  } | null>(null);
  
  // Track if user is interacting with toolbar
  const toolbarInteractionRef = useRef(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  // Parse quiz response from API
  const parseQuizResponse = useCallback((response: string): QuizData | null => {
    try {
      const lines = response.split('\n').map(line => line.trim()).filter(line => line);

      // Find title
      const titleLine = lines.find(line => line.startsWith('QUIZ_TITLE:'));
      const title = titleLine ? titleLine.replace('QUIZ_TITLE:', '').trim() : 'Quiz';

      const questions: any[] = [];
      let currentQuestion: any = {};
      let currentOptions: string[] = [];

      for (const line of lines) {
        if (line.startsWith('QUESTION ')) {
          // Save previous question if exists
          if (currentQuestion.question && currentOptions.length === 4 && currentQuestion.correctAnswer !== undefined) {
            questions.push({
              question: currentQuestion.question,
              options: currentOptions,
              correctAnswer: currentQuestion.correctAnswer
            });
          }

          // Start new question
          currentQuestion = { question: line.split(':').slice(1).join(':').trim() };
          currentOptions = [];
        } else if (line.match(/^[A-D]\)/)) {
          const option = line.substring(3).trim();
          currentOptions.push(option);
        } else if (line.startsWith('CORRECT:')) {
          const correctLetter = line.replace('CORRECT:', '').trim().toUpperCase();
          const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correctLetter);
          if (correctIndex !== -1) {
            currentQuestion.correctAnswer = correctIndex;
          }
        }
      }

      // Add final question
      if (currentQuestion.question && currentOptions.length === 4 && currentQuestion.correctAnswer !== undefined) {
        questions.push({
          question: currentQuestion.question,
          options: currentOptions,
          correctAnswer: currentQuestion.correctAnswer
        });
      }

      return questions.length > 0 ? { title, questions } : null;
    } catch (error) {
      console.error('Error parsing quiz response:', error);
      return null;
    }
  }, []);

  const parseFlashcardsResponse = useCallback((response: string): FlashcardData | null => {
    try {
      const lines = response.split('\n').map(line => line.trim()).filter(line => line);

      let title = 'Flashcards';
      const cards: Array<{ id: string; front: string; back: string }> = [];
      let currentCard: { front: string; back: string } | null = null;

      for (const line of lines) {
        if (line.startsWith('FLASHCARDS_TITLE:')) {
          title = line.replace('FLASHCARDS_TITLE:', '').trim();
        } else if (line.startsWith('CARD ')) {
          // Save previous card if exists
          if (currentCard && currentCard.front && currentCard.back) {
            cards.push({
              id: `card-${cards.length + 1}`,
              front: currentCard.front,
              back: currentCard.back
            });
          }

          // Start new card
          currentCard = { front: '', back: '' };
        } else if (line.startsWith('FRONT:')) {
          if (currentCard) {
            currentCard.front = line.replace('FRONT:', '').trim();
          }
        } else if (line.startsWith('BACK:')) {
          if (currentCard) {
            currentCard.back = line.replace('BACK:', '').trim();
          }
        }
      }

      // Add final card
      if (currentCard && currentCard.front && currentCard.back) {
        cards.push({
          id: `card-${cards.length + 1}`,
          front: currentCard.front,
          back: currentCard.back
        });
      }

      return cards.length > 0 ? { title, cards } : null;
    } catch (error) {
      console.error('Error parsing flashcards response:', error);
      return null;
    }
  }, []);

  // Generate quiz from content
  const generateQuizFromContent = useCallback(async (content: string, blockId: string) => {
    if (!content.trim()) {
      toast({
        title: "No content",
        description: "Please provide content to generate a quiz from.",
        variant: "destructive"
      });
      return;
    }

    // Show loading state - replace block content with "Generating quiz..."
    const blockElement = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
    if (blockElement) {
      const originalContent = blockElement.innerHTML;
      blockElement.innerHTML = '<span class="text-muted-foreground">Generating quiz...</span>';
      
      try {
        // Get access token
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        if (!token) {
          toast({
            title: "Error",
            description: "You must be logged in to generate quizzes.",
            variant: "destructive"
          });
          blockElement.innerHTML = originalContent;
          return;
        }

        // Call API to generate quiz
        const prompt = `Create a quiz based on the following content. Format the response as follows:

QUIZ_TITLE: [Title of the quiz]

QUESTION 1: [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
CORRECT: [A, B, C, or D]

[Repeat for more questions]

Content: ${content}`;

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ 
            messages: [{ role: 'user', content: prompt }], 
            journalTitle: 'Journal',
            enableWebSearch: false 
          }),
        });

        if (!resp.ok) {
          throw new Error('Failed to generate quiz');
        }

        const reader = resp.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let quizResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          quizResponse += decoder.decode(value, { stream: true });
        }

        // Parse quiz response
        const quizData = parseQuizResponse(quizResponse);
        
        if (quizData) {
          // Remove the command chip block and add quiz block
          setBlocks(prev => {
            const filtered = prev.filter(b => b.id !== blockId);
            const quizBlock: QuizBlock = {
              id: `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: 'quiz',
              quiz: quizData,
              currentQuestionIndex: 0,
              quizResults: [],
              showResults: false
            };
            return [...filtered, quizBlock];
          });
          
          toast({
            title: "Quiz generated",
            description: "Your quiz has been created successfully.",
          });
          
          onQuizAdded?.();
        } else {
          throw new Error('Failed to parse quiz response');
        }
      } catch (error) {
        console.error('Error generating quiz:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to generate quiz. Please try again.",
          variant: "destructive"
        });
        if (blockElement) {
          blockElement.innerHTML = originalContent;
        }
      }
    }
  }, [parseQuizResponse, setBlocks, toast, onQuizAdded]);

  // Generate flashcards from content
  const generateFlashcardsFromContent = useCallback(async (content: string, blockId: string) => {
    if (!content.trim()) {
      toast({
        title: "No content",
        description: "Please provide content to generate flashcards from.",
        variant: "destructive"
      });
      return;
    }

    // Show loading state - replace block content with "Generating flashcards..."
    const blockElement = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
    if (blockElement) {
      const originalContent = blockElement.innerHTML;
      blockElement.innerHTML = '<span class="text-muted-foreground">Generating flashcards...</span>';
      
      try {
        // Get access token
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        if (!token) {
          toast({
            title: "Error",
            description: "You must be logged in to generate flashcards.",
            variant: "destructive"
          });
          blockElement.innerHTML = originalContent;
          return;
        }

        // Call API to generate flashcards
        const prompt = `Create flashcards based on the following content. Format the response as follows:

FLASHCARDS_TITLE: [Title of the flashcards]

CARD 1:
FRONT: [Question or term]
BACK: [Answer or definition]

CARD 2:
FRONT: [Question or term]
BACK: [Answer or definition]

[Repeat for more cards - generate exactly 8 flashcards]

Content: ${content}`;

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ 
            messages: [{ role: 'user', content: prompt }], 
            journalTitle: 'Journal',
            enableWebSearch: false 
          }),
        });

        if (!resp.ok) {
          throw new Error('Failed to generate flashcards');
        }

        const reader = resp.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let flashcardsResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          flashcardsResponse += decoder.decode(value, { stream: true });
        }

        // Parse flashcards response
        const flashcardsData = parseFlashcardsResponse(flashcardsResponse);
        
        if (flashcardsData) {
          // Remove the command block and add flashcard block
          setBlocks(prev => {
            const filtered = prev.filter(b => b.id !== blockId);
            const flashcardBlock: FlashcardBlock = {
              id: `flashcards-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: 'flashcards',
              flashcards: flashcardsData,
              currentCardIndex: 0,
              isFlipped: false,
              isEditing: false,
              editingCardIndex: null,
              inlineEditingCardIndex: null,
              inlineEditingFront: '',
              inlineEditingBack: ''
            };
            return [...filtered, flashcardBlock];
          });
          
          toast({
            title: "Flashcards generated",
            description: "Your flashcards have been created successfully.",
          });
          
          onFlashcardsAdded?.();
        } else {
          throw new Error('Failed to parse flashcards response');
        }
      } catch (error) {
        console.error('Error generating flashcards:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to generate flashcards. Please try again.",
          variant: "destructive"
        });
        if (blockElement) {
          blockElement.innerHTML = originalContent;
        }
      }
    }
  }, [parseFlashcardsResponse, setBlocks, toast, onFlashcardsAdded]);

  // Quiz drag state for snapping
  const [draggedQuiz, setDraggedQuiz] = useState<QuizBlock | null>(null);
  const [quizDropTargetIndex, setQuizDropTargetIndex] = useState<number | null>(null);
  const [isQuizDragging, setIsQuizDragging] = useState(false);

  // Flashcard drag state
  const [draggedFlashcard, setDraggedFlashcard] = useState<FlashcardBlock | null>(null);
  const [flashcardDropTargetIndex, setFlashcardDropTargetIndex] = useState<number | null>(null);
  const [isFlashcardDragging, setIsFlashcardDragging] = useState(false);

  // Remove unused absolute positioning variables
  // const [quizPosition, setQuizPosition] = useState({ x: 100, y: 100 });
  // const [isQuizDragging, setIsQuizDragging] = useState(false);
  // const [quizDragOffset, setQuizDragOffset] = useState({ x: 0, y: 0 });
  // const quizRef = useRef<HTMLDivElement>(null);

  // Convert blocks to content for saving
  const getContentFromBlocks = useCallback((blocks: Block[]): string => {
    // Filter out transient UI state before saving
    const blocksToSave = blocks.map(block => {
      if (block.type === 'quiz') {
        // Save quiz without transient state
        const { currentQuestionIndex, quizResults, showResults, ...quizBlock } = block;
        return quizBlock;
      } else if (block.type === 'flashcards') {
        // Save flashcards without transient state
        const { currentCardIndex, isFlipped, isEditing, editingCardIndex, inlineEditingCardIndex, inlineEditingFront, inlineEditingBack, ...flashcardBlock } = block;
        return flashcardBlock;
      } else if (block.type === 'whiteboard') {
        // Save whiteboard without transient state
        const { isGenerating, ...whiteboardBlock } = block;
        return whiteboardBlock;
      } else if (block.type === 'calculator') {
        // Save calculator block as-is (no transient state)
        return block;
      } else if (block.type === 'row') {
        // Save row blocks with their nested blocks structure preserved
        const rowBlock = block as RowBlock;
        return {
          id: rowBlock.id,
          type: 'row',
          blocks: rowBlock.blocks.map(nestedBlock => {
            // Recursively save nested blocks (though nested rows are unlikely)
            if (nestedBlock.type === 'row') {
              const nestedRow = nestedBlock as RowBlock;
              return {
                id: nestedRow.id,
                type: 'row',
                blocks: nestedRow.blocks
              };
            }
            // For other nested block types, save them as-is
            return nestedBlock;
          })
        };
      }
      return block;
    });
    
    // Save as JSON format
    return JSON.stringify(blocksToSave);
  }, []);

  // Convert content to blocks
  const getBlocksFromContent = useCallback((content: string): Block[] => {
    if (!content || !content.trim()) {
      return [{ id: 'text-0', type: 'text', content: '' }];
    }
    
    // Try to parse as JSON (new format with quizzes/flashcards)
    try {
      const parsed = JSON.parse(content);
      console.log('Parsed content as JSON:', parsed);
      if (Array.isArray(parsed)) {
        // Handle empty array
        if (parsed.length === 0) {
          return [{ id: 'text-0', type: 'text', content: '' }];
        }
        // Restore blocks with default transient state
        const restoredBlocks = parsed.map((block: any, index: number) => {
          // Ensure block has required properties
          if (!block.id) {
            block.id = block.type === 'quiz' 
              ? `quiz-${Date.now()}-${index}`
              : block.type === 'flashcards'
              ? `flashcards-${Date.now()}-${index}`
              : block.type === 'calculator'
              ? `calculator-${Date.now()}-${index}`
              : `text-${index}`;
          }
          
          if (block.type === 'quiz') {
            return {
              id: block.id,
              type: 'quiz' as const,
              quiz: block.quiz || { title: '', questions: [] },
              currentQuestionIndex: 0,
              quizResults: [],
              showResults: false
            } as QuizBlock;
          } else if (block.type === 'flashcards') {
            // Ensure flashcards data exists
            if (!block.flashcards) {
              console.warn('Flashcard block missing flashcards data:', block);
              // Skip invalid flashcard blocks
              return null;
            }
            console.log('Restoring flashcard block:', block.id, 'with', block.flashcards.cards?.length || 0, 'cards');
             return {
               id: block.id,
               type: 'flashcards' as const,
               flashcards: block.flashcards,
               currentCardIndex: 0,
               isFlipped: false,
               isEditing: false,
               editingCardIndex: null,
               inlineEditingCardIndex: null,
               inlineEditingFront: '',
               inlineEditingBack: ''
             } as FlashcardBlock;
          } else if (block.type === 'whiteboard') {
            return {
              id: block.id,
              type: 'whiteboard' as const,
              canvasData: block.canvasData || null,
              prompt: block.prompt || '',
              isGenerating: false
            } as WhiteboardBlock;
          } else if (block.type === 'calculator') {
            return {
              id: block.id,
              type: 'calculator' as const,
              calculatorState: block.calculatorState, // Full calculator state (all expressions, equations, etc.)
              width: block.width || 600,
              height: block.height || 400
            } as DesmosBlock;
          } else if (block.type === 'text') {
            return {
              id: block.id,
              type: 'text' as const,
              content: block.content || ''
            } as TextBlock;
          } else if (block.type === 'row') {
            // Handle row blocks - recursively restore nested blocks
            if (!block.blocks || !Array.isArray(block.blocks)) {
              console.warn('Row block missing blocks array:', block);
              // Return empty row with empty text block
              return {
                id: block.id || `row-${Date.now()}`,
                type: 'row' as const,
                blocks: [{ id: 'text-0', type: 'text', content: '' }]
              } as RowBlock;
            }
            // Recursively restore nested blocks
            const nestedBlocks = block.blocks.map((nestedBlock: any, nestedIndex: number) => {
              // Recursively handle nested blocks
              if (nestedBlock.type === 'row') {
                // Nested row - handle recursively (though unlikely)
                return {
                  id: nestedBlock.id || `row-${Date.now()}-${nestedIndex}`,
                  type: 'row' as const,
                  blocks: nestedBlock.blocks || []
                } as RowBlock;
              } else if (nestedBlock.type === 'text') {
                return {
                  id: nestedBlock.id || `text-${nestedIndex}`,
                  type: 'text' as const,
                  content: nestedBlock.content || ''
                } as TextBlock;
              } else if (['paragraph', 'heading1', 'heading2', 'heading3', 'code', 'quote'].includes(nestedBlock.type)) {
                return {
                  id: nestedBlock.id || `${nestedBlock.type}-${nestedIndex}`,
                  type: nestedBlock.type,
                  content: nestedBlock.content || '',
                  children: nestedBlock.children || [],
                  collapsed: nestedBlock.collapsed || false,
                  level: nestedBlock.level || 0
                } as NotionBlock;
              } else {
                // Fallback for unknown nested block types
                return {
                  id: nestedBlock.id || `text-${nestedIndex}`,
                  type: 'text' as const,
                  content: typeof nestedBlock.content === 'string' ? nestedBlock.content : ''
                } as TextBlock;
              }
            });
            return {
              id: block.id || `row-${Date.now()}`,
              type: 'row' as const,
              blocks: nestedBlocks
            } as RowBlock;
          } else if (['paragraph', 'heading1', 'heading2', 'heading3', 'code', 'quote'].includes(block.type)) {
            // Handle NotionBlock types (paragraph, headings, code, quote)
            return {
              id: block.id,
              type: block.type,
              content: block.content || '',
              children: block.children || [],
              collapsed: block.collapsed || false,
              level: block.level || 0
            } as NotionBlock;
          }
          // Fallback for unknown types - check if it's a row block structure before stringifying
          if (block.type === 'row' || (block.blocks && Array.isArray(block.blocks))) {
            // It's a row block that wasn't recognized - restore it
            return {
              id: block.id || `row-${Date.now()}`,
              type: 'row' as const,
              blocks: block.blocks || []
            } as RowBlock;
          }
          // Fallback for unknown types - treat as text
          return {
            id: block.id || `text-${index}`,
            type: 'text' as const,
            content: typeof block.content === 'string' ? block.content : JSON.stringify(block)
          } as TextBlock;
        });
        
        console.log('Restored blocks:', restoredBlocks.length, 'blocks, including', 
          restoredBlocks.filter(b => b.type === 'flashcards').length, 'flashcard blocks');
        
        // Return empty text block if no valid blocks found
        return restoredBlocks.length > 0 ? restoredBlocks : [{ id: 'text-0', type: 'text', content: '' }];
      }
    } catch (e) {
      // Not JSON, handle as legacy text format
      console.log('Content is not JSON, treating as plain text:', e);
    }
    
    // Legacy format: plain text, split by double newlines
    const textBlocks = content.split('\n\n').map((text, index) => ({
      id: `text-${index}`,
      type: 'text' as const,
      content: text
    }));
    return textBlocks.length > 0 ? textBlocks : [{ id: 'text-0', type: 'text', content: '' }];
  }, []);

  // Initialize blocks from initial content
  useEffect(() => {
    if (initialContent.trim()) {
      setBlocks(getBlocksFromContent(initialContent));
    }
  }, [initialContent, getBlocksFromContent]);

  // Add quiz block when currentQuiz is provided
  useEffect(() => {
    console.log('Editor: currentQuiz changed:', currentQuiz);
    if (currentQuiz) {
      // Generate a unique ID using timestamp and random number to avoid duplicates
      const uniqueId = `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const quizBlock: QuizBlock = {
        id: uniqueId,
        type: 'quiz',
        quiz: currentQuiz,
        currentQuestionIndex: 0,
        quizResults: [],
        showResults: false
      };
      console.log('Editor: Adding quiz block to journal:', quizBlock.id, quizBlock);
      setBlocks(prev => [...prev, quizBlock]);
      setFocusedBlockId(quizBlock.id);
      console.log('Added quiz block to journal:', quizBlock.id);
      // Notify parent that quiz has been added
      onQuizAdded?.();
    }
  }, [currentQuiz, onQuizAdded]);

  // Add flashcards block when currentFlashcards is provided
  useEffect(() => {
    console.log('Editor: currentFlashcards changed:', currentFlashcards);
    if (currentFlashcards) {
      // Generate a unique ID using timestamp and random number to avoid duplicates
      const uniqueId = `flashcards-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const flashcardsBlock: FlashcardBlock = {
        id: uniqueId,
        type: 'flashcards',
        flashcards: currentFlashcards,
        currentCardIndex: 0,
        isFlipped: false,
        isEditing: false,
        editingCardIndex: null,
        inlineEditingCardIndex: null,
        inlineEditingFront: '',
        inlineEditingBack: ''
      };
      console.log('Editor: Adding flashcards block to journal:', flashcardsBlock.id, flashcardsBlock);
      setBlocks(prev => [...prev, flashcardsBlock]);
      setFocusedBlockId(flashcardsBlock.id);
      console.log('Added flashcards block to journal:', flashcardsBlock.id, 'with', flashcardsBlock.flashcards.cards.length, 'cards');
      // Notify parent that flashcards have been added
      onFlashcardsAdded?.();
    }
  }, [currentFlashcards, onFlashcardsAdded]);

  // Auto-save blocks
  useEffect(() => {
    if (!journalId) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!journalId) return;
      
      // Get user for security check
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('Cannot save: user not authenticated');
        return;
      }

      const content = getContentFromBlocks(blocks);
      console.log('Auto-saving journal', journalId, 'with', blocks.length, 'blocks:', blocks.map(b => ({ id: b.id, type: b.type })));
      
      // SECURITY: Verify ownership before updating
      const { error } = await supabase
        .from("journals")
        .update({ content })
        .eq("id", journalId)
        .eq("user_id", user.id); // Only update if user owns it

      if (error) {
        console.error('Error saving journal:', error);
        toast({ title: "Error saving", variant: "destructive" });
      } else {
        console.log('Successfully saved journal', journalId);
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [blocks, journalId, getContentFromBlocks]);

  // Calculate word count
  useEffect(() => {
    const textBlocks = blocks.filter(block => block.type === 'text') as TextBlock[];
    const totalWords = textBlocks.reduce((count, block) => {
      const words = block.content.trim().split(/\s+/).filter(word => word.length > 0);
      return count + words.length;
    }, 0);

    if (onWordCountChange) {
      onWordCountChange(totalWords);
    }
  }, [blocks, onWordCountChange]);

  // Handle Ctrl+A (Cmd+A) to select all blocks
  useEffect(() => {
    const handleSelectAll = (event: KeyboardEvent) => {
      // Check for Ctrl+A (Windows/Linux) or Cmd+A (Mac)
      if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
        // Check if user is typing in an input, textarea, or contentEditable
        const target = event.target as HTMLElement;
        const isTyping = 
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          (target.isContentEditable && target.closest('[contenteditable="true"]'));
        
        // Only prevent default if NOT typing in an editable element
        // This allows normal text selection (Ctrl+A) when typing
        if (!isTyping) {
          event.preventDefault();

          // Select all blocks
          const allBlockIds = new Set(blocks.map(block => block.id));
          setSelectedBlockIds(allBlockIds);

          // Clear any text selection
          const selection = window.getSelection();
          selection?.removeAllRanges();
        }
        // If typing, let the default behavior happen (select all text in the editable element)
      }
    };

    document.addEventListener('keydown', handleSelectAll);
    return () => document.removeEventListener('keydown', handleSelectAll);
  }, [blocks]);

  // Handle Escape to clear block selection
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedBlockIds.size > 0) {
        setSelectedBlockIds(new Set());
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedBlockIds.size]);

  // Handle Delete key for selected blocks
  useEffect(() => {
    const handleDelete = (event: KeyboardEvent) => {
      if (event.key === 'Delete' && selectedBlockIds.size > 0) {
        event.preventDefault();

        // Delete all selected blocks, but keep at least one block
        setBlocks(prev => {
          const remainingBlocks = prev.filter(block => !selectedBlockIds.has(block.id));

          // If no blocks remain, create an empty paragraph block
          if (remainingBlocks.length === 0) {
            return [{ id: `paragraph-${Date.now()}`, type: 'paragraph', content: '', children: [], collapsed: false }];
          }

          return remainingBlocks;
        });

        setSelectedBlockIds(new Set());
      }
    };

    document.addEventListener('keydown', handleDelete);
    return () => document.removeEventListener('keydown', handleDelete);
  }, [selectedBlockIds]);

  // Keyboard navigation for flashcards
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Don't handle keyboard events when user is typing in input fields
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true' ||
        activeElement.closest('[data-chat-input]')
      )) {
        return;
      }

      // Find active flashcard block in study mode (not editing)
      const activeFlashcardBlock = blocks.find(block =>
        block.type === 'flashcards' &&
        !(block as FlashcardBlock).isEditing
      ) as FlashcardBlock | undefined;

      if (!activeFlashcardBlock) return;

      const flashcardsBlock = activeFlashcardBlock;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          if (flashcardsBlock.currentCardIndex > 0) {
            setBlocks(prev => prev.map(b =>
              b.id === flashcardsBlock.id && b.type === 'flashcards'
                ? { ...b, currentCardIndex: flashcardsBlock.currentCardIndex - 1, isFlipped: false }
                : b
            ));
          }
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (flashcardsBlock.currentCardIndex < flashcardsBlock.flashcards.cards.length - 1) {
            setBlocks(prev => prev.map(b =>
              b.id === flashcardsBlock.id && b.type === 'flashcards'
                ? { ...b, currentCardIndex: flashcardsBlock.currentCardIndex + 1, isFlipped: false }
                : b
            ));
          }
          break;
        case ' ': // Spacebar to flip card
        case 'Enter':
          event.preventDefault();
          setBlocks(prev => prev.map(b =>
            b.id === flashcardsBlock.id && b.type === 'flashcards'
              ? { ...b, isFlipped: !flashcardsBlock.isFlipped }
              : b
          ));
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [blocks]);

  // Transform block function
  const transformBlock = useCallback((blockId: string, newType: BlockType, optionalProps?: Partial<BaseBlock>) => {
    setBlocks(prev => prev.map(block => {
      if (block.id === blockId) {
        // Preserve the block's text content, removing any slash command prefix
        let preservedContent = (block as NotionBlock).content || '';
        if (preservedContent.startsWith('/')) {
          // Find the first space after the slash command and keep text after it
          const spaceIndex = preservedContent.indexOf(' ');
          if (spaceIndex > 0) {
            preservedContent = preservedContent.substring(spaceIndex + 1);
          } else {
            // If no space, the content was just the command, so make it empty
            preservedContent = '';
          }
        }

        return {
          ...block,
          type: newType,
          content: preservedContent,
          ...optionalProps
        } as NotionBlock;
      }
      return block;
    }));
  }, []);

  // Slash command handlers
  const handleSlashCommand = useCallback((command: SlashCommand) => {
    if (!slashCommand) return;

    // Special handling for calculator - create calculator block immediately
    if (command.command === 'calculator') {
      const calculatorBlock: DesmosBlock = {
        id: `calculator-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'calculator',
        width: 600,
        height: 400
      };
      setBlocks(prev => prev.map(block => {
        if (block.id === slashCommand.blockId) {
          return calculatorBlock;
        }
        return block;
      }));
      setSlashCommand(null);
      return;
    }

    // Special handling for quiz and flashcards - allow continued typing
    if (command.command === 'quiz' || command.command === 'flashcards') {
      const blockElement = document.querySelector(`[data-block-id="${slashCommand.blockId}"]`) as HTMLElement;
      if (blockElement) {
        // Replace content with "/quiz " or "/flashcards " and position cursor
        const commandText = `/${command.command} `;
        
        // Update block content in state first
        setBlocks(prev => prev.map(block => {
          if (block.id === slashCommand.blockId) {
            return {
              ...block,
              content: commandText
            } as NotionBlock;
          }
          return block;
        }));
        
        // Update DOM content using textContent (preserves contentEditable functionality)
        // Use double requestAnimationFrame to ensure DOM is fully updated
        requestAnimationFrame(() => {
          blockElement.textContent = commandText;
          
          // Set cursor position after the space in the next frame
          requestAnimationFrame(() => {
            const range = document.createRange();
            const selection = window.getSelection();
            
            // Get the first text node (should be the only one after textContent assignment)
            const textNode = blockElement.firstChild;
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
              range.setStart(textNode, commandText.length);
              range.collapse(true);
            } else {
              // Fallback: select at end of element
              range.selectNodeContents(blockElement);
              range.collapse(false);
            }
            
            selection?.removeAllRanges();
            selection?.addRange(range);
            
            // Ensure element is focused and ready for input
            blockElement.focus();
          });
        });
        
        // Keep slash command open so user can continue typing
        // Don't close it - user will press Enter to generate
        // The dropdown will be hidden by SlashCommandMenu when filter starts with 'quiz ' or 'flashcards '
        return;
      }
    }

    // For other commands, transform the block immediately
    transformBlock(slashCommand.blockId, command.type);

    // Close dropdown after state update
    setSlashCommand(null);
  }, [slashCommand, transformBlock, setBlocks]);

  const openSlashCommand = useCallback((blockId: string, position: { top: number; left: number }, filter: string = '') => {
    setSlashCommand({
      isOpen: true,
      position,
      filter,
      blockId
    });
  }, []);

  const closeSlashCommand = useCallback(() => {
    setSlashCommand(null);
  }, []);

  const updateSlashFilter = useCallback((filter: string) => {
    if (slashCommand) {
      setSlashCommand(prev => prev ? { ...prev, filter } : null);
    }
  }, [slashCommand]);

  // @ command handlers
  const handleAtCommand = useCallback((command: AtCommand, blockId: string, startOffset: number) => {
    const blockElement = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
    if (!blockElement) {
      setAtCommand(null);
      setAtCommandSelectedIndex(0);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setAtCommand(null);
      setAtCommandSelectedIndex(0);
      return;
    }

    const textContent = blockElement.textContent || '';
    const beforeCursor = textContent.substring(0, startOffset);
    const atIndex = beforeCursor.lastIndexOf('@');
    
    if (atIndex === -1) {
      setAtCommand(null);
      setAtCommandSelectedIndex(0);
      return;
    }

    // Get the current range
    const range = selection.getRangeAt(0);
    
    // Find the text node containing the @
    const walker = document.createTreeWalker(
      blockElement,
      NodeFilter.SHOW_TEXT,
      null
    );

    let textNode: Text | null = null;
    let currentOffset = 0;
    let nodeStartOffset = 0;
    
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const nodeLength = node.textContent?.length || 0;
      
      if (currentOffset + nodeLength > atIndex) {
        textNode = node;
        nodeStartOffset = currentOffset;
        break;
      }
      
      currentOffset += nodeLength;
    }

    if (!textNode) {
      setAtCommand(null);
      setAtCommandSelectedIndex(0);
      return;
    }

    // Get text before @ and after cursor
    const textBeforeAt = textContent.substring(0, atIndex);
    const textAfterCursor = textContent.substring(startOffset);
    
    // Create command chip element
    const chipSpan = document.createElement('span');
    chipSpan.className = 'inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-sm font-medium mr-1';
    chipSpan.setAttribute('data-command', command.command);
    chipSpan.setAttribute('data-is-command', 'true');
    chipSpan.setAttribute('contenteditable', 'false');
    chipSpan.textContent = `@${command.command}`;

    // Create a range to replace @command text
    const replaceRange = document.createRange();
    
    // Find the start position (at @)
    const atOffsetInNode = atIndex - nodeStartOffset;
    replaceRange.setStart(textNode, atOffsetInNode);
    
    // Find the end position (at cursor)
    let endOffset = startOffset;
    let endNode: Text | null = null;
    let endNodeStartOffset = 0;
    
    const endWalker = document.createTreeWalker(
      blockElement,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    currentOffset = 0;
    while (endWalker.nextNode()) {
      const node = endWalker.currentNode as Text;
      const nodeLength = node.textContent?.length || 0;
      
      if (currentOffset + nodeLength >= endOffset) {
        endNode = node;
        endNodeStartOffset = currentOffset;
        break;
      }
      
      currentOffset += nodeLength;
    }

    if (endNode) {
      const endOffsetInNode = endOffset - endNodeStartOffset;
      replaceRange.setEnd(endNode, endOffsetInNode);
    } else {
      replaceRange.setEnd(textNode, textNode.textContent?.length || 0);
    }

    // Delete the @command text
    replaceRange.deleteContents();
    
    // Insert the chip
    replaceRange.insertNode(chipSpan);
    
    // Create a text node after the chip for the cursor and user input
    // Start with a space, then user can type their prompt
    const cursorTextNode = document.createTextNode(' ');
    if (chipSpan.nextSibling) {
      chipSpan.parentNode?.insertBefore(cursorTextNode, chipSpan.nextSibling);
    } else {
      chipSpan.parentNode?.appendChild(cursorTextNode);
    }

    // Update block content
    const newHtmlContent = blockElement.innerHTML;
    setBlocks(prev => prev.map(b =>
      b.id === blockId ? { ...b, content: newHtmlContent } as NotionBlock : b
    ));

    // Place cursor in the text node after the chip (outside the chip)
    setTimeout(() => {
      const newRange = document.createRange();
      const newSelection = window.getSelection();
      
      // Place cursor at the end of the text node (after the space, ready for user input)
      if (cursorTextNode && cursorTextNode.parentNode && cursorTextNode.textContent) {
        newRange.setStart(cursorTextNode, cursorTextNode.textContent.length);
        newRange.collapse(true);
      } else {
        // Fallback: create a new text node after the chip
        const fallbackTextNode = document.createTextNode('');
        if (chipSpan.nextSibling) {
          chipSpan.parentNode?.insertBefore(fallbackTextNode, chipSpan.nextSibling);
        } else {
          chipSpan.parentNode?.appendChild(fallbackTextNode);
        }
        newRange.setStart(fallbackTextNode, 0);
        newRange.collapse(true);
      }
      
      newSelection?.removeAllRanges();
      newSelection?.addRange(newRange);
      blockElement.focus();
    }, 0);

    setAtCommand(null);
    setAtCommandSelectedIndex(0);
  }, [blocks, setBlocks]);

  const openAtCommand = useCallback((blockId: string, position: { top: number; left: number }, startOffset: number) => {
    setAtCommand({
      isOpen: true,
      position,
      filter: '',
      blockId,
      startOffset
    });
    setAtCommandSelectedIndex(0);
  }, []);

  const closeAtCommand = useCallback(() => {
    setAtCommand(null);
    setAtCommandSelectedIndex(0);
  }, []);

  const updateAtFilter = useCallback((filter: string) => {
    if (atCommand) {
      setAtCommand(prev => prev ? { ...prev, filter } : null);
      setAtCommandSelectedIndex(0);
    }
  }, [atCommand]);

  // Drag and drop handlers
  const handleDragStart = useCallback((block: Block, index: number) => {
    setDraggedBlock(block);
    setDraggedIndex(index);
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedBlock(null);
    setDraggedIndex(null);
    setDropTargetIndex(null);
    setHorizontalDropTarget(null);
    setIsDragging(false);
  }, []);

  // Helper function to check if block is a row
  const isRowBlock = (block: Block): block is RowBlock => {
    return block.type === 'row';
  };

  // Helper function to get blocks in a flat list (unwrapping rows)
  const getFlatBlocks = useCallback((blocksList: Block[]): Block[] => {
    const flat: Block[] = [];
    blocksList.forEach(block => {
      if (isRowBlock(block)) {
        flat.push(...block.blocks);
      } else {
        flat.push(block);
      }
    });
    return flat;
  }, []);

  // Helper function to collapse row if it has only 1 block
  const collapseRowIfNeeded = useCallback((blocksList: Block[]): Block[] => {
    return blocksList.map(block => {
      if (isRowBlock(block) && block.blocks.length === 1) {
        // Unwrap the row, return the single block
        return block.blocks[0];
      }
      return block;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number, block?: Block) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedIndex === null || draggedBlock === null) return;

    // Check if dragging over a block (not drop zone)
    if (block && draggedIndex !== index) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mouseX = e.clientX;
      const blockCenterX = rect.left + rect.width / 2;
      
      // Determine if we're on left or right half
      const side = mouseX < blockCenterX ? 'left' : 'right';
      
      // Check if target block is already a row
      if (isRowBlock(block)) {
        // Can only drop if row has less than 3 blocks
        if (block.blocks.length < 3) {
          setHorizontalDropTarget({ blockIndex: index, side });
          setDropTargetIndex(null);
        }
      } else {
        // Show horizontal drop indicator
        setHorizontalDropTarget({ blockIndex: index, side });
        setDropTargetIndex(null);
      }
    } else {
      // Vertical drop zone
      if (draggedIndex !== index) {
        setDropTargetIndex(index);
        setHorizontalDropTarget(null);
      }
    }
  }, [draggedIndex, draggedBlock]);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number, block?: Block) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedBlock || draggedIndex === null) {
      handleDragEnd();
      return;
    }

    const newBlocks = [...blocks];
    
    // Handle horizontal drop (creating/adding to row)
    if (horizontalDropTarget && block) {
      const targetIndex = horizontalDropTarget.blockIndex;
      const targetBlock = newBlocks[targetIndex];
      
      // Remove dragged block first
      const actualDraggedIndex = draggedIndex < targetIndex ? draggedIndex : draggedIndex;
      const draggedBlockToMove = newBlocks[actualDraggedIndex];
      newBlocks.splice(actualDraggedIndex, 1);
      
      // Adjust target index if we removed a block before it
      const adjustedTargetIndex = actualDraggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
      
      if (isRowBlock(targetBlock)) {
        // Add to existing row
        const insertIndex = horizontalDropTarget.side === 'left' ? 0 : targetBlock.blocks.length;
        const updatedRow: RowBlock = {
          ...targetBlock,
          blocks: [
            ...targetBlock.blocks.slice(0, insertIndex),
            draggedBlockToMove,
            ...targetBlock.blocks.slice(insertIndex)
          ]
        };
        newBlocks[adjustedTargetIndex] = updatedRow;
      } else {
        // Create new row
        const newRow: RowBlock = {
          id: `row-${Date.now()}`,
          type: 'row',
          blocks: horizontalDropTarget.side === 'left' 
            ? [draggedBlockToMove, targetBlock]
            : [targetBlock, draggedBlockToMove]
        };
        newBlocks[adjustedTargetIndex] = newRow;
      }
    } else {
      // Handle vertical drop
      if (draggedIndex !== dropIndex) {
        // Remove dragged block
        newBlocks.splice(draggedIndex, 1);
        // Adjust drop index if we removed a block before it
        const adjustedDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
        // Insert at new position
        newBlocks.splice(adjustedDropIndex, 0, draggedBlock);
      }
    }

    // Collapse rows with only 1 block
    const collapsedBlocks = collapseRowIfNeeded(newBlocks);
    setBlocks(collapsedBlocks);
    handleDragEnd();
  }, [blocks, draggedBlock, draggedIndex, horizontalDropTarget, handleDragEnd, collapseRowIfNeeded]);

  // Function to parse text content and convert to blocks
  const parseContentToBlocks = useCallback((content: string): NotionBlock[] => {
    if (!content || typeof content !== 'string') {
      return [];
    }
    const lines = content.split('\n');
    const newBlocks: NotionBlock[] = [];
    let currentParagraph: string[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let codeLanguage = '';
    
    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const paraText = currentParagraph.join(' ').trim();
        if (paraText) {
          newBlocks.push({
            id: `paragraph-${Date.now()}-${newBlocks.length}`,
            type: 'paragraph',
            content: paraText,
            children: [],
            collapsed: false
          });
        }
        currentParagraph = [];
      }
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Handle code blocks
      if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          newBlocks.push({
            id: `code-${Date.now()}-${newBlocks.length}`,
            type: 'code',
            content: codeContent.join('\n'),
            children: [],
            collapsed: false
          });
          codeContent = [];
          inCodeBlock = false;
          codeLanguage = '';
        } else {
          // Start of code block
          flushParagraph();
          inCodeBlock = true;
          codeLanguage = trimmed.substring(3).trim();
        }
        continue;
      }
      
      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }
      
      // Detect headings
      if (trimmed.startsWith('# ')) {
        flushParagraph();
        newBlocks.push({
          id: `heading1-${Date.now()}-${newBlocks.length}`,
          type: 'heading1',
          content: trimmed.substring(2).trim(),
          children: [],
          collapsed: false
        });
      } else if (trimmed.startsWith('## ')) {
        flushParagraph();
        newBlocks.push({
          id: `heading2-${Date.now()}-${newBlocks.length}`,
          type: 'heading2',
          content: trimmed.substring(3).trim(),
          children: [],
          collapsed: false
        });
      } else if (trimmed.startsWith('### ')) {
        flushParagraph();
        newBlocks.push({
          id: `heading3-${Date.now()}-${newBlocks.length}`,
          type: 'heading3',
          content: trimmed.substring(4).trim(),
          children: [],
          collapsed: false
        });
      } else if (trimmed.startsWith('> ')) {
        // Quote
        flushParagraph();
        newBlocks.push({
          id: `quote-${Date.now()}-${newBlocks.length}`,
          type: 'quote',
          content: trimmed.substring(2).trim(),
          children: [],
          collapsed: false
        });
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        // Bullet list
        flushParagraph();
        newBlocks.push({
          id: `bullet-${Date.now()}-${newBlocks.length}`,
          type: 'bulletList',
          content: trimmed.substring(2).trim(),
          children: [],
          collapsed: false
        });
      } else if (/^\d+\.\s/.test(trimmed)) {
        // Numbered list
        flushParagraph();
        newBlocks.push({
          id: `numbered-${Date.now()}-${newBlocks.length}`,
          type: 'numberedList',
          content: trimmed.replace(/^\d+\.\s/, '').trim(),
          children: [],
          collapsed: false
        });
      } else if (trimmed === '---' || trimmed === '***') {
        // Divider
        flushParagraph();
        newBlocks.push({
          id: `divider-${Date.now()}-${newBlocks.length}`,
          type: 'divider',
          content: '',
          children: [],
          collapsed: false
        });
      } else if (trimmed === '') {
        // Empty line - flush current paragraph
        flushParagraph();
      } else {
        // Regular text - add to current paragraph
        currentParagraph.push(trimmed);
      }
    }
    
    // Flush any remaining paragraph
    flushParagraph();
    
    return newBlocks.length > 0 ? newBlocks : [{
      id: `paragraph-${Date.now()}`,
      type: 'paragraph',
      content: content.trim(),
      children: [],
      collapsed: false
    }];
  }, []);

  // Function to clean markdown and convert to formatted content
  // Follows journal formatting rules: NO asterisks, use HTML tags instead
  const cleanMarkdownForJournal = useCallback((text: string): string => {
    let cleaned = text;
    
    // Step 1: Convert markdown bold (**text**) to <strong>text</strong>
    // Handle multiple bold sections in one line
    cleaned = cleaned.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    
    // Step 2: Convert markdown italic (*text*) to <em>text</em>
    // Only match single asterisks that aren't part of bold markers
    // Use negative lookbehind/lookahead to avoid matching **
    cleaned = cleaned.replace(/(?<!\*)\*([^*\s][^*]*?[^*\s])\*(?!\*)/g, '<em>$1</em>');
    cleaned = cleaned.replace(/(?<!\*)\*([^*\s])\*(?!\*)/g, '<em>$1</em>'); // Single char italic
    
    // Step 3: Remove any remaining asterisks (shouldn't be any, but safety check)
    // But preserve asterisks in code blocks or URLs
    cleaned = cleaned.replace(/\*+/g, '');
    
    // Step 4: Clean up any double spaces that might result
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    
    // Step 5: Trim whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
  }, []);

  // Expose insert content function via callback
  const insertContent = useCallback((content: string | null | undefined) => {
    if (!content || typeof content !== 'string') {
      return;
    }
    
    // Clean and format the content according to journal formatting rules
    const trimmedContent = content.trim();
    
    if (!trimmedContent) {
      return;
    }
    
    // Parse markdown and create proper blocks
    const lines = trimmedContent.split('\n');
    const newBlocks: NotionBlock[] = [];
    let currentParagraph: string[] = [];
    
    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const paraText = currentParagraph.join(' ').trim();
        if (paraText) {
          // Clean markdown from paragraph text
          const cleanedText = cleanMarkdownForJournal(paraText);
          newBlocks.push({
            id: `paragraph-${Date.now()}-${newBlocks.length}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'paragraph' as BlockType,
            content: cleanedText,
            children: [],
            collapsed: false
          });
        }
        currentParagraph = [];
      }
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Handle headings
      if (trimmed.startsWith('# ')) {
        flushParagraph();
        const headingText = cleanMarkdownForJournal(trimmed.substring(2).trim());
        newBlocks.push({
          id: `heading1-${Date.now()}-${newBlocks.length}-${Math.random().toString(36).substr(2, 5)}`,
          type: 'heading1' as BlockType,
          content: headingText,
          children: [],
          collapsed: false
        });
      } else if (trimmed.startsWith('## ')) {
        flushParagraph();
        const headingText = cleanMarkdownForJournal(trimmed.substring(3).trim());
        newBlocks.push({
          id: `heading2-${Date.now()}-${newBlocks.length}-${Math.random().toString(36).substr(2, 5)}`,
          type: 'heading2' as BlockType,
          content: headingText,
          children: [],
          collapsed: false
        });
      } else if (trimmed.startsWith('### ')) {
        flushParagraph();
        const headingText = cleanMarkdownForJournal(trimmed.substring(4).trim());
        newBlocks.push({
          id: `heading3-${Date.now()}-${newBlocks.length}-${Math.random().toString(36).substr(2, 5)}`,
          type: 'heading3' as BlockType,
          content: headingText,
          children: [],
          collapsed: false
        });
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        // Bullet list
        flushParagraph();
        const listText = cleanMarkdownForJournal(trimmed.substring(2).trim());
        newBlocks.push({
          id: `bullet-${Date.now()}-${newBlocks.length}-${Math.random().toString(36).substr(2, 5)}`,
          type: 'bulletList' as BlockType,
          content: listText,
          children: [],
          collapsed: false
        });
      } else if (/^\d+\.\s/.test(trimmed)) {
        // Numbered list
        flushParagraph();
        const listText = cleanMarkdownForJournal(trimmed.replace(/^\d+\.\s/, '').trim());
        newBlocks.push({
          id: `numbered-${Date.now()}-${newBlocks.length}-${Math.random().toString(36).substr(2, 5)}`,
          type: 'numberedList' as BlockType,
          content: listText,
          children: [],
          collapsed: false
        });
      } else if (trimmed.startsWith('> ')) {
        // Quote
        flushParagraph();
        const quoteText = cleanMarkdownForJournal(trimmed.substring(2).trim());
        newBlocks.push({
          id: `quote-${Date.now()}-${newBlocks.length}-${Math.random().toString(36).substr(2, 5)}`,
          type: 'quote' as BlockType,
          content: quoteText,
          children: [],
          collapsed: false
        });
      } else if (trimmed === '' || trimmed === '---' || trimmed === '***') {
        // Empty line or divider - flush current paragraph
        flushParagraph();
        if (trimmed === '---' || trimmed === '***') {
          newBlocks.push({
            id: `divider-${Date.now()}-${newBlocks.length}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'divider' as BlockType,
            content: '',
            children: [],
            collapsed: false
          });
        }
      } else {
        // Regular text - add to current paragraph
        currentParagraph.push(trimmed);
      }
    }
    
    // Flush any remaining paragraph
    flushParagraph();
    
    // If no blocks were created, create at least one paragraph
    if (newBlocks.length === 0) {
      const cleanedText = cleanMarkdownForJournal(trimmedContent);
      newBlocks.push({
        id: `paragraph-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'paragraph' as BlockType,
        content: cleanedText,
        children: [],
        collapsed: false
      });
    }
    
    setBlocks(prev => [...prev, ...newBlocks]);
    
    // Focus the last new block
    if (newBlocks.length > 0) {
      setTimeout(() => {
        setFocusedBlockId(newBlocks[newBlocks.length - 1].id);
      }, 100);
    }
  }, [cleanMarkdownForJournal]);

  useEffect(() => {
    if (onInsertContentReady) {
      onInsertContentReady(insertContent);
    }
  }, [onInsertContentReady]); // Only depend on onInsertContentReady, not insertContent

  // Block manipulation
  const updateTextBlock = useCallback((blockId: string, newContent: string) => {
    setBlocks(prev => prev.map(block =>
      block.id === blockId && block.type === 'text'
        ? { ...block, content: newContent }
        : block
    ));
  }, []);

  const addNewBlock = useCallback((afterIndex: number, type: BlockType = 'paragraph') => {
    const newBlockId = `${type}-${Date.now()}`;
    const newBlock: NotionBlock = {
      id: newBlockId,
      type,
      content: '',
      children: [],
      collapsed: false
    };

    setBlocks(prev => {
      const newBlocks = [...prev];
      newBlocks.splice(afterIndex + 1, 0, newBlock);
      return newBlocks;
    });

    // Focus the new block and place cursor at the beginning
    setTimeout(() => {
      setFocusedBlockId(newBlockId);
      const newBlockElement = document.querySelector(`[data-block-id="${newBlockId}"]`) as HTMLElement;
      if (newBlockElement) {
        newBlockElement.focus();
        // For contenteditable, place cursor at the beginning
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(newBlockElement);
        range.collapse(true); // true = beginning of content
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }, 0);
  }, []);

  const deleteBlock = useCallback((blockId: string) => {
    setBlocks(prev => {
      if (prev.length <= 1) return prev; // Keep at least one block

      const blockIndex = prev.findIndex(block => block.id === blockId);
      let newBlocks = prev.filter(block => block.id !== blockId);

      // If the previous block is also empty, delete it too for smoother editing
      if (blockIndex > 0) {
        const prevBlock = prev[blockIndex - 1];
        if (!prevBlock.content && newBlocks.length > 1) {
          // Find the new index of the previous block in the filtered array
          const prevBlockIndex = newBlocks.findIndex(block => block.id === prevBlock.id);
          if (prevBlockIndex >= 0) {
            newBlocks = newBlocks.filter(block => block.id !== prevBlock.id);
          }
        }
      }

      // Focus the appropriate block
      let blockToFocusId = null;
      if (blockIndex > 0) {
        // Try to find the previous block in the new array
        const prevBlock = prev[blockIndex - 1];
        const prevBlockStillExists = newBlocks.some(block => block.id === prevBlock.id);
        if (prevBlockStillExists) {
          blockToFocusId = prevBlock.id;
        } else if (newBlocks.length > 0) {
          // If previous block was also deleted, focus the one before that
          const newBlockIndex = Math.max(0, blockIndex - 2);
          blockToFocusId = newBlocks[Math.min(newBlockIndex, newBlocks.length - 1)].id;
        }
      }

      if (blockToFocusId) {
        setTimeout(() => {
          setFocusedBlockId(blockToFocusId);
          const blockElement = document.querySelector(`[data-block-id="${blockToFocusId}"]`) as HTMLElement;
          if (blockElement) {
            blockElement.focus();
            // For contenteditable, place cursor at the end
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(blockElement);
            range.collapse(false); // false = end of content
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        }, 0);
      }

      return newBlocks;
    });
  }, []);

  // Quiz handlers
  const handleQuizAnswer = useCallback((blockId: string, selectedAnswer: number) => {
    setBlocks(prev => prev.map(block => {
      if (block.id === blockId && block.type === 'quiz') {
        const quizBlock = block as QuizBlock;
        const currentQuestion = quizBlock.quiz.questions[quizBlock.currentQuestionIndex];
        const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

        const result: QuizResult = {
          questionIndex: quizBlock.currentQuestionIndex,
          userAnswer: selectedAnswer,
          correctAnswer: currentQuestion.correctAnswer,
          isCorrect
        };

        const newResults = [...quizBlock.quizResults, result];
        const nextQuestionIndex = quizBlock.currentQuestionIndex + 1;
        const showResults = nextQuestionIndex >= quizBlock.quiz.questions.length;

        return {
          ...quizBlock,
          currentQuestionIndex: showResults ? quizBlock.currentQuestionIndex : nextQuestionIndex,
          quizResults: newResults,
          showResults
        };
      }
      return block;
    }));
  }, []);

  const handleExitQuiz = useCallback((blockId: string) => {
    deleteBlock(blockId);
  }, [deleteBlock]);

  // Content change handler for quiz overlay
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Update word count
    const words = newContent.trim().split(/\s+/).filter(word => word.length > 0);
    if (onWordCountChange) {
      onWordCountChange(words.length);
    }
  }, [onWordCountChange]);

  // Quiz drag handlers for snapping
  const handleQuizDragStart = useCallback((quizBlock: QuizBlock, blockIndex: number) => {
    setDraggedQuiz(quizBlock);
    setIsQuizDragging(true);
  }, []);

  const handleQuizDragEnd = useCallback(() => {
    // Clean up drag state - actual insertion happens in handleQuizDrop
    setDraggedQuiz(null);
    setQuizDropTargetIndex(null);
    setIsQuizDragging(false);
  }, []);

  const handleQuizDragOver = useCallback((e: React.DragEvent, blockIndex: number) => {
    e.preventDefault();
    if (isQuizDragging) {
      setQuizDropTargetIndex(blockIndex);
    }
  }, [isQuizDragging]);

  // Quiz drop handler
  const handleQuizDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedQuiz && dropIndex !== null) {
      setBlocks(prev => {
        const newBlocks = [...prev];
        // Remove from current position
        const currentIndex = newBlocks.findIndex(block => block.id === draggedQuiz.id);
        if (currentIndex !== -1) {
          newBlocks.splice(currentIndex, 1);
        }
        // Insert at target position
        newBlocks.splice(dropIndex, 0, draggedQuiz);
        return newBlocks;
      });
    }

    setDraggedQuiz(null);
    setQuizDropTargetIndex(null);
    setIsQuizDragging(false);
  }, [draggedQuiz]);

  // Flashcard drag handlers
  const handleFlashcardDragStart = useCallback((flashcardBlock: FlashcardBlock, blockIndex: number) => {
    setDraggedFlashcard(flashcardBlock);
    setIsFlashcardDragging(true);
  }, []);

  const handleFlashcardDragEnd = useCallback(() => {
    setDraggedFlashcard(null);
    setFlashcardDropTargetIndex(null);
    setIsFlashcardDragging(false);
  }, []);

  const handleFlashcardDragOver = useCallback((e: React.DragEvent, blockIndex: number) => {
    e.preventDefault();
    if (isFlashcardDragging) {
      setFlashcardDropTargetIndex(blockIndex);
    }
  }, [isFlashcardDragging]);

  const handleFlashcardDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedFlashcard && dropIndex !== null) {
      setBlocks(prev => {
        const newBlocks = [...prev];
        // Remove from current position
        const currentIndex = newBlocks.findIndex(block => block.id === draggedFlashcard.id);
        if (currentIndex !== -1) {
          newBlocks.splice(currentIndex, 1);
        }
        // Insert at target position
        newBlocks.splice(dropIndex, 0, draggedFlashcard);
        return newBlocks;
      });
    }

    setDraggedFlashcard(null);
    setFlashcardDropTargetIndex(null);
    setIsFlashcardDragging(false);
  }, [draggedFlashcard]);

  // Selection tracking for formatting toolbar
  const checkSelection = useCallback(() => {
    // Don't close if user is interacting with toolbar
    if (toolbarInteractionRef.current) {
      return;
    }

    // Don't check selection if active element is within Desmos
    const activeElement = document.activeElement;
    if (activeElement && (
      activeElement.closest('[data-desmos-calculator]') ||
      activeElement.closest('.dcg-container') ||
      activeElement.closest('.dcg-expression') ||
      activeElement.closest('.dcg-keypad') ||
      activeElement.closest('.dcg-expression-list') ||
      activeElement.closest('.dcg-popover') ||
      activeElement.closest('iframe')
    )) {
      return;
    }

    // Clear any pending close timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // Delay closing to prevent premature dismissal
      closeTimeoutRef.current = setTimeout(() => {
        if (!toolbarInteractionRef.current) {
          setFormattingToolbar(null);
        }
      }, 150);
      return;
    }

    const range = selection.getRangeAt(0);
    
    // Don't check if selection is within Desmos calculator
    const commonAncestor = range.commonAncestorContainer;
    const element = commonAncestor.nodeType === Node.ELEMENT_NODE 
      ? commonAncestor as Element 
      : (commonAncestor.parentElement as Element);
    
    if (element && (
      element.closest('[data-desmos-calculator]') ||
      element.closest('.dcg-container') ||
      element.closest('.dcg-expression') ||
      element.closest('.dcg-keypad') ||
      element.closest('.dcg-expression-list') ||
      element.closest('.dcg-popover') ||
      element.closest('iframe')
    )) {
      return;
    }
    
    const selectedText = range.toString().trim();

    // Only show toolbar if there's actual selected text
    if (!selectedText || range.collapsed) {
      // Delay closing to prevent premature dismissal
      closeTimeoutRef.current = setTimeout(() => {
        if (!toolbarInteractionRef.current) {
          setFormattingToolbar(null);
        }
      }, 150);
      return;
    }

    // Check if selection is within an editable block
    const container = range.commonAncestorContainer;
    let editableElement: Element | null = null;
    
    if (container.nodeType === Node.TEXT_NODE) {
      editableElement = container.parentElement;
    } else {
      editableElement = container as Element;
    }
    
    // Walk up the DOM tree to find contentEditable element
    while (editableElement && editableElement !== document.body) {
      if (editableElement.hasAttribute('contenteditable') && 
          editableElement.getAttribute('contenteditable') !== 'false') {
        break;
      }
      editableElement = editableElement.parentElement;
    }
    
    if (!editableElement || 
        !editableElement.hasAttribute('contenteditable') ||
        editableElement.getAttribute('contenteditable') === 'false') {
      // Delay closing
      closeTimeoutRef.current = setTimeout(() => {
        if (!toolbarInteractionRef.current) {
          setFormattingToolbar(null);
        }
      }, 150);
      return;
    }

    // Get position of selection
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      // Delay closing
      closeTimeoutRef.current = setTimeout(() => {
        if (!toolbarInteractionRef.current) {
          setFormattingToolbar(null);
        }
      }, 150);
      return;
    }

    const position = {
      top: rect.top + window.scrollY - 4,
      left: rect.left + rect.width / 2 + window.scrollX,
    };

    // Check active formats
    const activeFormats = {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikethrough: document.queryCommandState('strikeThrough'),
      code: false, // Check for code formatting (custom implementation)
    };

    // Get block ID from the editable element
    const blockId = editableElement.getAttribute('data-block-id') || undefined;
    
    // Save the selection range when toolbar is shown (before it becomes visible)
    saveSelectionForToolbar();
    
    // Only update position if toolbar is not already visible (don't move it while open)
    setFormattingToolbar(prev => {
      if (prev?.isVisible) {
        // Toolbar is already visible, only update active formats and blockId, keep position
        return {
          ...prev,
          activeFormats,
          blockId,
        };
      } else {
        // Toolbar is not visible, set new position
        return {
          isVisible: true,
          position,
          activeFormats,
          blockId,
        };
      }
    });
  }, []);

  // Handle formatting actions
  const handleFormat = useCallback((action: string, value?: string) => {
    const selection = window.getSelection();
    
    // Save the current selection and cursor position (if available)
    let range: Range | null = null;
    let startOffset = 0;
    let endOffset = 0;
    
    if (selection && selection.rangeCount > 0) {
      range = selection.getRangeAt(0).cloneRange();
      startOffset = range.startOffset;
      endOffset = range.endOffset;
    }
    
    // For textStyle actions, we can work without a selection (use focused block)
    if (action !== 'textStyle' && (!selection || selection.rangeCount === 0)) {
      return;
    }

    try {
      switch (action) {
        case 'bold':
          document.execCommand('bold', false);
          break;
        case 'italic':
          document.execCommand('italic', false);
          break;
        case 'underline':
          document.execCommand('underline', false);
          break;
        case 'strikethrough':
          document.execCommand('strikeThrough', false);
          break;
        case 'code':
          // For inline code, use execCommand. Block-level code is handled via textStyle.
          document.execCommand('formatBlock', false, '<code>');
          break;
        case 'link':
          const url = prompt('Enter URL:');
          if (url) {
            document.execCommand('createLink', false, url);
          }
          break;
        case 'comment':
          // Comment functionality - could be implemented later
          console.log('Comment action');
          break;
        case 'textStyle':
          if (value) {
            setIsUpdatingBlockType(true);
            let blockId: string | null = null;
            let editableElement: Element | null = null;

            // Try to find block from selection first
            if (range) {
              const container = range.commonAncestorContainer;
              editableElement = container.nodeType === Node.TEXT_NODE
                ? container.parentElement
                : container as Element;

              // Walk up to find contentEditable element
              while (editableElement &&
                     editableElement !== document.body &&
                     (!editableElement.hasAttribute('contenteditable') ||
                      editableElement.getAttribute('contenteditable') === 'false')) {
                editableElement = editableElement.parentElement;
              }

              if (editableElement && editableElement.hasAttribute('contenteditable')) {
                // Get block ID from data-block-id attribute
                blockId = editableElement.getAttribute('data-block-id');
              }
            }

            // Fallback: use block ID from toolbar state or focused block ID
            if (!blockId) {
              blockId = formattingToolbar?.blockId || focusedBlockId || null;
              if (blockId) {
                editableElement = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
              }
            }

            if (blockId && editableElement) {
                // Map value to BlockType
                const blockTypeMap: Record<string, BlockType> = {
                  'paragraph': 'paragraph',
                  'heading1': 'heading1',
                  'heading2': 'heading2',
                  'heading3': 'heading3',
                  'code': 'code',
                  'quote': 'quote'
                };

                const newType = blockTypeMap[value] || 'paragraph';

                // Get current HTML content to preserve formatting
                const htmlContent = editableElement.innerHTML;

                // Update block type in state while preserving content
                setBlocks(prev => prev.map(b => {
                  if (b.id === blockId) {
                    // Handle both NotionBlock types and legacy 'text' blocks
                    if (b.type === 'text') {
                      // Convert legacy text block to NotionBlock
                      const updatedBlock: NotionBlock = {
                        id: b.id,
                        type: newType,
                        content: htmlContent,
                        children: [],
                        collapsed: false
                      };
                      return updatedBlock;
                    } else if (b.type === 'paragraph' || b.type === 'heading1' || b.type === 'heading2' || b.type === 'heading3' || b.type === 'code' || b.type === 'quote') {
                      // Update existing NotionBlock
                      const updatedBlock: NotionBlock = { ...b as NotionBlock, type: newType, content: htmlContent };
                      return updatedBlock;
                    }
                  }
                  return b;
                }));

                // Clear the flag after a short delay
                setTimeout(() => {
                  setIsUpdatingBlockType(false);
                }, 100);

                // Restore cursor position after state update and re-render
                setTimeout(() => {
                  try {
                    // Find the element again after re-render
                    const updatedElement = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
                    if (updatedElement) {
                      const newSelection = window.getSelection();
                      if (newSelection) {
                        // Try to restore selection position (if we had one)
                        const textContent = updatedElement.textContent || '';
                        const safeStartOffset = range ? Math.min(startOffset, textContent.length) : textContent.length;
                        const safeEndOffset = range ? Math.min(endOffset, textContent.length) : textContent.length;
                        
                        // Create range and set cursor position
                        const newRange = document.createRange();
                        const walker = document.createTreeWalker(
                          updatedElement,
                          NodeFilter.SHOW_TEXT,
                          null
                        );
                        
                        let currentOffset = 0;
                        let startNode: Node | null = null;
                        let endNode: Node | null = null;
                        let startPos = 0;
                        let endPos = 0;
                        
                        let node: Node | null;
                        while ((node = walker.nextNode())) {
                          const nodeLength = node.textContent?.length || 0;
                          if (!startNode && currentOffset + nodeLength >= safeStartOffset) {
                            startNode = node;
                            startPos = safeStartOffset - currentOffset;
                          }
                          if (!endNode && currentOffset + nodeLength >= safeEndOffset) {
                            endNode = node;
                            endPos = safeEndOffset - currentOffset;
                            break;
                          }
                          currentOffset += nodeLength;
                        }
                        
                        if (startNode) {
                          newRange.setStart(startNode, Math.min(startPos, startNode.textContent?.length || 0));
                          if (endNode) {
                            newRange.setEnd(endNode, Math.min(endPos, endNode.textContent?.length || 0));
                          } else {
                            newRange.setEnd(startNode, Math.min(startPos, startNode.textContent?.length || 0));
                          }
                          newSelection.removeAllRanges();
                          newSelection.addRange(newRange);
                        } else {
                          // Fallback: set cursor at end
                          newRange.selectNodeContents(updatedElement);
                          newRange.collapse(false);
                          newSelection.removeAllRanges();
                          newSelection.addRange(newRange);
                        }
                      }
                    }
                  } catch (e) {
                    // Ignore errors - cursor position restoration is best effort
                  }
                }, 0);
            }
          }
          break;
        case 'more':
          if (value === 'highlight') {
            // Apply highlight (background color)
            document.execCommand('backColor', false, '#fef08a'); // Yellow highlight color
          } else if (value === 'clearFormatting') {
            // Clear all formatting by removing all formatting tags while preserving text
            if (range && !range.collapsed) {
              try {
                // Get the selected content
                const contents = range.extractContents();
                const textContent = contents.textContent || '';
                
                // Create a new text node with just the text (no formatting)
                const textNode = document.createTextNode(textContent);
                
                // Delete the selected range
                range.deleteContents();
                
                // Insert the plain text
                range.insertNode(textNode);
                
                // Restore selection to the inserted text
                const newRange = document.createRange();
                newRange.selectNodeContents(textNode);
                newRange.collapse(false);
                const newSelection = window.getSelection();
                if (newSelection) {
                  newSelection.removeAllRanges();
                  newSelection.addRange(newRange);
                }
              } catch (e) {
                // Fallback to execCommand if the manual method fails
                document.execCommand('removeFormat', false);
                // Also remove backColor (highlight)
                document.execCommand('backColor', false, 'transparent');
                document.execCommand('foreColor', false, 'inherit');
              }
            } else {
              // If no selection, try to clear formatting at cursor
              document.execCommand('removeFormat', false);
              document.execCommand('backColor', false, 'transparent');
              document.execCommand('foreColor', false, 'inherit');
            }
          }
          break;
      }

      // Don't call checkSelection after formatting - keep toolbar open
      // Only update active formats if toolbar is visible
      if (formattingToolbar?.isVisible && (action === 'bold' || action === 'italic' || action === 'underline' || action === 'strikethrough')) {
        setTimeout(() => {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const activeFormats = {
              bold: document.queryCommandState('bold'),
              italic: document.queryCommandState('italic'),
              underline: document.queryCommandState('underline'),
              strikethrough: document.queryCommandState('strikeThrough'),
              code: false,
            };
            setFormattingToolbar(prev => prev ? { ...prev, activeFormats } : null);
          }
        }, 10);
      }
    } catch (error) {
      console.error('Formatting error:', error);
    }
  }, [formattingToolbar, checkSelection, setBlocks]);

  // Listen for selection changes
  useEffect(() => {
    const handleSelectionChange = () => {
      // Don't check if user is interacting with toolbar or if toolbar is already visible (don't reposition)
      if (toolbarInteractionRef.current || formattingToolbar?.isVisible) {
        return;
      }
      
      // Don't check selection if it's within a Desmos calculator
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const commonAncestor = range.commonAncestorContainer;
        const element = commonAncestor.nodeType === Node.ELEMENT_NODE 
          ? commonAncestor as Element 
          : (commonAncestor.parentElement as Element);
        
        if (element && (
          element.closest('[data-desmos-calculator]') ||
          element.closest('.dcg-container') ||
          element.closest('.dcg-expression') ||
          element.closest('.dcg-keypad') ||
          element.closest('.dcg-expression-list') ||
          element.closest('iframe')
        )) {
          return;
        }
      }
      
      // Also check if active element is within Desmos
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.closest('[data-desmos-calculator]') ||
        activeElement.closest('.dcg-container') ||
        activeElement.closest('.dcg-expression') ||
        activeElement.closest('.dcg-keypad') ||
        activeElement.closest('.dcg-expression-list') ||
        activeElement.closest('iframe')
      )) {
        return;
      }
      
      checkSelection();
    };

    const handleMouseUp = (e: MouseEvent) => {
      const target = e.target as Element;
      
      // Don't check if mouseup happened within Desmos calculator
      if (target.closest('[data-desmos-calculator]') || 
          target.closest('.dcg-container') ||
          target.closest('.dcg-expression') ||
          target.closest('.dcg-keypad') ||
          target.closest('.dcg-expression-list') ||
          (target as HTMLElement).tagName === 'IFRAME' ||
          target.closest('iframe')) {
        return;
      }
      
      // Check if click is inside a Desmos iframe
      const desmosCalculators = document.querySelectorAll('[data-desmos-calculator]');
      for (const calculator of desmosCalculators) {
        const iframes = calculator.querySelectorAll('iframe');
        for (const iframe of iframes) {
          try {
            if (iframe.contains(target) || target === iframe) {
              return;
            }
          } catch (e) {
            // Cross-origin iframe - ignore errors
          }
        }
      }
      
      // Small delay to ensure selection is updated
      // Only check if toolbar is not already visible (don't reposition while open)
      if (!toolbarInteractionRef.current && !formattingToolbar?.isVisible) {
        setTimeout(checkSelection, 50);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as Element;
      
      // If typing in Desmos calculator, don't interfere
      if (target.closest('[data-desmos-calculator]')) {
        return;
      }
      
      // Check selection after arrow keys, shift+arrow, etc.
      if (!toolbarInteractionRef.current && (e.key.startsWith('Arrow') || e.key === 'Shift' || e.key === 'Control')) {
        setTimeout(checkSelection, 50);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      
      // If clicking on toolbar, don't close
      if (target.closest('[data-formatting-toolbar]')) {
        toolbarInteractionRef.current = true;
        return;
      }
      
      // If clicking on Desmos calculator or any Desmos elements (including keyboard)
      if (target.closest('[data-desmos-calculator]') || 
          target.closest('.dcg-container') ||
          target.closest('.dcg-expression') ||
          target.closest('.dcg-keypad') ||
          target.closest('.dcg-expression-list') ||
          target.closest('.dcg-popover') ||
          (target as HTMLElement).tagName === 'IFRAME' ||
          target.closest('iframe')) {
        return;
      }
      
      // Check if click is inside a Desmos iframe (Desmos keyboard is often in an iframe)
      const desmosCalculators = document.querySelectorAll('[data-desmos-calculator]');
      for (const calculator of desmosCalculators) {
        const iframes = calculator.querySelectorAll('iframe');
        for (const iframe of iframes) {
          try {
            // Check if click target is related to the iframe
            if (iframe.contains(target) || target === iframe) {
              return;
            }
            // Check if click happened inside the iframe's bounds (for cross-origin)
            const rect = iframe.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
              return;
            }
          } catch (e) {
            // Cross-origin iframe - ignore errors
          }
        }
      }
      
      // If clicking on editable area while toolbar is open, don't update position (keep it stable)
      if (target.closest('[contenteditable="true"]')) {
        // Only check selection if toolbar is not visible yet
        if (!formattingToolbar?.isVisible) {
          setTimeout(checkSelection, 50);
        }
        return;
      }
      
      // Only close if clicking outside both toolbar and editable areas
      if (formattingToolbar) {
        toolbarInteractionRef.current = false;
        // Small delay before closing to allow for selection updates
        setTimeout(() => {
          if (!toolbarInteractionRef.current) {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.getRangeAt(0).collapsed) {
              setFormattingToolbar(null);
            }
          }
        }, 100);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element;
      
      // If clicking on Desmos calculator or any Desmos elements (including keyboard)
      if (target.closest('[data-desmos-calculator]') || 
          target.closest('.dcg-container') ||
          target.closest('.dcg-expression') ||
          target.closest('.dcg-keypad') ||
          target.closest('.dcg-expression-list') ||
          target.closest('.dcg-popover') ||
          (target as HTMLElement).tagName === 'IFRAME' ||
          target.closest('iframe')) {
        return;
      }
      
      // Check if click is inside a Desmos iframe
      const desmosCalculators = document.querySelectorAll('[data-desmos-calculator]');
      for (const calculator of desmosCalculators) {
        const iframes = calculator.querySelectorAll('iframe');
        for (const iframe of iframes) {
          try {
            if (iframe.contains(target) || target === iframe) {
              return;
            }
            // Check if click happened inside the iframe's bounds (for cross-origin)
            const rect = iframe.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
              return;
            }
          } catch (e) {
            // Cross-origin iframe - ignore errors
          }
        }
      }
      
      // Mark toolbar interaction when clicking on it
      if (target.closest('[data-formatting-toolbar]')) {
        toolbarInteractionRef.current = true;
      } else {
        // Reset after a short delay if not clicking on toolbar
        setTimeout(() => {
          if (!target.closest('[data-formatting-toolbar]')) {
            toolbarInteractionRef.current = false;
          }
        }, 100);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('click', handleClick);
      
      // Clean up timeout
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [checkSelection, formattingToolbar]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in input/textarea
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA'
      )) {
        return;
      }

      // Ctrl/Cmd + B for bold
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        handleFormat('bold');
      }
      // Ctrl/Cmd + I for italic
      else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        handleFormat('italic');
      }
      // Ctrl/Cmd + U for underline
      else if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        handleFormat('underline');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleFormat]);

  // Text Block Component (contentEditable)
  const TextBlockComponent = ({ block, index, textBlock, setFocusedBlockId, addNewBlock, deleteBlock, blocks, updateTextBlock, handleDragStart, handleDragEnd, selectedBlockIds, setSelectedBlockIds, setBlocks }: {
    block: Block;
    index: number;
    textBlock: TextBlock;
    setFocusedBlockId: (id: string) => void;
    addNewBlock: (index: number) => void;
    deleteBlock: (id: string) => void;
    blocks: Block[];
    updateTextBlock: (blockId: string, content: string) => void;
    handleDragStart: (block: Block, index: number) => void;
    handleDragEnd: () => void;
    selectedBlockIds: Set<string>;
    setSelectedBlockIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    setBlocks: React.Dispatch<React.SetStateAction<Block[]>>;
  }) => {
    const textBlockRef = useRef<HTMLDivElement>(null);
    const isTextBlockInitialMount = useRef(true);
    const isEditingRef = useRef(false);
    const lastContentRef = useRef<string>('');
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize and sync content for text blocks
    useEffect(() => {
      if (textBlockRef.current) {
        if (isTextBlockInitialMount.current) {
          textBlockRef.current.innerHTML = textBlock.content || '';
          lastContentRef.current = textBlock.content || '';
          isTextBlockInitialMount.current = false;
        } else {
          // Only sync if content changed externally AND user is not editing
          const currentHtml = textBlockRef.current.innerHTML;
          const isFocused = document.activeElement === textBlockRef.current;
          
          // Don't sync if:
          // 1. User is actively editing (isEditingRef is true)
          // 2. Element is focused (user might be typing)
          // 3. Current HTML matches what we last saved (no external change)
          if (!isFocused && !isEditingRef.current && 
              currentHtml !== textBlock.content && 
              textBlock.content !== undefined &&
              lastContentRef.current !== textBlock.content) {
            // Only update if content actually changed externally
            textBlockRef.current.innerHTML = textBlock.content;
            lastContentRef.current = textBlock.content;
          }
        }
      }
    }, [textBlock.content]);
    
    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
      };
    }, []);

    const isSelected = selectedBlockIds.has(block.id);

    const handleBlockClick = (e: React.MouseEvent) => {
      // If Ctrl/Cmd is held, toggle selection
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setSelectedBlockIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(block.id)) {
            newSet.delete(block.id);
          } else {
            newSet.add(block.id);
          }
          return newSet;
        });
      } else {
        // Single click - clear all selections (user wants to type, not select)
        setSelectedBlockIds(new Set());
        setFocusedBlockId(block.id);
      }
    };

    return (
      <div
        key={block.id}
        className={cn(
          "group relative rounded-lg transition-colors",
          isSelected && "bg-primary/10 ring-2 ring-primary/30"
        )}
        onClick={handleBlockClick}
      >
        <div
          className="relative"
          draggable={!isSelected} // Don't allow dragging when selected for bulk operations
          onDragStart={() => handleDragStart(block, index)}
          onDragEnd={handleDragEnd}
        >
        {/* Drag handle */}
        <div 
          className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
          draggable={!isSelected}
          onDragStart={(e) => {
            e.stopPropagation();
            handleDragStart(block, index);
          }}
          onDragEnd={handleDragEnd}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        <div
          ref={textBlockRef}
          contentEditable
          suppressContentEditableWarning
          data-block-id={block.id}
          onInput={(e) => {
            // Mark as editing IMMEDIATELY to prevent content sync
            isEditingRef.current = true;
            
            const htmlContent = e.currentTarget.innerHTML;
            lastContentRef.current = htmlContent;
            
            // Clear any pending save timeout
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
            }
            
            // Debounce state updates - don't interfere with browser's cursor handling
            saveTimeoutRef.current = setTimeout(() => {
              updateTextBlock(block.id, htmlContent);
              // Keep editing flag active longer to prevent sync interference
              setTimeout(() => {
                isEditingRef.current = false;
              }, 300);
            }, 500);
          }}
          onBlur={() => {
            // Clear any pending timeout
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
              saveTimeoutRef.current = null;
            }
            // Reset editing flag when focus is lost
            setTimeout(() => {
              isEditingRef.current = false;
            }, 200);
          }}
          onFocus={() => {
            // Mark as editing when focused to prevent sync
            isEditingRef.current = true;
            setFocusedBlockId(block.id);
          }}
          onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            
            // Check for image in clipboard
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const blob = item.getAsFile();
                if (blob) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const base64 = event.target?.result as string;
                    if (base64) {
                      // Create new image block after current block
                      const imageBlock: ImageBlock = {
                        id: `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        type: 'image',
                        content: base64,
                        alt: 'Pasted image'
                      };
                      // Insert image block after current block
                      setBlocks(prev => {
                        const newBlocks = [...prev];
                        newBlocks.splice(index + 1, 0, imageBlock);
                        return newBlocks;
                      });
                      // Focus the image block
                      setTimeout(() => {
                        setFocusedBlockId(imageBlock.id);
                      }, 0);
                    }
                  };
                  reader.readAsDataURL(blob);
                }
                return;
              }
            }
          }}
          data-placeholder={index === 0 ? "Start writing..." : ""}
          className={cn(
            "w-full min-h-[1.5rem] bg-transparent text-foreground resize-none focus:outline-none text-base leading-relaxed",
            index === 0 ? "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground" : ""
          )}
          onKeyDown={(e) => {
            // Keep editing flag active during any key press to prevent cursor loss
            isEditingRef.current = true;
            
            // Allow Shift+Enter to create a new line (default behavior)
            if (e.key === 'Enter' && e.shiftKey) {
              // Let the default behavior happen - creates a <br> tag
              // Ensure cursor stays active after the line break
              requestAnimationFrame(() => {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0);
                  // Ensure the element stays focused
                  if (textBlockRef.current && document.activeElement !== textBlockRef.current) {
                    textBlockRef.current.focus();
                  }
                  // Restore cursor position
                  selection.removeAllRanges();
                  selection.addRange(range);
                }
              });
              return; // Don't prevent default, allow normal line break
            }
            
            if (e.key === 'Enter' && !e.shiftKey) {
              // Check if cursor is at the start of the block
              const selection = window.getSelection();
              if (selection && selection.rangeCount > 0 && textBlockRef.current) {
                const range = selection.getRangeAt(0);
                
                // Check if cursor is at the very start
                let isAtStart = false;
                if (range.startContainer === textBlockRef.current && range.startOffset === 0) {
                  isAtStart = true;
                } else if (range.startContainer.nodeType === Node.TEXT_NODE) {
                  const textNode = range.startContainer as Text;
                  // Check if this is the first text node and cursor is at offset 0
                  const walker = document.createTreeWalker(
                    textBlockRef.current,
                    NodeFilter.SHOW_TEXT
                  );
                  const firstTextNode = walker.nextNode();
                  if (firstTextNode === textNode && range.startOffset === 0) {
                    isAtStart = true;
                  }
                }
                
                if (isAtStart) {
                  // Insert line break at start, push text down, keep cursor at top
                  e.preventDefault();
                  
                  const currentHtml = textBlockRef.current.innerHTML;
                  const currentText = textBlockRef.current.textContent || '';
                  
                  // Insert <br> at the start
                  textBlockRef.current.innerHTML = '<br>' + currentHtml;
                  
                  // Set cursor position at the start (before the <br>)
                  const newRange = document.createRange();
                  newRange.setStart(textBlockRef.current, 0);
                  newRange.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(newRange);
                  
                  // Update content
                  const newHtml = textBlockRef.current.innerHTML;
                  lastContentRef.current = newHtml;
                  updateTextBlock(block.id, newHtml);
                  
                  // Keep focus and cursor active
                  textBlockRef.current.focus();
                  requestAnimationFrame(() => {
                    const sel = window.getSelection();
                    if (sel && textBlockRef.current) {
                      const r = document.createRange();
                      r.setStart(textBlockRef.current, 0);
                      r.collapse(true);
                      sel.removeAllRanges();
                      sel.addRange(r);
                    }
                  });
                  
                  return;
                }
              }
              
              // Normal Enter behavior - create new block
              e.preventDefault();
              
              // Save current content before adding new block
              const currentHtml = textBlockRef.current?.innerHTML || '';
              if (currentHtml !== lastContentRef.current) {
                lastContentRef.current = currentHtml;
                // Update content immediately before adding new block
                updateTextBlock(block.id, currentHtml);
              }
              
              // Add new block
              addNewBlock(index);
              
              // Keep editing flag active briefly to prevent sync
              setTimeout(() => {
                isEditingRef.current = false;
              }, 100);
            } else if (e.key === 'Backspace') {
              const selection = window.getSelection();
              if (!selection || selection.rangeCount === 0) return;
              
              const range = selection.getRangeAt(0);
              const startContainer = range.startContainer;
              
              // Check if cursor is at the start of a line (after a <br> tag)
              if (startContainer.nodeType === Node.TEXT_NODE && range.startOffset === 0) {
                const textNode = startContainer as Text;
                const prevSibling = textNode.previousSibling;
                
                // If previous sibling is a <br> tag, delete it
                if (prevSibling && prevSibling.nodeType === Node.ELEMENT_NODE) {
                  const prevElement = prevSibling as HTMLElement;
                  if (prevElement.tagName === 'BR') {
                    e.preventDefault();
                    prevElement.remove();
                    const newHtml = textBlockRef.current?.innerHTML || '';
                    lastContentRef.current = newHtml;
                    updateTextBlock(block.id, newHtml);
                    
                    // Restore cursor position
                    requestAnimationFrame(() => {
                      if (!textBlockRef.current) return;
                      const newRange = document.createRange();
                      newRange.setStart(textNode, 0);
                      newRange.collapse(true);
                      selection.removeAllRanges();
                      selection.addRange(newRange);
                      textBlockRef.current.focus();
                    });
                    return;
                  }
                }
              }
              
              // Check if cursor is at the very start of the block
              const isAtBlockStart = range.startOffset === 0 && 
                (startContainer === textBlockRef.current || 
                 (startContainer.nodeType === Node.TEXT_NODE && 
                  startContainer.previousSibling === null &&
                  startContainer.parentElement === textBlockRef.current));
              
              if (isAtBlockStart && textBlockRef.current) {
                // Check if there's a <br> tag at the start that we can delete
                const firstChild = textBlockRef.current.firstChild;
                if (firstChild && firstChild.nodeType === Node.ELEMENT_NODE) {
                  const firstElement = firstChild as HTMLElement;
                  if (firstElement.tagName === 'BR') {
                    // Delete the <br> tag instead of the whole block
                    e.preventDefault();
                    firstElement.remove();
                    const newHtml = textBlockRef.current.innerHTML;
                    lastContentRef.current = newHtml;
                    updateTextBlock(block.id, newHtml);
                    
                    // Restore cursor at the start
                    requestAnimationFrame(() => {
                      const newRange = document.createRange();
                      newRange.setStart(textBlockRef.current!, 0);
                      newRange.collapse(true);
                      selection.removeAllRanges();
                      selection.addRange(newRange);
                      textBlockRef.current?.focus();
                    });
                    return;
                  }
                }
                
                // Check if block is empty (only whitespace or empty)
                const textContent = textBlockRef.current.textContent?.trim() || '';
                const htmlContent = textBlockRef.current.innerHTML.trim();
                
                // Only delete the block if it's truly empty and there are other blocks
                if ((!textContent && !htmlContent) && blocks.length > 1) {
                  e.preventDefault();
                  deleteBlock(block.id);
                }
              }
            }
          }}
        />
        </div>
      </div>
    );
  };

  // ContentEditable Block Component
  const EditableBlock = ({ block, index, notionBlock, slashCommand, openSlashCommand, closeSlashCommand, updateSlashFilter, atCommand, openAtCommand, closeAtCommand, updateAtFilter, handleAtCommand, atCommandSelectedIndex, setAtCommandSelectedIndex, setFocusedBlockId, addNewBlock, deleteBlock, blocks, setBlocks, selectedBlockIds, setSelectedBlockIds, generateQuizFromContent, generateFlashcardsFromContent }: {
    block: Block;
    index: number;
    notionBlock: NotionBlock;
    slashCommand: { isOpen: boolean; position: { top: number; left: number }; filter: string; blockId: string } | null;
    openSlashCommand: (blockId: string, position: { top: number; left: number }, filter?: string) => void;
    closeSlashCommand: () => void;
    updateSlashFilter: (filter: string) => void;
    atCommand: { isOpen: boolean; position: { top: number; left: number }; filter: string; blockId: string; startOffset: number } | null;
    openAtCommand: (blockId: string, position: { top: number; left: number }, startOffset: number) => void;
    closeAtCommand: () => void;
    updateAtFilter: (filter: string) => void;
    handleAtCommand: (command: AtCommand, blockId: string, startOffset: number) => void;
    atCommandSelectedIndex: number;
    setAtCommandSelectedIndex: (index: number) => void;
    setFocusedBlockId: (id: string) => void;
    addNewBlock: (index: number) => void;
    deleteBlock: (id: string) => void;
    blocks: Block[];
    setBlocks: React.Dispatch<React.SetStateAction<Block[]>>;
    selectedBlockIds: Set<string>;
    setSelectedBlockIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    generateFlashcardsFromContent: (content: string, blockId: string) => Promise<void>;
  }) => {
    const blockRef = useRef<HTMLDivElement>(null);
    const isInitialMount = useRef(true);
    const isEditingRef = useRef(false);
    const lastContentRef = useRef<string>('');
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const selectionRef = useRef<{ start: number; end: number } | null>(null);

    // Save cursor position
    const saveCursorPosition = useCallback(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;
      
      const range = selection.getRangeAt(0);
      const blockElement = blockRef.current;
      if (!blockElement) return null;

      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(blockElement);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      
      return {
        start: preCaretRange.toString().length,
        end: preCaretRange.toString().length
      };
    }, []);

    // Restore cursor position
    const restoreCursorPosition = useCallback((position: { start: number; end: number } | null) => {
      if (!position) return;
      
      const blockElement = blockRef.current;
      if (!blockElement) return;

      const selection = window.getSelection();
      if (!selection) return;

      const range = document.createRange();
      let charCount = 0;
      let nodeStack = [blockElement];
      let node: Node | undefined;
      let foundStart = false;
      let foundEnd = false;
      let startNode: Node | null = null;
      let startOffset = 0;
      let endNode: Node | null = null;
      let endOffset = 0;

      while (!foundEnd && (node = nodeStack.pop())) {
        if (node.nodeType === Node.TEXT_NODE) {
          const nextCharCount = charCount + (node.textContent?.length || 0);
          if (!foundStart && position.start >= charCount && position.start <= nextCharCount) {
            startNode = node;
            startOffset = position.start - charCount;
            foundStart = true;
          }
          if (!foundEnd && position.end >= charCount && position.end <= nextCharCount) {
            endNode = node;
            endOffset = position.end - charCount;
            foundEnd = true;
          }
          charCount = nextCharCount;
        } else {
          let i = node.childNodes.length;
          while (i--) {
            nodeStack.push(node.childNodes[i]);
          }
        }
      }

      if (startNode && endNode) {
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }, []);

    // Save selection before any DOM manipulation
    const saveSelection = useCallback(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !blockRef.current) return;
      
      const range = selection.getRangeAt(0);
      if (!blockRef.current.contains(range.commonAncestorContainer)) return;
      
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(blockRef.current);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      
      selectionRef.current = {
        start: preCaretRange.toString().length,
        end: preCaretRange.toString().length
      };
    }, []);

    // Restore selection after DOM manipulation
    const restoreSelection = useCallback(() => {
      if (!selectionRef.current || !blockRef.current) return;
      
      const selection = window.getSelection();
      if (!selection) return;

      const range = document.createRange();
      let charCount = 0;
      let nodeStack = [blockRef.current];
      let node: Node | undefined;
      let foundStart = false;
      let startNode: Node | null = null;
      let startOffset = 0;

      while (!foundStart && (node = nodeStack.pop())) {
        if (node.nodeType === Node.TEXT_NODE) {
          const nextCharCount = charCount + (node.textContent?.length || 0);
          if (selectionRef.current.start >= charCount && selectionRef.current.start <= nextCharCount) {
            startNode = node;
            startOffset = selectionRef.current.start - charCount;
            foundStart = true;
          }
          charCount = nextCharCount;
        } else {
          let i = node.childNodes.length;
          while (i--) {
            nodeStack.push(node.childNodes[i]);
          }
        }
      }

      if (startNode) {
        range.setStart(startNode, startOffset);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }, []);

    // Initialize and sync content when block changes externally
    useEffect(() => {
      if (!blockRef.current) return;
      
      if (isInitialMount.current) {
        // On initial mount, set the content
        blockRef.current.innerHTML = notionBlock.content || '';
        lastContentRef.current = notionBlock.content || '';
        isInitialMount.current = false;
        return;
      }
      
      // CRITICAL: Never update innerHTML if user is actively typing or element is focused
      // This prevents cursor from disappearing
      const isFocused = document.activeElement === blockRef.current;
      if (isFocused || isEditingRef.current) {
        // Don't update - user is actively editing
        return;
      }
      
      // On subsequent updates, only sync if content actually changed externally
      const currentHtml = blockRef.current.innerHTML;
      
      // Only update if content changed externally (not from user typing)
      // Also check that lastContentRef doesn't match to avoid overwriting user's current typing
      if (currentHtml !== notionBlock.content && 
          notionBlock.content !== undefined &&
          lastContentRef.current !== notionBlock.content &&
          currentHtml === lastContentRef.current) {
        // Only sync if current HTML matches what we last saved (meaning it's an external change)
        saveSelection();
        blockRef.current.innerHTML = notionBlock.content;
        lastContentRef.current = notionBlock.content;
        setTimeout(() => restoreSelection(), 0);
      }
    }, [notionBlock.content, notionBlock.type, saveSelection, restoreSelection]);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
      };
    }, []);

    return (
      <div className="relative group" draggable onDragStart={() => handleDragStart(block, index)} onDragEnd={handleDragEnd}>
        <div 
          className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            handleDragStart(block, index);
          }}
          onDragEnd={handleDragEnd}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div
          key={`${block.id}-${notionBlock.type}`} // Force re-render when block type changes
          ref={blockRef}
          contentEditable
          suppressContentEditableWarning
          data-block-id={block.id}
          onInput={(e) => {
            // Skip if we're programmatically updating block type
            if (isUpdatingBlockType) return;

            // Mark as editing IMMEDIATELY to prevent any content sync
            isEditingRef.current = true;
            
            const htmlContent = e.currentTarget.innerHTML;
            const textContent = e.currentTarget.textContent || '';
            
            // Update last content ref immediately to prevent sync conflicts
            lastContentRef.current = htmlContent;
            
            // Clear any pending save timeout
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
            }
            
            // Debounce state updates - don't interfere with browser's cursor handling
            saveTimeoutRef.current = setTimeout(() => {
              setBlocks(prev => prev.map(b =>
                b.id === block.id ? { ...b, content: htmlContent } as NotionBlock : b
              ));
              // Keep editing flag active longer to prevent sync interference
              setTimeout(() => {
                isEditingRef.current = false;
              }, 300);
            }, 500);
            
            // Get selection for @ command detection
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) {
              return;
            }

            const range = selection.getRangeAt(0);
            const cursorOffset = range.startOffset;
            
            // Check if cursor is inside or immediately after a command chip
            const startContainer = range.startContainer;
            let isInsideCommandChip = false;
            
            // Check if cursor is inside a command chip element
            if (startContainer.nodeType === Node.TEXT_NODE) {
              const parent = startContainer.parentElement;
              if (parent && parent.hasAttribute('data-is-command')) {
                isInsideCommandChip = true;
              }
            } else if (startContainer.nodeType === Node.ELEMENT_NODE) {
              const element = startContainer as HTMLElement;
              if (element.hasAttribute('data-is-command')) {
                isInsideCommandChip = true;
              }
            }
            
            // Check if cursor is immediately after a command chip
            if (!isInsideCommandChip && startContainer.nodeType === Node.TEXT_NODE && range.startOffset === 0) {
              const prevSibling = startContainer.previousSibling;
              if (prevSibling && prevSibling.nodeType === Node.ELEMENT_NODE) {
                const prevElement = prevSibling as HTMLElement;
                if (prevElement.hasAttribute('data-is-command')) {
                  isInsideCommandChip = true;
                }
              }
            }
            
            // Skip @ detection if cursor is inside or after a command chip
            if (isInsideCommandChip) {
              // Close any open @ command menu
              if (atCommand && atCommand.blockId === block.id) {
                closeAtCommand();
              }
              // Content update is already handled in the debounced timeout
              return;
            }
            
            // Get text before cursor to check for @
            const textBeforeCursor = textContent.substring(0, cursorOffset);
            const lastAtIndex = textBeforeCursor.lastIndexOf('@');
            
            // Check if @ is inside an email or URL
            const isInEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(textBeforeCursor);
            const isInUrl = /https?:\/\/|www\./.test(textBeforeCursor);
            
            // Check if the @ is part of an existing command chip by checking DOM
            let isPartOfCommandChip = false;
            if (lastAtIndex !== -1) {
              // Find the element/node containing the @ character
              const walker = document.createTreeWalker(
                e.currentTarget,
                NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
              );
              
              let currentOffset = 0;
              while (walker.nextNode()) {
                const node = walker.currentNode;
                if (node.nodeType === Node.TEXT_NODE) {
                  const textNode = node as Text;
                  const nodeLength = textNode.textContent?.length || 0;
                  if (currentOffset <= lastAtIndex && lastAtIndex < currentOffset + nodeLength) {
                    // Found the text node containing @
                    // Check if it's inside a command chip
                    const parent = textNode.parentElement;
                    if (parent && parent.hasAttribute('data-is-command')) {
                      isPartOfCommandChip = true;
                    }
                    break;
                  }
                  currentOffset += nodeLength;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                  const el = node as HTMLElement;
                  if (el.hasAttribute('data-is-command')) {
                    // Skip text inside command chips
                    const chipText = el.textContent || '';
                    if (currentOffset <= lastAtIndex && lastAtIndex < currentOffset + chipText.length) {
                      isPartOfCommandChip = true;
                      break;
                    }
                    currentOffset += chipText.length;
                  }
                }
              }
            }
            
            // Handle @ commands - only if it's a fresh @ not in a command chip
            if (lastAtIndex !== -1 && !isInEmail && !isInUrl && !isPartOfCommandChip) {
              // Check if there's a space before @ (meaning it's a valid trigger)
              const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
              const isWordBoundary = /\s/.test(charBeforeAt);
              
              if (isWordBoundary || lastAtIndex === 0) {
                const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
                // Check if there's a space after @ (meaning command is complete or being typed)
                const spaceIndex = textAfterAt.indexOf(' ');
                const commandText = spaceIndex === -1 ? textAfterAt : textAfterAt.substring(0, spaceIndex);
                
                // Only trigger if we're still typing the command (no space yet) or command is empty
                if (spaceIndex === -1 || commandText.length === 0) {
                  if (!atCommand || atCommand.blockId !== block.id) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const range = document.createRange();
                    range.setStart(e.currentTarget, lastAtIndex);
                    range.setEnd(e.currentTarget, lastAtIndex);
                    const atRect = range.getBoundingClientRect();
                    
                    // Calculate available space above and below
                    const spaceAbove = atRect.top;
                    const spaceBelow = window.innerHeight - atRect.bottom;
                    const menuHeight = 300; // Approximate menu height
                    
                    // Position above if more space above, otherwise below
                    const position = spaceAbove > spaceBelow && spaceAbove > menuHeight
                      ? { top: atRect.top - menuHeight - 8, left: atRect.left }
                      : { top: atRect.bottom + 8, left: atRect.left };
                    
                    openAtCommand(block.id, position, cursorOffset);
                  } else {
                    updateAtFilter(commandText);
                  }
                } else if (atCommand && atCommand.blockId === block.id) {
                  closeAtCommand();
                }
              } else if (atCommand && atCommand.blockId === block.id) {
                closeAtCommand();
              }
            } else if (atCommand && atCommand.blockId === block.id) {
              closeAtCommand();
            }

            // Handle slash commands - extract filter from text before cursor only
            // Reuse textBeforeCursor from above (already calculated)
            const lastSlashIndex = textBeforeCursor.lastIndexOf('/');

            if (lastSlashIndex !== -1) {
              // Extract filter text from / to cursor position
              const filter = textBeforeCursor.slice(lastSlashIndex + 1).trim();
              
              // Check if it's /quiz or /flashcards with space (user is typing topic)
              const textAfterSlash = textBeforeCursor.slice(lastSlashIndex);
              if (textAfterSlash.startsWith('/quiz ') || textAfterSlash.startsWith('/flashcards ')) {
                // User is typing topic - keep slash command state but don't interfere with typing
                // Don't update filter or show dropdown - just let them type normally
                if (!slashCommand || slashCommand.blockId !== block.id) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  openSlashCommand(block.id, { top: rect.bottom + 20, left: rect.left });
                }
              } else if (!slashCommand) {
                const rect = e.currentTarget.getBoundingClientRect();
                // Initialize slash command with filter directly to avoid timing issues
                openSlashCommand(block.id, { top: rect.bottom + 20, left: rect.left }, filter);
              } else if (slashCommand.blockId === block.id) {
                // Only update filter if not typing topic
                if (!textAfterSlash.startsWith('/quiz ') && !textAfterSlash.startsWith('/flashcards ')) {
                  updateSlashFilter(filter);
                }
              }
            } else if (slashCommand && slashCommand.blockId === block.id) {
              // Close slash command if no / found before cursor
              closeSlashCommand();
            }
            
            // Content update is already handled in the debounced timeout at the start of onInput
          }}
          onBlur={() => {
            // Clear any pending timeout
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
              saveTimeoutRef.current = null;
            }
            // Reset editing flag when focus is lost
            setTimeout(() => {
              isEditingRef.current = false;
            }, 200);
          }}
          onFocus={() => {
            // Mark as editing when focused to prevent sync
            isEditingRef.current = true;
            setFocusedBlockId(block.id);
            // Clear selection when user starts typing
            setSelectedBlockIds(new Set());
          }}
          onKeyDown={(e) => {
            // Keep editing flag active during any key press to prevent cursor loss
            isEditingRef.current = true;
            
            // Allow Shift+Enter to create a new line (default behavior)
            if (e.key === 'Enter' && e.shiftKey) {
              // Let the default behavior happen - creates a <br> tag
              // Ensure cursor stays active after the line break
              requestAnimationFrame(() => {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0);
                  // Ensure the element stays focused
                  if (blockRef.current && document.activeElement !== blockRef.current) {
                    blockRef.current.focus();
                  }
                  // Restore cursor position
                  selection.removeAllRanges();
                  selection.addRange(range);
                }
              });
              return; // Don't prevent default, allow normal line break
            }
            
            // Handle @ command selection
            if (atCommand && atCommand.blockId === block.id) {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const filteredCommands = AT_COMMANDS.filter(cmd =>
                  cmd.command.toLowerCase().includes(atCommand.filter.toLowerCase()) ||
                  cmd.label.toLowerCase().includes(atCommand.filter.toLowerCase())
                );
                if (filteredCommands.length > 0) {
                  const selectedIndex = Math.min(atCommandSelectedIndex, filteredCommands.length - 1);
                  handleAtCommand(filteredCommands[selectedIndex], block.id, atCommand.startOffset);
                  return;
                }
              }
            }
            
            // Check if block contains a command chip
            const hasCommandChip = blockRef.current?.querySelector('[data-is-command="true"]') !== null;
            
            // Handle /quiz and /flashcards commands
            if (e.key === 'Enter' && !e.shiftKey && blockRef.current) {
              const textContent = blockRef.current.textContent || '';
              
              // Check for /quiz command
              if (textContent.startsWith('/quiz ')) {
                e.preventDefault();
                const topic = textContent.substring(6).trim(); // Remove "/quiz "
                if (topic) {
                  // Show loading state
                  blockRef.current.innerHTML = '<span class="text-muted-foreground">Generating quiz...</span>';
                  generateQuizFromContent(topic, block.id);
                  closeSlashCommand();
                  return;
                }
              }
              
              // Check for /flashcards command
              if (textContent.startsWith('/flashcards ')) {
                e.preventDefault();
                const topic = textContent.substring(12).trim(); // Remove "/flashcards "
                if (topic) {
                  // Show loading state
                  blockRef.current.innerHTML = '<span class="text-muted-foreground">Generating flashcards...</span>';
                  generateFlashcardsFromContent(topic, block.id);
                  closeSlashCommand();
                  return;
                }
              }
            }
            
            if (e.key === 'Enter' && !e.shiftKey) {
              // Check if cursor is at the start of the block
              const selection = window.getSelection();
              if (selection && selection.rangeCount > 0 && blockRef.current) {
                const range = selection.getRangeAt(0);
                
                // Check if cursor is at the very start
                let isAtStart = false;
                if (range.startContainer === blockRef.current && range.startOffset === 0) {
                  isAtStart = true;
                } else if (range.startContainer.nodeType === Node.TEXT_NODE) {
                  const textNode = range.startContainer as Text;
                  // Check if this is the first text node and cursor is at offset 0
                  const walker = document.createTreeWalker(
                    blockRef.current,
                    NodeFilter.SHOW_TEXT
                  );
                  const firstTextNode = walker.nextNode();
                  if (firstTextNode === textNode && range.startOffset === 0) {
                    isAtStart = true;
                  }
                }
                
                if (isAtStart) {
                  // Insert line break at start, push text down, keep cursor at top
                  e.preventDefault();
                  
                  const currentHtml = blockRef.current.innerHTML;
                  
                  // Insert <br> at the start
                  blockRef.current.innerHTML = '<br>' + currentHtml;
                  
                  // Set cursor position at the start (before the <br>)
                  const newRange = document.createRange();
                  newRange.setStart(blockRef.current, 0);
                  newRange.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(newRange);
                  
                  // Update content
                  const newHtml = blockRef.current.innerHTML;
                  lastContentRef.current = newHtml;
                  setBlocks(prev => prev.map(b =>
                    b.id === block.id ? { ...b, content: newHtml } as NotionBlock : b
                  ));
                  
                  // Keep focus and cursor active
                  blockRef.current.focus();
                  requestAnimationFrame(() => {
                    const sel = window.getSelection();
                    if (sel && blockRef.current) {
                      const r = document.createRange();
                      r.setStart(blockRef.current, 0);
                      r.collapse(true);
                      sel.removeAllRanges();
                      sel.addRange(r);
                    }
                  });
                  
                  return;
                }
              }
              
              // If there's a command chip, treat Enter as trigger for generation
              if (hasCommandChip) {
                e.preventDefault();
                // Extract the prompt text (everything after the command chip)
                const textContent = blockRef.current?.textContent || '';
                const commandChip = blockRef.current?.querySelector('[data-is-command="true"]') as HTMLElement;
                if (commandChip) {
                  const commandType = commandChip.getAttribute('data-command');
                  // Get text after the command chip
                  const chipText = commandChip.textContent || '';
                  const chipIndex = textContent.indexOf(chipText);
                  const promptText = chipIndex !== -1 ? textContent.substring(chipIndex + chipText.length).trim() : '';
                  
                  // Handle quiz command
                  if (commandType === 'quiz' && promptText) {
                    e.preventDefault();
                    // Generate quiz from prompt
                    generateQuizFromContent(promptText, block.id);
                    return;
                  }
                  
                  // Handle whiteboard command
                  if (commandType === 'whiteboard') {
                    // Create whiteboard block
                    const whiteboardBlock: WhiteboardBlock = {
                      id: `whiteboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                      type: 'whiteboard',
                      canvasData: null,
                      prompt: promptText,
                      isGenerating: false
                    };
                    
                    // Replace current block with whiteboard block
                    setBlocks(prev => prev.map(b =>
                      b.id === block.id ? whiteboardBlock : b
                    ));
                    
                    setFocusedBlockId(whiteboardBlock.id);
                    return;
                  }
                  
                  // If command chip exists but no prompt, don't prevent default (allow new line)
                  if (!promptText) {
                    return;
                  }
                  
                  return;
                }
              }
              
              // For normal Enter, prevent default and add new block
              // But maintain editing state to prevent cursor loss
              e.preventDefault();
              isEditingRef.current = true;
              
              // Save current content before adding new block
              const currentHtml = blockRef.current?.innerHTML || '';
              if (currentHtml !== lastContentRef.current) {
                lastContentRef.current = currentHtml;
                // Update content immediately before adding new block
                setBlocks(prev => prev.map(b =>
                  b.id === block.id ? { ...b, content: currentHtml } as NotionBlock : b
                ));
              }
              
              // Add new block and maintain focus
              addNewBlock(index);
              
              // Keep editing flag active briefly to prevent sync
              setTimeout(() => {
                isEditingRef.current = false;
              }, 100);
            } else if (e.key === 'Backspace') {
              const selection = window.getSelection();
              if (!selection || selection.rangeCount === 0) return;
              
              const range = selection.getRangeAt(0);
              const startContainer = range.startContainer;
              
              // Check if cursor is at the start of a line (after a <br> tag)
              if (startContainer.nodeType === Node.TEXT_NODE && range.startOffset === 0) {
                const textNode = startContainer as Text;
                const prevSibling = textNode.previousSibling;
                
                // If previous sibling is a <br> tag, delete it
                if (prevSibling && prevSibling.nodeType === Node.ELEMENT_NODE) {
                  const prevElement = prevSibling as HTMLElement;
                  if (prevElement.tagName === 'BR') {
                    e.preventDefault();
                    prevElement.remove();
                    const newHtml = blockRef.current?.innerHTML || '';
                    lastContentRef.current = newHtml;
                    setBlocks(prev => prev.map(b =>
                      b.id === block.id ? { ...b, content: newHtml } as NotionBlock : b
                    ));
                    
                    // Restore cursor position
                    requestAnimationFrame(() => {
                      if (!blockRef.current) return;
                      const newRange = document.createRange();
                      newRange.setStart(textNode, 0);
                      newRange.collapse(true);
                      selection.removeAllRanges();
                      selection.addRange(newRange);
                      blockRef.current.focus();
                    });
                    return;
                  }
                }
              }
              
              // Check if cursor is at the very start of the block
              const isAtBlockStart = range.startOffset === 0 && 
                (startContainer === blockRef.current || 
                 (startContainer.nodeType === Node.TEXT_NODE && 
                  startContainer.previousSibling === null &&
                  startContainer.parentElement === blockRef.current));
              
              if (isAtBlockStart && blockRef.current) {
                // Check if there's a <br> tag at the start that we can delete
                const firstChild = blockRef.current.firstChild;
                if (firstChild && firstChild.nodeType === Node.ELEMENT_NODE) {
                  const firstElement = firstChild as HTMLElement;
                  if (firstElement.tagName === 'BR') {
                    // Delete the <br> tag instead of the whole block
                    e.preventDefault();
                    firstElement.remove();
                    const newHtml = blockRef.current.innerHTML;
                    lastContentRef.current = newHtml;
                    setBlocks(prev => prev.map(b =>
                      b.id === block.id ? { ...b, content: newHtml } as NotionBlock : b
                    ));
                    
                    // Restore cursor at the start
                    requestAnimationFrame(() => {
                      const newRange = document.createRange();
                      newRange.setStart(blockRef.current!, 0);
                      newRange.collapse(true);
                      selection.removeAllRanges();
                      selection.addRange(newRange);
                      blockRef.current?.focus();
                    });
                    return;
                  }
                }
                
                // Check if block is empty (only whitespace or empty)
                const textContent = blockRef.current.textContent?.trim() || '';
                const htmlContent = blockRef.current.innerHTML.trim();
                
                // Only delete the block if it's truly empty and there are other blocks
                if ((!textContent && !htmlContent) && blocks.length > 1) {
                  e.preventDefault();
                  deleteBlock(block.id);
                }
              }
            } else if (e.key === 'Tab') {
              e.preventDefault();
              // Handle indentation
              const currentLevel = notionBlock.level || 0;
              if (e.shiftKey) {
                // Shift+Tab: outdent
                if (currentLevel > 0) {
                  setBlocks(prev => prev.map(b =>
                    b.id === block.id ? { ...b, level: currentLevel - 1 } as NotionBlock : b
                  ));
                }
              } else {
                // Tab: indent
                setBlocks(prev => prev.map(b =>
                  b.id === block.id ? { ...b, level: currentLevel + 1 } as NotionBlock : b
                ));
              }
            }
          }}
          onFocus={() => {
            setFocusedBlockId(block.id);
            // Clear selection when user starts typing
            setSelectedBlockIds(new Set());
          }}
          data-placeholder={index === 0 ? "Type / for commands" : ""}
          className={cn(
            "w-full min-h-[1.5rem] bg-transparent text-foreground resize-none focus:outline-none",
            "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground",
            // Paragraph (default)
            notionBlock.type === 'paragraph' && "text-base leading-relaxed",
            // Headings
            notionBlock.type === 'heading1' && "text-3xl font-bold mt-6 mb-4",
            notionBlock.type === 'heading2' && "text-2xl font-bold mt-5 mb-3",
            notionBlock.type === 'heading3' && "text-xl font-semibold mt-4 mb-2",
            // Code block - dark background with padding
            notionBlock.type === 'code' && "font-mono text-sm bg-muted px-4 py-3 rounded-lg my-2 border border-border",
            // Quote - indented bubble style with left border
            notionBlock.type === 'quote' && "border-l-4 border-primary/60 pl-4 py-2 my-2 text-muted-foreground italic bg-muted/30 rounded-r-lg"
          )}
          style={{ marginLeft: `${(notionBlock.level || 0) * 24}px` }}
        />
      </div>
    );
  };

  // Image Block Component with resize functionality
  const ImageBlockComponent = ({ block, index, imageBlock, handleDragStart, handleDragEnd, deleteBlock, setFocusedBlockId, setBlocks }: {
    block: Block;
    index: number;
    imageBlock: ImageBlock;
    handleDragStart: (block: Block, index: number) => void;
    handleDragEnd: () => void;
    deleteBlock: (id: string) => void;
    setFocusedBlockId: (id: string) => void;
    setBlocks: React.Dispatch<React.SetStateAction<Block[]>>;
  }) => {
    const [isSelected, setIsSelected] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
    const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
    const [currentSize, setCurrentSize] = useState({ 
      width: imageBlock.width || 600, 
      height: imageBlock.height || undefined 
    });
    const imageRef = useRef<HTMLImageElement>(null);
    const aspectRatioRef = useRef<number>(1);

    // Calculate aspect ratio on image load
    useEffect(() => {
      if (imageRef.current) {
        const img = imageRef.current;
        if (img.complete) {
          aspectRatioRef.current = img.naturalWidth / img.naturalHeight;
          if (!imageBlock.width) {
            setCurrentSize({ width: Math.min(600, img.naturalWidth), height: undefined });
          }
        } else {
          img.onload = () => {
            aspectRatioRef.current = img.naturalWidth / img.naturalHeight;
            if (!imageBlock.width) {
              setCurrentSize({ width: Math.min(600, img.naturalWidth), height: undefined });
            }
          };
        }
      }
    }, [imageBlock.content, imageBlock.width]);

    // Update current size when block width changes externally
    useEffect(() => {
      if (imageBlock.width) {
        setCurrentSize({ width: imageBlock.width, height: imageBlock.height });
      }
    }, [imageBlock.width, imageBlock.height]);

    const handleImageClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsSelected(true);
      setFocusedBlockId(block.id);
    };

    const handleResizeStart = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      setResizeStartPos({ x: e.clientX, y: e.clientY });
      const currentWidth = currentSize.width || 600;
      const currentHeight = currentSize.height || (currentWidth / aspectRatioRef.current);
      setResizeStartSize({ width: currentWidth, height: currentHeight });
    };

    useEffect(() => {
      if (!isResizing) return;

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - resizeStartPos.x;
        
        // Calculate new size maintaining aspect ratio (only resize based on X movement)
        const newWidth = Math.max(100, Math.min(1200, resizeStartSize.width + deltaX));
        const newHeight = newWidth / aspectRatioRef.current;
        
        setCurrentSize({ width: newWidth, height: newHeight });
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        // Save the new size to the block
        setBlocks(prev => prev.map(b => 
          b.id === block.id && b.type === 'image'
            ? { ...b, width: currentSize.width, height: currentSize.height } as ImageBlock
            : b
        ));
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }, [isResizing, resizeStartPos, resizeStartSize, currentSize, block.id, setBlocks]);

    // Close selection when clicking outside
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest(`[data-block-id="${block.id}"]`)) {
          setIsSelected(false);
        }
      };

      if (isSelected) {
        document.addEventListener('click', handleClickOutside);
      }

      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }, [isSelected, block.id]);

    return (
      <div
        key={block.id}
        data-block-id={block.id}
        className="group relative my-4"
        draggable={!isSelected}
        onDragStart={() => handleDragStart(block, index)}
        onDragEnd={handleDragEnd}
      >
        {/* Drag handle */}
        <div className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        
        {/* Image container - centered */}
        <div className="flex justify-center">
          <div 
            className={cn(
              "relative inline-block rounded-lg",
              isSelected && "ring-2 ring-primary"
            )}
            onClick={handleImageClick}
          >
            <img
              ref={imageRef}
              src={imageBlock.content}
              alt={imageBlock.alt || 'Pasted image'}
              className="rounded-lg select-none"
              style={{ 
                width: currentSize.width,
                height: currentSize.height || 'auto',
                maxWidth: '100%',
                cursor: isSelected ? 'default' : 'pointer'
              }}
              draggable={false}
            />
            
            {/* Resize handles - only show when selected */}
            {isSelected && (
              <>
                {/* Bottom-right corner */}
                <div
                  className="absolute bottom-0 right-0 w-4 h-4 bg-primary border-2 border-background rounded-full cursor-se-resize hover:bg-primary/80 transition-colors z-10"
                  style={{ transform: 'translate(50%, 50%)' }}
                  onMouseDown={handleResizeStart}
                />
              </>
            )}
          </div>
        </div>
        
        {/* Delete button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => deleteBlock(block.id)}
          className="absolute -right-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  // RowBlockComponent for rendering horizontal rows
  const RowBlockComponent = useCallback(({ rowBlock, rowIndex }: {
    rowBlock: RowBlock;
    rowIndex: number;
  }) => {
    const handleRowBlockDragStart = (block: Block, blockIndex: number) => {
      // Store both row index and block index for proper handling
      setDraggedBlock(block);
      setDraggedIndex(rowIndex); // Use row index as the main index
      setIsDragging(true);
    };

    const handleRowBlockDrop = (e: React.DragEvent, targetBlockIndex: number, side: 'left' | 'right') => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!draggedBlock || draggedIndex === null) return;

      const newBlocks = [...blocks];
      const targetRow = newBlocks[rowIndex] as RowBlock;
      
      if (isRowBlock(targetRow)) {
        // Remove dragged block from its original location
        const actualDraggedIndex = draggedIndex < rowIndex ? draggedIndex : draggedIndex;
        const draggedBlockToMove = newBlocks[actualDraggedIndex];
        newBlocks.splice(actualDraggedIndex, 1);
        
        // Adjust row index if we removed a block before it
        const adjustedRowIndex = actualDraggedIndex < rowIndex ? rowIndex - 1 : rowIndex;
        const adjustedTargetRow = newBlocks[adjustedRowIndex] as RowBlock;
        
        if (isRowBlock(adjustedTargetRow) && adjustedTargetRow.blocks.length < 3) {
          const insertIndex = side === 'left' ? targetBlockIndex : targetBlockIndex + 1;
          const updatedRow: RowBlock = {
            ...adjustedTargetRow,
            blocks: [
              ...adjustedTargetRow.blocks.slice(0, insertIndex),
              draggedBlockToMove,
              ...adjustedTargetRow.blocks.slice(insertIndex)
            ]
          };
          newBlocks[adjustedRowIndex] = updatedRow;
          const collapsedBlocks = collapseRowIfNeeded(newBlocks);
          setBlocks(collapsedBlocks);
        }
      }
      
      handleDragEnd();
    };

    return (
      <div
        key={rowBlock.id}
        data-block-id={rowBlock.id}
        className="group relative my-4"
        draggable
        onDragStart={() => handleDragStart(rowBlock, rowIndex)}
        onDragEnd={handleDragEnd}
      >
        {/* Drag handle for row */}
        <div 
          className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            handleDragStart(rowBlock, rowIndex);
          }}
          onDragEnd={handleDragEnd}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Row container with CSS grid */}
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${rowBlock.blocks.length}, 1fr)` }}>
          {rowBlock.blocks.map((block, blockIndex) => {
            const isMaxColumns = rowBlock.blocks.length >= 3;
            return (
              <div
                key={block.id}
                className="relative"
                draggable={!isMaxColumns}
                onDragStart={(e) => {
                  if (!isMaxColumns) {
                    handleRowBlockDragStart(block, blockIndex);
                  } else {
                    e.preventDefault();
                  }
                }}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => {
                  if (isMaxColumns) {
                    e.preventDefault();
                    return;
                  }
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const mouseX = e.clientX;
                  const blockCenterX = rect.left + rect.width / 2;
                  const side = mouseX < blockCenterX ? 'left' : 'right';
                  setHorizontalDropTarget({ blockIndex: rowIndex, side });
                }}
                onDrop={(e) => {
                  if (!isMaxColumns) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const mouseX = e.clientX;
                    const blockCenterX = rect.left + rect.width / 2;
                    const side = mouseX < blockCenterX ? 'left' : 'right';
                    handleRowBlockDrop(e, blockIndex, side);
                  }
                }}
              >
                {/* Horizontal drop indicator */}
                {horizontalDropTarget?.blockIndex === rowIndex && !isMaxColumns && (
                  <div
                    className={`absolute top-0 bottom-0 w-1 bg-primary rounded transition-all z-10 ${
                      horizontalDropTarget.side === 'left' ? 'left-0' : 'right-0'
                    }`}
                  />
                )}
                
                {/* Render block inside row - use renderBlock but with a wrapper to prevent recursion */}
                <div className="relative">
                  {renderBlock(block, blockIndex)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Max columns indicator */}
        {rowBlock.blocks.length >= 3 && (
          <div className="absolute -right-8 top-2 text-xs text-muted-foreground opacity-50 pointer-events-none">
            Max
          </div>
        )}
      </div>
    );
  }, [horizontalDropTarget, blocks, draggedBlock, draggedIndex, handleDragStart, handleDragEnd, collapseRowIfNeeded, setBlocks]);

  const renderBlock = useCallback((block: Block, index: number) => {
    // Handle row blocks
    if (block.type === 'row') {
      const rowBlock = block as RowBlock;
      return (
        <RowBlockComponent
          key={rowBlock.id}
          rowBlock={rowBlock}
          rowIndex={index}
          handleDragStart={handleDragStart}
          handleDragEnd={handleDragEnd}
          handleDrop={handleDrop}
          renderBlock={renderBlock}
        />
      );
    }

    if (block.type === 'image') {
      const imageBlock = block as ImageBlock;
      return (
        <ImageBlockComponent
          key={block.id}
          block={block}
          index={index}
          imageBlock={imageBlock}
          handleDragStart={handleDragStart}
          handleDragEnd={handleDragEnd}
          deleteBlock={deleteBlock}
          setFocusedBlockId={setFocusedBlockId}
          setBlocks={setBlocks}
        />
      );
    }

    if (block.type === 'text') {
      const textBlock = block as TextBlock;
      return (
        <TextBlockComponent
          key={block.id}
          block={block}
          index={index}
          textBlock={textBlock}
          setFocusedBlockId={setFocusedBlockId}
          addNewBlock={addNewBlock}
          deleteBlock={deleteBlock}
          blocks={blocks}
          updateTextBlock={updateTextBlock}
          handleDragStart={handleDragStart}
          handleDragEnd={handleDragEnd}
          selectedBlockIds={selectedBlockIds}
          setSelectedBlockIds={setSelectedBlockIds}
          setBlocks={setBlocks}
        />
      );
    }

    if (block.type === 'quiz') {
      const quizBlock = block as QuizBlock;
      const currentQuestion = quizBlock.quiz.questions[quizBlock.currentQuestionIndex];

      return (
        <div
          key={block.id}
          data-block-id={block.id}
          className="group relative my-4"
          draggable
          onDragStart={() => handleQuizDragStart(quizBlock, index)}
          onDragEnd={handleQuizDragEnd}
        >
          {/* Drag handle */}
          <div 
            className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              handleQuizDragStart(quizBlock, index);
            }}
            onDragEnd={handleQuizDragEnd}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Quiz Container */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            {/* Quiz Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">{quizBlock.quiz.title}</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {quizBlock.currentQuestionIndex + 1} / {quizBlock.quiz.questions.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExitQuiz(block.id)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {!quizBlock.showResults ? (
              /* Quiz Question */
              <div>
                <div className="text-base font-medium text-foreground mb-4">
                  {currentQuestion?.question || 'No questions available'}
                </div>
                {currentQuestion && (
                  <div className="space-y-2">
                    {currentQuestion.options.map((option, optionIndex) => (
                      <Button
                        key={optionIndex}
                        variant="outline"
                        className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-primary/10"
                        onClick={() => handleQuizAnswer(block.id, optionIndex)}
                      >
                        <span className="font-semibold mr-3 text-primary">
                          {String.fromCharCode(65 + optionIndex)}.
                        </span>
                        {option}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Quiz Results */
              <div>
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-primary mb-2">
                    {Math.round((quizBlock.quizResults.filter(r => r.isCorrect).length / quizBlock.quiz.questions.length) * 100)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {quizBlock.quizResults.filter(r => r.isCorrect).length} out of {quizBlock.quiz.questions.length} correct
                  </div>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {quizBlock.quiz.questions.map((question, qIndex) => {
                    const result = quizBlock.quizResults.find(r => r.questionIndex === qIndex);
                    return (
                      <div key={qIndex} className="text-xs bg-muted/30 rounded p-2">
                        <div className="font-medium mb-1">{question.question}</div>
                        {result && (
                          <div className={result.isCorrect ? 'text-green-600' : 'text-red-600'}>
                            {result.isCorrect ? '✓ Correct' : `✗ Wrong (Correct: ${String.fromCharCode(65 + question.correctAnswer)})`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (block.type === 'flashcards') {
      const flashcardsBlock = block as FlashcardBlock;
      const currentCard = flashcardsBlock.flashcards.cards[flashcardsBlock.currentCardIndex];


      return (
        <div
          key={block.id}
          data-block-id={block.id}
          className="group relative my-4"
          draggable
          onDragStart={() => handleQuizDragStart(flashcardsBlock as any, index)}
          onDragEnd={handleQuizDragEnd}
        >
          {/* Drag handle */}
          <div 
            className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              handleQuizDragStart(flashcardsBlock as any, index);
            }}
            onDragEnd={handleQuizDragEnd}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Flashcards Container */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            {/* Flashcards Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {flashcardsBlock.isEditing ? (
                  <input
                    type="text"
                    value={flashcardsBlock.flashcards.title}
                    onChange={(e) => {
                      setBlocks(prev => prev.map(b =>
                        b.id === block.id && b.type === 'flashcards'
                          ? {
                              ...b,
                              flashcards: {
                                ...flashcardsBlock.flashcards,
                                title: e.target.value
                              }
                            }
                          : b
                      ));
                    }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // Save changes and exit edit mode
                      setBlocks(prev => prev.map(b =>
                        b.id === block.id && b.type === 'flashcards'
                          ? { ...b, isEditing: false }
                          : b
                      ));
                    } else if (e.key === 'Escape') {
                      // Cancel changes and stay in edit mode
                      // Just blur the input without saving
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                    className="text-lg font-semibold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground focus:ring-0 p-0"
                    placeholder="Flashcard Set Title"
                    autoFocus
                  />
                ) : (
                  <h3 className="text-lg font-semibold text-foreground">
                    {flashcardsBlock.flashcards.title || 'Untitled Flashcard Set'}
                  </h3>
                )}
                {flashcardsBlock.isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBlocks(prev => prev.map(b =>
                        b.id === block.id && b.type === 'flashcards'
                          ? { ...b, isEditing: true }
                          : b
                      ));
                    }}
                    className="h-6 w-6 p-0 opacity-60 hover:opacity-100 transition-opacity"
                    title="Edit title"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {flashcardsBlock.currentCardIndex + 1} / {flashcardsBlock.flashcards.cards.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExitQuiz(block.id)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  ×
                </Button>
              </div>
            </div>

            {/* Flashcard Content */}
            {flashcardsBlock.isEditing ? (
              /* Edit Mode */
              flashcardsBlock.editingCardIndex !== null ? (
                /* Individual Card Editor */
                <div className="w-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Edit Card {flashcardsBlock.editingCardIndex + 1}</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setBlocks(prev => prev.map(b =>
                          b.id === block.id && b.type === 'flashcards'
                            ? { ...b, editingCardIndex: null }
                            : b
                        ));
                      }}
                      className="text-sm"
                    >
                      ← Back to Directory
                    </Button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Front Side
                      </label>
                      <textarea
                        value={flashcardsBlock.flashcards.cards[flashcardsBlock.editingCardIndex]?.front || ''}
                        onChange={(e) => {
                          setBlocks(prev => prev.map(b =>
                            b.id === block.id && b.type === 'flashcards'
                              ? {
                                  ...b,
                                  flashcards: {
                                    ...flashcardsBlock.flashcards,
                                    cards: flashcardsBlock.flashcards.cards.map((card, idx) =>
                                      idx === flashcardsBlock.editingCardIndex
                                        ? { ...card, front: e.target.value }
                                        : card
                                    )
                                  }
                                }
                              : b
                          ));
                        }}
                        className="w-full min-h-[120px] p-4 text-base bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Enter the question or front side of the card..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Back Side
                      </label>
                      <textarea
                        value={flashcardsBlock.flashcards.cards[flashcardsBlock.editingCardIndex]?.back || ''}
                        onChange={(e) => {
                          setBlocks(prev => prev.map(b =>
                            b.id === block.id && b.type === 'flashcards'
                              ? {
                                  ...b,
                                  flashcards: {
                                    ...flashcardsBlock.flashcards,
                                    cards: flashcardsBlock.flashcards.cards.map((card, idx) =>
                                      idx === flashcardsBlock.editingCardIndex
                                        ? { ...card, back: e.target.value }
                                        : card
                                    )
                                  }
                                }
                              : b
                          ));
                        }}
                        className="w-full min-h-[120px] p-4 text-base bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Enter the answer or back side of the card..."
                      />
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setBlocks(prev => prev.map(b =>
                            b.id === block.id && b.type === 'flashcards'
                              ? {
                                  ...b,
                                  flashcards: {
                                    ...flashcardsBlock.flashcards,
                                    cards: flashcardsBlock.flashcards.cards.filter((_, idx) => idx !== flashcardsBlock.editingCardIndex)
                                  },
                                  editingCardIndex: null,
                                  currentCardIndex: Math.max(0, Math.min(flashcardsBlock.currentCardIndex, flashcardsBlock.flashcards.cards.length - 2))
                                }
                              : b
                          ));
                        }}
                        disabled={flashcardsBlock.flashcards.cards.length <= 1}
                        className="text-sm"
                      >
                        Delete Card
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Save any pending inline edits before exiting
                          if (flashcardsBlock.inlineEditingCardIndex !== null) {
                            const frontValue = flashcardsBlock.inlineEditingFront;
                            const backValue = flashcardsBlock.inlineEditingBack;
                            setBlocks(prev => prev.map(b =>
                              b.id === block.id && b.type === 'flashcards'
                                ? {
                                    ...b,
                                    flashcards: {
                                      ...flashcardsBlock.flashcards,
                                      cards: flashcardsBlock.flashcards.cards.map((c, idx) =>
                                        idx === flashcardsBlock.inlineEditingCardIndex
                                          ? { ...c, front: frontValue, back: backValue }
                                          : c
                                      )
                                    },
                                    isEditing: false,
                                    editingCardIndex: null,
                                    inlineEditingCardIndex: null
                                  }
                                : b
                            ));
                          } else {
                            setBlocks(prev => prev.map(b =>
                              b.id === block.id && b.type === 'flashcards'
                                ? { ...b, isEditing: false, editingCardIndex: null, inlineEditingCardIndex: null }
                                : b
                            ));
                          }
                        }}
                        className="text-sm"
                      >
                        Done Editing
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Card Directory View */
                <div className="w-full">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-foreground">Edit Flashcards</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newCard = { id: `card-${Date.now()}`, front: '', back: '' };
                          setBlocks(prev => prev.map(b =>
                            b.id === block.id && b.type === 'flashcards'
                              ? {
                                  ...b,
                                  flashcards: {
                                    ...flashcardsBlock.flashcards,
                                    cards: [...flashcardsBlock.flashcards.cards, newCard]
                                  },
                                  inlineEditingCardIndex: flashcardsBlock.flashcards.cards.length,
                                  inlineEditingFront: '',
                                  inlineEditingBack: ''
                                }
                              : b
                          ));
                        }}
                        className="text-sm"
                      >
                        + Add Card
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Save any pending inline edits before exiting
                          if (flashcardsBlock.inlineEditingCardIndex !== null) {
                            const frontValue = flashcardsBlock.inlineEditingFront;
                            const backValue = flashcardsBlock.inlineEditingBack;
                            setBlocks(prev => prev.map(b =>
                              b.id === block.id && b.type === 'flashcards'
                                ? {
                                    ...b,
                                    flashcards: {
                                      ...flashcardsBlock.flashcards,
                                      cards: flashcardsBlock.flashcards.cards.map((c, idx) =>
                                        idx === flashcardsBlock.inlineEditingCardIndex
                                          ? { ...c, front: frontValue, back: backValue }
                                          : c
                                      )
                                    },
                                    isEditing: false,
                                    editingCardIndex: null,
                                    inlineEditingCardIndex: null
                                  }
                                : b
                            ));
                          } else {
                            setBlocks(prev => prev.map(b =>
                              b.id === block.id && b.type === 'flashcards'
                                ? { ...b, isEditing: false, editingCardIndex: null, inlineEditingCardIndex: null }
                                : b
                            ));
                          }
                        }}
                        className="text-sm"
                      >
                        Done Editing
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {flashcardsBlock.flashcards.cards.map((card, index) => (
                      <div
                        key={card.id}
                        className="border border-border rounded-lg p-4 bg-background hover:bg-muted/50 cursor-pointer transition-all hover:shadow-md"
                        onClick={() => {
                          setBlocks(prev => prev.map(b =>
                            b.id === block.id && b.type === 'flashcards'
                              ? { ...b, editingCardIndex: index }
                              : b
                          ));
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-sm font-medium text-muted-foreground">Card {index + 1}</span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBlocks(prev => prev.map(b =>
                                  b.id === block.id && b.type === 'flashcards'
                                    ? {
                                        ...b,
                                        inlineEditingCardIndex: index,
                                        inlineEditingFront: card.front || '',
                                        inlineEditingBack: card.back || ''
                                      }
                                    : b
                                ));
                              }}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                              title="Edit card"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBlocks(prev => prev.map(b =>
                                  b.id === block.id && b.type === 'flashcards'
                                    ? {
                                        ...b,
                                        flashcards: {
                                          ...flashcardsBlock.flashcards,
                                          cards: flashcardsBlock.flashcards.cards.filter((_, idx) => idx !== index)
                                        },
                                        editingCardIndex: null,
                                        currentCardIndex: Math.max(0, Math.min(flashcardsBlock.currentCardIndex, flashcardsBlock.flashcards.cards.length - 2)),
                                        inlineEditingCardIndex: flashcardsBlock.inlineEditingCardIndex === index ? null : flashcardsBlock.inlineEditingCardIndex
                                      }
                                    : b
                                ));
                              }}
                              disabled={flashcardsBlock.flashcards.cards.length <= 1}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                              title="Delete card"
                            >
                              ×
                            </Button>
                          </div>
                        </div>

                        {flashcardsBlock.inlineEditingCardIndex === index ? (
                          <div className="space-y-3">
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Front</div>
                              <textarea
                                value={flashcardsBlock.inlineEditingFront}
                                onChange={(e) => {
                                  setBlocks(prev => prev.map(b =>
                                    b.id === block.id && b.type === 'flashcards'
                                      ? { ...b, inlineEditingFront: e.target.value }
                                      : b
                                  ));
                                }}
                                className="w-full min-h-[60px] p-2 text-sm bg-background border border-border rounded resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                                placeholder="Enter the front side..."
                                autoFocus
                              />
                            </div>

                            <div className="border-t border-border/50 pt-2">
                              <div className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Back</div>
                              <textarea
                                value={flashcardsBlock.inlineEditingBack}
                                onChange={(e) => {
                                  setBlocks(prev => prev.map(b =>
                                    b.id === block.id && b.type === 'flashcards'
                                      ? { ...b, inlineEditingBack: e.target.value }
                                      : b
                                  ));
                                }}
                                className="w-full min-h-[60px] p-2 text-sm bg-background border border-border rounded resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                                placeholder="Enter the back side..."
                              />
                            </div>

                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBlocks(prev => prev.map(b =>
                                    b.id === block.id && b.type === 'flashcards'
                                      ? {
                                          ...b,
                                          flashcards: {
                                            ...flashcardsBlock.flashcards,
                                            cards: flashcardsBlock.flashcards.cards.map((c, idx) =>
                                              idx === index
                                                ? { ...c, front: flashcardsBlock.inlineEditingFront, back: flashcardsBlock.inlineEditingBack }
                                                : c
                                            )
                                          },
                                          inlineEditingCardIndex: null
                                        }
                                      : b
                                  ));
                                }}
                                className="flex-1"
                              >
                                Save
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBlocks(prev => prev.map(b =>
                                    b.id === block.id && b.type === 'flashcards'
                                      ? { ...b, inlineEditingCardIndex: null }
                                      : b
                                  ));
                                }}
                                className="flex-1"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Front</div>
                              <div className="text-sm text-foreground leading-relaxed min-h-[2.5rem]">
                                {card.front ? (
                                  <div className="line-clamp-3">{card.front}</div>
                                ) : (
                                  <span className="text-muted-foreground italic">Empty</span>
                                )}
                              </div>
                            </div>

                            <div className="border-t border-border/50 pt-2">
                              <div className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Back</div>
                              <div className="text-sm text-foreground leading-relaxed min-h-[2.5rem]">
                                {card.back ? (
                                  <div className="line-clamp-3">{card.back}</div>
                                ) : (
                                  <span className="text-muted-foreground italic">Empty</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                      </div>
                    ))}
                  </div>

                  {flashcardsBlock.flashcards.cards.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <div className="text-lg mb-2">No cards yet</div>
                      <div className="text-sm">Click "Add Card" to create your first flashcard</div>
                    </div>
                  )}
                </div>
              )
            ) : (
              /* Normal Flashcard Study Mode */
              <>
                <div className="flex flex-col items-center relative">
                  {/* Left Arrow */}
                  <button
                    onClick={() => {
                      setBlocks(prev => prev.map(b =>
                        b.id === block.id && b.type === 'flashcards'
                          ? { ...b, currentCardIndex: Math.max(0, flashcardsBlock.currentCardIndex - 1), isFlipped: false }
                          : b
                      ));
                    }}
                    disabled={flashcardsBlock.currentCardIndex === 0}
                    className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-background/80 hover:bg-background border border-border rounded-full shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ left: '-60px' }}
                  >
                    <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Right Arrow */}
                  <button
                    onClick={() => {
                      setBlocks(prev => prev.map(b =>
                        b.id === block.id && b.type === 'flashcards'
                          ? { ...b, currentCardIndex: Math.min(flashcardsBlock.flashcards.cards.length - 1, flashcardsBlock.currentCardIndex + 1), isFlipped: false }
                          : b
                      ));
                    }}
                    disabled={flashcardsBlock.currentCardIndex === flashcardsBlock.flashcards.cards.length - 1}
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-background/80 hover:bg-background border border-border rounded-full shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ right: '-60px' }}
                  >
                    <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <div
                    className="w-full max-w-2xl h-96 bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-dashed border-primary/20 rounded-xl flex items-center justify-center cursor-pointer transition-all hover:bg-primary/15 hover:border-primary/30 hover:shadow-lg mb-6"
                    onClick={() => {
                      setBlocks(prev => prev.map(b =>
                        b.id === block.id && b.type === 'flashcards'
                          ? { ...b, isFlipped: !flashcardsBlock.isFlipped }
                          : b
                      ));
                    }}
                  >
                    <div className="text-center p-8">
                      <div className="text-base text-muted-foreground mb-4 uppercase tracking-wide font-medium">
                        {flashcardsBlock.isFlipped ? 'Back' : 'Front'}
                      </div>
                      <div className="text-2xl font-medium text-foreground leading-relaxed">
                        {currentCard ? (flashcardsBlock.isFlipped ? currentCard.back : currentCard.front) : 'No cards available'}
                      </div>
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm text-muted-foreground">
                      {flashcardsBlock.currentCardIndex + 1} of {flashcardsBlock.flashcards.cards.length}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{
                          width: flashcardsBlock.flashcards.cards.length > 0
                            ? `${((flashcardsBlock.currentCardIndex + 1) / flashcardsBlock.flashcards.cards.length) * 100}%`
                            : '0%'
                        }}
                      />
                    </div>
                  </div>

                  {/* Keyboard hint */}
                  <div className="text-xs text-muted-foreground">
                    Use ← → arrow keys to navigate, Space/Enter to flip card
                  </div>
                </div>

                {/* Edit Cards Button */}
                <div className="mt-6 w-full flex justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Edit Cards clicked');
                      setBlocks(prev => {
                        return prev.map(b => {
                          if (b.id === block.id && b.type === 'flashcards') {
                            const fb = b as FlashcardBlock;
                            console.log('Updating flashcard block to editing mode');
                            return {
                              ...fb,
                              isEditing: true,
                              isFlipped: false,
                              currentCardIndex: 0,
                              editingCardIndex: null
                            } as FlashcardBlock;
                          }
                          return b;
                        });
                      });
                    }}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                  >
                    Edit Cards
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    if (block.type === 'calculator') {
      const calculatorBlock = block as DesmosBlock;

      return (
        <div
          key={block.id}
          data-block-id={block.id}
          data-desmos-calculator="true"
          className="group relative my-4"
        >
          {/* Drag handle - only way to drag the block */}
          <div 
            className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              handleQuizDragStart(calculatorBlock as any, index);
            }}
            onDragEnd={handleQuizDragEnd}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Calculator Container - not draggable, allows graph interaction */}
          <div 
            className="bg-card rounded-lg" 
            draggable={false}
            data-desmos-calculator="true"
          >
            <DesmosCalculator
              blockId={calculatorBlock.id}
              calculatorState={calculatorBlock.calculatorState}
              width={calculatorBlock.width}
              height={calculatorBlock.height}
              onStateChange={(state) => {
                setBlocks(prev => prev.map(b => 
                  b.id === block.id && b.type === 'calculator'
                    ? { ...b, calculatorState: state } as DesmosBlock
                    : b
                ));
              }}
            />
          </div>

          {/* Delete button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteBlock(block.id)}
            className="absolute -right-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-muted-foreground hover:text-destructive z-10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    if (block.type === 'whiteboard') {
      const whiteboardBlock = block as WhiteboardBlock;
      return (
        <div
          key={block.id}
          data-block-id={block.id}
          className="group relative my-4"
          draggable
          onDragStart={() => handleQuizDragStart(whiteboardBlock as any, index)}
          onDragEnd={handleQuizDragEnd}
        >
          {/* Drag handle */}
          <div 
            className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              handleQuizDragStart(whiteboardBlock as any, index);
            }}
            onDragEnd={handleQuizDragEnd}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Whiteboard Container */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            {/* Whiteboard Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Whiteboard</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteBlock(block.id)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Whiteboard Canvas */}
            <WhiteboardComponent
              blockId={block.id}
              initialCanvasData={whiteboardBlock.canvasData}
              prompt={whiteboardBlock.prompt}
              isGenerating={whiteboardBlock.isGenerating}
              onCanvasUpdate={(canvasData) => {
                setBlocks(prev => prev.map(b =>
                  b.id === block.id && b.type === 'whiteboard'
                    ? { ...b, canvasData } as WhiteboardBlock
                    : b
                ));
              }}
            />
          </div>
        </div>
      );
    }

    // Handle new Notion-style blocks
    const notionBlock = block as NotionBlock;
    return (
      <EditableBlock
        key={block.id}
        block={block}
        index={index}
        notionBlock={notionBlock}
        slashCommand={slashCommand}
        openSlashCommand={openSlashCommand}
        closeSlashCommand={closeSlashCommand}
        updateSlashFilter={updateSlashFilter}
        atCommand={atCommand}
        openAtCommand={openAtCommand}
        closeAtCommand={closeAtCommand}
        updateAtFilter={updateAtFilter}
        handleAtCommand={handleAtCommand}
        atCommandSelectedIndex={atCommandSelectedIndex}
        setAtCommandSelectedIndex={setAtCommandSelectedIndex}
        setFocusedBlockId={setFocusedBlockId}
        addNewBlock={addNewBlock}
        deleteBlock={deleteBlock}
        blocks={blocks}
        setBlocks={setBlocks}
        selectedBlockIds={selectedBlockIds}
        setSelectedBlockIds={setSelectedBlockIds}
        generateQuizFromContent={generateQuizFromContent}
        generateFlashcardsFromContent={generateFlashcardsFromContent}
      />
    );
  }, [handleDragStart, handleDragEnd, updateTextBlock, addNewBlock, deleteBlock, handleQuizAnswer, handleExitQuiz, slashCommand, openSlashCommand, closeSlashCommand, updateSlashFilter, atCommand, openAtCommand, closeAtCommand, updateAtFilter, handleAtCommand, atCommandSelectedIndex, setAtCommandSelectedIndex, blocks.length, setBlocks, generateQuizFromContent]);

  // Initialize blocks from initial content
  useEffect(() => {
    if (initialContent.trim()) {
      setBlocks(getBlocksFromContent(initialContent));
    }
  }, [initialContent, getBlocksFromContent]);

  // Calculate word count
  useEffect(() => {
    const textBlocks = blocks.filter(block => block.type === 'text') as TextBlock[];
    const totalWords = textBlocks.reduce((count, block) => {
      const words = block.content.trim().split(/\s+/).filter(word => word.length > 0);
      return count + words.length;
    }, 0);

    if (onWordCountChange) {
      onWordCountChange(totalWords);
    }
  }, [blocks, onWordCountChange]);

  return (
    <div className="flex-1 flex flex-col bg-editor overflow-y-auto">
      <div className="flex-1 px-12 pt-6 pb-0 flex flex-col min-h-full">
        <div ref={containerRef} className="relative flex-1">
          {/* Formatting Toolbar */}
          {formattingToolbar?.isVisible && (
            <FormattingToolbar
              position={formattingToolbar.position}
              onFormat={handleFormat}
              onClose={() => setFormattingToolbar(null)}
              isActive={formattingToolbar.activeFormats}
            />
          )}

          {/* Slash Command Menu */}
          {slashCommand?.isOpen && (
            <SlashCommandMenu
              position={slashCommand.position}
              filter={slashCommand.filter}
              onSelect={handleSlashCommand}
              onClose={closeSlashCommand}
            />
          )}

          {/* @ Command Menu */}
          {atCommand?.isOpen && (
            <AtCommandMenu
              position={atCommand.position}
              filter={atCommand.filter}
              onSelect={(cmd) => handleAtCommand(cmd, atCommand.blockId, atCommand.startOffset)}
              onClose={closeAtCommand}
              selectedIndex={atCommandSelectedIndex}
              onSelectedIndexChange={setAtCommandSelectedIndex}
            />
          )}

          <div className="space-y-1">
            {blocks.map((block, index) => (
              <div key={`block-container-${block.id}`} className="relative">
                {/* Drop zone above block */}
                <div
                  className={`h-1 rounded transition-all duration-200 ${
                    (dropTargetIndex === index && isDragging) || (quizDropTargetIndex === index && isQuizDragging)
                      ? 'bg-primary shadow-sm'
                      : 'hover:bg-muted/50'
                  }`}
                  onDragOver={(e) => {
                    handleDragOver(e, index, block);
                    handleQuizDragOver(e, index);
                  }}
                  onDrop={(e) => {
                    if (isQuizDragging) {
                      handleQuizDrop(e, index);
                    } else {
                      handleDrop(e, index, block);
                    }
                  }}
                  style={{
                    minHeight: (dropTargetIndex === index && isDragging) || (quizDropTargetIndex === index && isQuizDragging) ? '4px' : '2px'
                  }}
                />

                {/* Block content with horizontal drop indicators */}
                <div
                  className="relative"
                  onDragOver={(e) => {
                    if (!isRowBlock(block)) {
                      handleDragOver(e, index, block);
                    }
                  }}
                  onDrop={(e) => {
                    if (!isRowBlock(block)) {
                      handleDrop(e, index, block);
                    }
                  }}
                >
                  {/* Horizontal drop indicator (left) */}
                  {horizontalDropTarget?.blockIndex === index && horizontalDropTarget.side === 'left' && !isRowBlock(block) && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded transition-all z-10" />
                  )}
                  
                  {/* Horizontal drop indicator (right) */}
                  {horizontalDropTarget?.blockIndex === index && horizontalDropTarget.side === 'right' && !isRowBlock(block) && (
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary rounded transition-all z-10" />
                  )}

                  {renderBlock(block, index)}
                </div>

                {/* Drop zone below block (only if not last block) */}
                {index < blocks.length - 1 && (
                  <div
                    className={`h-1 rounded transition-all duration-200 ${
                      (dropTargetIndex === index + 1 && isDragging) || (quizDropTargetIndex === index + 1 && isQuizDragging)
                        ? 'bg-primary shadow-sm'
                        : 'hover:bg-muted/50'
                    }`}
                    onDragOver={(e) => {
                      handleDragOver(e, index + 1);
                      handleQuizDragOver(e, index + 1);
                    }}
                    onDrop={(e) => {
                      if (isQuizDragging) {
                        handleQuizDrop(e, index + 1);
                      } else {
                        handleDrop(e, index + 1);
                      }
                    }}
                    style={{
                      minHeight: (dropTargetIndex === index + 1 && isDragging) || (quizDropTargetIndex === index + 1 && isQuizDragging) ? '4px' : '2px'
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Add new block button at the end */}
          <div className="mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => addNewBlock(blocks.length - 1)}
              className="text-muted-foreground hover:text-foreground"
            >
              + Add block
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
