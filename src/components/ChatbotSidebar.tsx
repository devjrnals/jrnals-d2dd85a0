import { useState, useRef, useEffect, useCallback } from "react";
import { SendHorizontal, Upload, PanelLeftClose, Share2, Edit, ChevronDown, Search, Plus, BookPlus, FileText, X, ArrowUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromFile } from "@/utils/documentExtractor";
import { LinkTextarea } from "@/components/LinkTextarea";

type QuizData = {
  title: string;
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
  }>;
};

type FlashcardData = {
  title: string;
  cards: Array<{
    id: string;
    front: string;
    back: string;
  }>;
};

type ChatbotSidebarProps = {
  journalTitle?: string;
  journalId?: string;
  className?: string;
  onQuizGenerated?: (quiz: QuizData) => void;
  onFlashcardsGenerated?: (flashcards: FlashcardData) => void;
  onToggleSidebar?: () => void;
  onShare?: () => void;
  onInsertContent?: ((content: string) => void) | null;
  initialMessage?: string;
  initialFiles?: Array<{ name: string; content: string; type: string }>;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: Array<{ name: string; content: string; type: string }>;
  sources?: Array<{ title: string; url: string }>;
};

type SavedChat = {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  journalId?: string; // Track which journal this chat belongs to
};

const id = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
};

// Generate a short title (max 5 words) from user's first message - fallback
const generateChatTitle = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return "New AI chat";
  
  // Remove common question words and clean up
  const words = trimmed
    .split(/\s+/)
    .filter(word => word.length > 0)
    .slice(0, 5); // Take first 5 words max
  
  if (words.length === 0) return "New AI chat";
  
  // Capitalize first letter of first word
  const title = words.join(' ');
  return title.charAt(0).toUpperCase() + title.slice(1);
};

// Truncate title to fit container (sidebar is 420px, so max ~45 chars)
const truncateTitle = (title: string, maxLength: number = 45): string => {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3).trim() + '...';
};

// Generate AI title from user message
const generateAITitle = async (userMessage: string, accessToken: string | null): Promise<string> => {
  if (!accessToken) {
    // Fallback if no token
    return truncateTitle(generateChatTitle(userMessage));
  }

  try {
    // Use ai-chat endpoint which returns a simple JSON response
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        userMessage: `Create a short, descriptive title (6-8 words max) for this conversation: "${userMessage}". Only return the title, nothing else.`,
        journalTitle: 'Chat Title Generation',
        journalId: 'title-generation',
        enableWebSearch: false,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise, descriptive titles for chat conversations. Generate a short, clear title (maximum 6-8 words) based on the user\'s message. The title should be professional and descriptive. Only return the title, nothing else.'
          },
          {
            role: 'user',
            content: `Create a short title for this conversation: "${userMessage}"`
          }
        ]
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate title');
    }

    const data = await response.json();
    // The ai-chat endpoint returns { response: string }
    const aiTitle = (data.response || '').trim() || generateChatTitle(userMessage);
    
    // Clean up the title - remove quotes, extra spaces, etc.
    let cleanedTitle = aiTitle
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/^Title:\s*/i, '') // Remove "Title:" prefix if present
      .trim();
    
    // If title is too long, truncate it
    return truncateTitle(cleanedTitle);
  } catch (error) {
    console.error('Error generating AI title:', error);
    // Fallback to simple title generation
    return truncateTitle(generateChatTitle(userMessage));
  }
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

// Slash command definitions for chat
type ChatSlashCommand = {
  command: string;
  label: string;
  description: string;
  icon?: string;
};

const CHAT_SLASH_COMMANDS: ChatSlashCommand[] = [
  {
    command: 'cite',
    label: 'Cite',
    description: 'Generate citations in APA, MLA, and Chicago formats',
    icon: '📚'
  },
  {
    command: 'fact-check',
    label: 'Fact Check',
    description: 'Verify accuracy of uploaded files or links',
    icon: '✓'
  }
];

