import { useState, useEffect, useMemo } from "react";
import { Search, FileText, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type Journal = {
  id: string;
  title: string;
  folder_id: string | null;
  updated_at: string;
};

interface AddJournalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  onAddJournals: (journals: Journal[]) => void;
}

export const AddJournalsDialog = ({
  open,
  onOpenChange,
  folderId,
  onAddJournals,
}: AddJournalsDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJournals, setSelectedJournals] = useState<Set<string>>(new Set());
  const [availableJournals, setAvailableJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open && user) {
      loadAvailableJournals();
    }
  }, [open, user]);

  const loadAvailableJournals = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("journals")
        .select("*")
        .eq("user_id", user.id)
        .or(`folder_id.is.null,folder_id.neq.${folderId}`)
        .order("updated_at", { ascending: false });

      if (error) {
        toast({
          title: "Error loading journals",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setAvailableJournals(data || []);
      }
    } catch (error) {
      toast({
        title: "Error loading journals",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredJournals = useMemo(() => {
    if (!searchQuery.trim()) return availableJournals;

    const query = searchQuery.toLowerCase();
    return availableJournals.filter(journal =>
      journal.title.toLowerCase().includes(query)
    );
  }, [availableJournals, searchQuery]);

  const handleSelectJournal = (journalId: string, checked: boolean) => {
    const newSelected = new Set(selectedJournals);
    if (checked) {
      newSelected.add(journalId);
    } else {
      newSelected.delete(journalId);
    }
    setSelectedJournals(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJournals(new Set(filteredJournals.map(j => j.id)));
    } else {
      setSelectedJournals(new Set());
    }
  };

  const handleAddJournals = async () => {
    if (selectedJournals.size === 0) return;

    setAdding(true);
    try {
      const journalIds = Array.from(selectedJournals);
      const { error } = await supabase
        .from("journals")
        .update({ folder_id: folderId })
        .in("id", journalIds);

      if (error) {
        toast({
          title: "Error adding journals",
          description: error.message,
          variant: "destructive"
        });
      } else {
        const addedJournals = availableJournals.filter(j =>
          selectedJournals.has(j.id)
        ).map(j => ({ ...j, folder_id: folderId }));

        onAddJournals(addedJournals);
        toast({
          title: "Journals added successfully",
          description: `${selectedJournals.size} journal${selectedJournals.size === 1 ? '' : 's'} added to folder`
        });
        onOpenChange(false);
      }
    } catch (error) {
      toast({
        title: "Error adding journals",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedJournals(new Set());
    onOpenChange(false);
  };

  const allSelected = filteredJournals.length > 0 && selectedJournals.size === filteredJournals.length;
  const someSelected = selectedJournals.size > 0 && selectedJournals.size < filteredJournals.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add Journals to Folder</DialogTitle>
          <DialogDescription>
            Select journals to add to this folder. You can search and select multiple journals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search journals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Select All */}
          {filteredJournals.length > 0 && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={allSelected}
                onCheckedChange={handleSelectAll}
              />
              <label
                htmlFor="select-all"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Select all ({filteredJournals.length})
              </label>
            </div>
          )}

          {/* Journals List */}
          <ScrollArea className="h-96 border rounded-md">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading journals...</span>
              </div>
            ) : filteredJournals.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No journals match your search" : "No journals available to add"}
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {filteredJournals.map((journal) => (
                  <div
                    key={journal.id}
                    onClick={() => handleSelectJournal(journal.id, !selectedJournals.has(journal.id))}
                    className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedJournals.has(journal.id)
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <Checkbox
                      id={journal.id}
                      checked={selectedJournals.has(journal.id)}
                      onCheckedChange={() => handleSelectJournal(journal.id, !selectedJournals.has(journal.id))}
                    />
                    <FileText className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground truncate">
                        {journal.title}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Last edited {new Date(journal.updated_at).toLocaleDateString()}
                        {journal.folder_id && " • In another folder"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAddJournals}
            disabled={selectedJournals.size === 0 || adding}
          >
            {adding ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              `Add ${selectedJournals.size} Journal${selectedJournals.size === 1 ? '' : 's'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};



