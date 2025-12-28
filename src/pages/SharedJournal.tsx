import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Save, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type SharedJournal = {
  id: string;
  title: string;
  content: string | null;
  updated_at: string;
  user_id: string;
};

type SharePermissions = {
  share_type: 'anyone' | 'specific_users';
  permission_type: 'view' | 'edit';
  allowed_emails: string[];
};

const SharedJournal = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [journal, setJournal] = useState<SharedJournal | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [permissions, setPermissions] = useState<SharePermissions | null>(null);
  const [accessGranted, setAccessGranted] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    if (shareId) {
      loadSharedJournal();
    }
  }, [shareId]);

  const loadSharedJournal = async () => {
    if (!shareId) return;

    setLoading(true);
    try {
      // Load journal and its share permissions
      const { data: journalData, error: journalError } = await supabase
        .from("journals")
        .select("*")
        .eq("id", shareId)
        .single();

      if (journalError) {
        toast({
          title: "Journal not found",
          description: "This shared journal may have been removed or the link is invalid.",
          variant: "destructive"
        });
        navigate("/");
        return;
      }

      // Check if there are share permissions
      const { data: shareData, error: shareError } = await supabase
        .from("journal_shares")
        .select("*")
        .eq("journal_id", shareId)
        .single();

      if (shareError && shareError.code !== 'PGRST116') {
        console.error("Error loading share permissions:", shareError);
      }

      if (shareData) {
        setPermissions({
          share_type: shareData.share_type,
          permission_type: shareData.permission_type,
          allowed_emails: shareData.allowed_emails || []
        });

        // Check if access is restricted to specific users
        if (shareData.share_type === 'specific_users') {
          // Check if user has already verified their email for this session
          const verifiedEmail = sessionStorage.getItem(`shared_journal_${shareId}_email`);
          if (verifiedEmail && shareData.allowed_emails.includes(verifiedEmail.toLowerCase())) {
            setEmailVerified(true);
            setAccessGranted(true);
          } else {
            setShowEmailDialog(true);
            setLoading(false);
            return;
          }
        } else {
          // Anyone with link can access
          setAccessGranted(true);
        }
      } else {
        // No share permissions set - deny access
        toast({
          title: "Access denied",
          description: "This journal is not shared or sharing has been disabled.",
          variant: "destructive"
        });
        navigate("/");
        return;
      }

      setJournal(journalData);
      setContent(journalData.content || "");
      setTitle(journalData.title);

    } catch (error) {
      console.error("Error loading journal:", error);
      toast({
        title: "Error loading journal",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
      navigate("/");
    } finally {
      if (!showEmailDialog) {
        setLoading(false);
      }
    }
  };

  const verifyEmailAccess = () => {
    if (!permissions || permissions.share_type !== 'specific_users') return;

    const email = emailInput.trim().toLowerCase();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive"
      });
      return;
    }

    if (!permissions.allowed_emails.includes(email)) {
      toast({
        title: "Access denied",
        description: "This email address is not authorized to view this journal",
        variant: "destructive"
      });
      return;
    }

    // Store verified email in session storage
    sessionStorage.setItem(`shared_journal_${shareId}_email`, email);
    setEmailVerified(true);
    setAccessGranted(true);
    setShowEmailDialog(false);
    setLoading(false);

    toast({
      title: "Access granted",
      description: "You can now view this journal"
    });
  };

  const saveChanges = async () => {
    if (!journal || !permissions || permissions.permission_type !== 'edit') return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("journals")
        .update({
          content: content,
          title: title,
          updated_at: new Date().toISOString()
        })
        .eq("id", journal.id);

      if (error) {
        toast({
          title: "Error saving changes",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Changes saved",
          description: "Your changes have been saved successfully"
        });
        // Update local state
        setJournal(prev => prev ? { ...prev, title, content, updated_at: new Date().toISOString() } : null);
      }
    } catch (error) {
      toast({
        title: "Error saving changes",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const isReadOnly = !permissions || permissions.permission_type === 'view';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading shared journal...</span>
        </div>
      </div>
    );
  }

  if (!journal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Journal not found</h1>
          <p className="text-muted-foreground mb-4">
            This shared journal may have been removed or the link is invalid.
          </p>
          <Button onClick={() => navigate("/")}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">Shared Journal</span>
                {permissions && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {permissions.permission_type === 'view' ? (
                      <>
                        <Eye className="w-3 h-3" />
                        View only
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3 h-3" />
                        Can edit
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Last saved: {new Date(journal.updated_at).toLocaleString()}
              </span>
              {!isReadOnly && (
                <Button
                  onClick={saveChanges}
                  disabled={saving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full text-3xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground ${
                isReadOnly ? 'text-muted-foreground cursor-not-allowed' : 'text-foreground'
              }`}
              placeholder="Journal title..."
              readOnly={isReadOnly}
            />
          </div>

          {/* Content */}
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing your journal entry..."
              className={`w-full min-h-[500px] text-base leading-relaxed bg-transparent border-none outline-none placeholder:text-muted-foreground resize-none ${
                isReadOnly ? 'text-muted-foreground cursor-not-allowed' : 'text-foreground'
              }`}
              style={{ fontFamily: 'inherit' }}
              readOnly={isReadOnly}
            />
          </div>
        </div>
      </div>

      {/* Email Verification Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Your Email</DialogTitle>
            <DialogDescription>
              This journal is shared with specific people only. Please enter your email address to verify access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    verifyEmailAccess();
                  }
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={verifyEmailAccess}>
              Verify Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SharedJournal;