// Slash Command Menu Component for Chat
function ChatSlashCommandMenu({
  position,
  filter,
  onSelect,
  onClose
}: {
  position: { top: number; left: number };
  filter: string;
  onSelect: (command: ChatSlashCommand) => void;
  onClose: () => void;
}) {
  const filteredCommands = CHAT_SLASH_COMMANDS.filter(cmd =>
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
        {filteredCommands.map((cmd) => (
          <button
            key={cmd.command}
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            onClick={() => onSelect(cmd)}
          >
            <div className="mr-2 flex h-4 w-4 items-center justify-center">
              {cmd.icon ? (
                <span>{cmd.icon}</span>
              ) : (
                <div className="flex h-4 w-4 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
                  {cmd.command.charAt(0).toUpperCase()}
                </div>
              )}
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

// Function to extract URLs from text
const extractUrls = (text: string): Array<{ title: string; url: string }> => {
  const urls: Array<{ title: string; url: string }> = [];
  
  // More comprehensive URL regex patterns
  const urlRegex = /(https?:\/\/[^\s\)\]\>\"\'\,]+)/gi;
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/gi;
  
  // Extract markdown links [text](url) - reset regex lastIndex
  markdownLinkRegex.lastIndex = 0;
  let match;
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    const title = match[1];
    const url = match[2].trim();
    if (url && !urls.find(u => u.url === url)) {
      // Extract domain from URL
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace(/^www\./, '');
        urls.push({ title: domain, url });
      } catch {
        // If URL parsing fails, use the title or URL itself
        urls.push({ title: title || url, url });
      }
    }
  }
  
  // Extract plain URLs - reset regex lastIndex
  urlRegex.lastIndex = 0;
  while ((match = urlRegex.exec(text)) !== null) {
    let url = match[1].trim();
    // Remove trailing punctuation that might have been captured
    url = url.replace(/[.,;!?]+$/, '');
    // Remove trailing parentheses, brackets, quotes
    url = url.replace(/[\)\]\>\"\']+$/, '');
    
    if (url && !urls.find(u => u.url === url)) {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace(/^www\./, '');
        urls.push({ title: domain, url });
      } catch {
        // Invalid URL, skip
      }
    }
  }
  
  // Also check for URLs in the original text before markdown processing
  // Look for patterns like "Source: https://..." or "See: https://..."
  const sourcePattern = /(?:source|see|reference|link|url)[:\s]+(https?:\/\/[^\s\)\]]+)/gi;
  sourcePattern.lastIndex = 0;
  while ((match = sourcePattern.exec(text)) !== null) {
    const url = match[1].trim().replace(/[.,;!?]+$/, '');
    if (url && !urls.find(u => u.url === url)) {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace(/^www\./, '');
        urls.push({ title: domain, url });
      } catch {
        // Invalid URL, skip
      }
    }
  }
  
  return urls;
};

// Function to reformat AI responses with proper Markdown
const reformatMarkdown = (text: string): string => {
  let formatted = text;
  
  // First, convert key concepts to numbered lists with bold headings
  // Look for patterns like "- Key concept:" or "* Key concept:" before removing asterisks
  const lines = formatted.split('\n');
  const processedLines: string[] = [];
  let inList = false;
  let listNumber = 1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detect if this looks like a key concept (starts with - or * followed by text and colon)
    const keyConceptMatch = trimmed.match(/^[-*]\s*(.+?):\s*(.+)$/);
    
    if (keyConceptMatch) {
      if (!inList) {
        inList = true;
        listNumber = 1;
        processedLines.push(''); // Add spacing before list
      }
      // Convert to numbered list with bold heading
      processedLines.push(`${listNumber}. **${keyConceptMatch[1]}**: ${keyConceptMatch[2]}`);
      listNumber++;
    } else if (trimmed.match(/^[-*]\s/)) {
      // Regular bullet point - keep as is
      if (inList) {
        inList = false;
        processedLines.push(''); // Add spacing after list
      }
      processedLines.push(line.replace(/^\*\s/, '- ').replace(/^-\s/, '- '));
    } else {
      // Regular line
      if (inList && trimmed.length > 0) {
        inList = false;
        processedLines.push(''); // Add spacing after list
      }
      processedLines.push(line);
    }
  }
  
  formatted = processedLines.join('\n');
  
  // Remove single asterisks used for emphasis (*text*) but preserve double asterisks for bold (**text**)
  // First, temporarily replace ** with a placeholder
  formatted = formatted.replace(/\*\*/g, '__BOLD__');
  // Remove single asterisks
  formatted = formatted.replace(/\*([^*]+?)\*/g, '$1');
  // Restore double asterisks
  formatted = formatted.replace(/__BOLD__/g, '**');
  
  // Ensure proper paragraph spacing (double newlines)
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  // Clean up extra spacing
  formatted = formatted.trim();
  
  return formatted;
};

