import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { Editor } from "@/components/Editor";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const Journal = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [journal, setJournal] = useState<any>(null);
  const [loadingJournal, setLoadingJournal] = useState(true);
  const [wordCount, setWordCount] = useState(0);
  const [confirmTrashOpen, setConfirmTrashOpen] = useState(false);

  const isMissingTrashedAtColumn = (err: unknown) => {
    const e = err as { code?: string; message?: string } | null;
    return e?.code === "42703" || (e?.message || "").toLowerCase().includes("trashed_at");
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user && id) {
      loadJournal();
    }
  }, [user, id]);

  const loadJournal = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("journals")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      toast({ title: "Error loading journal", variant: "destructive" });
      navigate("/");
    } else {
      if (data?.trashed_at) {
        toast({ title: "That journal is in Trash." });
        setLoadingJournal(false);
        navigate("/trash");
        return;
      }
      setJournal(data);
    }
    setLoadingJournal(false);
  };

  const handleTitleChange = async (newTitle: string) => {
    if (!id) return;

    const { error } = await supabase
      .from("journals")
      .update({ title: newTitle })
      .eq("id", id);

    if (error) {
      toast({ title: "Error updating title", variant: "destructive" });
    } else {
      setJournal({ ...journal, title: newTitle });
    }
  };

  const moveToTrash = async () => {
    if (!id) return;
    const { error } = await supabase
      .from("journals")
      .update({ trashed_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      if (isMissingTrashedAtColumn(error)) {
        toast({
          title: "Trash isn't set up in your database yet",
          description: "Please apply the migration that adds journals.trashed_at, then try again.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Error moving to Trash", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Moved to Trash" });
      navigate("/trash");
    }
  };

  if (loading || loadingJournal) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !journal) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar
        journalTitle={journal.title}
        onTitleChange={handleTitleChange}
        wordCount={wordCount}
        onMoveToTrash={() => setConfirmTrashOpen(true)}
      />
      <Editor 
        journalId={journal.id} 
        initialContent={journal.content || ""} 
        onWordCountChange={setWordCount}
      />

      <ConfirmDialog
        open={confirmTrashOpen}
        onOpenChange={setConfirmTrashOpen}
        title={`Are you sure you want to delete the journal "${journal.title}"?`}
        description="This will move it to Trash. It will be deleted permanently after 30 days."
        onConfirm={async () => {
          setConfirmTrashOpen(false);
          await moveToTrash();
        }}
      />
    </div>
  );
};

export default Journal;
