import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { FileCheck, Download, Share2, ArrowLeft, Globe, BookOpen, FileText, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ReportView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [id]);

  const loadReport = async () => {
    try {
      // Find submission by ID
      const { data: submissionData, error: subError } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', id)
        .single();

      if (subError) throw subError;
      setSubmission(submissionData);

      // Get report for this submission
      const { data: reportData, error: repError } = await supabase
        .from('reports')
        .select('*')
        .eq('submission_id', id)
        .single();

      if (repError) throw repError;
      setReport(reportData);

      // Get matches for this report
      const { data: matchesData, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('report_id', reportData.id)
        .order('similarity_percentage', { ascending: false });

      if (matchError) throw matchError;
      setMatches(matchesData || []);

    } catch (error: any) {
      console.error('Error loading report:', error);
      toast.error('Failed to load report');
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadReport = () => {
    if (!submission || !report) return;

    const reportText = `
SHANTRIX SIMILARITY REPORT
==========================

Document: ${submission.title}
Submitted: ${new Date(submission.created_at).toLocaleString()}

SCORES
------
Originality Score: ${report.originality_score}%
AI-Generated Content: ${report.ai_score}%
Total Matches Found: ${report.total_matches}

MATCHED SOURCES
--------------
${matches.map((match, idx) => `
${idx + 1}. ${match.source_name}
   Type: ${match.match_type}
   Similarity: ${match.similarity_percentage}%
   Text: "${match.matched_text}"
   ${match.source_url ? `URL: ${match.source_url}` : ''}
`).join('\n')}

FULL DOCUMENT
-------------
${submission.content}
    `;

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shantrix-report-${submission.title}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Report downloaded!');
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "journal":
        return <BookOpen className="h-4 w-4" />;
      case "web":
        return <Globe className="h-4 w-4" />;
      case "ai_detector":
        return <Bot className="h-4 w-4" />;
      case "student":
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getMatchColor = (matchType: string) => {
    return matchType === "ai_generated" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-yellow-100 dark:bg-yellow-900/30";
  };

  const renderHighlightedContent = () => {
    if (!submission) return null;
    
    let content = submission.content;
    const parts: JSX.Element[] = [];
    let lastIndex = 0;

    // Sort matches by start position
    const sortedMatches = [...matches].sort((a, b) => a.start_position - b.start_position);

    sortedMatches.forEach((match, idx) => {
      // Add text before match
      if (match.start_position > lastIndex) {
        parts.push(
          <span key={`text-${idx}`}>
            {content.substring(lastIndex, match.start_position)}
          </span>
        );
      }

      // Add highlighted match
      const isSelected = selectedMatch === match.id;
      const colorClass = getMatchColor(match.match_type);
      parts.push(
        <mark
          key={`match-${idx}`}
          className={`${colorClass} ${isSelected ? 'ring-2 ring-accent' : ''} p-1 rounded cursor-pointer transition-all`}
          onClick={() => setSelectedMatch(match.id)}
        >
          {content.substring(match.start_position, match.end_position)}
        </mark>
      );

      lastIndex = match.end_position;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(<span key="text-end">{content.substring(lastIndex)}</span>);
    }

    return <div className="whitespace-pre-wrap">{parts}</div>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/30">
        <p className="text-muted-foreground">Loading report...</p>
      </div>
    );
  }

  if (!report || !submission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/30">
        <p className="text-muted-foreground">Report not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Navbar */}
      <nav className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-2 font-bold text-xl">
              <FileCheck className="h-6 w-6 text-accent" />
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                Similarity Report
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadReport}>
              <Download className="mr-2 h-4 w-4" />
              Download Report
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.info('Share feature coming soon!')}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">{submission.title}</h1>
          <p className="text-sm text-muted-foreground">
            Submitted on {new Date(submission.created_at).toLocaleString()}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Document Viewer (Left Panel) */}
          <Card className="lg:col-span-2 shadow-elevated">
            <CardHeader>
              <CardTitle>Document Preview</CardTitle>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-100 dark:bg-yellow-900/30 rounded"></div>
                  <span>Plagiarism</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900/30 rounded"></div>
                  <span>AI Generated</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] rounded-lg border p-6 bg-background">
                <div className="prose prose-sm max-w-none">
                  {renderHighlightedContent()}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Match Summary (Right Panel) */}
          <div className="space-y-6">
            {/* Scores */}
            <Card className="shadow-elevated border-2 border-accent/20">
              <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-secondary/50 rounded-lg">
                  <div className={`text-5xl font-bold mb-1 ${getScoreColor(report.originality_score)}`}>
                    {report.originality_score}%
                  </div>
                  <p className="text-sm text-muted-foreground">Originality Score</p>
                </div>
                
                <Separator />
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">AI-Generated:</span>
                    <span className="font-medium text-blue-600">{report.ai_score}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Similarity detected:</span>
                    <span className="font-medium text-yellow-600">{100 - report.originality_score}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total matches:</span>
                    <span className="font-medium">{report.total_matches}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Matched Sources */}
            <Card className="shadow-elevated">
              <CardHeader>
                <CardTitle>Matched Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {matches.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No matches found
                      </p>
                    ) : (
                      matches.map((match) => (
                        <Card
                          key={match.id}
                          className={`cursor-pointer transition-colors ${
                            selectedMatch === match.id
                              ? "border-accent border-2"
                              : "hover:border-accent/50"
                          }`}
                          onClick={() => setSelectedMatch(match.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3 mb-2">
                              <div className="p-2 bg-secondary rounded">
                                {getSourceIcon(match.source_type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate">{match.source_name}</h4>
                                <Badge 
                                  variant="secondary" 
                                  className={match.match_type === "ai_generated" ? "bg-blue-500" : ""}
                                >
                                  {match.similarity_percentage}% match • {match.match_type === "ai_generated" ? "AI" : "Plagiarism"}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {match.matched_text}
                            </p>
                            {match.source_url && (
                              <a
                                href={match.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-accent hover:underline mt-2 inline-block"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View source →
                              </a>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}