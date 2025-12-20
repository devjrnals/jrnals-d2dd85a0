import { useState, useRef, useEffect } from "react";
import { PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";

type TopBarProps = {
  journalTitle?: string;
  journalId?: string;
  onTitleChange?: (title: string) => void;
  wordCount?: number;
  onMoveToTrash?: () => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
};

export const TopBar = ({
  journalTitle = "New Journal",
  journalId,
  onTitleChange,
  wordCount = 0,
  onMoveToTrash,
  onToggleSidebar,
  sidebarCollapsed = false,
}: TopBarProps) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(journalTitle);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditTitle(journalTitle);
  }, [journalTitle]);

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


          <div className="flex items-center gap-2 flex-1 justify-end">
            {onToggleSidebar && (
              <Button
                variant="ghost"
                size="icon"
                className="text-foreground"
                onClick={onToggleSidebar}
              >
                <PanelLeftClose className={`w-5 h-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
              </Button>
            )}
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Share
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
