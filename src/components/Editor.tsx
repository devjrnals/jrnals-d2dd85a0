import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CommandMenu } from "./CommandMenu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type EditorProps = {
  journalId?: string;
  initialContent?: string;
  onWordCountChange?: (count: number) => void;
};

export const Editor = ({ journalId, initialContent = "", onWordCountChange }: EditorProps) => {
  const [content, setContent] = useState(initialContent);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [commandMenuPosition, setCommandMenuPosition] = useState({ top: 0, left: 0 });
  const [commandFilter, setCommandFilter] = useState("");
  const [slashIndex, setSlashIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  useEffect(() => {
    if (!journalId) return;

    // Auto-save after 1 second of no typing
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from("journals")
        .update({ content })
        .eq("id", journalId);

      if (error) {
        toast({ title: "Error saving", variant: "destructive" });
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, journalId]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showCommandMenu && (e.key === "Escape" || e.key === " ")) {
        setShowCommandMenu(false);
        setCommandFilter("");
        setSlashIndex(-1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showCommandMenu]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPosition = e.target.selectionStart;

    setContent(newContent);

    // Calculate word count
    const words = newContent.trim().split(/\s+/).filter(word => word.length > 0);
    if (onWordCountChange) {
      onWordCountChange(words.length);
    }

    // Check for "/" command
    const lastSlash = newContent.lastIndexOf("/", cursorPosition - 1);
    
    if (lastSlash !== -1 && cursorPosition > lastSlash) {
      const textAfterSlash = newContent.substring(lastSlash + 1, cursorPosition);
      
      // Only show menu if there's no space after slash
      if (!textAfterSlash.includes(" ") && !textAfterSlash.includes("\n")) {
        setSlashIndex(lastSlash);
        setCommandFilter(textAfterSlash);
        setShowCommandMenu(true);
        
        // Calculate menu position
        if (textareaRef.current) {
          const textarea = textareaRef.current;
          const rect = textarea.getBoundingClientRect();
          setCommandMenuPosition({
            top: rect.top + 40,
            left: rect.left + 40,
          });
        }
      } else {
        setShowCommandMenu(false);
      }
    } else {
      setShowCommandMenu(false);
      setCommandFilter("");
      setSlashIndex(-1);
    }
  };

  const handleCommandSelect = (command: string) => {
    if (textareaRef.current && slashIndex !== -1) {
      const textarea = textareaRef.current;
      const beforeSlash = content.substring(0, slashIndex);
      const afterCommand = content.substring(textarea.selectionStart);

      let insertText = "";
      switch (command) {
        case "h1":
          insertText = "# ";
          break;
        case "h2":
          insertText = "## ";
          break;
        case "h3":
          insertText = "### ";
          break;
        case "bold":
          insertText = "**bold text** ";
          break;
        case "italic":
          insertText = "*italic text* ";
          break;
        case "code":
          insertText = "`code` ";
          break;
        case "link":
          insertText = "[link text](url) ";
          break;
        case "bullet":
          insertText = "- ";
          break;
        case "numbered":
          insertText = "1. ";
          break;
        case "toggle":
          insertText = "> ";
          break;
        case "divider":
          insertText = "---\n";
          break;
        case "image":
          insertText = "![alt text](url) ";
          break;
        case "quote":
          insertText = "> ";
          break;
      }

      const newContent = beforeSlash + insertText + afterCommand;
      setContent(newContent);

      // Set cursor position after inserted text
      setTimeout(() => {
        if (textareaRef.current) {
          const newPosition = beforeSlash.length + insertText.length;
          textareaRef.current.selectionStart = newPosition;
          textareaRef.current.selectionEnd = newPosition;
          textareaRef.current.focus();
        }
      }, 0);
    }

    setShowCommandMenu(false);
    setCommandFilter("");
    setSlashIndex(-1);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-editor">
      {/* No bottom padding so the textarea can reach viewport bottom */}
      <div className="flex-1 min-h-0 px-12 pt-6 pb-0 flex flex-col">

        <div className="relative flex-1 min-h-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            placeholder="Start writing or type '/' to see commands..."
            className="w-full flex-1 min-h-0 bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none text-base leading-relaxed"
          />

          {showCommandMenu && (
            <CommandMenu
              position={commandMenuPosition}
              onSelect={handleCommandSelect}
              onClose={() => {
                setShowCommandMenu(false);
                setCommandFilter("");
                setSlashIndex(-1);
              }}
              filter={commandFilter}
            />
          )}
        </div>
      </div>
    </div>
  );
};
