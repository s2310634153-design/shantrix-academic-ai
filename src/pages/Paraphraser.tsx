import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wand2, ArrowLeft, Copy, Check, RefreshCw, FileCheck, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

const modes = [
  { value: "standard", label: "Standard", description: "Basic paraphrasing" },
  { value: "fluent", label: "Fluent", description: "Natural flow" },
  { value: "formal", label: "Formal / Academic", description: "Scholarly tone" },
  { value: "creative", label: "Creative", description: "Vivid language" },
  { value: "humanize", label: "Humanize", description: "Bypass AI detection" },
  { value: "shorten", label: "Shorten", description: "Condense text" },
  { value: "expand", label: "Expand", description: "Add detail" },
];

export default function Paraphraser() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [mode, setMode] = useState("standard");
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user);
      else navigate("/login");
    });
  }, [navigate]);

  const handleParaphrase = async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    setOutputText("");
    try {
      const { data, error } = await supabase.functions.invoke('paraphraser', {
        body: { text: inputText, mode }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setOutputText(data.paraphrasedText);
      setStats(data.stats);
      toast.success("Text paraphrased successfully!");
    } catch (error: any) {
      console.error('Error paraphrasing:', error);
      toast.error(error.message || 'Failed to paraphrase text');
    } finally {
      setIsLoading(false);
    }
  };

  const copyOutput = () => {
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const inputWordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;

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

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-600 mb-4">
            <Wand2 className="h-4 w-4" />
            <span className="text-sm font-medium">AI Paraphraser & Humanizer</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Paraphrase & Humanize Text</h1>
          <p className="text-muted-foreground">Rewrite text naturally, bypass AI detection, and maintain meaning</p>
        </div>

        {/* Mode Selection */}
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {modes.map((m) => (
            <Button
              key={m.value}
              variant={mode === m.value ? "default" : "outline"}
              size="sm"
              onClick={() => setMode(m.value)}
              className={mode === m.value ? "bg-accent" : ""}
            >
              {m.label}
            </Button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input */}
          <Card className="shadow-elevated">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Original Text</CardTitle>
                <Badge variant="secondary">{inputWordCount} words</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Paste or type your text here..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="min-h-[400px] resize-none text-sm"
              />
              <Button
                className="w-full mt-4 bg-accent hover:bg-accent/90"
                onClick={handleParaphrase}
                disabled={isLoading || !inputText.trim()}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    {mode === "humanize" ? "Humanizing..." : "Paraphrasing..."}
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    {mode === "humanize" ? "Humanize Text" : "Paraphrase Text"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Output */}
          <Card className="shadow-elevated">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">
                  {mode === "humanize" ? "Humanized" : "Paraphrased"} Text
                </CardTitle>
                <div className="flex items-center gap-2">
                  {stats && <Badge variant="secondary">{stats.newWordCount} words</Badge>}
                  {outputText && (
                    <Button variant="ghost" size="sm" onClick={copyOutput}>
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="min-h-[400px] p-4 rounded-md border bg-secondary/30 text-sm whitespace-pre-wrap">
                {outputText || (
                  <span className="text-muted-foreground">
                    {isLoading ? "Processing your text..." : "Your paraphrased text will appear here..."}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mode Description */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Current mode: </span>
            {modes.find(m => m.value === mode)?.label} — {modes.find(m => m.value === mode)?.description}
          </p>
        </div>
      </div>
    </div>
  );
}