export function ChatbotSidebar({ journalTitle, journalId, className, onQuizGenerated, onFlashcardsGenerated, onToggleSidebar, onShare, onInsertContent, initialMessage, initialFiles }: ChatbotSidebarProps) {
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; content: string; type: string }>>(initialFiles || []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [chatName, setChatName] = useState("New AI chat");
  const [isEditingChatName, setIsEditingChatName] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [chats, setChats] = useState<SavedChat[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const insertContentRef = useRef(onInsertContent);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialSendDoneRef = useRef(false);
  const lastSaveTimeRef = useRef<number>(0);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [slashCommand, setSlashCommand] = useState<{ isOpen: boolean; filter: string; position: { top: number; left: number } } | null>(null);
  const slashCommandRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Keep ref in sync with prop
  useEffect(() => {
    insertContentRef.current = onInsertContent;
  }, [onInsertContent]);

  // Auto-scroll to bottom when messages change or when loading
  useEffect(() => {
    if (messagesEndRef.current) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  }, [messages, isLoading]);

  // Load chats for this journal and reset state when journal changes
  useEffect(() => {
    if (!journalId) {
      // Clear everything if no journalId
      setChats([]);
      setMessages([]);
      setChatName("New AI chat");
      setCurrentChatId(null);
      setDraft("");
      setUploadedFiles([]);
      initialSendDoneRef.current = false;
      return;
    }
    
    // Reset state when switching to a new journal
    setDraft("");
    setUploadedFiles([]);
    initialSendDoneRef.current = false;
    
    // Auto-send initial message if provided (will be handled in separate effect)
    
    // Load chats from localStorage (journal-specific)
    const storageKey = `chatbot-chats-${journalId}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsedChats = JSON.parse(stored);
        if (Array.isArray(parsedChats) && parsedChats.length > 0) {
          // Filter out any chats that don't belong to this journal (safety check)
          const journalChats = parsedChats.filter((chat: SavedChat) => 
            !chat.journalId || chat.journalId === journalId
          );
          // Update any chats missing journalId
          const updatedChats = journalChats.map((chat: SavedChat) => ({
            ...chat,
            journalId: journalId
          }));
          setChats(updatedChats);
          
          // Automatically restore the most recent chat (by updatedAt)
          const sortedChats = [...updatedChats].sort((a, b) => b.updatedAt - a.updatedAt);
          const mostRecentChat = sortedChats[0];
          
          if (mostRecentChat && mostRecentChat.messages && mostRecentChat.messages.length > 0) {
            // Restore the most recent chat
            setCurrentChatId(mostRecentChat.id);
            setChatName(mostRecentChat.name);
            setMessages(mostRecentChat.messages);
          } else {
            // No messages in most recent chat, start fresh
            setMessages([]);
            setChatName("New AI chat");
            setCurrentChatId(null);
          }
          
          // Save back the cleaned list if it was filtered
          if (updatedChats.length !== parsedChats.length) {
            localStorage.setItem(storageKey, JSON.stringify(updatedChats));
          }
        } else {
          setChats([]);
          setMessages([]);
          setChatName("New AI chat");
          setCurrentChatId(null);
        }
      } catch (error) {
        console.warn('Error loading chats:', error);
        setChats([]);
        setMessages([]);
        setChatName("New AI chat");
        setCurrentChatId(null);
      }
    } else {
      // No chats found for this journal, start fresh
      setChats([]);
      setMessages([]);
      setChatName("New AI chat");
      setCurrentChatId(null);
    }
  }, [journalId]);

  // Set initial files when provided
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      setUploadedFiles(initialFiles);
    }
  }, [initialFiles]);

  // Auto-send initial message when journal loads with initial message or files
  useEffect(() => {
    // Only send once per journal/message/files combination
    if (initialSendDoneRef.current) return;
    
    if (journalId && !isLoading && messages.length === 0) {
      const hasMessage = initialMessage && initialMessage.trim();
      const hasFiles = initialFiles && initialFiles.length > 0;
      
      // Send if there's a message OR if there are files (even without a message)
      if (hasMessage || hasFiles) {
        // Ensure files are set in state first
        if (initialFiles && initialFiles.length > 0) {
          setUploadedFiles(initialFiles);
        }
        
        // Use setTimeout to ensure component is fully mounted and state updates are processed
        const timer = setTimeout(() => {
          const messageToSend = hasMessage ? initialMessage!.trim() : "";
          initialSendDoneRef.current = true;
          // Files are already in uploadedFiles state (initialized or set above), so send will include them
          send(messageToSend);
        }, 600); // Delay to ensure state is ready
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage, initialFiles, journalId]); // Run when initialMessage, initialFiles, or journalId changes

  // Save current chat before unmounting or switching journals
  useEffect(() => {
    return () => {
      // Save current chat when component unmounts or journal changes
      if (journalId && currentChatId && messages.length > 0) {
        const storageKey = `chatbot-chats-${journalId}`;
        const stored = localStorage.getItem(storageKey);
        let existingChats: SavedChat[] = [];
        
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              existingChats = parsed;
            }
          } catch (error) {
            console.warn('Error parsing chats on unmount:', error);
          }
        }
        
        const chatData: SavedChat = {
          id: currentChatId,
          name: chatName,
          messages: messages,
          createdAt: existingChats.find(c => c.id === currentChatId)?.createdAt || Date.now(),
          updatedAt: Date.now(),
          journalId: journalId
        };
        
        const existingIndex = existingChats.findIndex(c => c.id === currentChatId);
        if (existingIndex >= 0) {
          existingChats[existingIndex] = chatData;
        } else {
          existingChats.push(chatData);
        }
        
        localStorage.setItem(storageKey, JSON.stringify(existingChats));
      }
    };
  }, [journalId, currentChatId, messages, chatName]);

  // Save chat to localStorage - journal-specific only
  const saveChat = useCallback((chatId: string, chatName: string, chatMessages: ChatMessage[]) => {
    if (!journalId) {
      console.warn('Cannot save chat: journalId is missing');
      return;
    }
    
    const storageKey = `chatbot-chats-${journalId}`;
    
    setChats(prevChats => {
      const existingChats = [...prevChats];
      const existingIndex = existingChats.findIndex(c => c.id === chatId);
      
      const chatData: SavedChat = {
        id: chatId,
        name: chatName,
        messages: chatMessages,
        createdAt: existingIndex >= 0 ? existingChats[existingIndex].createdAt : Date.now(),
        updatedAt: Date.now(),
        journalId: journalId // Explicitly track which journal this chat belongs to
      };
      
      if (existingIndex >= 0) {
        existingChats[existingIndex] = chatData;
      } else {
        existingChats.push(chatData);
      }
      
      localStorage.setItem(storageKey, JSON.stringify(existingChats));
      return existingChats;
    });
  }, [journalId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  // Get user session for authentication
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setAccessToken(session?.access_token ?? null);
    };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const readFileContent = async (file: File): Promise<string> => {
    // Use the document extractor for PDFs, Word docs, and PowerPoints
    // Fallback to text reading for other files
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();
    
    const isDocumentFile = 
      fileName.endsWith('.pdf') ||
      fileName.endsWith('.docx') ||
      fileName.endsWith('.doc') ||
      fileName.endsWith('.pptx') ||
      fileName.endsWith('.ppt') ||
      fileType === 'application/pdf' ||
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword' ||
      fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      fileType === 'application/vnd.ms-powerpoint';
    
    if (isDocumentFile) {
      return await extractTextFromFile(file);
    }
    
    // For text files, use FileReader
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: Array<{ name: string; content: string; type: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const textFileTypes = [
          'text/plain',
          'text/markdown',
          'text/javascript',
          'text/typescript',
          'application/json',
          'text/css',
          'text/html',
          'application/xml',
          'text/xml'
        ];

        const documentFileTypes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-powerpoint'
        ];

        const isTextFile = textFileTypes.includes(file.type) ||
                          file.name.endsWith('.txt') ||
                          file.name.endsWith('.md') ||
                          file.name.endsWith('.js') ||
                          file.name.endsWith('.ts') ||
                          file.name.endsWith('.json') ||
                          file.name.endsWith('.css') ||
                          file.name.endsWith('.html') ||
                          file.name.endsWith('.xml');

        const isDocumentFile = documentFileTypes.includes(file.type) ||
                              file.name.endsWith('.pdf') ||
                              file.name.endsWith('.docx') ||
                              file.name.endsWith('.doc') ||
                              file.name.endsWith('.pptx') ||
                              file.name.endsWith('.ppt');

        if (!isTextFile && !isDocumentFile) {
          toast({
            title: "Unsupported file type",
            description: `File "${file.name}" is not a supported file type. Supported: text files, PDFs, Word documents, and PowerPoint presentations.`,
            variant: "destructive"
          });
          continue;
        }
        
        // Show loading toast for document files
        if (isDocumentFile) {
          toast({
            title: "Processing document",
            description: `Extracting text from "${file.name}"...`,
          });
        }

        // Determine file type - ensure PDFs get correct type even if browser doesn't provide MIME type
        let fileType = file.type;
        if (!fileType || fileType === 'application/octet-stream') {
          if (file.name.toLowerCase().endsWith('.pdf')) {
            fileType = 'application/pdf';
          } else if (file.name.toLowerCase().endsWith('.docx')) {
            fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          } else if (file.name.toLowerCase().endsWith('.doc')) {
            fileType = 'application/msword';
          } else if (file.name.toLowerCase().endsWith('.pptx')) {
            fileType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          } else if (file.name.toLowerCase().endsWith('.ppt')) {
            fileType = 'application/vnd.ms-powerpoint';
          } else {
            fileType = 'text/plain';
          }
        }

        // Try to extract content, but still add file even if extraction fails
        let content = '';
        try {
          content = await readFileContent(file);
        } catch (error) {
          console.error(`Error extracting content from ${file.name}:`, error);
          // Still add the file with error message - user can still reference it
          content = `[Error extracting content from ${file.name}. File uploaded but content extraction failed.]`;
        }
        
        newFiles.push({
          name: file.name,
          content: content,
          type: fileType
        });
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        // Even if there's an error, try to add the file with a placeholder
        const fileName = file.name.toLowerCase();
        let fileType = file.type || 'application/octet-stream';
        if (!fileType || fileType === 'application/octet-stream') {
          if (fileName.endsWith('.pdf')) {
            fileType = 'application/pdf';
          } else if (fileName.endsWith('.docx')) {
            fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          } else if (fileName.endsWith('.doc')) {
            fileType = 'application/msword';
          } else if (fileName.endsWith('.pptx')) {
            fileType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          } else if (fileName.endsWith('.ppt')) {
            fileType = 'application/vnd.ms-powerpoint';
          }
        }
        
        newFiles.push({
          name: file.name,
          content: `[Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}]`,
          type: fileType
        });
      }
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const parseQuizResponse = (response: string): QuizData | null => {
    try {
      console.log('Parsing quiz response:', response);
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

      const result = questions.length > 0 ? { title, questions } : null;
      console.log('Parsed quiz result:', result);
      return result;
    } catch (error) {
      console.error('Error parsing quiz response:', error);
      return null;
    }
  };

  const parseFlashcardsResponse = (response: string): FlashcardData | null => {
    try {
      console.log('Parsing flashcards response:', response);
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

      const result = cards.length > 0 ? { title, cards } : null;
      console.log('Parsed flashcards result:', result);
      return result;
    } catch (error) {
      console.error('Error parsing flashcards response:', error);
      return null;
    }
  };

  const streamChat = async ({
    messages: chatMessages,
    journalTitle: title,
    onDelta,
    onDone,
    onError,
    onStatus,
  }: {
    messages: Array<{ role: string; content: string }>;
    journalTitle: string;
    onDelta: (deltaText: string) => void;
    onDone: () => void;
    onError: (error: string) => void;
    onStatus?: (status: string) => void;
  }) => {
    // Get fresh access token
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      onError("You must be logged in to use the chatbot");
      return;
    }

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        messages: chatMessages, 
        journalTitle: title, 
        enableWebSearch: true,
        journalId: journalId,
        isCiteCommand: isCiteCommand || false,
        isFactCheckCommand: isFactCheckCommand || false
      }),
    });

    if (resp.status === 429) {
      onError("Rate limit exceeded. Please try again later.");
      return;
    }

    if (!resp.ok || !resp.body) {
      const errorData = await resp.json().catch(() => ({}));
      onError(errorData.error || "Failed to start stream");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      let isStatusEvent = false;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        
        // Handle status events
        if (line.startsWith("event: status")) {
          isStatusEvent = true;
          continue;
        }
        
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            
            // Check if this is a status update (either from status event or status field)
            if (isStatusEvent || parsed.status) {
              if (onStatus && parsed.status) {
                onStatus(parsed.status);
              }
              isStatusEvent = false;
              continue;
            }
            
            // Otherwise, it's content
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) onDelta(content);
            isStatusEvent = false;
          } catch {
            textBuffer = line + "\n" + textBuffer;
            isStatusEvent = false;
            break;
          }
        } else {
          isStatusEvent = false;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (raw.startsWith("event: status")) continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.status && onStatus) {
            onStatus(parsed.status);
            continue;
          }
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore partial leftovers */ }
      }
    }

    onDone();
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && uploadedFiles.length === 0) || isLoading) return;

    const isQuizRequest = trimmed.toLowerCase().includes("quiz me on");
    const isFlashcardsRequest = trimmed.toLowerCase().includes("create flashcards on") || trimmed.toLowerCase().includes("flashcards on");
    const isContentGenerationRequest = 
      trimmed.toLowerCase().includes("create structured notes") ||
      trimmed.toLowerCase().includes("create notes") ||
      trimmed.toLowerCase().includes("structured notes") ||
      trimmed.toLowerCase().includes("history of") ||
      trimmed.toLowerCase().includes("summary of") ||
      trimmed.toLowerCase().includes("add to journal") ||
      trimmed.toLowerCase().includes("insert into journal");
    
    // Detect slash commands
    const isCiteCommand = trimmed.startsWith('/cite ');
    const isFactCheckCommand = trimmed.startsWith('/fact-check') || trimmed.startsWith('/factcheck');

    // Create or get current chat ID
    let chatId = currentChatId;
    if (!chatId) {
      chatId = id();
      setCurrentChatId(chatId);
    }
    
    // Generate title from first user message if this is a new chat
    const isNewChat = messages.length === 0;
    if (isNewChat) {
      // Use simple title initially, then generate AI title in background
      const initialTitle = truncateTitle(generateChatTitle(trimmed));
      setChatName(initialTitle);
      
      // Generate AI title asynchronously after initial message
      generateAITitle(trimmed, accessToken).then((aiTitle) => {
        setChatName(aiTitle);
        // Update saved chat with new title
        if (chatId) {
          setMessages((prev) => {
            saveChat(chatId, aiTitle, prev);
            return prev;
          });
        }
      }).catch((error) => {
        console.error('Failed to generate AI title:', error);
        // Keep the initial title if AI generation fails
      });
    }
    
    // Add user message immediately
    const userMessage: ChatMessage = {
      id: id(),
      role: "user",
      content: trimmed,
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined
    };
    
    setMessages((prev) => {
      const updatedMessages = [...prev, userMessage];
      // Save chat after adding user message
      if (chatId) {
        const titleToSave = isNewChat ? truncateTitle(generateChatTitle(trimmed)) : chatName;
        saveChat(chatId, titleToSave, updatedMessages);
      }
      return updatedMessages;
    });
    
    const currentFiles = [...uploadedFiles];
    const currentText = trimmed;
    setDraft("");
    setUploadedFiles([]);
    setIsLoading(true);
    setToolStatus("Thinking...");
    setStatusMessages([]); // Reset status messages for new request

    // Prepare messages for API
    const apiMessages = messages.map(m => {
      let content = m.content;
      if (m.files && m.files.length > 0) {
        content += '\n\n--- Attached Files ---\n';
        m.files.forEach(file => {
          content += `\n## File: ${file.name}\n\`\`\`\n${file.content}\n\`\`\`\n`;
        });
      }
      return { role: m.role, content };
    });

    // Add current user message
    const userContent = currentFiles.length > 0
      ? `${currentText}\n\n--- Attached Files ---\n${currentFiles.map(file => `## File: ${file.name}\n\`\`\`\n${file.content}\n\`\`\``).join('\n')}`
      : currentText;

    apiMessages.push({ role: 'user', content: userContent });

    let assistantContent = "";
    const SAVE_INTERVAL = 2000; // Save every 2 seconds during streaming
    
    const upsertAssistant = (nextChunk: string) => {
      assistantContent += nextChunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        let updatedMessages: ChatMessage[];
        if (last?.role === "assistant") {
          updatedMessages = prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        } else {
          updatedMessages = [...prev, { id: id(), role: "assistant", content: assistantContent }];
        }
        
        // Save chat periodically during streaming (throttled to avoid too many writes)
        const now = Date.now();
        if (chatId && (now - lastSaveTimeRef.current >= SAVE_INTERVAL)) {
          saveChat(chatId, chatName, updatedMessages);
          lastSaveTimeRef.current = now;
        }
        
        return updatedMessages;
      });
      
      // Auto-scroll to bottom as assistant response generates
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 50);
    };

    try {
      await streamChat({
        messages: apiMessages,
        journalTitle: journalTitle || 'Untitled',
        onDelta: (chunk) => upsertAssistant(chunk),
        onStatus: (status) => {
          setStatusMessages(prev => {
            // Add status if not already present
            if (!prev.includes(status)) {
              return [...prev, status];
            }
            return prev;
          });
          setToolStatus(status);
        },
        onDone: () => {
          setToolStatus(null);
          setStatusMessages([]);
          // Handle quiz and flashcards generation
          if (isQuizRequest) {
            const quizData = parseQuizResponse(assistantContent);
            if (quizData && onQuizGenerated) {
              onQuizGenerated(quizData);
              setMessages((prev) => {
                const updatedMessages = [
                  ...prev.slice(0, -1), // Remove the last assistant message
                  {
                    id: id(),
                    role: "assistant" as const,
                    content: `Quiz generated! Check your journal to start taking the quiz.`
                  },
                ];
                // Save chat
                if (chatId) {
                  saveChat(chatId, chatName, updatedMessages);
                }
                return updatedMessages;
              });
            }
          } else if (isFlashcardsRequest) {
            const flashcardsData = parseFlashcardsResponse(assistantContent);
            if (flashcardsData && onFlashcardsGenerated) {
              onFlashcardsGenerated(flashcardsData);
              setMessages((prev) => {
                const updatedMessages = [
                  ...prev.slice(0, -1), // Remove the last assistant message
                  {
                    id: id(),
                    role: "assistant" as const,
                    content: `Flashcards generated! Check your journal to start studying.`
                  },
                ];
                // Save chat
                if (chatId) {
                  saveChat(chatId, chatName, updatedMessages);
                }
                return updatedMessages;
              });
            }
          } else if (isContentGenerationRequest && onInsertContent && assistantContent) {
            // Insert content into journal
            try {
              onInsertContent(assistantContent);
              setMessages((prev) => {
                const updatedMessages = [
                  ...prev.slice(0, -1), // Remove the last assistant message
                  {
                    id: id(),
                    role: "assistant" as const,
                    content: `Content has been added to your journal!`
                  },
                ];
                // Save chat
                if (chatId) {
                  saveChat(chatId, chatName, updatedMessages);
                }
                return updatedMessages;
              });
              toast({
                title: "Content added",
                description: "The generated content has been inserted into your journal.",
              });
            } catch (error) {
              console.error('Error inserting content:', error);
              toast({
                title: "Error",
                description: "Failed to insert content into journal.",
                variant: "destructive"
              });
            }
          } else {
            // Save final chat state after normal response completes
            setMessages((prev) => {
              // Ensure we save the complete final state
              if (chatId) {
                saveChat(chatId, chatName, prev);
              }
              return prev;
            });
          }
          // Reset save timer after completion
          lastSaveTimeRef.current = 0;
          setIsLoading(false);
        },
        onError: (error) => {
          setToolStatus(null);
          setStatusMessages([]);
          toast({
            title: "Error",
            description: error,
            variant: "destructive"
          });
          setMessages((prev) => {
            const errorMessage: ChatMessage = {
              id: id(),
              role: "assistant",
              content: "Sorry, I'm having trouble connecting right now. Please try again later.",
            };
            const updatedMessages = [...prev, errorMessage];
            // Save chat with error message
            if (chatId) {
              saveChat(chatId, chatName, updatedMessages);
            }
            return updatedMessages;
          });
          setIsLoading(false);
        }
      });
    } catch (error) {
      setToolStatus(null);
      setStatusMessages([]);
      console.error('Error calling chat API:', error);
      setMessages((prev) => {
        const errorMessage: ChatMessage = {
          id: id(),
          role: "assistant",
          content: "Sorry, I'm having trouble connecting right now. Please try again later.",
        };
        const updatedMessages = [...prev, errorMessage];
        // Save chat with error message
        if (chatId) {
          saveChat(chatId, chatName, updatedMessages);
        }
        return updatedMessages;
      });
      setIsLoading(false);
    }
  };

  return (
    <aside
      aria-label="Chatbot"
      className={cn(
        "w-[420px] shrink-0 border-l border-border bg-card flex flex-col overflow-hidden",
        className,
      )}
    >

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3" ref={messagesContainerRef}>
          {messages.map((m) => (
            <div key={m.id} className="max-w-[90%] space-y-2">
              <div className="space-y-2">
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm leading-relaxed",
                    m.role === "user"
                      ? "ml-auto bg-gray-100 dark:bg-[#333333] text-gray-900 dark:text-[#F3FAF9]"
                      : "mr-auto bg-transparent text-foreground prose prose-sm dark:prose-invert max-w-none",
                  )}
                >
                  {m.role === "assistant" ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                        h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h3>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="ml-2">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
                            {children}
                          </a>
                        ),
                        code: ({ children }) => (
                          <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                        ),
                        pre: ({ children }) => (
                          <pre className="bg-muted p-2 rounded overflow-x-auto mb-3 text-xs">{children}</pre>
                        ),
                      }}
                    >
                      {reformatMarkdown(m.content)}
                    </ReactMarkdown>
                  ) : (
                    m.content
                  )}
                </div>
                {/* Add to Journal button for assistant messages */}
                {m.role === "assistant" && (
                  <div className="flex items-center gap-2 mr-auto mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!m.content.trim()}
                      onClick={() => {
                        if (!m.content.trim()) {
                          toast({
                            title: "No content",
                            description: "This message has no content to add.",
                            variant: "destructive"
                          });
                          return;
                        }

                        // Use the ref first (most up-to-date), then fallback to prop
                        const insertFn = insertContentRef.current || onInsertContent;
                        
                        if (!insertFn) {
                          toast({
                            title: "Unable to add content",
                            description: "Journal editor is not ready. Please wait a moment and try again.",
                            variant: "destructive"
                          });
                          return;
                        }

                        try {
                          // Get the raw text content from the AI response
                          // Insert it as plain text (as if user typed it) - no markdown parsing
                          const contentToInsert = m.content;
                          
                          // Insert the content as plain text in a paragraph block
                          insertFn(contentToInsert);
                          
                          toast({
                            title: "Added to journal",
                            description: "The chat message has been added to your journal.",
                          });
                        } catch (error) {
                          console.error('ChatbotSidebar: Error adding content to journal:', error);
                          toast({
                            title: "Error",
                            description: error instanceof Error ? error.message : "Failed to add content to journal.",
                            variant: "destructive"
                          });
                        }
                      }}
                    >
                      <BookPlus className="h-3 w-3 mr-1.5" />
                      Add to Journal
                    </Button>
                  </div>
                )}
                {/* Source bubbles for assistant messages */}
                {m.role === "assistant" && (() => {
                  // Extract URLs from the original content (before markdown reformatting)
                  const urls = extractUrls(m.content);
                  const displayUrls = urls.length > 3 ? urls.slice(0, 3) : urls;
                  const remainingCount = urls.length > 3 ? urls.length - 3 : 0;
                  
                  
                  if (displayUrls.length === 0) return null;
                  
                  return (
                    <div className="flex flex-wrap gap-2 mr-auto mt-2">
                      {displayUrls.map((source, index) => (
                        <a
                          key={`${source.url}-${index}`}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span>{source.title}</span>
                        </a>
                      ))}
                      {remainingCount > 0 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs">
                          +{remainingCount}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              {m.files && m.files.length > 0 && (
                <div className={cn(
                  "text-xs px-3 py-1 rounded-md",
                  m.role === "user"
                    ? "ml-auto bg-gray-100/80 dark:bg-[#333333] text-gray-900 dark:text-[#F3FAF9]"
                    : "mr-auto bg-transparent text-muted-foreground",
                )}>
                  📎 {m.files.length} file{m.files.length > 1 ? 's' : ''} attached: {m.files.map(f => f.name).join(', ')}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="mr-auto max-w-[90%] rounded-lg px-3 py-2 text-sm leading-relaxed bg-transparent space-y-1">
              {statusMessages.length > 0 ? (
                <div className="space-y-1">
                  {statusMessages.map((status, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <div className="w-0.5 h-4 bg-gray-300 dark:bg-gray-600 mt-0.5 flex-shrink-0" />
                      <span>{status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="thinking-text text-sm">
                  {toolStatus || "Thinking…"}
                </span>
              )}
            </div>
          )}
          {/* Scroll anchor at bottom */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-3 bg-card">
        {/* Uploaded Files Display */}
        {uploadedFiles.length > 0 && (
          <div className="mb-3 overflow-x-auto">
            <div className="flex gap-2 w-max">
              {uploadedFiles.map((file, index) => {
              // Get file type from extension
              const getFileType = (fileName: string, fileType: string): string => {
                const extension = fileName.split('.').pop()?.toUpperCase();
                if (fileType === 'application/pdf' || extension === 'PDF') return 'PDF';
                if (fileType.includes('word') || extension === 'DOCX' || extension === 'DOC') return 'DOC';
                if (fileType.includes('powerpoint') || extension === 'PPTX' || extension === 'PPT') return 'PPT';
                if (extension === 'TXT') return 'TXT';
                if (extension === 'MD') return 'MD';
                return extension || 'FILE';
              };

              const fileType = getFileType(file.name, file.type);
              const truncatedName = file.name.length > 30 ? file.name.substring(0, 30) + '...' : file.name;

              return (
                <div key={index} className="flex items-center gap-2 bg-white dark:bg-gray-50 rounded-xl p-2 border border-gray-200 dark:border-gray-300 w-fit">
                  {/* Red square icon with white document */}
                  <div className="flex-shrink-0 w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  {/* File name and type */}
                  <div className="flex-shrink-0">
                    <div className="text-sm text-gray-900 font-medium whitespace-nowrap">{truncatedName}</div>
                    <div className="text-xs text-gray-500">{fileType}</div>
                  </div>
                  {/* Remove button */}
                  <button
                    type="button"
                    className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-900 hover:text-gray-700 transition-colors"
                    onClick={() => removeFile(index)}
                    disabled={isLoading}
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            </div>
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <div className="flex-1 relative" ref={textareaRef}>
            <LinkTextarea
              value={draft}
              onChange={(value) => {
                setDraft(value);
                // Detect "/" for slash commands
                const lastSlashIndex = value.lastIndexOf('/');
                if (lastSlashIndex !== -1) {
                  // Check if there's a space after the slash (command completed)
                  const afterSlash = value.substring(lastSlashIndex + 1);
                  const hasSpace = afterSlash.includes(' ');
                  
                  if (!hasSpace && textareaRef.current) {
                    // Get cursor position
                    const rect = textareaRef.current.getBoundingClientRect();
                    const position = {
                      top: rect.bottom + 8,
                      left: rect.left
                    };
                    
                    setSlashCommand({
                      isOpen: true,
                      filter: afterSlash,
                      position
                    });
                  } else {
                    setSlashCommand(null);
                  }
                } else {
                  setSlashCommand(null);
                }
              }}
              placeholder={isLoading ? "Waiting for response..." : "Ask about this journal…"}
              className="min-h-[44px] max-h-32 resize-none pr-20 text-sm rounded-[15px] px-4 py-3 bg-gray-100 dark:bg-[#333333]"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                  if (slashCommand?.isOpen) {
                    // If menu is open, don't send - let user select command
                    return;
                  }
                  e.preventDefault();
                  send(draft);
                } else if (e.key === "Escape" && slashCommand?.isOpen) {
                  setSlashCommand(null);
                }
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.js,.ts,.json,.css,.html,.xml,.pdf,.doc,.docx,.ppt,.pptx,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-10 bottom-1 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Upload files"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <button
              type="submit"
              disabled={isLoading || (!draft.trim() && uploadedFiles.length === 0)}
              className="absolute right-1 bottom-1 flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send message"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </div>
        </form>
        
        {/* Slash Command Menu */}
        {slashCommand?.isOpen && (
          <ChatSlashCommandMenu
            position={slashCommand.position}
            filter={slashCommand.filter}
            onSelect={(cmd) => {
              const currentText = draft;
              const lastSlashIndex = currentText.lastIndexOf('/');
              if (lastSlashIndex !== -1) {
                const beforeSlash = currentText.substring(0, lastSlashIndex);
                const newText = `${beforeSlash}/${cmd.command} `;
                setDraft(newText);
                setSlashCommand(null);
                // Focus back on textarea contentEditable
                setTimeout(() => {
                  const contentEditable = textareaRef.current?.querySelector('[contenteditable="true"]') as HTMLElement;
                  contentEditable?.focus();
                }, 0);
              }
            }}
            onClose={() => setSlashCommand(null)}
          />
        )}
      </div>
    </aside>
  );
}
