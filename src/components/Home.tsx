import { useState, useEffect, useMemo } from "react";
import { Folder, FileText, Check, Edit, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
};

type Folder = {
  id: string;
  name: string;
  journal_count?: number;
};

export const Home = () => {
  const [activeFilter, setActiveFilter] = useState("owned");
  const [sortBy, setSortBy] = useState<"updated_desc" | "updated_asc" | "title_desc" | "title_asc">("updated_desc");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [editingJournalTitle, setEditingJournalTitle] = useState("");
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


  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, sortBy, activeFilter]);

  const loadData = async () => {
    if (!user) return;

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

    let journalsRes;
    let foldersRes;

    if (activeFilter === "shared") {
      // Load shared journals
      const userEmail = user.email?.toLowerCase();

      if (!userEmail) {
        toast({
          title: "Email required",
          description: "Your email address is required to view shared journals.",
          variant: "destructive"
        });
        // Load empty results for shared view
        journalsRes = { data: [], error: null };
        foldersRes = { data: [], error: null };
      } else {
        // Get journals that are shared with this user
        const { data: sharedData, error: sharedError } = await (supabase as any)
          .from("journal_shares")
          .select(`
            journal_id,
            share_type,
            permission_type,
            allowed_emails,
            journals (
              id,
              title,
              content,
              folder_id,
              updated_at,
              user_id
            )
          `)
          .or(`share_type.eq.anyone,allowed_emails.cs.{${userEmail}}`);

        if (sharedError) {
          console.error("Error loading shared journals:", sharedError);
          journalsRes = { data: [], error: sharedError };
        } else {
          // Extract journals from the share data
          const sharedJournals = (sharedData || [])
            .map((share: any) => share.journals)
            .filter(Boolean)
            .sort((a: any, b: any) => {
              const aVal = new Date(a[sortConfig.column]).getTime();
              const bVal = new Date(b[sortConfig.column]).getTime();
              return sortConfig.ascending ? aVal - bVal : bVal - aVal;
            });

          journalsRes = { data: sharedJournals, error: null };
        }

        // No folders shown in shared view
        foldersRes = { data: [], error: null };
      }
    } else {
      // Load owned journals and folders
      [journalsRes, foldersRes] = await Promise.all([
        supabase
          .from("journals")
          .select("*")
          .eq("user_id", user.id)
          .order(sortConfig.column, { ascending: sortConfig.ascending }),
        supabase.from("folders").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      ]);

      // Get journal counts for folders
      if (foldersRes.data) {
        const folderIds = foldersRes.data.map(f => f.id);
        if (folderIds.length > 0) {
          const { data: counts } = await supabase
            .from("journals")
            .select("folder_id")
            .eq("user_id", user.id)
            .in("folder_id", folderIds);

          const countMap = (counts || []).reduce((acc, journal) => {
            if (journal.folder_id) {
              acc[journal.folder_id] = (acc[journal.folder_id] || 0) + 1;
            }
            return acc;
          }, {} as Record<string, number>);

          foldersRes.data = foldersRes.data.map(folder => ({
            ...folder,
            journal_count: countMap[folder.id] || 0
          }));
        }
      }
    }

    if (journalsRes.error && activeFilter !== "shared") {
      toast({ title: "Error loading journals", description: journalsRes.error.message, variant: "destructive" });
    } else {
      setJournals(journalsRes.data || []);
    }

    if (foldersRes.error && activeFilter !== "shared") {
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
    (user?.user_metadata?.display_name as string | undefined) ||
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
      // Instantly navigate to the new journal (don't wait for data refresh)
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

  const deleteJournal = async (journalId: string) => {
    const { error } = await supabase.from("journals").delete().eq("id", journalId);

    if (error) {
      toast({ title: "Error deleting journal", variant: "destructive" });
    } else {
      setJournals(journals.filter(j => j.id !== journalId));
      toast({ title: "Journal deleted successfully" });
    }
  };

  const confirmDeleteFolder = (folder: Folder) => {
    setConfirmState({ open: true, kind: "folder", id: folder.id, title: folder.name });
  };

  const startEditingFolder = (folder: Folder) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const saveFolderEdit = async () => {
    if (!editingFolderId) return;

    const trimmedName = editingFolderName.trim();
    if (!trimmedName) {
      setEditingFolderId(null);
      setEditingFolderName("");
      return;
    }

    const { error } = await supabase
      .from("folders")
      .update({ name: trimmedName })
      .eq("id", editingFolderId);

    if (error) {
      toast({ title: "Error updating folder", description: error.message, variant: "destructive" });
    } else {
      setFolders(folders.map(f => f.id === editingFolderId ? { ...f, name: trimmedName } : f));
      setEditingFolderId(null);
      setEditingFolderName("");
      toast({ title: "Folder updated successfully" });
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

        {/* Folders Section - Only show for owned journals */}
        {activeFilter === "owned" && (
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
                  onClick={() => navigate(`/folder/${folder.id}`)}
                  className="group border border-border rounded-lg p-4 hover:border-primary transition-colors flex items-center justify-between bg-card cursor-pointer relative"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Folder className="w-8 h-8 text-primary shrink-0" />
                    {editingFolderId === folder.id ? (
                      <input
                        type="text"
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveFolderEdit();
                        }}
                        onBlur={() => {
                          if (editingFolderName.trim()) {
                            saveFolderEdit();
                          } else {
                            setEditingFolderId(null);
                            setEditingFolderName("");
                          }
                        }}
                        className="flex-1 bg-transparent border-b border-primary outline-none text-foreground font-medium"
                        autoFocus
                      />
                    ) : (
                      <span className="text-foreground font-medium truncate">{folder.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingFolderId === folder.id ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          saveFolderEdit();
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
                            startEditingFolder(folder);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 rounded transition-colors"
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDeleteFolder(folder);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Journals Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-foreground">
                {activeFilter === "shared" ? "Shared with you" : "Journals"}
              </h2>
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

          <div className="space-y-2">
            {activeFilter === "owned" && (
              <button
                onClick={handleCreateJournal}
                className="group border-2 border-dashed border-border rounded-lg p-4 hover:border-primary transition-colors flex items-center gap-3 w-full bg-card/50"
              >
                <FileText className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-foreground font-medium">Create journal</span>
              </button>
            )}
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
                          confirmDeleteJournal(journal);
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
            {journals.length === 0 && activeFilter === "shared" && (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No shared journals</h3>
                <p className="text-muted-foreground">
                  Journals shared with you will appear here.
                </p>
              </div>
            )}
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
          confirmState.open
            ? `Are you sure you want to delete this ${confirmState.kind}? This action cannot be undone.`
            : undefined
        }
        onConfirm={async () => {
          if (!confirmState.open) return;
          const { kind, id } = confirmState;
          setConfirmState({ open: false });
          if (kind === "folder") return deleteFolder(id);
          if (kind === "journal") return deleteJournal(id);
        }}
      />
    </div>
  );
};
