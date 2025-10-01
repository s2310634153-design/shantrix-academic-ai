import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Upload, FileText, Clock, CheckCircle2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        navigate("/login");
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        navigate("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign out");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const mockSubmissions = [
    {
      id: 1,
      title: "Research Paper - AI Ethics",
      date: "2025-01-15",
      status: "completed",
      score: 92,
    },
    {
      id: 2,
      title: "Literature Review Draft",
      date: "2025-01-14",
      status: "processing",
      score: null,
    },
    {
      id: 3,
      title: "Case Study Analysis",
      date: "2025-01-10",
      status: "completed",
      score: 88,
    },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile) {
      console.log("Uploading:", selectedFile);
      // Upload logic will be added later
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Navbar */}
      <nav className="border-b bg-background">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <FileCheck className="h-6 w-6 text-accent" />
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              Shantrix
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user?.user_metadata?.full_name || user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Sidebar */}
          <aside className="space-y-2">
            <Button variant="default" className="w-full justify-start bg-accent">
              <FileText className="mr-2 h-4 w-4" />
              My Submissions
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Upload className="mr-2 h-4 w-4" />
              Upload New
            </Button>
          </aside>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Section */}
            <Card className="shadow-elevated">
              <CardHeader>
                <CardTitle>Upload New Submission</CardTitle>
                <CardDescription>
                  Upload your document for plagiarism checking. Supported formats: DOCX, PDF, TXT
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="file">Select Document</Label>
                    <Input
                      id="file"
                      type="file"
                      accept=".docx,.pdf,.txt"
                      onChange={handleFileChange}
                      required
                    />
                  </div>
                  {selectedFile && (
                    <div className="p-3 bg-secondary rounded-lg text-sm">
                      <p className="font-medium">Selected: {selectedFile.name}</p>
                      <p className="text-muted-foreground">
                        Size: {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  )}
                  <Button type="submit" className="w-full bg-accent hover:bg-accent/90">
                    <Upload className="mr-2 h-4 w-4" />
                    Submit for Analysis
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Submissions Table */}
            <Card className="shadow-elevated">
              <CardHeader>
                <CardTitle>Recent Submissions</CardTitle>
                <CardDescription>View and manage your document submissions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockSubmissions.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell className="font-medium">{submission.title}</TableCell>
                        <TableCell>{submission.date}</TableCell>
                        <TableCell>
                          {submission.status === "completed" ? (
                            <Badge className="bg-green-500">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Completed
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Clock className="mr-1 h-3 w-3" />
                              Processing
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {submission.score ? (
                            <span className="font-bold text-accent">{submission.score}%</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {submission.status === "completed" && (
                            <Link to={`/report/${submission.id}`}>
                              <Button size="sm" variant="outline">
                                View Report
                              </Button>
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
