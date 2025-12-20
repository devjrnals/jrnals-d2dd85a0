import { Home, Search, Plus, HelpCircle, Settings, Moon, Sun, LogOut, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logoLight from "@/assets/logo-light.png";
import logoDark from "@/assets/logo-dark.png";
import { SearchPanel } from "@/components/SearchPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Journal = {
  id: string;
  title: string;
  folder_id: string | null;
  updated_at?: string | null;
};

type Folder = {
  id: string;
  name: string;
};

export const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [displayName, setDisplayName] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);


  useEffect(() => {
    if (user) {
      loadJournals();
      loadFolders();
      loadDisplayName();
    }
  }, [user]);

  // Global shortcut: Ctrl/⌘ + K opens search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (searchOpen) return;
      const isK = e.key.toLowerCase() === "k";
      const isShortcut = (e.ctrlKey || e.metaKey) && isK;
      if (!isShortcut) return;

      // Avoid stealing the shortcut while typing in inputs/textareas.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingTarget =
        tag === "input" ||
        tag === "textarea" ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (isTypingTarget) return;

      e.preventDefault();
      setSearchOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  // Real-time subscription for journal updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('journal-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'journals',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          setJournals((prev) =>
            prev.map((journal) =>
              journal.id === payload.new.id
                ? { ...journal, title: payload.new.title, updated_at: payload.new.updated_at }
                : journal
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadJournals = async () => {
    const { data, error } = await supabase
      .from("journals")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading journals", description: error.message, variant: "destructive" });
    } else {
      setJournals(data || []);
    }
  };

  const loadFolders = async () => {
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading folders", variant: "destructive" });
    } else {
      setFolders(data || []);
    }
  };

  const loadDisplayName = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    setDisplayName(profile?.display_name || "");
  };

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
      setJournals([data, ...journals]);
      navigate(`/journal/${data.id}`);
    }
  };

  const handleUpdateJournalTitle = async (journalId: string, newTitle: string) => {
    const { error } = await supabase
      .from("journals")
      .update({ title: newTitle })
      .eq("id", journalId);

    if (error) {
      toast({ title: "Error updating title", variant: "destructive" });
    } else {
      setJournals(journals.map(j => j.id === journalId ? { ...j, title: newTitle } : j));
      setEditingJournalId(null);
    }
  };


  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Get display name with email fallback
  const getDisplayName = () => {
    if (displayName) return displayName;
    return user?.email?.split('@')[0] || 'User';
  };

  // Get first letter for avatar
  const getAvatarLetter = () => {
    const name = getDisplayName();
    return name[0]?.toUpperCase() || 'U';
  };

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className={`absolute top-4 z-10 bg-sidebar border border-sidebar-border rounded p-1 shadow-md hover:bg-sidebar-accent transition-colors -right-[30px]`}
        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? (
          <ChevronsLeft className="w-4 h-4 text-sidebar-foreground" />
        ) : (
          <ChevronsRight className="w-4 h-4 text-sidebar-foreground" />
        )}
      </button>

      <aside className={`${
        sidebarOpen ? 'w-64' : 'w-0'
      } bg-sidebar border-r border-sidebar-border flex flex-col h-screen transition-all duration-300 ease-in-out overflow-hidden ${
        sidebarOpen ? '' : 'border-r-0'
      }`}>
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <div className={`flex items-center ${sidebarOpen ? '' : 'justify-center'}`}>
            {sidebarOpen ? (
              <>
                <img
                  src={logoDark}
                  alt="AI Jrnals"
                  className="h-6 w-auto object-contain dark:hidden"
                  loading="eager"
                />
                <img
                  src={logoLight}
                  alt="AI Jrnals"
                  className="hidden h-6 w-auto object-contain dark:block"
                  loading="eager"
                />
              </>
            ) : (
              <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">J</span>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <Button
              size="sm"
              onClick={handleCreateJournal}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create
            </Button>
          )}
        </div>

        {sidebarOpen && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="w-full bg-sidebar-accent text-sidebar-foreground px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Search</span>
            </div>
          </button>
        )}
      </div>

      <ScrollArea className="flex-1 overflow-auto">
        <nav className="p-2 space-y-1">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className={`w-full justify-start hover:bg-sidebar-accent ${
              location.pathname === "/dashboard"
                ? "bg-primary/10 text-primary"
                : "text-sidebar-foreground"
            }`}
            title="Home"
          >
            <Home className="w-4 h-4 mr-3" />
            {sidebarOpen && <span>Home</span>}
          </Button>
        </nav>

        {sidebarOpen && (
          <div className="px-4 py-3">
            <h2 className="text-sm font-semibold text-sidebar-foreground mb-2">Your journals</h2>
          </div>
        )}
        <div className="px-2 space-y-1">
          {journals.slice(0, sidebarOpen ? journals.length : 5).map((journal) => (
            <div key={journal.id} className="relative group">
              {editingJournalId === journal.id ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => handleUpdateJournalTitle(journal.id, editingTitle)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleUpdateJournalTitle(journal.id, editingTitle);
                    }
                  }}
                  autoFocus
                  className="w-full px-3 py-2 text-sm bg-sidebar-accent text-sidebar-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => navigate(`/journal/${journal.id}`)}
                    onDoubleClick={() => {
                      if (sidebarOpen) {
                        setEditingJournalId(journal.id);
                        setEditingTitle(journal.title);
                      }
                    }}
                    className={`w-full justify-start ${
                      location.pathname === `/journal/${journal.id}`
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                    title={sidebarOpen ? journal.title : `Open ${journal.title}`}
                  >
                    {sidebarOpen && <span className="truncate">{journal.title}</span>}
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-2 border-t border-sidebar-border space-y-1">
        <Button
          variant="ghost"
          className={`w-full justify-start text-primary hover:bg-sidebar-accent`}
          title="Upgrade"
        >
          <span className="w-4 h-4 flex items-center justify-center bg-primary rounded-full text-primary-foreground text-xs mr-3">+</span>
          {sidebarOpen && <span>Upgrade</span>}
        </Button>
        <Button
          variant="ghost"
          className={`w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent`}
          title="Quick Guide"
        >
          <HelpCircle className="w-4 h-4 mr-3" />
          {sidebarOpen && <span>Quick Guide</span>}
        </Button>
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className={`w-full justify-center hover:bg-sidebar-accent p-2`} title={sidebarOpen ? undefined : getDisplayName()}>
              <div className={`flex items-center ${sidebarOpen ? 'justify-between w-full' : 'justify-center'}`}>
                <div className={`flex items-center gap-2 ${sidebarOpen ? '' : 'flex-col'}`}>
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-medium">
                    {getAvatarLetter()}
                  </div>
                  {sidebarOpen && (
                    <span className="text-sm text-sidebar-foreground">
                      {getDisplayName()}
                    </span>
                  )}
                </div>
                {sidebarOpen && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Free</span>
                )}
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 bg-popover border-border" align="end" side="top">
            <div className="space-y-1">
              <Button
                variant="ghost"
                onClick={toggleTheme}
                className="w-full justify-start text-popover-foreground hover:bg-muted"
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="w-4 h-4 mr-3" />
                    Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 mr-3" />
                    Dark Mode
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate("/settings")}
                className="w-full justify-start text-popover-foreground hover:bg-muted"
              >
                <Settings className="w-4 h-4 mr-3" />
                Settings
              </Button>
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-start text-destructive hover:bg-muted hover:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Log out
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <SearchPanel
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        journals={journals}
        folders={folders}
        onOpenJournal={(journalId) => navigate(`/journal/${journalId}`)}
      />

    </aside>
    </div>
  );
};
