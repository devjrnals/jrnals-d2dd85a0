import { Home, Search, Plus, HelpCircle, Settings, Moon, Sun, LogOut, ChevronsLeft, ChevronsRight, Users, FileText, PanelLeft, MoreVertical, Pin, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { PremiumPanel } from "@/components/PremiumPanel";
import { PREMIUM_PANEL_OPEN_EVENT } from "@/lib/premiumPanel";

type Journal = {
  id: string;
  title: string;
  folder_id: string | null;
  updated_at?: string | null;
  pinned?: boolean;
};

type Folder = {
  id: string;
  name: string;
};

type SidebarProps = {
  onLoadComplete?: () => void;
};

export const Sidebar = ({ onLoadComplete }: SidebarProps) => {
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<
    | { open: false }
    | {
        open: true;
        id: string;
        title: string;
      }
  >({ open: false });


  useEffect(() => {
    if (user) {
      setIsLoading(true);
      Promise.all([
        loadJournals(),
        loadFolders(),
        loadDisplayName(),
        loadAvatar()
      ]).finally(() => {
        setIsLoading(false);
        // Call callback after a small delay to ensure state is updated
        setTimeout(() => {
          onLoadComplete?.();
        }, 0);
      });
    } else {
      setIsLoading(false);
      setTimeout(() => {
        onLoadComplete?.();
      }, 0);
    }
  }, [user, onLoadComplete]);

  // Global shortcut: Ctrl/⌘ + K opens search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (searchOpen) return;
      if (!e.key) return; // Fix: Check if key exists
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

  // Allow any part of the app to open the premium panel without prop drilling.
  useEffect(() => {
    const onOpen = () => setPremiumOpen(true);
    window.addEventListener(PREMIUM_PANEL_OPEN_EVENT, onOpen as EventListener);
    return () => window.removeEventListener(PREMIUM_PANEL_OPEN_EVENT, onOpen as EventListener);
  }, []);

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

  // Real-time subscription for profile updates (avatar changes)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          setAvatarUrl(payload.new.avatar_url || null);
          if (payload.new.display_name !== undefined) {
            setDisplayName(payload.new.display_name || "");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadJournals = async () => {
    if (!user) {
      setJournals([]);
      return;
    }

    const { data, error } = await supabase
      .from("journals")
      .select("id, title, folder_id, updated_at")
      .eq("user_id", user.id) // SECURITY: Only load journals owned by current user
      .order("updated_at", { ascending: false });
    
    if (error) {
      toast({ title: "Error loading journals", description: error.message, variant: "destructive" });
      setJournals([]);
      return;
    }

    if (data) {
      // Sort journals: pinned first, then by updated_at
      const sortedJournals = data.sort((a, b) => {
        const aPinned = (a as any).pinned || false;
        const bPinned = (b as any).pinned || false;
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        const aTime = new Date(a.updated_at || 0).getTime();
        const bTime = new Date(b.updated_at || 0).getTime();
        return bTime - aTime;
      });
      setJournals(sortedJournals);
    } else {
      setJournals([]);
    }
  };

  const loadFolders = async () => {
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading folders", variant: "destructive" });
      return;
    } else {
      setFolders(data || []);
    }
  };

  const loadDisplayName = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();

    setDisplayName(profile?.display_name || "");
    setAvatarUrl(profile?.avatar_url || null);
  };

  const loadAvatar = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();

    setAvatarUrl(profile?.avatar_url || null);
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
    if (!user) return;

    // SECURITY: Verify ownership before updating
    const { error } = await supabase
      .from("journals")
      .update({ title: newTitle })
      .eq("id", journalId)
      .eq("user_id", user.id); // Only update if user owns it

    if (error) {
      toast({ title: "Error updating title", variant: "destructive" });
    } else {
      setJournals(journals.map(j => j.id === journalId ? { ...j, title: newTitle } : j));
      setEditingJournalId(null);
    }
  };

  const deleteJournal = async (journalId: string) => {
    if (!user) return;

    // SECURITY: Verify ownership before deleting
    const { error } = await supabase
      .from("journals")
      .delete()
      .eq("id", journalId)
      .eq("user_id", user.id); // Only delete if user owns it

    if (error) {
      toast({ title: "Error deleting journal", description: error.message, variant: "destructive" });
    } else {
      setJournals(journals.filter(j => j.id !== journalId));
      toast({ title: "Journal deleted successfully" });
    }
  };

  const confirmDeleteJournal = (journal: Journal) => {
    setConfirmState({ open: true, id: journal.id, title: journal.title });
  };

  const togglePinJournal = async (journal: Journal) => {
    if (!user) return;

    const newPinnedState = !((journal as any).pinned || false);
    // SECURITY: Verify ownership before updating
    const { error } = await supabase
      .from("journals")
      .update({ pinned: newPinnedState } as any)
      .eq("id", journal.id)
      .eq("user_id", user.id); // Only update if user owns it

    if (error) {
      // If error is about missing column, silently fail (feature not available)
      if (error.code === '42703' || error.message?.includes('pinned')) {
        toast({ 
          title: "Pin feature not available", 
          description: "The pinned column needs to be added to your database.",
          variant: "destructive" 
        });
      } else {
        toast({ title: "Error updating journal", description: error.message, variant: "destructive" });
      }
    } else {
      setJournals(journals.map(j => j.id === journal.id ? { ...j, pinned: newPinnedState } as any : j));
      toast({ 
        title: newPinnedState ? "Journal pinned" : "Journal unpinned",
      });
    }
  };


  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);

    // Theme persistence is handled elsewhere - profiles table doesn't have theme column yet
    // To add theme persistence, run a migration to add the theme column to profiles
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
      <aside className={`${
        sidebarOpen ? 'w-64' : 'w-[72px]'
      } bg-sidebar flex flex-col h-screen transition-all duration-300 ease-in-out overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className={`flex items-center ${sidebarOpen ? 'flex-1' : 'justify-center w-full relative group'}`}>
            {sidebarOpen ? (
              <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center"
              >
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
              </button>
            ) : (
              <>
                <img
                  src={logoDark}
                  alt="AI Jrnals"
                  className="h-6 w-auto object-contain dark:hidden transition-opacity group-hover:opacity-0"
                  loading="eager"
                />
                <img
                  src={logoLight}
                  alt="AI Jrnals"
                  className="hidden h-6 w-auto object-contain dark:block transition-opacity group-hover:opacity-0"
                  loading="eager"
                />
              </>
            )}
            {sidebarOpen && (
              <button
                onClick={toggleSidebar}
                className="ml-auto p-1 hover:bg-sidebar-accent rounded transition-colors"
                title="Close sidebar"
              >
                <PanelLeft className="w-4 h-4 text-sidebar-foreground" />
              </button>
            )}
            {!sidebarOpen && (
              <button
                onClick={toggleSidebar}
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-sidebar-accent rounded"
                title="Open sidebar"
              >
                <PanelLeft className="w-4 h-4 text-sidebar-foreground" />
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className={`w-full bg-sidebar-accent text-sidebar-foreground px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary flex items-center ${sidebarOpen ? 'justify-start gap-2' : 'justify-center'}`}
          title="Search"
        >
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          {sidebarOpen && <span className="text-muted-foreground">Search</span>}
        </button>
      </div>

      <nav className="p-4 space-y-1">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className={`w-full justify-start px-3 py-2 hover:bg-sidebar-accent rounded-md ${
            location.pathname === "/dashboard"
              ? "bg-primary/10 text-primary"
              : "text-sidebar-foreground"
          }`}
          title="Home"
        >
          <Home className="w-4 h-4" />
          {sidebarOpen && <span className="ml-3">Home</span>}
        </Button>
        <Button
          variant="ghost"
          onClick={handleCreateJournal}
          className="w-full justify-start px-3 py-2 hover:bg-sidebar-accent text-sidebar-foreground rounded-md"
          title="Create"
        >
          <FileText className="w-4 h-4" />
          {sidebarOpen && <span className="ml-3">Create</span>}
        </Button>
      </nav>

      <ScrollArea className={`flex-1 overflow-auto ${!sidebarOpen ? 'hidden' : ''}`}>

        {sidebarOpen && (
          <div className="px-4 py-3">
            <h2 className="text-sm font-semibold text-sidebar-foreground mb-0.5">Your journals</h2>
          </div>
        )}
        <div className="px-4 pt-1 pb-4 space-y-1">
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
                    className={`w-full flex justify-between items-center px-3 py-2 rounded-md group/item ${
                      location.pathname === `/journal/${journal.id}`
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                    title={sidebarOpen ? journal.title : `Open ${journal.title}`}
                  >
                    {sidebarOpen && <span className="truncate flex-1 text-left min-w-0 overflow-hidden">{journal.title}</span>}
                    {sidebarOpen && (
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        {(journal as any).pinned && (
                          <Pin className="w-3.5 h-3.5 text-sidebar-foreground fill-current" />
                        )}
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="opacity-0 group-hover/item:opacity-100 p-1 rounded transition-opacity flex-shrink-0"
                            title="More options"
                          >
                            <MoreVertical className="w-4 h-4 text-sidebar-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="border-0">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            togglePinJournal(journal);
                          }}>
                            <Pin className={`w-4 h-4 mr-2 ${(journal as any).pinned ? 'fill-current' : ''}`} />
                            {(journal as any).pinned ? 'Unpin' : 'Pin'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setEditingJournalId(journal.id);
                            setEditingTitle(journal.title);
                          }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDeleteJournal(journal);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Bin
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    )}
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {sidebarOpen && (
        <div className="p-4">
          <Button
            className={`w-full justify-start bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 rounded-md`}
            title="Upgrade"
            onClick={() => setPremiumOpen(true)}
          >
            <span className="w-4 h-4 flex items-center justify-center bg-primary-foreground rounded-full text-primary text-xs mr-3">+</span>
            <span>Upgrade</span>
          </Button>
        </div>
      )}

      <div className="p-4 mt-auto">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className={`w-full hover:bg-sidebar-accent px-3 py-2 rounded-md ${sidebarOpen ? 'justify-start' : 'justify-center'}`} title={sidebarOpen ? undefined : getDisplayName()}>
              <div className={`flex items-center ${sidebarOpen ? 'justify-between w-full' : 'justify-center'}`}>
                <div className={`flex items-center ${sidebarOpen ? 'gap-2' : ''}`}>
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-medium overflow-hidden">
                    {avatarUrl ? (
                      <img 
                        src={avatarUrl} 
                        alt={getDisplayName()} 
                        className="w-full h-full object-cover"
                        onError={() => setAvatarUrl(null)}
                      />
                    ) : (
                      getAvatarLetter()
                    )}
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
                className="w-full justify-start text-popover-foreground hover:bg-muted hover:text-popover-foreground"
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
              {user?.email === "alishahed798@gmail.com" && (
                <Button
                  variant="ghost"
                  onClick={() => navigate("/admin")}
                  className="w-full justify-start text-popover-foreground hover:bg-muted hover:text-popover-foreground"
                >
                  <Users className="w-4 h-4 mr-3" />
                  Admin
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => navigate("/settings")}
                className="w-full justify-start text-popover-foreground hover:bg-muted hover:text-popover-foreground"
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

      <PremiumPanel open={premiumOpen} onClose={() => setPremiumOpen(false)} />

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
            ? "This action cannot be undone."
            : undefined
        }
        onConfirm={async () => {
          if (!confirmState.open) return;
          const { id } = confirmState;
          setConfirmState({ open: false });
          deleteJournal(id);
        }}
      />

    </aside>
    </div>
  );
};
