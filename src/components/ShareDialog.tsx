import { useState, useEffect } from "react";
import { Share2, Copy, Check, Loader2, X, Globe, Users, Eye, Edit as EditIcon } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journalId: string;
  journalTitle: string;
}

type ShareType = 'anyone' | 'specific_users';
type PermissionType = 'view' | 'edit';

export const ShareDialog = ({
  open,
  onOpenChange,
  journalId,
  journalTitle,
}: ShareDialogProps) => {
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentShare, setCurrentShare] = useState<any>(null);

  // Form state
  const [shareType, setShareType] = useState<ShareType>('anyone');
  const [permissionType, setPermissionType] = useState<PermissionType>('view');
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open && journalId) {
      loadCurrentShare();
    }
  }, [open, journalId]);

  const loadCurrentShare = async () => {
    if (!user || !journalId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("journal_shares")
        .select("*")
        .eq("journal_id", journalId)
        .eq("created_by", user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error("Error loading share:", error);
      } else if (data) {
        setCurrentShare(data);
        setShareType(data.share_type);
        setPermissionType(data.permission_type);
        setEmails(data.allowed_emails || []);
      }

      // Generate share link
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/shared/${journalId}`;
      setShareLink(link);

    } catch (error) {
      console.error("Error loading share:", error);
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    if (!validateEmail(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    if (emails.includes(email)) {
      toast({
        title: "Email already added",
        description: "This email address is already in the list",
        variant: "destructive"
      });
      return;
    }

    setEmails([...emails, email]);
    setEmailInput("");
  };

  const removeEmail = (emailToRemove: string) => {
    setEmails(emails.filter(email => email !== emailToRemove));
  };

  const saveShareSettings = async () => {
    if (!user || !journalId) return;

    setSaving(true);
    try {
      const shareData = {
        journal_id: journalId,
        created_by: user.id,
        share_type: shareType,
        permission_type: permissionType,
        allowed_emails: shareType === 'specific_users' ? emails : [],
      };

      if (currentShare) {
        // Update existing share
        const { error } = await supabase
          .from("journal_shares")
          .update(shareData)
          .eq("id", currentShare.id);

        if (error) throw error;
      } else {
        // Create new share
        const { error } = await supabase
          .from("journal_shares")
          .insert(shareData);

        if (error) throw error;
      }

      toast({
        title: "Share settings saved",
        description: "Your sharing preferences have been updated"
      });

      // Reload current share data
      await loadCurrentShare();

    } catch (error) {
      console.error("Error saving share settings:", error);
      toast({
        title: "Error saving settings",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Share link has been copied to clipboard"
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually",
        variant: "destructive"
      });
    }
  };

  const handleClose = () => {
    setShareLink("");
    setCopied(false);
    setEmails([]);
    setEmailInput("");
    setShareType('anyone');
    setPermissionType('view');
    setCurrentShare(null);
    onOpenChange(false);
  };

  const handleEmailInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmail();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share "{journalTitle}"
          </DialogTitle>
          <DialogDescription>
            Configure who can access this journal and what they can do.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Share Type */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Who can access this journal?</Label>
            <RadioGroup value={shareType} onValueChange={(value) => setShareType(value as ShareType)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="anyone" id="anyone" />
                <Label htmlFor="anyone" className="flex items-center gap-2 cursor-pointer">
                  <Globe className="w-4 h-4" />
                  <div>
                    <div className="font-medium">Anyone with the link</div>
                    <div className="text-xs text-muted-foreground">Anyone who has the link can access</div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="specific_users" id="specific_users" />
                <Label htmlFor="specific_users" className="flex items-center gap-2 cursor-pointer">
                  <Users className="w-4 h-4" />
                  <div>
                    <div className="font-medium">Specific people</div>
                    <div className="text-xs text-muted-foreground">Only people with these email addresses</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Email Input for Specific Users */}
          {shareType === 'specific_users' && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Allowed email addresses</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter email address"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={handleEmailInputKeyDown}
                  className="flex-1"
                />
                <Button onClick={addEmail} variant="outline" size="sm">
                  Add
                </Button>
              </div>
              {emails.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {emails.map((email) => (
                    <Badge key={email} variant="secondary" className="flex items-center gap-1">
                      {email}
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-destructive"
                        onClick={() => removeEmail(email)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Permission Type */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">What can they do?</Label>
            <RadioGroup value={permissionType} onValueChange={(value) => setPermissionType(value as PermissionType)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="view" id="view" />
                <Label htmlFor="view" className="flex items-center gap-2 cursor-pointer">
                  <Eye className="w-4 h-4" />
                  <div>
                    <div className="font-medium">View only</div>
                    <div className="text-xs text-muted-foreground">They can read but not edit</div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="edit" id="edit" />
                <Label htmlFor="edit" className="flex items-center gap-2 cursor-pointer">
                  <EditIcon className="w-4 h-4" />
                  <div>
                    <div className="font-medium">View and edit</div>
                    <div className="text-xs text-muted-foreground">They can read and make changes</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Share Link */}
          <div className="space-y-2">
            <Label htmlFor="share-link" className="text-sm font-medium">Share Link</Label>
            <div className="flex gap-2">
              <Input
                id="share-link"
                value={loading ? "Generating link..." : shareLink}
                readOnly
                className="flex-1"
              />
              <Button
                onClick={copyToClipboard}
                disabled={loading || !shareLink}
                variant="outline"
                size="icon"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={saveShareSettings} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};




