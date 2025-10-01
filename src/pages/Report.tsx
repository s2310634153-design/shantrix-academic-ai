import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { FileCheck, Download, Share2, ArrowLeft, Globe, BookOpen, FileText } from "lucide-react";

export default function Report() {
  const { id } = useParams();
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);

  const mockReport = {
    title: "Research Paper - AI Ethics",
    submittedDate: "2025-01-15",
    originalityScore: 92,
    matches: [
      {
        id: 1,
        source: "IEEE Digital Library",
        type: "journal",
        similarity: 3,
        text: "Artificial intelligence systems must prioritize ethical considerations...",
        url: "https://ieeexplore.ieee.org/document/12345",
      },
      {
        id: 2,
        source: "arXiv.org",
        type: "web",
        similarity: 2,
        text: "The development of AI technologies requires careful attention to bias...",
        url: "https://arxiv.org/abs/1234.5678",
      },
      {
        id: 3,
        source: "Student Repository",
        type: "student",
        similarity: 3,
        text: "Machine learning algorithms can perpetuate existing societal biases...",
        url: null,
      },
    ],
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
      case "student":
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

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
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">{mockReport.title}</h1>
          <p className="text-sm text-muted-foreground">
            Submitted on {mockReport.submittedDate}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Document Viewer (Left Panel) */}
          <Card className="lg:col-span-2 shadow-elevated">
            <CardHeader>
              <CardTitle>Document Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] rounded-lg border p-6 bg-background">
                <div className="prose prose-sm max-w-none space-y-4">
                  <h2 className="text-xl font-bold">AI Ethics: A Comprehensive Study</h2>
                  
                  <p>
                    Artificial intelligence systems must prioritize ethical considerations 
                    in their design and implementation. As AI becomes increasingly prevalent 
                    in society, the need for robust ethical frameworks becomes paramount.
                  </p>

                  <p className={selectedMatch === 1 ? "bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded" : ""}>
                    The development of AI technologies requires careful attention to bias, 
                    transparency, and accountability. Organizations developing AI systems 
                    must ensure their models are fair and equitable across all user groups.
                  </p>

                  <p>
                    Recent studies have shown that without proper oversight, machine learning 
                    algorithms can perpetuate existing societal biases. This highlights the 
                    importance of diverse development teams and rigorous testing protocols.
                  </p>

                  <p className={selectedMatch === 2 ? "bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded" : ""}>
                    Machine learning algorithms can perpetuate existing societal biases 
                    if not carefully designed and monitored. Regular audits and diverse 
                    training data are essential for creating fair AI systems.
                  </p>

                  <p>
                    The future of AI ethics will require collaboration between technologists, 
                    ethicists, policymakers, and the broader public. By working together, 
                    we can ensure that AI technologies benefit all of humanity while 
                    minimizing potential harms.
                  </p>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Match Summary (Right Panel) */}
          <div className="space-y-6">
            {/* Originality Score */}
            <Card className="shadow-elevated border-2 border-accent/20">
              <CardHeader>
                <CardTitle>Originality Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className={`text-6xl font-bold mb-2 ${getScoreColor(mockReport.originalityScore)}`}>
                    {mockReport.originalityScore}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Original content
                  </p>
                </div>
                
                <Separator className="my-4" />
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Similarity detected:</span>
                    <span className="font-medium">{100 - mockReport.originalityScore}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total matches:</span>
                    <span className="font-medium">{mockReport.matches.length}</span>
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
                    {mockReport.matches.map((match) => (
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
                              {getSourceIcon(match.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">{match.source}</h4>
                              <Badge variant="secondary" className="mt-1">
                                {match.similarity}% match
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {match.text}
                          </p>
                          {match.url && (
                            <a
                              href={match.url}
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
                    ))}
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
