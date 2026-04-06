import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ArrowLeft, Search, Copy, BookOpen, Sparkles, FileCheck, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";
import type { User } from "@supabase/supabase-js";

export default function ResearchTopicFinder() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [field, setField] = useState("");
  const [level, setLevel] = useState("masters");
  const [keywords, setKeywords] = useState("");
  const [topics, setTopics] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user);
      else navigate("/login");
    });
  }, [navigate]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!field.trim()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('research-topic-finder', {
        body: { field, level, keywords }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setTopics(data.topics || []);
      toast.success(`Found ${data.topics?.length || 0} unique research topics!`);
    } catch (error: any) {
      console.error('Error finding topics:', error);
      toast.error(error.message || 'Failed to find topics');
    } finally {
      setIsLoading(false);
    }
  };

  const copyTopic = (title: string) => {
    navigator.clipboard.writeText(title);
    toast.success("Topic copied to clipboard!");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <nav className="border-b bg-background">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-2 font-bold text-xl">
              <FileCheck className="h-6 w-6 text-accent" />
              <span className="bg-gradient-primary bg-clip-text text-transparent">Shantrix</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-highlight/10 text-highlight mb-4">
            <Lightbulb className="h-4 w-4" />
            <span className="text-sm font-medium">Research Topic Finder</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Discover Unique Research Topics</h1>
          <p className="text-muted-foreground">AI-powered tool that finds novel, unpublished research ideas in your field</p>
        </div>

        <Card className="shadow-elevated mb-8">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="field">Research Field / Subject *</Label>
                  <Input
                    id="field"
                    placeholder="e.g., Machine Learning, Psychology, Climate Science"
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">Academic Level</Label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bachelors">Bachelor's</SelectItem>
                      <SelectItem value="masters">Master's</SelectItem>
                      <SelectItem value="phd">PhD / Doctoral</SelectItem>
                      <SelectItem value="postdoc">Post-Doctoral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="keywords">Keywords (optional)</Label>
                  <Input
                    id="keywords"
                    placeholder="e.g., sustainability, deep learning"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-highlight hover:bg-highlight/90"
                disabled={isLoading || !field.trim()}
              >
                {isLoading ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                    Searching for unique topics...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Find Unique Research Topics
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {topics.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-highlight" />
              {topics.length} Unique Research Topics Found
            </h2>
            {topics.map((topic, idx) => (
              <Card key={idx} className="shadow-elevated hover:shadow-glow transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-highlight/10 flex items-center justify-center text-sm font-bold text-highlight flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div>
                        <CardTitle className="text-lg leading-snug">{topic.title}</CardTitle>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => copyTopic(topic.title)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pl-14">
                  <p className="text-sm text-muted-foreground mb-3">{topic.description}</p>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-foreground">Methodology: </span>
                      <span className="text-muted-foreground">{topic.methodology}</span>
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Impact: </span>
                      <span className="text-muted-foreground">{topic.impact}</span>
                    </div>
                  </div>
                  {topic.keywords && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {topic.keywords.map((kw: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
