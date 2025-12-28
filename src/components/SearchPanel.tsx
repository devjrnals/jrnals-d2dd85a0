import { useEffect, useMemo, useRef, useState } from "react";
import { FileText } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type SearchPanelJournal = {
  id: string;
  title: string;
  updated_at?: string | null;
};

export type SearchPanelFolder = {
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  journals: SearchPanelJournal[];
  folders: SearchPanelFolder[];
  onOpenJournal: (journalId: string) => void;
  onOpenFolder?: (folderId: string) => void;
};

function timeAgo(input?: string | null) {
  if (!input) return "";
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function SearchPanel({
  open,
  onClose,
  journals,
  folders,
  onOpenJournal,
  onOpenFolder,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");

  // Filter journals based on search query
  const filteredJournals = useMemo(() => {
    if (!query.trim()) {
      // Show all journals when no search query
      return journals;
    }

    const lowerQuery = query.toLowerCase().trim();
    return journals.filter(journal =>
      journal.title.toLowerCase().includes(lowerQuery)
    );
  }, [journals, query]);

  // Sort journals: recent first, then alphabetical
  const sortedJournals = useMemo(() => {
    return [...filteredJournals].sort((a, b) => {
      // Sort by recency first
      const aTime = new Date(a.updated_at || 0).getTime();
      const bTime = new Date(b.updated_at || 0).getTime();

      if (aTime !== bTime) {
        return bTime - aTime; // Most recent first
      }

      // Then alphabetically by title
      return a.title.localeCompare(b.title);
    });
  }, [filteredJournals]);

  useEffect(() => {
    if (!open) return;
    setQuery("");

    // Focus after paint so the dialog feels snappy.
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close search"
        className="absolute inset-0 bg-background/35 backdrop-blur-sm"
        onMouseDown={onClose}
      />

      <div
        className={cn(
          "absolute left-1/2 top-24 w-[min(820px,calc(100%-2rem))] -translate-x-1/2",
          "rounded-2xl border border-border/60 shadow-2xl",
          "bg-background/70 supports-[backdrop-filter]:backdrop-blur-2xl",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
      >
        <Command
          className={cn(
            "rounded-2xl bg-transparent",
            "[&_[cmdk-input-wrapper]]:border-border/60",
          )}
        >
          <div className="relative">
            <CommandInput
              ref={inputRef}
              placeholder="Search all journals..."
              value={query}
              onValueChange={setQuery}
              className="h-14 text-[15px]"
            />
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
              <div className="rounded-md border border-border/60 bg-background/50 px-2 py-1 text-xs text-muted-foreground">
                Esc
              </div>
            </div>
          </div>

          <div className="relative">
            <CommandList className="max-h-[420px] p-2 overflow-y-auto scrollbar-thin">
              <CommandEmpty className="py-10 text-center text-sm text-muted-foreground">
                {query.trim() ? "No journals found matching your search." : "No journals available."}
              </CommandEmpty>

            {sortedJournals.length > 0 && (
              <CommandGroup
                heading={query.trim() ?
                  `Search Results (${sortedJournals.length} journal${sortedJournals.length === 1 ? '' : 's'})` :
                  `All Journals (${sortedJournals.length})`
                }
              >
                {sortedJournals.map((j) => (
                  <CommandItem
                    key={j.id}
                    value={`journal:${j.id}`}
                    onSelect={() => {
                      onOpenJournal(j.id);
                      onClose();
                    }}
                    className="gap-3 rounded-xl px-3 py-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {j.title}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {j.updated_at ? `Last opened ${timeAgo(j.updated_at)}` : "Never opened"}
                      </div>
                    </div>
                    <CommandShortcut>↵</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            </CommandList>

            {/* Visual fade indicator for scrollable content */}
            {sortedJournals.length > 6 && (
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none rounded-b-xl" />
            )}
          </div>
        </Command>
      </div>
    </div>
  );
}


