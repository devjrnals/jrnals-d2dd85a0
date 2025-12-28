import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CommandMenu } from "./CommandMenu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { GripVertical, X, Edit, ChevronRight, ChevronDown, Copy, AlertCircle, Quote } from "lucide-react";

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
  | 'callout';

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

type NotionBlock = BaseBlock;
type Block = NotionBlock | TextBlock | QuizBlock | FlashcardBlock;

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
  onFlashcardsAdded
}: EditorProps) => {
  // Block-based state
  const [blocks, setBlocks] = useState<Block[]>(() => {
    if (initialContent.trim()) {
      return [{ id: 'paragraph-0', type: 'paragraph', content: initialContent, children: [], collapsed: false }];
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

  // Drag and drop state
  const [draggedBlock, setDraggedBlock] = useState<Block | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // UI state
  const [focusedBlockId, setFocusedBlockId] = useState<string>('text-0');
  const [content, setContent] = useState(initialContent);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

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
          } else if (block.type === 'text') {
            return {
              id: block.id,
              type: 'text' as const,
              content: block.content || ''
            } as TextBlock;
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
      setBlocks(prev => [...prev, quizBlock]);
      setFocusedBlockId(quizBlock.id);
      console.log('Added quiz block to journal:', quizBlock.id);
      // Notify parent that quiz has been added
      onQuizAdded?.();
    }
  }, [currentQuiz, onQuizAdded]);

  // Add flashcards block when currentFlashcards is provided
  useEffect(() => {
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
      const content = getContentFromBlocks(blocks);
      console.log('Auto-saving journal', journalId, 'with', blocks.length, 'blocks:', blocks.map(b => ({ id: b.id, type: b.type })));
      const { error } = await supabase
        .from("journals")
        .update({ content })
        .eq("id", journalId);

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

  // Keyboard navigation for flashcards
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
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

    // Identify the currently focused block and transform it
    transformBlock(slashCommand.blockId, command.type);

    // Close dropdown after state update
    setSlashCommand(null);
  }, [slashCommand, transformBlock]);

  const openSlashCommand = useCallback((blockId: string, position: { top: number; left: number }) => {
    setSlashCommand({
      isOpen: true,
      position,
      filter: '',
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
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDropTargetIndex(index);
    }
  }, [draggedIndex]);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedBlock && draggedIndex !== null && draggedIndex !== dropIndex) {
      const newBlocks = [...blocks];
      // Remove dragged block
      newBlocks.splice(draggedIndex, 1);
      // Insert at new position
      newBlocks.splice(dropIndex, 0, draggedBlock);

      setBlocks(newBlocks);
    }

    handleDragEnd();
  }, [blocks, draggedBlock, draggedIndex, handleDragEnd]);

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
    setFocusedBlockId(newBlockId);
  }, []);

  const deleteBlock = useCallback((blockId: string) => {
    setBlocks(prev => {
      if (prev.length <= 1) return prev; // Keep at least one block
      return prev.filter(block => block.id !== blockId);
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

  // Render block content
  const renderBlock = useCallback((block: Block, index: number) => {
    if (block.type === 'text') {
      const textBlock = block as TextBlock;
      return (
        <div
          key={block.id}
          className="group relative"
          draggable
          onDragStart={() => handleDragStart(block, index)}
          onDragEnd={handleDragEnd}
        >
          {/* Drag handle */}
          <div className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>

          <textarea
            value={textBlock.content}
            onChange={(e) => updateTextBlock(block.id, e.target.value)}
            onFocus={() => setFocusedBlockId(block.id)}
            placeholder="Start writing..."
            className="w-full min-h-[1.5rem] bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-base leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                addNewBlock(index);
              } else if (e.key === 'Backspace' && textBlock.content === '' && blocks.length > 1) {
                e.preventDefault();
                deleteBlock(block.id);
              }
            }}
          />
        </div>
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
          <div className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10">
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
          <div className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10">
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

    // Handle new Notion-style blocks
    const notionBlock = block as NotionBlock;
    return (
      <div className="relative group">
        <div className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <textarea
          value={notionBlock.content}
          onChange={(e) => {
            const content = e.target.value;
            // Handle slash commands
            if (content.startsWith('/')) {
              const filter = content.slice(1);
              if (!slashCommand) {
                const rect = e.currentTarget.getBoundingClientRect();
                openSlashCommand(block.id, { top: rect.bottom + 20, left: rect.left });
              } else {
                updateSlashFilter(filter);
              }
            } else if (slashCommand && slashCommand.blockId === block.id) {
              closeSlashCommand();
            }
            // Update block content
            setBlocks(prev => prev.map(b =>
              b.id === block.id ? { ...b, content } as NotionBlock : b
            ));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              addNewBlock(index);
            } else if (e.key === 'Backspace' && !notionBlock.content && blocks.length > 1) {
              e.preventDefault();
              deleteBlock(block.id);
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
          placeholder="Type / for commands"
          className="w-full min-h-[1.5rem] bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-base leading-relaxed"
          style={{ marginLeft: `${(notionBlock.level || 0) * 24}px` }}
        />
      </div>
    );
  }, [handleDragStart, handleDragEnd, updateTextBlock, addNewBlock, deleteBlock, handleQuizAnswer, handleExitQuiz, slashCommand, openSlashCommand, closeSlashCommand, updateSlashFilter, blocks.length]);

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
          {/* Slash Command Menu */}
          {slashCommand?.isOpen && (
            <SlashCommandMenu
              position={slashCommand.position}
              filter={slashCommand.filter}
              onSelect={handleSlashCommand}
              onClose={closeSlashCommand}
            />
          )}

          <div className="space-y-1">
            {blocks.map((block, index) => (
              <div key={`block-container-${block.id}`}>
                {/* Drop zone above block */}
                <div
                  className={`h-1 rounded transition-all duration-200 ${
                    (dropTargetIndex === index && isDragging) || (quizDropTargetIndex === index && isQuizDragging)
                      ? 'bg-primary shadow-sm'
                      : 'hover:bg-muted/50'
                  }`}
                  onDragOver={(e) => {
                    handleDragOver(e, index);
                    handleQuizDragOver(e, index);
                  }}
                  onDrop={(e) => {
                    if (isQuizDragging) {
                      handleQuizDrop(e, index);
                    } else {
                      handleDrop(e, index);
                    }
                  }}
                  style={{
                    minHeight: (dropTargetIndex === index && isDragging) || (quizDropTargetIndex === index && isQuizDragging) ? '4px' : '2px'
                  }}
                />

                {/* Block content */}
                {renderBlock(block, index)}

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
