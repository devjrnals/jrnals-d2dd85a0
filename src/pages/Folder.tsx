import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Folder as FolderIcon, FileText, Check, Edit, Trash2, ArrowLeft, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AddJournalsDialog } from "@/components/AddJournalsDialog";

type Journal = {
  id: string;
  title: string;
  folder_id: string | null;
  updated_at: string;
};

type Folder = {
  id: string;
  name: string;
};

const FolderPage = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const [sortBy, setSortBy] = useState<"updated_desc" | "updated_asc" | "title_desc" | "title_asc">("updated_desc");
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [editingJournalTitle, setEditingJournalTitle] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [confirmState, setConfirmState] = useState<
    | { open: false }
    | {
        open: true;
        kind: "journal";
        id: string;
        title: string;
      }
  >({ open: false });
  const [addJournalsOpen, setAddJournalsOpen] = useState(false);

  useEffect(() => {
    if (user && folderId) {
      loadData();
    }
  }, [user, folderId, sortBy]);

  const loadData = async () => {
    if (!user || !folderId) return;

    // Determine sort order
    const getSortConfig = () => {
      switch (sortBy) {
        case "updated_asc":
          return { column: "updated_at", ascending: true };
        case "title_desc":
          return { column: "title", ascending: false };
        case "title_asc":
          return { column: "title", ascending: true };
        case "updated_desc":
        default:
          return { column: "updated_at", ascending: false };
      }
    };

    const sortConfig = getSortConfig();

    const [folderRes, journalsRes] = await Promise.all([
      supabase
        .from("folders")
        .select("*")
        .eq("id", folderId)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("journals")
        .select("*")
        .eq("folder_id", folderId)
        .eq("user_id", user.id)
        .order(sortConfig.column, { ascending: sortConfig.ascending })
    ]);

    if (folderRes.error) {
      toast({ title: "Error loading folder", description: folderRes.error.message, variant: "destructive" });
      navigate("/dashboard");
      return;
    } else {
      setFolder(folderRes.data);
    }

    if (journalsRes.error) {
      toast({ title: "Error loading journals", description: journalsRes.error.message, variant: "destructive" });
    } else {
      setJournals(journalsRes.data || []);
    }
  };

  const removeFromFolder = async (journalId: string) => {
    const { error } = await supabase
      .from("journals")
      .update({ folder_id: null })
      .eq("id", journalId);

    if (error) {
      toast({ title: "Error removing journal from folder", variant: "destructive" });
    } else {
      setJournals(journals.filter(j => j.id !== journalId));
      toast({ title: "Journal removed from folder" });
    }
  };

  const deleteJournal = async (journalId: string) => {
    const { error } = await supabase.from("journals").delete().eq("id", journalId);

    if (error) {
      toast({ title: "Error deleting journal", variant: "destructive" });
    } else {
      setJournals(journals.filter(j => j.id !== journalId));
      toast({ title: "Journal deleted successfully" });
    }
  };

  const startEditingJournal = (journal: Journal) => {
    setEditingJournalId(journal.id);
    setEditingJournalTitle(journal.title);
  };

  const saveJournalEdit = async () => {
    if (!editingJournalId) return;

    const trimmedTitle = editingJournalTitle.trim();
    if (!trimmedTitle) {
      setEditingJournalId(null);
      setEditingJournalTitle("");
      return;
    }

    const { error } = await supabase
      .from("journals")
      .update({ title: trimmedTitle })
      .eq("id", editingJournalId);

    if (error) {
      toast({ title: "Error updating journal", description: error.message, variant: "destructive" });
    } else {
      setJournals(journals.map(j => j.id === editingJournalId ? { ...j, title: trimmedTitle } : j));
      setEditingJournalId(null);
      setEditingJournalTitle("");
      toast({ title: "Journal updated successfully" });
    }
  };

  const confirmDeleteJournal = (journal: Journal) => {
    setConfirmState({ open: true, kind: "journal", id: journal.id, title: journal.title });
  };

  const handleAddJournals = (addedJournals: Journal[]) => {
    setJournals(prev => [...prev, ...addedJournals]);
    setAddJournalsOpen(false);
  };

  if (!folder) {
    return (
      <div className="flex-1 overflow-auto bg-editor">
        <div className="px-12 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading folder...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-editor">
      <div className="px-12 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Folder Header */}
        <div className="flex items-center gap-3 mb-8">
          <FolderIcon className="w-8 h-8 text-primary" />
          <h1 className="text-4xl font-bold text-foreground">{folder.name}</h1>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-8">
          <Button
            onClick={() => setAddJournalsOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Journals
          </Button>
        </div>

        {/* Journals Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-foreground">Journals in this folder</h2>
              <span className="text-lg text-muted-foreground">{journals.length}</span>
            </div>

            <div className="flex items-center gap-2 text-foreground">
              <span className="text-sm">Sort by:</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-foreground">
                    {sortBy === "updated_desc" && "Last edited (newest)"}
                    {sortBy === "updated_asc" && "Last edited (oldest)"}
                    {sortBy === "title_desc" && "Title (Z-A)"}
                    {sortBy === "title_asc" && "Title (A-Z)"}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setSortBy("updated_desc")}>
                    <Check className={`w-4 h-4 mr-2 ${sortBy === "updated_desc" ? "opacity-100" : "opacity-0"}`} />
                    Last edited (newest)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("updated_asc")}>
                    <Check className={`w-4 h-4 mr-2 ${sortBy === "updated_asc" ? "opacity-100" : "opacity-0"}`} />
                    Last edited (oldest)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("title_desc")}>
                    <Check className={`w-4 h-4 mr-2 ${sortBy === "title_desc" ? "opacity-100" : "opacity-0"}`} />
                    Title (Z-A)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("title_asc")}>
                    <Check className={`w-4 h-4 mr-2 ${sortBy === "title_asc" ? "opacity-100" : "opacity-0"}`} />
                    Title (A-Z)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {journals.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No journals in this folder</h3>
              <p className="text-muted-foreground mb-4">Click "Add Journals" to add some journals to this folder.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {journals.map((journal) => (
                <div
                  key={journal.id}
                  onClick={() => navigate(`/journal/${journal.id}`)}
                  className="group border border-border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer bg-card flex items-center justify-between relative"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-primary" />
                    {editingJournalId === journal.id ? (
                      <input
                        type="text"
                        value={editingJournalTitle}
                        onChange={(e) => setEditingJournalTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveJournalEdit();
                        }}
                        onBlur={() => {
                          if (editingJournalTitle.trim()) {
                            saveJournalEdit();
                          } else {
                            setEditingJournalId(null);
                            setEditingJournalTitle("");
                          }
                        }}
                        className="flex-1 bg-transparent border-b border-primary outline-none text-foreground font-medium"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <h3 className="text-foreground font-medium">{journal.title}</h3>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingJournalId === journal.id ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          saveJournalEdit();
                        }}
                        className="opacity-100 p-1 hover:bg-green-100 rounded transition-colors"
                      >
                        <Check className="w-4 h-4 text-green-600" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingJournal(journal);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 rounded transition-colors"
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromFolder(journal.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                        <div className="text-xs text-muted-foreground">
                          {new Date(journal.updated_at).toLocaleDateString()}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => {
          if (!open) setConfirmState({ open: false });
        }}
        title={
          confirmState.open
            ? `Are you sure you want to delete the journal "${confirmState.title}"?`
            : "Confirm delete"
        }
        description={
          confirmState.open
            ? "Are you sure you want to delete this journal? This action cannot be undone."
            : undefined
        }
        onConfirm={async () => {
          if (!confirmState.open) return;
          const { id } = confirmState;
          setConfirmState({ open: false });
          await deleteJournal(id);
        }}
      />

      <AddJournalsDialog
        open={addJournalsOpen}
        onOpenChange={setAddJournalsOpen}
        folderId={folderId!}
        onAddJournals={handleAddJournals}
      />
    </div>
  );
};

export default FolderPage;

