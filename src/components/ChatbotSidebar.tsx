import { useState, useRef, useEffect } from "react";
import { SendHorizontal, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

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
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: Array<{ name: string; content: string; type: string }>;
};

const id = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
};

export function ChatbotSidebar({ journalTitle, journalId, className, onQuizGenerated, onFlashcardsGenerated }: ChatbotSidebarProps) {
  console.log('ChatbotSidebar initialized for journal:', journalId, journalTitle);

  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; content: string; type: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize messages state - this will be properly managed by useEffect
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Clear active suggestion if draft doesn't match
  useEffect(() => {
    const suggestions = ["quiz me on ", "create flashcards on ", "generate notes on "];
    if (activeSuggestion && !draft.startsWith(activeSuggestion)) {
      setActiveSuggestion(null);
    }
  }, [draft, activeSuggestion]);

  // Load messages when journalId changes - ensures complete isolation
  useEffect(() => {
    console.log('Journal changed, clearing context and loading messages for:', journalId, journalTitle);

    // Step 1: Clear all current state to prevent any cross-journal leakage
    setMessages([]);
    setChatId(null);
    setDraft("");
    setActiveSuggestion(null);
    setUploadedFiles([]);
    setIsLoading(false);
    setIsInitializing(true);

    // Step 2: Handle no journal context
    if (!journalId) {
      // No journal context - use generic welcome
      setMessages([
        {
          id: id(),
          role: "assistant",
          content: `Hi! I'm your AI assistant. Ask me anything about journaling, writing, or organization. I'm powered by GPT-4o and ready to help!`,
        },
      ]);
      setIsInitializing(false);
      return;
    }

    // Step 3: Load or create chat for this journal
    const loadOrCreateChat = async () => {
      try {
        // First, try to find existing chat for this journal
        let { data: existingChat, error: chatError } = await supabase
          .from('chats')
          .select('id')
          .eq('journal_id', journalId)
          .single();

        let currentChatId: string;

        if (chatError && chatError.code === 'PGRST116') {
          // No chat exists, create one
          console.log(`Creating new chat for journal ${journalId}`);
          const { data: newChat, error: createError } = await supabase
            .from('chats')
            .insert({ journal_id: journalId })
            .select('id')
            .single();

          if (createError) throw createError;
          currentChatId = newChat.id;
        } else if (chatError) {
          throw chatError;
        } else {
          currentChatId = existingChat.id;
        }

        setChatId(currentChatId);

        // Step 4: Load messages for this chat
        const { data: chatMessages, error: messagesError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('chat_id', currentChatId)
          .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        // Convert database messages to ChatMessage format
        const loadedMessages: ChatMessage[] = (chatMessages || []).map(msg => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          files: msg.files as Array<{ name: string; content: string; type: string }> | undefined
        }));

        if (loadedMessages.length === 0) {
          // Start with empty conversation for this journal
          console.log(`Starting empty conversation context for journal ${journalId}`);
          setMessages([]);
        } else {
          console.log(`Loaded ${loadedMessages.length} messages for journal ${journalId}`);
          setMessages(loadedMessages);
        }

      } catch (error) {
        console.error('Error loading/creating chat for journal:', journalId, error);
        // Fallback to in-memory welcome message
        setMessages([
          {
            id: id(),
            role: "assistant",
            content: `Hi! I'm your AI assistant for this journal${journalTitle ? ` "${journalTitle}"` : ''}. There was an issue loading your chat history. Ask me anything about your writing!`,
          },
        ]);
      } finally {
        setIsInitializing(false);
      }
    };

    loadOrCreateChat();
  }, [journalId, journalTitle]);

  // Messages are now saved to database when added, no need for separate save effect

  // Function to clear chat history for current journal (exposed via window for testing)
  const clearChatHistory = async () => {
    if (!journalId || !chatId) {
      console.warn('Cannot clear chat history: no journal or chat context');
      return;
    }

    try {
      // Delete all messages for this chat from database
      const { error: deleteError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('chat_id', chatId);

      if (deleteError) throw deleteError;

      console.log(`Cleared chat history for journal ${journalId}`);

      // Clear current state
      setMessages([]);
      setDraft("");
      setActiveSuggestion(null);
      setUploadedFiles([]);
      setIsLoading(false);

      // Start with empty conversation for this journal
      setMessages([]);

    } catch (error) {
      console.error('Error clearing chat history for journal:', journalId, error);
    }
  };

  // Expose clearChatHistory to window for testing
  useEffect(() => {
    (window as any).clearChatHistory = clearChatHistory;
    return () => {
      delete (window as any).clearChatHistory;
    };
  }, [clearChatHistory]);

  const readFileContent = (file: File): Promise<string> => {
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
        // Check if it's a text file
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

        const isTextFile = textFileTypes.includes(file.type) ||
                          file.name.endsWith('.txt') ||
                          file.name.endsWith('.md') ||
                          file.name.endsWith('.js') ||
                          file.name.endsWith('.ts') ||
                          file.name.endsWith('.json') ||
                          file.name.endsWith('.css') ||
                          file.name.endsWith('.html') ||
                          file.name.endsWith('.xml');

        if (!isTextFile) {
          alert(`File "${file.name}" is not a supported text file type. Please upload text files only.`);
          continue;
        }

        const content = await readFileContent(file);
        newFiles.push({
          name: file.name,
          content: content,
          type: file.type || 'text/plain'
        });
      } catch (error) {
        console.error(`Error reading file ${file.name}:`, error);
        alert(`Error reading file "${file.name}". Please try again.`);
      }
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
    // Clear the input
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

  const send = async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && uploadedFiles.length === 0) || isLoading) return;

    // Validate journal and chat context before sending
    if (!journalId || !chatId) {
      console.error('Cannot send AI request: no journal or chat context');
      setMessages((prev) => [
        ...prev,
        {
          id: id(),
          role: "assistant",
          content: "Error: No journal context available. Please ensure you're viewing a valid journal."
        },
      ]);
      return;
    }

    const isQuizRequest = trimmed.toLowerCase().includes("quiz me on");
    const isFlashcardsRequest = trimmed.toLowerCase().includes("create flashcards on") || trimmed.toLowerCase().includes("flashcards on");

    // Validate current messages context before proceeding
    const currentMessages = [...messages];
    const isValidContext = currentMessages.every(msg =>
      msg.role && typeof msg.content === 'string' && msg.id
    );

    if (!isValidContext) {
      console.error('Invalid message context detected, clearing and reinitializing');
      // Clear corrupted context and start empty
      setMessages([]);
      return;
    }

    // Add user message immediately
    const userMessage = {
      id: id(),
      role: "user" as const,
      content: trimmed,
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined
    };

    setMessages((prev) => [...prev, userMessage]);

    // Save user message to database
    try {
      await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatId,
          role: userMessage.role,
          content: userMessage.content,
          files: userMessage.files
        });
    } catch (error) {
      console.error('Error saving user message to database:', error);
      // Continue with AI request even if database save fails
    }
    const currentFiles = [...uploadedFiles];
    const currentText = trimmed;
    setDraft("");
    setUploadedFiles([]);
    setActiveSuggestion(null);
    setIsLoading(true);

    try {
      // Validate Supabase URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured. Please check your environment variables.');
      }

      // Get auth token for backend request
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Authentication required. Please log in to use AI features.');
      }

      // Call backend AI service with journal isolation
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          journalId: journalId,
          chatId: chatId,
          journalTitle: journalTitle,
          messages: currentMessages, // Only validated messages for this journal
          userMessage: currentText,
          files: currentFiles,
          isQuizRequest: isQuizRequest,
          isFlashcardsRequest: isFlashcardsRequest,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Validate that response belongs to the correct journal
        if (data.journalId !== journalId) {
          throw new Error('Journal context mismatch - possible isolation breach');
        }

        const aiResponse = data.response;

        if (isQuizRequest) {
          // Parse quiz response and pass to parent
          const quizData = parseQuizResponse(aiResponse);
          if (quizData && onQuizGenerated) {
            onQuizGenerated(quizData);
            const assistantMessage = {
              id: id(),
              role: "assistant" as const,
              content: `Quiz generated! Check your journal to start taking the quiz.`
            };
            setMessages((prev) => [...prev, assistantMessage]);
            // Save to database
            await supabase.from('chat_messages').insert({
              chat_id: chatId,
              role: assistantMessage.role,
              content: assistantMessage.content
            });
          } else {
            // Fallback if parsing fails
            const assistantMessage = {
              id: id(),
              role: "assistant" as const,
              content: `I couldn't generate a quiz from that response. Here's what I got:\n\n${aiResponse}`
            };
            setMessages((prev) => [...prev, assistantMessage]);
            // Save to database
            await supabase.from('chat_messages').insert({
              chat_id: chatId,
              role: assistantMessage.role,
              content: assistantMessage.content
            });
          }
        } else if (isFlashcardsRequest) {
          // Parse flashcards response and pass to parent
          const flashcardsData = parseFlashcardsResponse(aiResponse);
          if (flashcardsData && onFlashcardsGenerated) {
            onFlashcardsGenerated(flashcardsData);
            const assistantMessage = {
              id: id(),
              role: "assistant" as const,
              content: `Flashcards generated! Check your journal to start studying.`
            };
            setMessages((prev) => [...prev, assistantMessage]);
            // Save to database
            await supabase.from('chat_messages').insert({
              chat_id: chatId,
              role: assistantMessage.role,
              content: assistantMessage.content
            });
          } else {
            // Fallback if parsing fails
            const assistantMessage = {
              id: id(),
              role: "assistant" as const,
              content: `I couldn't generate flashcards from that response. Here's what I got:\n\n${aiResponse}`
            };
            setMessages((prev) => [...prev, assistantMessage]);
            // Save to database
            await supabase.from('chat_messages').insert({
              chat_id: chatId,
              role: assistantMessage.role,
              content: assistantMessage.content
            });
          }
        } else {
          const assistantMessage = {
            id: id(),
            role: "assistant" as const,
            content: aiResponse
          };
          setMessages((prev) => [...prev, assistantMessage]);
          // Save to database
          await supabase.from('chat_messages').insert({
            chat_id: chatId,
            role: assistantMessage.role,
            content: assistantMessage.content
          });
        }
      } else {
        throw new Error(data.error || 'AI service unavailable');
      }
      } catch (error) {
        console.error('Error calling OpenAI API:', error);
        const errorMessage = error instanceof Error && error.message.includes('API key not configured')
          ? "OpenAI API key not configured. Please add your API key to the .env file."
          : "Sorry, I'm having trouble connecting right now. Please try again later.";

        setMessages((prev) => [
          ...prev,
          {
            id: id(),
            role: "assistant",
            content: errorMessage,
          },
        ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <aside
      aria-label="Chatbot"
      className={cn(
        "w-[360px] shrink-0 bg-card flex flex-col overflow-hidden",
        className,
      )}
    >
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {messages.map((m) => (
            <div key={m.id} className="max-w-[90%] space-y-2">
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-muted text-foreground",
                )}
              >
                {m.content}
              </div>
              {m.files && m.files.length > 0 && (
                <div className={cn(
                  "text-xs px-3 py-1 rounded-md",
                  m.role === "user"
                    ? "ml-auto bg-primary/80 text-primary-foreground"
                    : "mr-auto bg-muted/80 text-muted-foreground",
                )}>
                  📎 {m.files.length} file{m.files.length > 1 ? 's' : ''} attached: {m.files.map(f => f.name).join(', ')}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="mr-auto max-w-[90%] rounded-lg px-3 py-2 text-sm leading-relaxed bg-muted text-foreground">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick Suggestions */}
      <div className="px-3 py-2 bg-card">
        <div className="flex gap-1 overflow-x-auto pb-1">
          <Button
            type="button"
            variant={activeSuggestion === "quiz me on " ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs whitespace-nowrap flex-shrink-0"
            onClick={() => {
              setDraft("quiz me on ");
              setActiveSuggestion("quiz me on ");
            }}
            disabled={isLoading || !import.meta.env.VITE_OPENAI_API_KEY}
          >
            quiz me on
          </Button>
          <Button
            type="button"
            variant={activeSuggestion === "create flashcards on " ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs whitespace-nowrap flex-shrink-0"
            onClick={() => {
              setDraft("create flashcards on ");
              setActiveSuggestion("create flashcards on ");
            }}
            disabled={isLoading || !import.meta.env.VITE_OPENAI_API_KEY}
          >
            create flashcards on
          </Button>
          <Button
            type="button"
            variant={activeSuggestion === "generate notes on " ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs whitespace-nowrap flex-shrink-0"
            onClick={() => {
              setDraft("generate notes on ");
              setActiveSuggestion("generate notes on ");
            }}
            disabled={isLoading || !import.meta.env.VITE_OPENAI_API_KEY}
          >
            generate notes on
          </Button>
        </div>
      </div>

      <div className="p-3 bg-card">
        {/* Uploaded Files Display */}
        {uploadedFiles.length > 0 && (
          <div className="mb-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Attached Files:</div>
            {uploadedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-muted rounded-md p-2">
                <Upload className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-foreground truncate flex-1">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeFile(index)}
                  disabled={isLoading}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <div className="flex-1 relative">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                !import.meta.env.VITE_OPENAI_API_KEY
                  ? "Please configure OpenAI API key first"
                  : isLoading
                    ? "Waiting for response..."
                    : "Ask about this journal…"
              }
              className="min-h-[44px] max-h-32 resize-none pr-10"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                  e.preventDefault();
                  send(draft);
                }
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.js,.ts,.json,.css,.html,.xml,text/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 bottom-1 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Upload files"
            >
              <Upload className="h-4 w-4" />
            </Button>
          </div>
          <Button
            type="submit"
            className="shrink-0"
            disabled={isLoading || (!draft.trim() && uploadedFiles.length === 0) || !import.meta.env.VITE_OPENAI_API_KEY}
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </aside>
  );
}