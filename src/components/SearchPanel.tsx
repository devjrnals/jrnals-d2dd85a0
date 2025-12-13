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

  const recentJournals = useMemo(() => journals.slice(0, 6), [journals]);

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
              placeholder="search"
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

          <CommandList className="max-h-[420px] p-2">
            <CommandEmpty className="py-10 text-center text-sm text-muted-foreground">
              No results found.
            </CommandEmpty>

            {query.trim().length === 0 && recentJournals.length > 0 && (
              <>
                <CommandGroup heading="Recently opened">
                  {recentJournals.map((j) => (
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
                          Last opened {timeAgo(j.updated_at)}
                        </div>
                      </div>
                      <CommandShortcut>↵</CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}


          </CommandList>
        </Command>
      </div>
    </div>
  );
}


