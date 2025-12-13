import { useState, useEffect, useMemo } from "react";
import { Folder, FileText, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Journal = {
  id: string;
  title: string;
  folder_id: string | null;
  updated_at: string;
  trashed_at?: string | null;
};

type Folder = {
  id: string;
  name: string;
};

export const Home = () => {
  const [activeFilter, setActiveFilter] = useState("owned");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [displayName, setDisplayName] = useState<string>("");
  const [confirmState, setConfirmState] = useState<
    | { open: false }
    | {
        open: true;
        kind: "folder" | "journal";
        id: string;
        title: string;
      }
  >({ open: false });

  const isMissingTrashedAtColumn = (err: unknown) => {
    const e = err as { code?: string; message?: string } | null;
    return e?.code === "42703" || (e?.message || "").toLowerCase().includes("trashed_at");
  };

  const purgeExpiredTrashedJournals = async () => {
    if (!user) return;
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("journals")
      .delete()
      .eq("user_id", user.id)
      .not("trashed_at", "is", null)
      .lt("trashed_at", cutoff);
    if (error && !isMissingTrashedAtColumn(error)) {
      // Don't toast here; loading will handle errors with better context.
      // console.warn(error);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    // Best-effort cleanup: permanently delete journals that have been in Trash for 30+ days.
    await purgeExpiredTrashedJournals();

    const [journalsRes, foldersRes] = await Promise.all([
      supabase
        .from("journals")
        .select("*")
        .is("trashed_at", null)
        .order("updated_at", { ascending: false }),
      supabase.from("folders").select("*").order("created_at", { ascending: false })
    ]);

    if (journalsRes.error) {
      if (isMissingTrashedAtColumn(journalsRes.error)) {
        const retry = await supabase.from("journals").select("*").order("updated_at", { ascending: false });
        if (retry.error) {
          toast({ title: "Error loading journals", description: retry.error.message, variant: "destructive" });
        } else {
          setJournals(retry.data || []);
          toast({
            title: "Trash not configured yet",
            description: "Your database is missing the 'trashed_at' column. Journals are shown normally for now.",
          });
        }
      } else {
        toast({ title: "Error loading journals", description: journalsRes.error.message, variant: "destructive" });
      }
    } else {
      setJournals(journalsRes.data || []);
    }

    if (foldersRes.error) {
      toast({ title: "Error loading folders", variant: "destructive" });
    } else {
      setFolders(foldersRes.data || []);
    }

    // Load user's display name (optional)
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    setDisplayName(profile?.display_name || "");
  };

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  const resolvedName =
    displayName ||
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    (user?.email ? user.email.split("@")[0] : "there");

  const filters = useMemo(
    () => [
      { id: "owned", label: "Notes by you" },
      { id: "shared", label: "Shared with you" },
    ],
    []
  );

  const handleCreateJournal = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("journals")
      .insert({ user_id: user.id, title: "New Journal" })
      .select()
      .single();

    if (error) {
      toast({ title: "Error creating journal", variant: "destructive" });
    } else {
      navigate(`/journal/${data.id}`);
    }
  };

  const handleCreateFolder = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("folders")
      .insert({ user_id: user.id, name: "New Folder" })
      .select()
      .single();

    if (error) {
      toast({ title: "Error creating folder", variant: "destructive" });
    } else {
      setFolders([data, ...folders]);
    }
  };

  const deleteFolder = async (folderId: string) => {
    const { error } = await supabase.from("folders").delete().eq("id", folderId);

    if (error) {
      toast({ title: "Error deleting folder", variant: "destructive" });
    } else {
      setFolders(folders.filter(f => f.id !== folderId));
      toast({ title: "Folder deleted successfully" });
    }
  };

  const moveJournalToTrash = async (journalId: string) => {
    const { error } = await supabase
      .from("journals")
      .update({ trashed_at: new Date().toISOString() })
      .eq("id", journalId);

    if (error) {
      if (isMissingTrashedAtColumn(error)) {
        toast({
          title: "Trash isn't set up in your database yet",
          description: "Please apply the migration that adds journals.trashed_at, then try again.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Error moving journal to trash", description: error.message, variant: "destructive" });
    } else {
      setJournals(journals.filter(j => j.id !== journalId));
      toast({ title: "Moved to Trash" });
    }
  };

  const confirmDeleteFolder = (folder: Folder) => {
    setConfirmState({ open: true, kind: "folder", id: folder.id, title: folder.name });
  };

  const confirmTrashJournal = (journal: Journal) => {
    setConfirmState({ open: true, kind: "journal", id: journal.id, title: journal.title });
  };

  return (
    <div className="flex-1 overflow-auto bg-editor">
      <div className="px-12 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-foreground">
              {greeting}, {resolvedName}
            </h1>
          </div>

        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-12">
          {filters.map((filter) => (
            <Button
              key={filter.id}
              variant={activeFilter === filter.id ? "default" : "ghost"}
              onClick={() => setActiveFilter(filter.id)}
              className={
                activeFilter === filter.id
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-foreground hover:bg-secondary"
              }
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {/* Folders Section */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-foreground">Folders</h2>
            <span className="text-lg text-muted-foreground">{folders.length}</span>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <button
              onClick={handleCreateFolder}
              className="group border-2 border-dashed border-border rounded-lg p-4 hover:border-primary transition-colors flex items-center gap-3 bg-card/50"
            >
              <Folder className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-foreground font-medium">Create folder</span>
            </button>
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="group border border-border rounded-lg p-4 hover:border-primary transition-colors flex items-center justify-between bg-card cursor-pointer relative"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Folder className="w-8 h-8 text-primary shrink-0" />
                  <span className="text-foreground font-medium truncate">{folder.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDeleteFolder(folder);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Journals Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-foreground">Journals</h2>
              <span className="text-lg text-muted-foreground">{journals.length}</span>
            </div>

            <div className="flex items-center gap-2 text-foreground">
              <span className="text-sm">Sort by:</span>
              <Button variant="ghost" size="sm" className="text-foreground">
                Last edited (newest)
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleCreateJournal}
              className="group border-2 border-dashed border-border rounded-lg p-4 hover:border-primary transition-colors flex items-center gap-3 w-full bg-card/50"
            >
              <FileText className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-foreground font-medium">Create journal</span>
            </button>
            {journals.map((journal) => (
              <div
                key={journal.id}
                onClick={() => navigate(`/journal/${journal.id}`)}
                className="group border border-border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer bg-card flex items-center justify-between relative"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-primary" />
                  <h3 className="text-foreground font-medium">{journal.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmTrashJournal(journal);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                  <div className="text-xs text-muted-foreground">
                    {new Date(journal.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => {
          if (!open) setConfirmState({ open: false });
        }}
        title={
          confirmState.open
            ? `Are you sure you want to delete the ${confirmState.kind} "${confirmState.title}"?`
            : "Confirm delete"
        }
        description={
          confirmState.open && confirmState.kind === "journal"
            ? "This will move it to Trash. It will be deleted permanently after 30 days."
            : undefined
        }
        onConfirm={async () => {
          if (!confirmState.open) return;
          const { kind, id } = confirmState;
          setConfirmState({ open: false });
          if (kind === "folder") return deleteFolder(id);
          return moveJournalToTrash(id);
        }}
      />
    </div>
  );
};
