import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  MessageSquare,
  Type,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Store saved selection globally so it persists across button clicks
let savedSelectionRange: Range | null = null;

// Export function to save selection from Editor component
export const saveSelectionForToolbar = () => {
  const selection = window.getSelection();
  // #region agent log
  const hasSelection = selection && selection.rangeCount > 0;
  fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:27',message:'saveSelectionForToolbar called',data:{hasSelection},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (selection && selection.rangeCount > 0) {
    try {
      savedSelectionRange = selection.getRangeAt(0).cloneRange();
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:33',message:'Selection saved',data:{startOffset:savedSelectionRange.startOffset,endOffset:savedSelectionRange.endOffset,collapsed:savedSelectionRange.collapsed},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    } catch (e) {
      savedSelectionRange = null;
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:36',message:'Failed to save selection',data:{error:String(e)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }
  } else {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:39',message:'No selection to save',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  }
};

// Export function to get saved selection
export const getSavedSelectionForToolbar = (): Range | null => {
  return savedSelectionRange;
};

type FormattingAction =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "code"
  | "link"
  | "comment"
  | "textStyle"
  | "more";

interface FormattingToolbarProps {
  position: { top: number; left: number };
  onFormat: (action: FormattingAction, value?: string) => void;
  onClose: () => void;
  isActive?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
}

const TEXT_STYLES = [
  { value: "paragraph", label: "Text" },
  { value: "heading1", label: "Heading 1" },
  { value: "heading2", label: "Heading 2" },
  { value: "heading3", label: "Heading 3" },
  { value: "code", label: "Code" },
  { value: "quote", label: "Quote" },
];

export const FormattingToolbar = ({
  position,
  onFormat,
  onClose,
  isActive = {},
}: FormattingToolbarProps) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [isVisible, setIsVisible] = useState(false);

  // Selection is saved by Editor component when toolbar is shown

  // Smooth fade/scale in animation
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Adjust position to prevent going off-screen
  useEffect(() => {
    if (!toolbarRef.current) return;

    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      if (!toolbarRef.current) return;

      const toolbar = toolbarRef.current;
      const toolbarRect = toolbar.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 8;
      const toolbarHeight = toolbarRect.height || 40; // Fallback height
      const toolbarWidth = toolbarRect.width || 300; // Fallback width

      let top = position.top - toolbarHeight + 2; // Default: above selection (slight overlap of 2px for closer appearance)
      let left = position.left;

      // Check if toolbar goes off right edge
      if (left + toolbarWidth / 2 > viewportWidth - padding) {
        left = viewportWidth - toolbarWidth / 2 - padding;
      }

      // Check if toolbar goes off left edge
      if (left - toolbarWidth / 2 < padding) {
        left = toolbarWidth / 2 + padding;
      }

      // Check if toolbar goes off top edge - flip below selection
      if (top < padding) {
        top = position.top - 2; // Position below selection (slight overlap of 2px for closer appearance)
      }

      // Check if toolbar goes off bottom edge - ensure it's above
      if (top + toolbarHeight > viewportHeight - padding) {
        top = Math.max(padding, position.top - toolbarHeight + 2);
      }

      setAdjustedPosition({ top, left });
    });
  }, [position]);

  const handleFormat = (action: FormattingAction, value?: string) => {
    // #region agent log
    const selectionBefore = window.getSelection();
    const hasSelectionBefore = selectionBefore && selectionBefore.rangeCount > 0;
    const savedRangeExists = !!savedSelectionRange;
    fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:136',message:'handleFormat entry',data:{action,value,hasSelectionBefore,savedRangeExists},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    // Use the saved selection range (saved when toolbar appeared)
    const savedRange = savedSelectionRange;
    const selection = window.getSelection();
    
    // If we don't have a saved range, try to get current selection
    let rangeToRestore = savedRange;
    if (!rangeToRestore && selection && selection.rangeCount > 0) {
      try {
        rangeToRestore = selection.getRangeAt(0).cloneRange();
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:147',message:'Got range from current selection',data:{action,startOffset:rangeToRestore.startOffset,endOffset:rangeToRestore.endOffset,collapsed:rangeToRestore.collapsed},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      } catch (e) {
        rangeToRestore = null;
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:150',message:'Failed to clone range from current selection',data:{action,error:String(e)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
      }
    }
    // #region agent log
    if (rangeToRestore) {
      fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:155',message:'Range to restore prepared',data:{action,startOffset:rangeToRestore.startOffset,endOffset:rangeToRestore.endOffset,collapsed:rangeToRestore.collapsed,isSavedRange:rangeToRestore===savedRange},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    } else {
      fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:157',message:'No range to restore',data:{action},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    }
    // #endregion
    
    // Apply format
    onFormat(action, value);
    
    // #region agent log
    const selectionAfterFormat = window.getSelection();
    const hasSelectionAfterFormat = selectionAfterFormat && selectionAfterFormat.rangeCount > 0;
    fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:163',message:'After onFormat call',data:{action,hasSelectionAfterFormat},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Restore selection after a brief delay to allow format to apply
    if (rangeToRestore) {
      setTimeout(() => {
        try {
          const sel = window.getSelection();
          // #region agent log
          const hasSelectionBeforeRestore = sel && sel.rangeCount > 0;
          fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:170',message:'Attempting selection restore',data:{action,hasSelectionBeforeRestore},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(rangeToRestore!.cloneRange());
            // #region agent log
            const hasSelectionAfterRestore = sel && sel.rangeCount > 0;
            fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:174',message:'Selection restored (direct)',data:{action,hasSelectionAfterRestore,restoreSuccess:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            // Update savedSelectionRange after successful restoration for next click
            savedSelectionRange = rangeToRestore.cloneRange();
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:179',message:'Updated savedSelectionRange after restore',data:{action},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
          }
        } catch (e) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:184',message:'Direct restore failed, trying fallback',data:{action,error:String(e)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          // Selection might be invalid, try to find and restore it
          try {
            if (!rangeToRestore) return;
            const container = rangeToRestore.commonAncestorContainer;
            let element: Element | null = container.nodeType === Node.TEXT_NODE
              ? container.parentElement
              : container as Element;
            
            while (element && element !== document.body) {
              if (element.hasAttribute('contenteditable')) {
                break;
              }
              element = element.parentElement;
            }
            
            if (element) {
              const newRange = document.createRange();
              newRange.selectNodeContents(element);
              const textContent = element.textContent || '';
              const startOffset = Math.min(savedRange.startOffset, textContent.length);
              const endOffset = Math.min(savedRange.endOffset, textContent.length);
              
              const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                null
              );
              
              let currentOffset = 0;
              let startNode: Node | null = null;
              let endNode: Node | null = null;
              let startPos = 0;
              let endPos = 0;
              
              let node: Node | null;
              while ((node = walker.nextNode())) {
                const nodeLength = node.textContent?.length || 0;
                if (!startNode && currentOffset + nodeLength >= startOffset) {
                  startNode = node;
                  startPos = startOffset - currentOffset;
                }
                if (!endNode && currentOffset + nodeLength >= endOffset) {
                  endNode = node;
                  endPos = endOffset - currentOffset;
                  break;
                }
                currentOffset += nodeLength;
              }
              
              if (startNode) {
                newRange.setStart(startNode, Math.min(startPos, startNode.textContent?.length || 0));
                if (endNode) {
                  newRange.setEnd(endNode, Math.min(endPos, endNode.textContent?.length || 0));
                } else {
                  newRange.setEnd(startNode, Math.min(startPos, startNode.textContent?.length || 0));
                }
                const sel = window.getSelection();
                if (sel) {
                  sel.removeAllRanges();
                  sel.addRange(newRange);
                  // #region agent log
                  const hasSelectionAfterFallback = sel && sel.rangeCount > 0;
                  fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:225',message:'Selection restored (fallback)',data:{action,hasSelectionAfterFallback,restoreSuccess:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                  // #endregion
                  // Update savedSelectionRange after successful restoration for next click
                  savedSelectionRange = newRange.cloneRange();
                  // #region agent log
                  fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:230',message:'Updated savedSelectionRange after fallback restore',data:{action},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                  // #endregion
                }
              }
            }
          } catch (e2) {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:237',message:'Fallback restore failed',data:{action,error:String(e2)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
          }
        }
      }, 100);
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/505803cc-574b-40ed-a9f8-e9c2e267e4a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FormattingToolbar.tsx:243',message:'No rangeToRestore, skipping restore',data:{action},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }
  };

  const handleButtonClick = (
    e: React.MouseEvent,
    action: FormattingAction,
    value?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    handleFormat(action, value);
  };

  const handleMenuItemClick = (
    e: React.MouseEvent,
    action: FormattingAction,
    value?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Use the saved selection range
    const savedRange = savedSelectionRange;
    
    // Apply format
    onFormat(action, value);
    
    // Restore selection after dropdown closes
    setTimeout(() => {
      if (savedRange) {
        try {
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(savedRange.cloneRange());
          }
        } catch (e) {
          // Selection might be invalid, try to restore it
          try {
            if (!savedRange) return;
            const container = savedRange.commonAncestorContainer;
            let element: Element | null = container.nodeType === Node.TEXT_NODE
              ? container.parentElement
              : container as Element;
            
            while (element && element !== document.body) {
              if (element.hasAttribute('contenteditable')) {
                break;
              }
              element = element.parentElement;
            }
            
            if (element) {
              const newRange = document.createRange();
              newRange.selectNodeContents(element);
              const textContent = element.textContent || '';
              const startOffset = Math.min(savedRange.startOffset, textContent.length);
              const endOffset = Math.min(savedRange.endOffset, textContent.length);
              
              const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                null
              );
              
              let currentOffset = 0;
              let startNode: Node | null = null;
              let endNode: Node | null = null;
              let startPos = 0;
              let endPos = 0;
              
              let node: Node | null;
              while ((node = walker.nextNode())) {
                const nodeLength = node.textContent?.length || 0;
                if (!startNode && currentOffset + nodeLength >= startOffset) {
                  startNode = node;
                  startPos = startOffset - currentOffset;
                }
                if (!endNode && currentOffset + nodeLength >= endOffset) {
                  endNode = node;
                  endPos = endOffset - currentOffset;
                  break;
                }
                currentOffset += nodeLength;
              }
              
              if (startNode) {
                newRange.setStart(startNode, Math.min(startPos, startNode.textContent?.length || 0));
                if (endNode) {
                  newRange.setEnd(endNode, Math.min(endPos, endNode.textContent?.length || 0));
                } else {
                  newRange.setEnd(startNode, Math.min(startPos, startNode.textContent?.length || 0));
                }
                const sel = window.getSelection();
                if (sel) {
                  sel.removeAllRanges();
                  sel.addRange(newRange);
                }
              }
            }
          } catch (e2) {
            // Ignore errors
          }
        }
      }
    }, 150);
  };

  return (
    <div
      ref={toolbarRef}
      className={cn(
        "fixed z-50 flex items-center gap-0.5 rounded-lg border bg-popover px-1 py-1 shadow-lg",
        "transition-all duration-150 ease-out",
        isVisible
          ? "opacity-100 scale-100"
          : "opacity-0 scale-95 pointer-events-none"
      )}
      style={{
        top: `${adjustedPosition.top}px`,
        left: `${adjustedPosition.left}px`,
        transform: isVisible
          ? `translate(-50%, -100%) scale(1)`
          : `translate(-50%, -100%) scale(0.95)`,
      }}
      data-formatting-toolbar="true"
      onMouseDown={(e) => {
        // Prevent toolbar clicks from clearing selection
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseEnter={() => {
        // Keep toolbar open when hovering
      }}
      onClick={(e) => {
        // Prevent clicks from bubbling up
        e.stopPropagation();
      }}
    >
      {/* Text Style Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs font-medium hover:bg-accent"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Type className="h-3.5 w-3.5 mr-1" />
            Text
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          className="w-48"
          onCloseAutoFocus={(e) => {
            // Prevent focus from being stolen
            e.preventDefault();
          }}
        >
          {TEXT_STYLES.map((style) => (
            <DropdownMenuItem
              key={style.value}
              onSelect={(e) => {
                e.preventDefault();
                handleMenuItemClick(e as any, "textStyle", style.value);
              }}
              onMouseDown={(e) => {
                // Prevent selection loss
                e.preventDefault();
              }}
            >
              {style.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="h-4 w-px bg-border mx-0.5" />

      {/* Bold */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 w-7 p-0 hover:bg-accent",
          isActive.bold && "bg-accent"
        )}
        onClick={(e) => handleButtonClick(e, "bold")}
        onMouseDown={(e) => e.preventDefault()}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>

      {/* Italic */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 w-7 p-0 hover:bg-accent",
          isActive.italic && "bg-accent"
        )}
        onClick={(e) => handleButtonClick(e, "italic")}
        onMouseDown={(e) => e.preventDefault()}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>

      {/* Underline */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 w-7 p-0 hover:bg-accent",
          isActive.underline && "bg-accent"
        )}
        onClick={(e) => handleButtonClick(e, "underline")}
        onMouseDown={(e) => e.preventDefault()}
        title="Underline (Ctrl+U)"
      >
        <Underline className="h-3.5 w-3.5" />
      </Button>

      {/* Strikethrough */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 w-7 p-0 hover:bg-accent",
          isActive.strikethrough && "bg-accent"
        )}
        onClick={(e) => handleButtonClick(e, "strikethrough")}
        onMouseDown={(e) => e.preventDefault()}
        title="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </Button>

      <div className="h-4 w-px bg-border mx-0.5" />

      {/* Code */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 w-7 p-0 hover:bg-accent",
          isActive.code && "bg-accent"
        )}
        onClick={(e) => handleButtonClick(e, "code")}
        onMouseDown={(e) => e.preventDefault()}
        title="Code"
      >
        <Code className="h-3.5 w-3.5" />
      </Button>

      {/* Link */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:bg-accent"
        onClick={(e) => handleButtonClick(e, "link")}
        onMouseDown={(e) => e.preventDefault()}
        title="Link"
      >
        <Link className="h-3.5 w-3.5" />
      </Button>

      {/* Comment */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:bg-accent"
        onClick={(e) => handleButtonClick(e, "comment")}
        onMouseDown={(e) => e.preventDefault()}
        title="Comment"
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </Button>

      <div className="h-4 w-px bg-border mx-0.5" />

      {/* More */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-accent"
            onMouseDown={(e) => e.preventDefault()}
            title="More options"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          className="w-48"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
          }}
        >
          <DropdownMenuItem 
            onSelect={(e) => {
              e.preventDefault();
              handleMenuItemClick(e as any, "more", "highlight");
            }}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
          >
            Highlight
          </DropdownMenuItem>
          <DropdownMenuItem 
            onSelect={(e) => {
              e.preventDefault();
              handleMenuItemClick(e as any, "more", "clearFormatting");
            }}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
          >
            Clear formatting
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};


