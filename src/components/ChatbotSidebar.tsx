import { useState, useRef } from "react";
import { SendHorizontal, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

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

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export function ChatbotSidebar({ journalTitle, journalId, className, onQuizGenerated, onFlashcardsGenerated }: ChatbotSidebarProps) {
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; content: string; type: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

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
          toast({
            title: "Unsupported file type",
            description: `File "${file.name}" is not a supported text file type.`,
            variant: "destructive"
          });
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
        toast({
          title: "Error reading file",
          description: `Error reading file "${file.name}". Please try again.`,
          variant: "destructive"
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
  }: {
    messages: Array<{ role: string; content: string }>;
    journalTitle: string;
    onDelta: (deltaText: string) => void;
    onDone: () => void;
    onError: (error: string) => void;
  }) => {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: chatMessages, journalTitle: title }),
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
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
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

    // Add user message immediately
    setMessages((prev) => [
      ...prev,
      {
        id: id(),
        role: "user",
        content: trimmed,
        files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined
      },
    ]);
    const currentFiles = [...uploadedFiles];
    const currentText = trimmed;
    setDraft("");
    setUploadedFiles([]);
    setIsLoading(true);

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
    const upsertAssistant = (nextChunk: string) => {
      assistantContent += nextChunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...prev, { id: id(), role: "assistant", content: assistantContent }];
      });
    };

    try {
      await streamChat({
        messages: apiMessages,
        journalTitle: journalTitle || 'Untitled',
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => {
          // Handle quiz and flashcards generation
          if (isQuizRequest) {
            const quizData = parseQuizResponse(assistantContent);
            if (quizData && onQuizGenerated) {
              onQuizGenerated(quizData);
              setMessages((prev) => [
                ...prev.slice(0, -1), // Remove the last assistant message
                {
                  id: id(),
                  role: "assistant",
                  content: `Quiz generated! Check your journal to start taking the quiz.`
                },
              ]);
            }
          } else if (isFlashcardsRequest) {
            const flashcardsData = parseFlashcardsResponse(assistantContent);
            if (flashcardsData && onFlashcardsGenerated) {
              onFlashcardsGenerated(flashcardsData);
              setMessages((prev) => [
                ...prev.slice(0, -1), // Remove the last assistant message
                {
                  id: id(),
                  role: "assistant",
                  content: `Flashcards generated! Check your journal to start studying.`
                },
              ]);
            }
          }
          setIsLoading(false);
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error,
            variant: "destructive"
          });
          setMessages((prev) => [
            ...prev,
            {
              id: id(),
              role: "assistant",
              content: "Sorry, I'm having trouble connecting right now. Please try again later.",
            },
          ]);
          setIsLoading(false);
        }
      });
    } catch (error) {
      console.error('Error calling chat API:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: id(),
          role: "assistant",
          content: "Sorry, I'm having trouble connecting right now. Please try again later.",
        },
      ]);
      setIsLoading(false);
    }
  };

  return (
    <aside
      aria-label="Chatbot"
      className={cn(
        "w-[360px] shrink-0 border-l border-border bg-card flex flex-col overflow-hidden",
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

        {/* Quick Suggestion Buttons */}
        <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs whitespace-nowrap flex-shrink-0"
            onClick={() => setDraft("quiz me on ")}
            disabled={isLoading}
          >
            quiz me on
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs whitespace-nowrap flex-shrink-0"
            onClick={() => setDraft("create flashcards on ")}
            disabled={isLoading}
          >
            create flashcards on
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs whitespace-nowrap flex-shrink-0"
            onClick={() => setDraft("generate notes on ")}
            disabled={isLoading}
          >
            generate notes on
          </Button>
        </div>

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
              placeholder={isLoading ? "Waiting for response..." : "Ask about this journal…"}
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
          <Button type="submit" className="shrink-0" disabled={isLoading || (!draft.trim() && uploadedFiles.length === 0)}>
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </aside>
  );
}
