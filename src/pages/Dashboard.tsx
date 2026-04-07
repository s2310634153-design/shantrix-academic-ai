import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Upload, FileText, Clock, CheckCircle2, LogOut, Lightbulb, Wand2, FileSearch, CreditCard, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { useUserRole } from "@/hooks/useUserRole";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualText, setManualText] = useState("");
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { role, isAdmin } = useUserRole();

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadSubmissions();
      } else {
        navigate("/login");
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        setTimeout(() => loadSubmissions(), 0);
      } else {
        navigate("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error: any) {
      console.error('Error loading submissions:', error);
      toast.error('Failed to load submissions');
    }
  };

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


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    // Only extract text from .txt files on client side
    if (extension === 'txt') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          resolve(text);
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }
    
    // For binary files (PDF, DOCX), return placeholder text
    // The edge function will handle proper extraction
    return `[Document: ${file.name}] - Content will be extracted during analysis`;
  };

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !user) return;

    setIsSubmitting(true);
    try {
      // Extract text from file
      const content = await extractTextFromFile(selectedFile);
      
      // Upload file to storage
      const filePath = `${user.id}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('submissions')
        .getPublicUrl(filePath);

      // Create submission
      const { data: submission, error: submitError } = await supabase
        .from('submissions')
        .insert({
          user_id: user.id,
          title: selectedFile.name,
          content,
          file_url: publicUrl,
          file_name: selectedFile.name,
          status: 'processing'
        })
        .select()
        .single();

      if (submitError) throw submitError;

      // Trigger analysis
      const { error: analyzeError } = await supabase.functions.invoke('analyze-submission', {
        body: { submissionId: submission.id }
      });

      if (analyzeError) throw analyzeError;

      toast.success('File submitted for analysis!');
      setSelectedFile(null);
      loadSubmissions();
    } catch (error: any) {
      console.error('Error submitting file:', error);
      toast.error(error.message || 'Failed to submit file');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim() || !user) return;

    setIsSubmitting(true);
    try {
      // Create submission
      const title = manualText.substring(0, 50) + (manualText.length > 50 ? '...' : '');
      const { data: submission, error: submitError } = await supabase
        .from('submissions')
        .insert({
          user_id: user.id,
          title,
          content: manualText,
          status: 'processing'
        })
        .select()
        .single();

      if (submitError) throw submitError;

      // Trigger analysis
      const { error: analyzeError } = await supabase.functions.invoke('analyze-submission', {
        body: { submissionId: submission.id }
      });

      if (analyzeError) throw analyzeError;

      toast.success('Text submitted for analysis!');
      setManualText('');
      loadSubmissions();
    } catch (error: any) {
      console.error('Error submitting text:', error);
      toast.error(error.message || 'Failed to submit text');
    } finally {
      setIsSubmitting(false);
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
              <FileSearch className="mr-2 h-4 w-4" />
              Originality Checker
            </Button>
            <Link to="/research-topics" className="block">
              <Button variant="ghost" className="w-full justify-start">
                <Lightbulb className="mr-2 h-4 w-4" />
                Research Topic Finder
              </Button>
            </Link>
            <Link to="/paraphraser" className="block">
              <Button variant="ghost" className="w-full justify-start">
                <Wand2 className="mr-2 h-4 w-4" />
                AI Paraphraser & Humanizer
              </Button>
            </Link>
            <Link to="/pricing" className="block">
              <Button variant="ghost" className="w-full justify-start">
                <CreditCard className="mr-2 h-4 w-4" />
                Pricing
              </Button>
            </Link>
            {isAdmin && (
              <Link to="/admin" className="block">
                <Button variant="ghost" className="w-full justify-start text-highlight">
                  <Shield className="mr-2 h-4 w-4" />
                  Admin Panel
                </Button>
              </Link>
            )}
            <div className="pt-2 px-2">
              <Badge variant={role === "premium" || role === "admin" ? "default" : "secondary"} className="w-full justify-center">
                {role.charAt(0).toUpperCase() + role.slice(1)} Plan
              </Badge>
            </div>
          </aside>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Section */}
            <Card className="shadow-elevated">
              <CardHeader>
                <CardTitle>Submit for Analysis</CardTitle>
                <CardDescription>
                  Upload a document or paste text for AI and plagiarism detection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="file" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="file">Upload File</TabsTrigger>
                    <TabsTrigger value="text">Paste Text</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="file" className="space-y-4 mt-4">
                    <form onSubmit={handleFileSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="file">Select Document</Label>
                        <Input
                          id="file"
                          type="file"
                          accept=".txt,.docx,.pdf"
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
                      <Button 
                        type="submit" 
                        className="w-full bg-accent hover:bg-accent/90"
                        disabled={isSubmitting}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {isSubmitting ? 'Submitting...' : 'Submit for Analysis'}
                      </Button>
                    </form>
                  </TabsContent>
                  
                  <TabsContent value="text" className="space-y-4 mt-4">
                    <form onSubmit={handleTextSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="text">Paste Your Text</Label>
                        <Textarea
                          id="text"
                          placeholder="Paste your text here for analysis..."
                          value={manualText}
                          onChange={(e) => setManualText(e.target.value)}
                          className="min-h-[200px]"
                          required
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full bg-accent hover:bg-accent/90"
                        disabled={isSubmitting}
                      >
                        <FileCheck className="mr-2 h-4 w-4" />
                        {isSubmitting ? 'Submitting...' : 'Submit for Analysis'}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
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
                      <TableHead className="text-right">Similarity</TableHead>
                      <TableHead className="text-right">AI Score</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No submissions yet. Submit your first document above!
                        </TableCell>
                      </TableRow>
                    ) : (
                      submissions.map((submission) => {
                        const similarity = submission.originality_score != null
                          ? Math.max(0, Math.min(100, 100 - submission.originality_score))
                          : null;
                        const aiScore = submission.ai_score != null
                          ? Math.max(0, Math.min(100, submission.ai_score))
                          : null;
                        return (
                          <TableRow key={submission.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">{submission.title}</TableCell>
                            <TableCell className="text-xs">{new Date(submission.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>
                              {submission.status === "completed" ? (
                                <Badge className="bg-green-600 text-white">
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
                              {similarity != null ? (
                                <span className={`font-bold ${similarity > 30 ? 'text-destructive' : similarity > 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                                  {similarity}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {aiScore != null ? (
                                <span className="font-bold text-blue-600">{aiScore}%</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                              {submission.status === "completed" && (
                                <>
                                  <Link to={`/report/${submission.id}`}>
                                    <Button size="sm" variant="outline">View Report</Button>
                                  </Link>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={async () => {
                                      if (!confirm('Delete this submission?')) return;
                                      const { error } = await supabase.from('submissions').delete().eq('id', submission.id);
                                      if (error) { toast.error('Failed to delete'); return; }
                                      toast.success('Deleted');
                                      loadSubmissions();
                                    }}
                                  >
                                    Delete
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
          </div>
        </div>
      </div>
    </div>
  );
}
