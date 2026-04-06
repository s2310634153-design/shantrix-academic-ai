import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileCheck, Users, CreditCard, Shield, LogOut, Download, Check, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [payments, setPayments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error("Access denied. Admins only.");
      navigate("/dashboard");
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [paymentsRes, profilesRes, rolesRes] = await Promise.all([
        supabase.from("payments").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
      ]);

      setPayments(paymentsRes.data || []);

      // Merge profiles with roles
      const profiles = profilesRes.data || [];
      const roles = rolesRes.data || [];
      const merged = profiles.map((p: any) => ({
        ...p,
        roles: roles.filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role),
      }));
      setUsers(merged);
    } catch (error) {
      console.error("Error loading admin data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePaymentStatus = async (paymentId: string, status: string, userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("payments")
        .update({ status, reviewed_by: user?.id })
        .eq("id", paymentId);

      if (error) throw error;

      // If approved, upgrade user to premium
      if (status === "approved") {
        const { error: roleError } = await supabase
          .from("user_roles")
          .upsert({ user_id: userId, role: "premium" }, { onConflict: "user_id,role" });
        if (roleError) console.error("Error upgrading role:", roleError);
      }

      toast.success(`Payment ${status}`);
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update payment");
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      // Remove existing non-basic roles, then add new one
      if (newRole === "admin") {
        await supabase.from("user_roles").upsert(
          { user_id: userId, role: "admin" as any },
          { onConflict: "user_id,role" }
        );
      } else if (newRole === "premium") {
        // Remove admin if exists
        await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        await supabase.from("user_roles").upsert(
          { user_id: userId, role: "premium" as any },
          { onConflict: "user_id,role" }
        );
      } else {
        // Set to basic - remove premium and admin
        await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "premium");
      }

      toast.success("User role updated!");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update role");
    }
  };

  const downloadBills = () => {
    const approved = payments.filter((p) => p.status === "approved");
    const csvHeader = "ID,User ID,Amount,Payment Method,Transaction ID,Status,Date\n";
    const csvRows = approved
      .map((p) => `${p.id},${p.user_id},${p.amount},${p.payment_method},${p.transaction_id},${p.status},${new Date(p.created_at).toLocaleDateString()}`)
      .join("\n");
    const blob = new Blob([csvHeader + csvRows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shantrix-bills-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const filteredUsers = users.filter(
    (u) =>
      (u.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.full_name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (roleLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-secondary/30">
      <nav className="border-b bg-background">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <FileCheck className="h-6 w-6 text-accent" />
            <span className="bg-gradient-primary bg-clip-text text-transparent">Shantrix Admin</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/dashboard"><Button variant="ghost" size="sm">Dashboard</Button></Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-accent" />
              <p className="text-2xl font-bold">{users.length}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Shield className="h-8 w-8 mx-auto mb-2 text-highlight" />
              <p className="text-2xl font-bold">{users.filter((u) => u.roles.includes("premium")).length}</p>
              <p className="text-sm text-muted-foreground">Premium Users</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CreditCard className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold">{payments.filter((p) => p.status === "pending").length}</p>
              <p className="text-sm text-muted-foreground">Pending Payments</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CreditCard className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">
                ৳{payments.filter((p) => p.status === "approved").reduce((sum, p) => sum + Number(p.amount), 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="payments" className="space-y-6">
          <TabsList>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="users">Users & Roles</TabsTrigger>
          </TabsList>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Payment Requests</CardTitle>
                  <CardDescription>Review and approve payment submissions</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={downloadBills}>
                  <Download className="mr-2 h-4 w-4" /> Download Bills
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>TXN ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No payment requests yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments.map((payment) => {
                        const user = users.find((u) => u.user_id === payment.user_id);
                        return (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">
                              {user?.email || payment.user_id.slice(0, 8)}
                            </TableCell>
                            <TableCell className="capitalize">{payment.payment_method}</TableCell>
                            <TableCell className="font-mono text-sm">{payment.transaction_id}</TableCell>
                            <TableCell>৳{payment.amount}</TableCell>
                            <TableCell>{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  payment.status === "approved" ? "default" :
                                  payment.status === "rejected" ? "destructive" : "secondary"
                                }
                              >
                                {payment.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              {payment.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => updatePaymentStatus(payment.id, "approved", payment.user_id)}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => updatePaymentStatus(payment.id, "rejected", payment.user_id)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage user roles and permissions</CardDescription>
                <div className="pt-2">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Change Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => {
                      const highestRole = user.roles.includes("admin")
                        ? "admin"
                        : user.roles.includes("premium")
                        ? "premium"
                        : "basic";
                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name || "N/A"}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                highestRole === "admin" ? "destructive" :
                                highestRole === "premium" ? "default" : "secondary"
                              }
                            >
                              {highestRole}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <Select
                              value={highestRole}
                              onValueChange={(val) => updateUserRole(user.user_id, val)}
                            >
                              <SelectTrigger className="w-32 ml-auto">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="basic">Basic</SelectItem>
                                <SelectItem value="premium">Premium</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
