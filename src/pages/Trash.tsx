import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type TrashedJournal = {
  id: string;
  title: string;
  updated_at: string;
  trashed_at: string;
};

const TrashPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [journals, setJournals] = useState<TrashedJournal[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<null | { id: string; title: string }>(null);

  const isMissingTrashedAtColumn = (err: unknown) => {
    const e = err as { code?: string; message?: string } | null;
    return e?.code === "42703" || (e?.message || "").toLowerCase().includes("trashed_at");
  };

  const cutoffISO = useMemo(
    () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    []
  );

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  const purgeExpired = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("journals")
      .delete()
      .eq("user_id", user.id)
      .not("trashed_at", "is", null)
      .lt("trashed_at", cutoffISO);
    if (error && !isMissingTrashedAtColumn(error)) {
      // ignore
    }
  };

  const loadTrash = async () => {
    if (!user) return;
    setLoadingTrash(true);

    await purgeExpired();

    const { data, error } = await supabase
      .from("journals")
      .select("id,title,updated_at,trashed_at")
      .eq("user_id", user.id)
      .not("trashed_at", "is", null)
      .order("trashed_at", { ascending: false });

    if (error) {
      if (isMissingTrashedAtColumn(error)) {
        toast({
          title: "Trash isn't set up in your database yet",
          description: "Please apply the migration that adds journals.trashed_at.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Error loading Trash", description: error.message, variant: "destructive" });
      }
      setJournals([]);
    } else {
      setJournals((data as TrashedJournal[]) || []);
    }
    setLoadingTrash(false);
  };

  useEffect(() => {
    if (user) loadTrash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const restoreJournal = async (journalId: string) => {
    const { error } = await supabase.from("journals").update({ trashed_at: null }).eq("id", journalId);
    if (error) {
      toast({ title: "Error restoring journal", variant: "destructive" });
      return;
    }
    setJournals((prev) => prev.filter((j) => j.id !== journalId));
    toast({ title: "Journal restored" });
  };

  const deletePermanently = async (journalId: string) => {
    const { error } = await supabase.from("journals").delete().eq("id", journalId);
    if (error) {
      toast({ title: "Error deleting journal", variant: "destructive" });
      return;
    }
    setJournals((prev) => prev.filter((j) => j.id !== journalId));
    toast({ title: "Journal deleted" });
  };

  if (loading || loadingTrash) {
    return (
      <div className="flex-1 overflow-auto bg-editor">
        <div className="px-12 py-8">
          <h1 className="text-3xl font-bold text-foreground">Trash</h1>
          <div className="mt-6 text-muted-foreground">Loading…</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex-1 overflow-auto bg-editor">
      <div className="px-12 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Trash</h1>
            <p className="text-muted-foreground mt-1">
              Items in Trash are deleted permanently after 30 days.
            </p>
          </div>
          <Button variant="ghost" onClick={loadTrash}>
            Refresh
          </Button>
        </div>

        {journals.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Trash2 className="h-6 w-6" />
            </div>
            <div className="text-foreground font-medium">Trash is empty</div>
            <div className="text-sm text-muted-foreground mt-1">
              Journals you delete will show up here.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {journals.map((j) => (
              <div
                key={j.id}
                className="group border border-border rounded-lg p-4 hover:border-primary transition-colors bg-card flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-8 h-8 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="text-foreground font-medium truncate">{j.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Trashed {new Date(j.trashed_at).toLocaleDateString()} • Last edited{" "}
                      {new Date(j.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="text-foreground"
                    onClick={() => restoreJournal(j.id)}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restore
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete({ id: j.id, title: j.title })}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title={
          confirmDelete
            ? `Are you sure you want to delete the journal "${confirmDelete.title}"?`
            : "Confirm delete"
        }
        description="This will delete it permanently. This cannot be undone."
        onConfirm={async () => {
          if (!confirmDelete) return;
          const { id } = confirmDelete;
          setConfirmDelete(null);
          await deletePermanently(id);
        }}
      />
    </div>
  );
};

export default TrashPage;


