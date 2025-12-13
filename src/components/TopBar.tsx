import { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  MoreHorizontal,
  Download,
  Copy,
  History,
  Trash2,
  FileText,
  ChevronRight,
  BookOpen,
  Video,
  Layers,
  HelpCircle,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

type TopBarProps = {
  journalTitle?: string;
  onTitleChange?: (title: string) => void;
  wordCount?: number;
  onMoveToTrash?: () => void;
};

export const TopBar = ({
  journalTitle = "New Journal",
  onTitleChange,
  wordCount = 0,
  onMoveToTrash,
}: TopBarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(journalTitle);
  const inputRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditTitle(journalTitle);
  }, [journalTitle]);

  const suggestions = [
    { icon: BookOpen, text: "Make notes on...", color: "text-blue-500" },
    { icon: Video, text: "Generate a video on...", color: "text-pink-500" },
    { icon: Layers, text: "Create flashcards on...", color: "text-green-500" },
    { icon: HelpCircle, text: "Quiz me on...", color: "text-purple-500" },
    { icon: GraduationCap, text: "Teach me how to...", color: "text-orange-500" },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <div className="bg-card border-b border-border h-16">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-4 flex-1">
            <Button variant="ghost" size="icon" className="text-foreground">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            </Button>
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => {
                  setIsEditingTitle(false);
                  if (onTitleChange) onTitleChange(editTitle);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setIsEditingTitle(false);
                    if (onTitleChange) onTitleChange(editTitle);
                  }
                }}
                autoFocus
                className="text-foreground font-medium bg-transparent border-b-2 border-primary focus:outline-none"
              />
            ) : (
              <span
                className="text-foreground font-medium cursor-pointer hover:text-primary"
                onClick={() => setIsEditingTitle(true)}
              >
                {journalTitle}
              </span>
            )}
          </div>

          <div className="flex-1 max-w-3xl px-8">
            <div className="relative" ref={inputRef}>
              <input
                type="text"
                placeholder="clarity"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsExpanded(true)}
                className="w-full bg-input text-foreground px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
              <Button
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 bg-primary hover:bg-primary/90"
              >
                <ArrowUp className="w-4 h-4" />
              </Button>

              {isExpanded && (
                <div className="absolute left-1/2 top-full mt-2 z-50 w-[min(760px,calc(100vw-2rem))] -translate-x-1/2">
                  <div className="rounded-xl border border-border bg-popover shadow-lg p-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                    <div className="text-sm font-semibold text-foreground mb-2">
                      Suggestions
                    </div>
                    <div className="flex flex-col gap-2">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion.text}
                          type="button"
                          className="flex items-center gap-3 rounded-lg bg-transparent px-3 py-2 text-left hover:bg-muted transition-colors"
                          onMouseDown={(e) => {
                            // Prevent input blur so the panel doesn't close before click runs.
                            e.preventDefault();
                          }}
                          onClick={() => {
                            setSearchQuery(suggestion.text);
                            // Keep open; user can keep browsing suggestions or edit text.
                          }}
                        >
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${suggestion.color}`}>
                            <suggestion.icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-foreground truncate">
                              {suggestion.text}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-foreground">
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FileText className="w-4 h-4 mr-2" />
                    <span>Integrations</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                        </svg>
                        <span>Google Drive</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M4 4v16h16V4H4zm2 2h12v12H6V6z"/>
                        </svg>
                        <span>Notion</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M4 4h16v16H4z"/>
                        </svg>
                        <span>Canvas</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem>
                  <Download className="w-4 h-4 mr-2" />
                  <span>Export</span>
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Copy className="w-4 h-4 mr-2" />
                  <span>Clone Journal</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <History className="w-4 h-4 mr-2" />
                  <span>Version history</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onSelect={onMoveToTrash}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  <span>Move to Trash</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-sm text-muted-foreground">Word count</span>
                  <span className="text-sm font-medium text-green-500">{wordCount}</span>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Share
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
