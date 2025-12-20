import { useState, useRef } from "react";
import { SendHorizontal, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

type ChatbotSidebarProps = {
  journalTitle?: string;
  className?: string;
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

export function ChatbotSidebar({ journalTitle, className }: ChatbotSidebarProps) {
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; content: string; type: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: id(),
      role: "assistant",
      content: `Hi! I'm your AI assistant for this journal${journalTitle ? ` "${journalTitle}"` : ''}. Ask me anything about your writing, get help organizing your thoughts, or request summaries and insights. I'm powered by GPT-4o and ready to help!`,
    },
  ]);

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

  const send = async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && uploadedFiles.length === 0) || isLoading) return;

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

    try {
      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a helpful AI assistant for a journal/note-taking application. The user is currently working on a journal titled "${journalTitle || 'Untitled'}". Provide helpful, relevant responses to their questions about journaling, writing, organization, or any other topics they bring up. When files are provided, analyze their contents and use that information to provide more relevant and informed responses. Be concise but informative.`
            },
            ...messages.map(m => {
              let content = m.content;
              if (m.files && m.files.length > 0) {
                content += '\n\n--- Attached Files ---\n';
                m.files.forEach(file => {
                  content += `\n## File: ${file.name}\n\`\`\`\n${file.content}\n\`\`\`\n`;
                });
              }
              return { role: m.role, content };
            }),
            {
              role: 'user',
              content: currentFiles.length > 0
                ? `${currentText}\n\n--- Attached Files ---\n${currentFiles.map(file => `## File: ${file.name}\n\`\`\`\n${file.content}\n\`\`\``).join('\n')}`
                : currentText
            }
          ],
          max_tokens: 1500, // Increased to accommodate file contents
          temperature: 0.7,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const aiResponse = data.choices[0].message.content;
        setMessages((prev) => [
          ...prev,
          { id: id(), role: "assistant", content: aiResponse },
        ]);
      } else {
        throw new Error(data.error?.message || 'API call failed');
      }
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: id(),
          role: "assistant",
          content: "Sorry, I'm having trouble connecting right now. Please try again later.",
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

      <div className="p-3 border-t border-border bg-card">
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
        <div className="mt-2 text-[11px] text-muted-foreground">
          Tip: Press Enter to send, Shift+Enter for a new line. Upload files for AI analysis.
        </div>
      </div>
    </aside>
  );
}