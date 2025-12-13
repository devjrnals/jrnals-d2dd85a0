import { useState, useEffect, useRef } from "react";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ChevronRight,
  Minus,
  Image as ImageIcon,
  Quote,
  Link,
  Code,
  Bold,
  Italic
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CommandMenuProps {
  position: { top: number; left: number };
  onSelect: (command: string) => void;
  onClose: () => void;
  filter: string;
}

const commands = [
  { icon: Heading1, label: "Heading 1", value: "h1", keywords: ["heading", "h1", "title", "header"] },
  { icon: Heading2, label: "Heading 2", value: "h2", keywords: ["heading", "h2", "subtitle", "header"] },
  { icon: Heading3, label: "Heading 3", value: "h3", keywords: ["heading", "h3", "header"] },
  { icon: Bold, label: "Bold", value: "bold", keywords: ["bold", "strong", "**"] },
  { icon: Italic, label: "Italic", value: "italic", keywords: ["italic", "emphasis", "*"] },
  { icon: Code, label: "Code", value: "code", keywords: ["code", "inline", "`"] },
  { icon: Link, label: "Link", value: "link", keywords: ["link", "url", "href"] },
  { icon: List, label: "Bullet list", value: "bullet", keywords: ["bullet", "list", "ul", "-"] },
  { icon: ListOrdered, label: "Numbered list", value: "numbered", keywords: ["numbered", "list", "ol", "ordered", "1."] },
  { icon: ChevronRight, label: "Toggle list", value: "toggle", keywords: ["toggle", "collapsible", "▶"] },
  { icon: Minus, label: "Divider", value: "divider", keywords: ["divider", "separator", "hr", "---"] },
  { icon: ImageIcon, label: "Insert image", value: "image", keywords: ["image", "picture", "photo", "!["] },
  { icon: Quote, label: "Insert quote", value: "quote", keywords: ["quote", "blockquote", ">"] },
];

export const CommandMenu = ({ position, onSelect, onClose, filter }: CommandMenuProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredCommands = commands.filter((cmd) => {
    if (!filter) return true;
    const filterLower = filter.toLowerCase();
    return cmd.keywords.some((keyword) => keyword.includes(filterLower)) ||
           cmd.label.toLowerCase().includes(filterLower) ||
           cmd.value.toLowerCase().includes(filterLower);
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          onSelect(filteredCommands[selectedIndex].value);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, filteredCommands, onSelect, onClose]);

  if (filteredCommands.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg min-w-[240px] animate-in fade-in-0 slide-in-from-top-2"
      style={{ top: position.top, left: position.left }}
    >
      <ScrollArea className="max-h-[300px]">
        <div className="py-2">
          {filteredCommands.map((command, index) => {
            const Icon = command.icon;
            return (
              <button
                key={command.value}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  index === selectedIndex
                    ? "bg-suggestion-hover text-foreground"
                    : "text-muted-foreground hover:bg-suggestion-hover hover:text-foreground"
                }`}
                onClick={() => onSelect(command.value)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <Icon className="w-4 h-4" />
                <span>{command.label}</span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
