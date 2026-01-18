import { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import { Folder, FileText, Check, Edit, Trash2, ChevronDown, Plus, ArrowUp, List, Grid, X, MoreVertical, Pin, Search } from "lucide-react";
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
import { extractTextFromFile } from "@/utils/documentExtractor";
import { LinkInput } from "@/components/LinkInput";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type Journal = {
  id: string;
  title: string;
  folder_id: string | null;
  updated_at: string;
  content?: string | null;
  pinned?: boolean;
};

type Folder = {
  id: string;
  name: string;
  journal_count?: number;
};

type HomeProps = {
  onLoadComplete?: () => void;
};

export const Home = ({ onLoadComplete }: HomeProps) => {
  const [activeFilter, setActiveFilter] = useState("owned");
  const [sortBy, setSortBy] = useState<"updated_desc" | "updated_asc" | "title_desc" | "title_asc">("updated_desc");
  const [viewMode, setViewMode] = useState<"list" | "panel">("list");
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; content: string; type: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isContextDropdownOpen, setIsContextDropdownOpen] = useState(false);
  const [journalSearchQuery, setJournalSearchQuery] = useState("");
  const [selectedJournalIds, setSelectedJournalIds] = useState<Set<string>>(new Set());


  // Store onLoadComplete in ref to prevent unnecessary re-renders
  const onLoadCompleteRef = useRef(onLoadComplete);
  useEffect(() => {
    onLoadCompleteRef.current = onLoadComplete;
  }, [onLoadComplete]);

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      loadData().finally(() => {
        setIsLoading(false);
        // Call callback after a small delay to ensure state is updated
        setTimeout(() => {
          onLoadCompleteRef.current?.();
        }, 0);
      });
    } else {
      setIsLoading(false);
      setTimeout(() => {
        onLoadCompleteRef.current?.();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              user_id,
              pinned
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
      // Load ALL journals (including those in folders) - they'll be displayed in the main list
      // Note: Don't select 'content' here as it's large and can cause 400 errors with RLS
      [journalsRes, foldersRes] = await Promise.all([
        supabase
          .from("journals")
          .select("id, title, folder_id, updated_at")
          .eq("user_id", user.id)
          .order(sortConfig.column, { ascending: sortConfig.ascending }),
        supabase.from("folders").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      ]);

      // Log for debugging
      if (journalsRes.error) {
        console.error("Error loading owned journals:", journalsRes.error);
        console.error("Error details:", {
          code: journalsRes.error.code,
          message: journalsRes.error.message,
          details: journalsRes.error.details,
          hint: journalsRes.error.hint
        });
      }

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
      console.error("Error loading journals:", journalsRes.error);
      console.error("Error details:", JSON.stringify(journalsRes.error, null, 2));
      toast({ 
        title: "Error loading journals", 
        description: journalsRes.error.message || "Failed to load journals. Please check your database permissions.",
        variant: "destructive" 
      });
      setJournals([]);
    } else {
      // Sort journals: pinned first, then by sort order
      const journalsData = journalsRes.data || [];
      const sortedJournals = journalsData.sort((a, b) => {
        // Pinned journals always come first (if pinned column exists)
        const aPinned = (a as any).pinned || false;
        const bPinned = (b as any).pinned || false;
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        // If both pinned or both not pinned, use existing sort order
        if (sortConfig.column === "title") {
          // String comparison for titles
          const aVal = (a.title || "").toLowerCase();
          const bVal = (b.title || "").toLowerCase();
          return sortConfig.ascending 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        } else if (sortConfig.column === "updated_at") {
          // Date comparison for updated_at
          const aVal = new Date(a.updated_at || 0).getTime();
          const bVal = new Date(b.updated_at || 0).getTime();
          return sortConfig.ascending ? aVal - bVal : bVal - aVal;
        } else {
          // Fallback for other columns
          return 0;
        }
      });
      setJournals(sortedJournals);
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

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  // Filter journals based on search query
  const filteredJournals = useMemo(() => {
    if (!journalSearchQuery.trim()) {
      return journals;
    }
    const query = journalSearchQuery.toLowerCase();
    return journals.filter(journal =>
      journal.title.toLowerCase().includes(query)
    );
  }, [journals, journalSearchQuery]);

  // Get selected journal objects
  const selectedJournals = useMemo(() => {
    return journals.filter(journal => selectedJournalIds.has(journal.id));
  }, [journals, selectedJournalIds]);

  // Handle journal selection
  const handleJournalSelect = (journal: Journal) => {
    const isSelected = selectedJournalIds.has(journal.id);
    const newSelectedIds = new Set(selectedJournalIds);
    
    if (isSelected) {
      // Deselect: remove from set (don't modify input value)
      newSelectedIds.delete(journal.id);
      setSelectedJournalIds(newSelectedIds);
    } else {
      // Select: add to set (don't modify input value)
      newSelectedIds.add(journal.id);
      setSelectedJournalIds(newSelectedIds);
    }
  };

  // Sync selected journals when input is cleared externally
  useEffect(() => {
    if (!inputValue.trim()) {
      setSelectedJournalIds(new Set());
    }
  }, [inputValue]);

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isContextDropdownOpen) {
      setJournalSearchQuery("");
    }
  }, [isContextDropdownOpen]);

  const resolvedName = useMemo(() => {
    return displayName ||
      (user?.user_metadata?.display_name as string | undefined) ||
      (user?.user_metadata?.full_name as string | undefined) ||
      (user?.user_metadata?.name as string | undefined) ||
      (user?.email ? user.email.split("@")[0] : "there");
  }, [displayName, user]);

  // Extract preview text from journal content - memoized to avoid expensive parsing on every render
  const getJournalPreview = useCallback((journal: Journal): string => {
    if (!journal.content) return "No content yet";
    
    try {
      // Try to parse as JSON (block-based content)
      const parsed = JSON.parse(journal.content);
      if (Array.isArray(parsed)) {
        // Extract text from blocks
        let text = '';
        const maxLength = 200;
        for (const block of parsed) {
          if (block.type === 'paragraph' || block.type === 'text') {
            const content = block.content || '';
            // Remove HTML tags for preview
            const plainText = content.replace(/<[^>]*>/g, '').trim();
            if (plainText) {
              text += plainText + ' ';
            }
            if (text.length > maxLength) break;
          } else if (block.type === 'heading1' || block.type === 'heading2' || block.type === 'heading3') {
            const content = block.content || '';
            const plainText = content.replace(/<[^>]*>/g, '').trim();
            if (plainText) {
              text += plainText + ' ';
            }
            if (text.length > maxLength) break;
          }
        }
        if (text.trim()) {
          const trimmed = text.trim();
          return trimmed.substring(0, maxLength) + (trimmed.length > maxLength ? '...' : '');
        }
      }
    } catch {
      // Not JSON, treat as plain text
    }
    
    // Fallback: treat as plain text
    const plainText = journal.content.replace(/<[^>]*>/g, '').trim();
    if (plainText) {
      return plainText.substring(0, 200) + (plainText.length > 200 ? '...' : '');
    }
    
    return "No content yet";
  }, []);

  const filters = useMemo(
    () => [
      { id: "owned", label: "Notes by you" },
      { id: "shared", label: "Shared with you" },
    ],
    []
  );

  const readFileContent = async (file: File): Promise<string> => {
    // Use the document extractor for PDFs, Word docs, and PowerPoints
    // Fallback to text reading for other files
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();
    
    const isDocumentFile = 
      fileName.endsWith('.pdf') ||
      fileName.endsWith('.docx') ||
      fileName.endsWith('.doc') ||
      fileName.endsWith('.pptx') ||
      fileName.endsWith('.ppt') ||
      fileType === 'application/pdf' ||
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword' ||
      fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      fileType === 'application/vnd.ms-powerpoint';
    
    if (isDocumentFile) {
      return await extractTextFromFile(file);
    }
    
    // For text files, use FileReader
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0]; // Take the first file
    try {
      const textFileTypes = [
        'text/plain',
        'text/markdown',
        'text/javascript',
        'text/typescript',
        'application/json',
        'text/css',
        'text/html',
        'application/xml',
        'text/xml'
      ];

      const documentFileTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint'
      ];

      const isTextFile = textFileTypes.includes(file.type) ||
                        file.name.endsWith('.txt') ||
                        file.name.endsWith('.md') ||
                        file.name.endsWith('.js') ||
                        file.name.endsWith('.ts') ||
                        file.name.endsWith('.json') ||
                        file.name.endsWith('.css') ||
                        file.name.endsWith('.html') ||
                        file.name.endsWith('.xml');

      const isDocumentFile = documentFileTypes.includes(file.type) ||
                            file.name.endsWith('.pdf') ||
                            file.name.endsWith('.docx') ||
                            file.name.endsWith('.doc') ||
                            file.name.endsWith('.pptx') ||
                            file.name.endsWith('.ppt');

      if (!isTextFile && !isDocumentFile) {
        toast({
          title: "Unsupported file type",
          description: `File "${file.name}" is not a supported file type. Supported: text files, PDFs, Word documents, and PowerPoint presentations.`,
          variant: "destructive"
        });
        event.target.value = '';
        return;
      }

      // Determine file type - ensure PDFs get correct type even if browser doesn't provide MIME type
      let fileType = file.type;
      if (!fileType || fileType === 'application/octet-stream') {
        if (file.name.toLowerCase().endsWith('.pdf')) {
          fileType = 'application/pdf';
        } else if (file.name.toLowerCase().endsWith('.docx')) {
          fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (file.name.toLowerCase().endsWith('.doc')) {
          fileType = 'application/msword';
        } else if (file.name.toLowerCase().endsWith('.pptx')) {
          fileType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        } else if (file.name.toLowerCase().endsWith('.ppt')) {
          fileType = 'application/vnd.ms-powerpoint';
        } else {
          fileType = 'text/plain';
        }
      }

      // Try to extract content, but still add file even if extraction fails
      let content = '';
      try {
        content = await readFileContent(file);
      } catch (error) {
        console.error(`Error extracting content from ${file.name}:`, error);
        // Still add the file with empty content - user can still reference it
        content = `[Error extracting content from ${file.name}. File uploaded but content extraction failed.]`;
      }
      
      // Store the file instead of creating a journal
      setUploadedFiles(prev => [...prev, {
        name: file.name,
        content: content,
        type: fileType
      }]);
      
      event.target.value = '';
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      // Even if there's an error, try to add the file with a placeholder
      const fileName = file.name.toLowerCase();
      let fileType = file.type || 'application/octet-stream';
      if (!fileType || fileType === 'application/octet-stream') {
        if (fileName.endsWith('.pdf')) {
          fileType = 'application/pdf';
        } else if (fileName.endsWith('.docx')) {
          fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (fileName.endsWith('.doc')) {
          fileType = 'application/msword';
        } else if (fileName.endsWith('.pptx')) {
          fileType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        } else if (fileName.endsWith('.ppt')) {
          fileType = 'application/vnd.ms-powerpoint';
        }
      }
      
      setUploadedFiles(prev => [...prev, {
        name: file.name,
        content: `[Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}]`,
        type: fileType
      }]);
      
      event.target.value = '';
    }
  };

  const handleCreateJournalFromFile = async (title: string, content: string) => {
    if (!user) return;

    try {
      // Create initial content with the file content as a paragraph block
      const initialBlocks = [{
        id: 'paragraph-0',
        type: 'paragraph',
        content: content,
        children: [],
        collapsed: false
      }];
      
      const { data, error } = await supabase
        .from("journals")
        .insert({
          title: title || "Untitled",
          content: JSON.stringify(initialBlocks),
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Journal created",
        description: `Journal "${title}" has been created from the uploaded file.`,
      });

      // Navigate to the new journal
      navigate(`/journal/${data.id}`);
    } catch (error) {
      console.error("Error creating journal from file:", error);
      toast({
        title: "Error",
        description: "Failed to create journal from file.",
        variant: "destructive"
      });
    }
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
      // Instantly navigate to the new journal (don't wait for data refresh)
      navigate(`/journal/${data.id}`);
    }
  };

  const handleCreateJournalWithMessage = async () => {
    if (!user || (!inputValue.trim() && uploadedFiles.length === 0)) return;

    const message = inputValue.trim();
    
    try {
      // Create a new journal with a title based on the message or file name
      const title = message.length > 50 ? message.substring(0, 50) + "..." : (message || uploadedFiles[0]?.name.replace(/\.[^/.]+$/, "") || "New Journal");
      
      const { data, error } = await supabase
        .from("journals")
        .insert({ 
          user_id: user.id, 
          title: title 
        })
        .select()
        .single();

      if (error) {
        toast({ title: "Error creating journal", variant: "destructive" });
        return;
      }

      // Navigate to the new journal with the message and files as state
      navigate(`/journal/${data.id}`, { 
        state: { 
          initialMessage: message,
          initialFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined
        } 
      });
      
      // Clear the input and files
      setInputValue("");
      setUploadedFiles([]);
    } catch (error) {
      console.error("Error creating journal with message:", error);
      toast({
        title: "Error",
        description: "Failed to create journal.",
        variant: "destructive"
      });
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
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
      // If error is about missing column, show helpful message
      if (error.code === '42703' || error.message?.includes('pinned')) {
        toast({ 
          title: "Pin feature not available", 
          description: "The pinned column needs to be added to your database. Run the migration to enable this feature.",
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

  // Memoize journal previews for panel view to avoid expensive recalculation
  const journalPreviews = useMemo(() => {
    const previewMap = new Map<string, string>();
    journals.forEach(journal => {
      previewMap.set(journal.id, getJournalPreview(journal));
    });
    return previewMap;
  }, [journals, getJournalPreview]);

  // Hide content while loading but still render so useEffect runs
  return (
    <div className={`flex-1 overflow-auto bg-editor dark:bg-[#212121] ${isLoading ? 'opacity-0 pointer-events-none' : ''}`}>
      <div className="px-12 py-8">
        {/* Header */}
        <div className="flex flex-col items-center pt-64 mb-8">
          <h1 className="text-4xl font-normal text-foreground dark:text-[#F3FAF9]">
            {greeting}, {resolvedName}
          </h1>
        </div>

        {/* Input Section */}
        <div className="max-w-4xl mx-auto mb-64">
          <div className="relative">
            {/* Uploaded Files Display */}
            {uploadedFiles.length > 0 && (
              <div className="mb-3 overflow-x-auto">
                <div className="flex gap-2 w-max">
                  {uploadedFiles.map((file, index) => {
                  // Get file type from extension
                  const getFileType = (fileName: string, fileType: string): string => {
                    const extension = fileName.split('.').pop()?.toUpperCase();
                    if (fileType === 'application/pdf' || extension === 'PDF') return 'PDF';
                    if (fileType.includes('word') || extension === 'DOCX' || extension === 'DOC') return 'DOC';
                    if (fileType.includes('powerpoint') || extension === 'PPTX' || extension === 'PPT') return 'PPT';
                    if (extension === 'TXT') return 'TXT';
                    if (extension === 'MD') return 'MD';
                    return extension || 'FILE';
                  };

                  const fileType = getFileType(file.name, file.type);
                  const truncatedName = file.name.length > 30 ? file.name.substring(0, 30) + '...' : file.name;

                  return (
                    <div key={index} className="flex items-center gap-2 bg-white dark:bg-[#333333] rounded-xl p-2 border border-gray-200 dark:border-[#333333] w-fit">
                      {/* Red square icon with white document */}
                      <div className="flex-shrink-0 w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                        <FileText className="h-4 w-4 text-white" />
                      </div>
                      {/* File name and type */}
                      <div className="flex-shrink-0">
                        <div className="text-sm text-gray-900 dark:text-[#F3FAF9] font-medium whitespace-nowrap">{truncatedName}</div>
                        <div className="text-xs text-gray-500 dark:text-[#F3FAF9]/70">{fileType}</div>
                      </div>
                      {/* Remove button */}
                      <button
                        type="button"
                        className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-900 dark:text-[#F3FAF9] hover:text-gray-700 dark:hover:text-[#F3FAF9]/80 transition-colors"
                        onClick={() => removeFile(index)}
                        aria-label="Remove file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
                </div>
              </div>
            )}

            <div className="flex flex-col bg-sidebar-accent dark:bg-[#333333] rounded-2xl border-0 shadow-sm px-4 py-3 focus-within:outline-none min-h-[80px]">
              {/* @ Add context button and selected journal chips - positioned above plus icon */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <DropdownMenu open={isContextDropdownOpen} onOpenChange={setIsContextDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className="flex items-center justify-center h-8 px-3 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-[#F3FAF9] hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium whitespace-nowrap"
                      title="Add context"
                    >
                      @ Add context
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    className="w-80 p-0" 
                    align="start"
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    {/* Search input */}
                    <div className="p-2 border-b">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search journals..."
                          value={journalSearchQuery}
                          onChange={(e) => setJournalSearchQuery(e.target.value)}
                          className="pl-8"
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Journal list */}
                    <ScrollArea className="max-h-[300px]">
                      {filteredJournals.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          {journalSearchQuery.trim() ? "No journals found" : "No journals available"}
                        </div>
                      ) : (
                        <div className="p-1">
                          {filteredJournals.map((journal) => {
                            const isSelected = selectedJournalIds.has(journal.id);
                            return (
                              <DropdownMenuItem
                                key={journal.id}
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleJournalSelect(journal);
                                }}
                                className="flex items-center gap-2 cursor-pointer"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <div className="flex items-center justify-center w-4 h-4">
                                  {isSelected && (
                                    <Check className="h-4 w-4 text-primary" />
                                  )}
                                </div>
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="flex-1 truncate">{journal.title}</span>
                              </DropdownMenuItem>
                            );
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Selected journal chips */}
                {selectedJournals.map((journal) => (
                  <div
                    key={journal.id}
                    className="flex items-center gap-1.5 h-8 px-3 pr-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-[#F3FAF9] text-sm font-medium whitespace-nowrap"
                  >
                    <span>{journal.title}</span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleJournalSelect(journal);
                      }}
                      className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      aria-label={`Remove ${journal.title}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Input row with plus icon and input field */}
              <div className="flex items-center flex-1">
              {/* Plus Icon - File Upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.js,.ts,.json,.css,.html,.xml,.pdf,.doc,.docx,.ppt,.pptx,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center w-6 h-6 mr-3 text-sidebar-accent-foreground dark:text-[#F3FAF9] hover:text-sidebar-foreground dark:hover:text-[#F3FAF9] transition-colors"
                title="Upload file"
              >
                <Plus className="w-5 h-5" />
              </button>

              {/* Input Field */}
              <LinkInput
                value={inputValue}
                onChange={setInputValue}
                placeholder="Ask anything"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && (inputValue.trim() || uploadedFiles.length > 0)) {
                    e.preventDefault();
                    handleCreateJournalWithMessage();
                  }
                }}
                  className="bg-transparent text-sidebar-accent-foreground dark:text-[#F3FAF9] placeholder:text-muted-foreground dark:placeholder:text-[#F3FAF9]/60 text-base focus:outline-none focus:ring-0 flex-1"
              />

              {/* Enter Button (upward arrow) */}
              <button 
                onClick={handleCreateJournalWithMessage}
                disabled={!inputValue.trim() && uploadedFiles.length === 0}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <ArrowUp className="w-5 h-5" />
              </button>
              </div>
            </div>
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
                  : "text-foreground dark:text-[#F3FAF9] hover:bg-secondary"
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
              <h2 className="text-2xl font-bold text-foreground dark:text-[#F3FAF9]">Folders</h2>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <button
                onClick={handleCreateFolder}
                className="group border-2 border-dashed border-border rounded-lg p-4 hover:border-primary transition-colors flex items-center gap-3 bg-card/50"
              >
                <Folder className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-foreground dark:text-[#F3FAF9] font-medium">Create folder</span>
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
                <h2 className="text-2xl font-bold text-foreground dark:text-[#F3FAF9]">
                  {activeFilter === "shared" ? "Shared with you" : "Journals"}
                </h2>
              </div>

            <div className="flex items-center gap-4 text-foreground">
              <div className="flex items-center gap-2">
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
              
              {/* View Toggle */}
              <div className="flex items-center gap-1 border border-border rounded-md p-1">
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-7 px-2"
                  title="List View"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "panel" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("panel")}
                  className="h-7 px-2"
                  title="Panel View"
                >
                  <Grid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {viewMode === "list" ? (
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
                        <div className="text-xs text-muted-foreground">
                          {new Date(journal.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        {(journal as any).pinned && (
                          <Pin className="w-4 h-4 text-muted-foreground fill-current" />
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                              title="More options"
                            >
                              <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              togglePinJournal(journal);
                            }}>
                              <Pin className={`w-4 h-4 mr-2 ${(journal as any).pinned ? 'fill-current' : ''}`} />
                              {(journal as any).pinned ? 'Unpin' : 'Pin'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              startEditingJournal(journal);
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
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {activeFilter === "owned" && (
                <button
                  onClick={handleCreateJournal}
                  className="group border-2 border-dashed border-border rounded-lg p-6 hover:border-primary transition-colors flex flex-col items-center justify-center bg-card/50 min-h-[200px]"
                >
                  <FileText className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors mb-3" />
                  <span className="text-foreground font-medium">Create journal</span>
                </button>
              )}
              {journals.map((journal) => {
                const preview = journalPreviews.get(journal.id) || getJournalPreview(journal);
                return (
                  <div
                    key={journal.id}
                    onClick={() => navigate(`/journal/${journal.id}`)}
                    className="group border border-border rounded-lg bg-card cursor-pointer hover:border-primary transition-all hover:shadow-md flex flex-col h-full min-h-[200px]"
                  >
                    {/* Top section: Content preview */}
                    <div className="flex-1 p-4 overflow-hidden">
                      <p className="text-sm text-muted-foreground line-clamp-4 leading-relaxed">
                        {preview}
                      </p>
                    </div>
                    
                    {/* Bottom section: Title and date */}
                    <div className="border-t border-border p-4 bg-muted/30">
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
                          className="w-full bg-transparent border-b border-primary outline-none text-foreground font-medium"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <h3 className="text-foreground font-semibold mb-1 truncate">{journal.title}</h3>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {new Date(journal.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <div className="flex items-center gap-1">
                              {(journal as any).pinned && (
                                <Pin className="h-3.5 w-3.5 text-muted-foreground fill-current" />
                              )}
                              <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                                  title="More options"
                                >
                                  <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  togglePinJournal(journal);
                                }}>
                                  <Pin className={`w-4 h-4 mr-2 ${(journal as any).pinned ? 'fill-current' : ''}`} />
                                  {(journal as any).pinned ? 'Unpin' : 'Pin'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingJournal(journal);
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
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {journals.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {activeFilter === "shared" ? "No shared journals" : "No journals yet"}
              </h3>
              <p className="text-muted-foreground">
                {activeFilter === "shared" 
                  ? "Journals shared with you will appear here."
                  : "Create your first journal to get started."}
              </p>
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
            ? `Are you sure you want to delete the ${confirmState.kind} "${confirmState.title}"?`
            : "Confirm delete"
        }
        description={
          confirmState.open
            ? "This action cannot be undone."
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
