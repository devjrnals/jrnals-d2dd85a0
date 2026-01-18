import { useState, useRef, useEffect } from "react";
import { PanelLeftClose, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareDialog } from "@/components/ShareDialog";

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
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditTitle(journalTitle);
  }, [journalTitle]);

  return (
    <div className="relative">
      <div className="bg-editor h-16">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-4 flex-1 pl-4">
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


          {/* Controls - always positioned at the right edge */}
          <div className="flex items-center gap-2 absolute z-20 right-6">
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setShareDialogOpen(true)}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            {onToggleSidebar && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                onClick={onToggleSidebar}
              >
                <PanelLeftClose className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {journalId && (
        <ShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          journalId={journalId}
          journalTitle={journalTitle}
        />
      )}
    </div>
  );
};
