import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { Editor } from "@/components/Editor";
import { ChatbotSidebar } from "@/components/ChatbotSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type QuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: number;
};

type QuizData = {
  title: string;
  questions: QuizQuestion[];
};

type FlashcardData = {
  title: string;
  cards: Array<{
    id: string;
    front: string;
    back: string;
  }>;
};

const Journal = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { toast } = useToast();
  const [journal, setJournal] = useState<any>(null);
  const [loadingJournal, setLoadingJournal] = useState(true);
  const [wordCount, setWordCount] = useState(0);
  const [confirmTrashOpen, setConfirmTrashOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Quiz state
  const [currentQuiz, setCurrentQuiz] = useState<QuizData | null>(null);
  const [currentFlashcards, setCurrentFlashcards] = useState<FlashcardData | null>(null);
  
  // Content insertion callback
  const [insertContentCallback, setInsertContentCallback] = useState<((content: string) => void) | null>(null);
  const insertContentRef = useRef<((content: string) => void) | null>(null);
  
  // Keep ref in sync with callback
  useEffect(() => {
    insertContentRef.current = insertContentCallback;
  }, [insertContentCallback]);
  
  // Wrapper function that always uses the latest callback
  const handleInsertContent = useCallback((content: string) => {
    // Always use ref first (most up-to-date)
    const callback = insertContentRef.current;
    if (callback) {
      callback(content);
    }
  }, []);

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
    if (!id || !user) return;

    const { data, error } = await supabase
      .from("journals")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id) // SECURITY: Verify ownership before loading
      .single();

    if (error || !data) {
      toast({ 
        title: "Error loading journal", 
        description: "Journal not found or you don't have access to it.",
        variant: "destructive" 
      });
      navigate("/");
      return;
    }

    // SECURITY: Double-check ownership (defense in depth)
    if (data.user_id !== user.id) {
      toast({ 
        title: "Access denied", 
        description: "You don't have permission to access this journal.",
        variant: "destructive" 
      });
      navigate("/");
      return;
    }

    // Check for trashed_at if the column exists (optional feature)
    if ((data as any)?.trashed_at) {
      toast({ title: "That journal is in Trash." });
      setLoadingJournal(false);
      navigate("/trash");
      return;
    }

    setJournal(data);
    setLoadingJournal(false);
  };

  const handleTitleChange = async (newTitle: string) => {
    if (!id || !user) return;

    const finalTitle = newTitle.trim() || "New Journal";

    // SECURITY: Verify ownership before updating
    const { error } = await supabase
      .from("journals")
      .update({ title: finalTitle })
      .eq("id", id)
      .eq("user_id", user.id); // Only update if user owns it

    if (error) {
      toast({ title: "Error updating title", variant: "destructive" });
    } else {
      setJournal({ ...journal, title: finalTitle });
    }
  };

  const moveToTrash = async () => {
    if (!id) return;
    const { error } = await supabase
      .from("journals")
      .update({ trashed_at: new Date().toISOString() } as any)
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

  // Quiz handling
  const handleQuizGenerated = (quiz: QuizData) => {
    console.log('Journal: handleQuizGenerated called with:', quiz);
    setCurrentQuiz(quiz);
  };

  const handleFlashcardsGenerated = (flashcards: FlashcardData) => {
    console.log('Journal: handleFlashcardsGenerated called with:', flashcards);
    setCurrentFlashcards(flashcards);
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
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <TopBar
        journalTitle={journal.title}
        journalId={journal.id}
        onTitleChange={handleTitleChange}
        wordCount={wordCount}
        onMoveToTrash={() => setConfirmTrashOpen(true)}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        sidebarCollapsed={sidebarCollapsed}
      />
      {/* Content area under the TopBar */}
      <div className={`flex-1 flex overflow-hidden transition-all duration-300 ${!sidebarCollapsed ? 'lg:pr-[420px]' : ''}`}>
        <div className="flex-1 min-w-0 flex flex-col">
          <Editor
            key={journal.id} // Force remount when journal changes
            journalId={journal.id}
            initialContent={journal.content || ""}
            onWordCountChange={setWordCount}
            currentQuiz={currentQuiz}
            currentFlashcards={currentFlashcards}
            onQuizAdded={() => {
              console.log('Clearing current quiz state');
              setCurrentQuiz(null);
            }}
            onFlashcardsAdded={() => {
              console.log('Clearing current flashcards state');
              setCurrentFlashcards(null);
            }}
            onInsertContentReady={(callback) => {
              // Store the callback directly
              insertContentRef.current = callback;
              setInsertContentCallback(() => callback);
            }}
          />
        </div>
      </div>

      {/* Right-side chatbot panel (desktop) - full height from top of page */}
      <div className={`hidden lg:flex w-[420px] fixed top-0 right-0 h-full bg-muted rounded-l-[20px] z-10 transition-transform duration-300 ease-in-out ${sidebarCollapsed ? 'translate-x-full' : 'translate-x-0'}`}>
        <ChatbotSidebar
          journalTitle={journal.title}
          journalId={journal.id}
          onQuizGenerated={handleQuizGenerated}
          onFlashcardsGenerated={handleFlashcardsGenerated}
          onInsertContent={handleInsertContent}
          initialMessage={(location.state as any)?.initialMessage}
          initialFiles={(location.state as any)?.initialFiles}
        />
      </div>

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
