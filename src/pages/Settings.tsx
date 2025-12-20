import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Camera, Crown, CreditCard, Plus } from "lucide-react";

export default function Settings() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Error loading profile:", error);
      return;
    }

    if (data) {
      setDisplayName(data.display_name || "");
      setAvatarUrl(data.avatar_url);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      console.log('Attempting to upload file:', fileName);

      // Upload to Supabase Storage
      const { error: uploadError, data } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log('Upload successful:', data);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('Public URL:', publicUrl);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw new Error(`Profile update failed: ${updateError.message}`);
      }

      setAvatarUrl(publicUrl);
      toast({
        title: "Success",
        description: "Profile picture updated successfully!",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);

      // Provide more specific error messages
      let errorMessage = "Failed to upload profile picture. Please try again.";
      if (error instanceof Error) {
        if (error.message.includes('Bucket not found') || error.message.includes('not found')) {
          errorMessage = "Storage not configured. Please run database migrations first.";
        } else if (error.message.includes('Permission denied') || error.message.includes('access')) {
          errorMessage = "Permission denied. Please check your account permissions.";
        } else if (error.message.includes('File too large')) {
          errorMessage = "File is too large. Please choose a smaller image.";
        } else if (error.message.includes('already exists')) {
          errorMessage = "A file with this name already exists. Please try again.";
        } else {
          errorMessage = `Upload failed: ${error.message}`;
        }
      }

      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;

    setIsUpdating(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("user_id", user.id);

    setIsUpdating(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Profile updated successfully!",
    });
  };

  const handlePasswordChange = async () => {
    if (!user || !currentPassword || !newPassword) return;

    if (newPassword !== confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "New password and confirmation don't match.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      toast({
        title: "Success",
        description: "Password changed successfully!",
      });
    } catch (error) {
      console.error("Error changing password:", error);
      toast({
        title: "Error",
        description: "Failed to change password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getCurrentPlan = () => {
    // For now, return "Free" - in a real app, this would come from a subscription service
    return "Free";
  };

  const isPlusPlan = () => {
    return getCurrentPlan() === "Plus";
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your account settings</p>
        </div>

        {/* Profile Picture Section */}
        <Card className="p-6 bg-card border-border">
          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-primary-foreground font-bold text-lg">
                        {displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
                  ) : (
                    <Camera className="w-4 h-4 text-primary-foreground" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">Profile Picture</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload a profile picture. Max size: 5MB. Supported formats: JPG, PNG, GIF.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Account Information */}
        <Card className="p-6 bg-card border-border">
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-foreground">Account Information</h3>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-foreground">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                className="bg-input border-border"
              />
            </div>

            <Button
              onClick={handleUpdateProfile}
              disabled={isUpdating}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Profile"
              )}
            </Button>
          </div>
        </Card>

        {/* Password Change */}
        <Card className="p-6 bg-card border-border">
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-foreground">Change Password</h3>

            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-foreground">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-foreground">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter your new password"
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                className="bg-input border-border"
              />
            </div>

            <Button
              onClick={handlePasswordChange}
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Changing Password...
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </div>
        </Card>

        {/* Billing Section */}
        <Card className="p-6 bg-card border-border">
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-foreground">Billing & Subscription</h3>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                {isPlusPlan() ? (
                  <Crown className="w-6 h-6 text-yellow-500" />
                ) : (
                  <CreditCard className="w-6 h-6 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium text-foreground">
                    Current Plan: {getCurrentPlan()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isPlusPlan()
                      ? "You have access to all premium features"
                      : "Upgrade to unlock unlimited journals and premium features"
                    }
                  </p>
                </div>
              </div>

              {!isPlusPlan() && (
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade to Plus
                </Button>
              )}
            </div>

            {isPlusPlan() && (
              <div className="text-sm text-muted-foreground">
                <p>You're on the Plus plan! Enjoy unlimited journals, priority support, and all premium features.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Integrations Section */}
        <Card className="p-6 bg-card border-border">
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-foreground">Integrations</h3>
            <p className="text-sm text-muted-foreground">
              Connect your favorite tools to sync data and enhance your journaling experience.
            </p>

            <div className="space-y-4">
              {/* Notion Integration */}
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                      <path fill="#000000" d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.846-.813c1.364-.076 1.864-.377 2.965-.941V2.986a52.138 52.138 0 0 0-3.77.245c-3.912.562-3.819 1.46-1.51 1.661 1.077.098 2.909-.045 3.746-.466-.197.513-.37.631-.756.735-2.035.517-3.708.43-5.727.26-2.486-.206-3.25-.297-5.727-.26-2.024.037-3.708.154-5.727-.26-.387-.104-.56-.222-.756-.735.838.421 2.67.564 3.746.466 2.309-.201 2.402-1.099-1.51-1.661a52.11 52.11 0 0 0-3.77-.245v.227c1.1.564 1.6.865 2.965.941L4.64 4.678c1.402.094 1.682.14 2.428-.466z"/>
                      <path fill="#000000" d="M6.666 6.762c.782-.146.902-.369.902-.369.053-1.09-.755-1.09-.755-1.09-.708-.197-1.027-.448-1.027-.448-.527-.271-.805-.365-.805-.365-.729-.226-1.443-.252-1.443-.252-.709-.12-1.26-.231-1.26-.231-.708-.197-1.027-.448-1.027-.448-.527-.271-.805-.365-.805-.365-.729-.226-1.443-.252-1.443-.252-.709-.12-1.26-.231-1.26-.231-.708-.197-1.027-.448-1.027-.448-.527-.271-.805-.365-.805-.365-.729-.226-1.443-.252-1.443-.252-.709-.12-1.26-.231-1.26-.231-.708-.197-1.027-.448-1.027-.448-.527-.271-.805-.365-.805-.365-.729-.226-1.443-.252-1.443-.252-.709-.12-1.26-.231-1.26-.231v7.29c.729 0 1.443.252 1.443.252.527.271.805.365.805.365.527.271 1.027.448 1.027.448.709.12 1.26.231 1.26.231.729.226 1.443.252 1.443.252.527.271.805.365.805.365.527.271 1.027.448 1.027.448.709.12 1.26.231 1.26.231.729.226 1.443.252 1.443.252.527.271.805.365.805.365.527.271 1.027.448 1.027.448.709.12 1.26.231 1.26.231.729.226 1.443.252 1.443.252.527.271.805.365.805.365.527.271 1.027.448 1.027.448.709.12 1.26.231 1.26.231z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Notion</p>
                    <p className="text-sm text-muted-foreground">Sync your Notion pages and databases</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </div>

              {/* Google Drive Integration */}
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Google Drive</p>
                    <p className="text-sm text-muted-foreground">Access and sync your Google Drive files</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </div>

              {/* Canvas Integration */}
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <rect x="2" y="2" width="20" height="20" rx="2" fill="#E84B37"/>
                      <rect x="4" y="4" width="16" height="16" rx="1" fill="white"/>
                      <rect x="6" y="6" width="12" height="12" rx="1" fill="#E84B37"/>
                      <rect x="8" y="8" width="8" height="8" rx="1" fill="white"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Canvas</p>
                    <p className="text-sm text-muted-foreground">Connect to your Canvas LMS courses</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
