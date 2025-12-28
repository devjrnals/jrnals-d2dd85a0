import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, DollarSign, Eye, Mail, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminData {
  visitor_count: number;
  accounts_signed_up: number;
  revenue: number;
}

interface ComingSoonEmail {
  id: string;
  email: string;
  created_at: string;
}

const Admin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [adminData, setAdminData] = useState<AdminData>({
    visitor_count: 0,
    accounts_signed_up: 0,
    revenue: 0,
  });
  const [emails, setEmails] = useState<ComingSoonEmail[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Check if user has admin role in database
  useEffect(() => {
    const checkAdminRole = async () => {
      if (loading) return;
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check admin role in user_roles table
      const { data: roleData, error } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (error) {
        console.error("Error checking admin role:", error);
        setIsAdmin(false);
        navigate("/dashboard");
        return;
      }

      if (!roleData) {
        // No admin role found
        setIsAdmin(false);
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
    };

    checkAdminRole();
  }, [user, loading, navigate]);

  const loadAdminData = async () => {
    if (!isAdmin) return;
    
    try {
      setLoadingData(true);

      // Load admin metrics - RLS will enforce admin-only access
      const { data: adminMetrics, error: metricsError } = await supabase
        .from("admin_data")
        .select("key, value");

      if (metricsError) {
        console.error("Error loading admin metrics:", metricsError);
        // If permission denied, show error
        if (metricsError.message?.includes('row-level security')) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to view admin data",
            variant: "destructive",
          });
          setAdminData({ visitor_count: 0, accounts_signed_up: 0, revenue: 0 });
        }
      } else {
        const newAdminData = { visitor_count: 0, accounts_signed_up: 0, revenue: 0 };
        adminMetrics?.forEach((item) => {
          if (item.key === "visitor_count") {
            newAdminData.visitor_count = parseInt(item.value as string) || 0;
          } else if (item.key === "accounts_signed_up") {
            newAdminData.accounts_signed_up = parseInt(item.value as string) || 0;
          } else if (item.key === "revenue") {
            newAdminData.revenue = parseFloat(item.value as string) || 0;
          }
        });
        setAdminData(newAdminData);
      }

      // Load coming soon emails - RLS will enforce admin-only access
      const { data: emailData, error: emailError } = await supabase
        .from("coming_soon_emails")
        .select("*")
        .order("created_at", { ascending: false });

      if (emailError) {
        console.error("Error loading emails:", emailError);
        if (emailError.message?.includes('row-level security')) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to view email data",
            variant: "destructive",
          });
        }
        setEmails([]);
      } else {
        setEmails(emailData || []);
      }
    } catch (error) {
      console.error("Error loading admin data:", error);
      toast({
        title: "Error",
        description: "Failed to load admin data",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const updateRevenue = async (newRevenue: number) => {
    try {
      const { error } = await supabase
        .from("admin_data")
        .update({ value: newRevenue.toString(), updated_at: new Date().toISOString() })
        .eq("key", "revenue");

      if (error) {
        throw error;
      }

      setAdminData(prev => ({ ...prev, revenue: newRevenue }));
      toast({
        title: "Success",
        description: "Revenue updated successfully",
      });
    } catch (error) {
      console.error("Error updating revenue:", error);
      toast({
        title: "Error",
        description: "Failed to update revenue",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (isAdmin === true) {
      loadAdminData();
    }
  }, [isAdmin]);

  // Show loading while checking admin status
  if (loading || isAdmin === null) {
    return (
      <div className="signed-in-theme flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>Verifying access...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="signed-in-theme flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="signed-in-theme flex h-screen overflow-hidden bg-background">
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor site analytics and manage data
            </p>
          </div>

          {/* Metrics Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Page Visitors</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loadingData ? "..." : adminData.visitor_count.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total unique visitors
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Accounts Signed Up</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loadingData ? "..." : adminData.accounts_signed_up.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Registered users
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${loadingData ? "..." : adminData.revenue.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total revenue
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Coming Soon Emails</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loadingData ? "..." : emails.length.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Email subscriptions
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Coming Soon Emails List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Coming Soon Email List</span>
                <Button
                  onClick={loadAdminData}
                  variant="outline"
                  size="sm"
                  disabled={loadingData}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingData ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardTitle>
              <CardDescription>
                Emails collected from the coming soon page
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading...</span>
                </div>
              ) : emails.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No emails collected yet
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {emails.map((email) => (
                    <div
                      key={email.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{email.email}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {new Date(email.created_at).toLocaleDateString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Admin;
