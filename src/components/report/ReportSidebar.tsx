import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, BookOpen, FileText, Bot, Search, AlertTriangle, Shield, ChevronRight } from "lucide-react";
import { GeneratedReport, MatchSpan, SourceDocument, SOURCE_COLORS, AI_HIGHLIGHT, clampScore } from "@/types/report";

interface ReportSidebarProps {
  report: GeneratedReport;
  selectedSpanId: string | null;
  onSourceSelect: (sourceId: string | null) => void;
  onSpanSelect: (spanId: string) => void;
}

const getSourceIcon = (type: string) => {
  switch (type) {
    case 'journal': case 'publication': return <BookOpen className="h-4 w-4" />;
    case 'web': return <Globe className="h-4 w-4" />;
    case 'ai_detector': return <Bot className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

export default function ReportSidebar({ report, selectedSpanId, onSourceSelect, onSpanSelect }: ReportSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("summary");

  const webSources = report.sources.filter((s) => s.type === 'web').length;
  const pubSources = report.sources.filter((s) => s.type === 'journal' || s.type === 'publication').length;
  const repoSources = report.sources.filter((s) => s.type === 'student' || s.type === 'repository').length;

  const topSource = report.sources[0];
  const plagiarismSpans = report.matchSpans.filter((s) => s.matchType === 'plagiarism');
  const aiSpans = report.matchSpans.filter((s) => s.matchType === 'ai_generated');

  // For AI analysis: group by paragraph
  const aiParagraphs = report.aiSpans.map((span) => ({
    ...span,
    text: report.content.substring(span.startOffset, Math.min(span.endOffset, span.startOffset + 150)),
  }));

  const filteredSources = report.sources.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.url && s.url.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Card className="shadow-elevated h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <CardHeader className="py-2 px-3 border-b">
          <TabsList className="grid grid-cols-5 h-8">
            <TabsTrigger value="summary" className="text-[10px] px-1">Summary</TabsTrigger>
            <TabsTrigger value="matches" className="text-[10px] px-1">Matches</TabsTrigger>
            <TabsTrigger value="sources" className="text-[10px] px-1">Sources</TabsTrigger>
            <TabsTrigger value="ai" className="text-[10px] px-1">AI</TabsTrigger>
            <TabsTrigger value="flags" className="text-[10px] px-1">Flags</TabsTrigger>
          </TabsList>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-[700px]">
            {/* Summary Tab */}
            <TabsContent value="summary" className="m-0 p-4 space-y-4">
              {/* Scores */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg text-center">
                  <div className="text-2xl font-bold text-yellow-600">{report.similarityScore}%</div>
                  <p className="text-[10px] text-muted-foreground mt-1">Similarity</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{report.aiScore}%</div>
                  <p className="text-[10px] text-muted-foreground mt-1">AI Content</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Matched Spans</span>
                  <span className="font-semibold">{report.totalMatches}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Web Sources</span>
                  <span className="font-semibold">{webSources}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Publication Sources</span>
                  <span className="font-semibold">{pubSources}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Repository Sources</span>
                  <span className="font-semibold">{repoSources}</span>
                </div>

                <Separator />

                {topSource && (
                  <div>
                    <p className="text-muted-foreground mb-1">Most Matched Source</p>
                    <div className="p-2 bg-secondary/50 rounded text-xs">
                      <p className="font-medium truncate">{topSource.title}</p>
                      <p className="text-muted-foreground">{topSource.percentContribution}% contribution</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Word Count</span>
                  <span className="font-semibold">{report.wordCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pages</span>
                  <span className="font-semibold">{report.totalPages}</span>
                </div>
              </div>
            </TabsContent>

            {/* Match Overview Tab */}
            <TabsContent value="matches" className="m-0 p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                {report.totalSources} sources, {report.totalMatches} matched spans
              </p>
              {report.sources.map((src, idx) => {
                const c = SOURCE_COLORS[src.colorIndex % SOURCE_COLORS.length];
                return (
                  <div
                    key={src.id}
                    className="p-3 border rounded-lg cursor-pointer hover:border-accent/50 transition-all"
                    onClick={() => onSourceSelect(src.id)}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${c.bg} ${c.text}`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          {getSourceIcon(src.type)}
                          <span className="text-xs font-medium truncate">{src.title}</span>
                        </div>
                        {src.url && (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-accent hover:underline truncate block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {src.url}
                          </a>
                        )}
                        <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
                          <span>{src.matchedWords} words</span>
                          <span>{src.percentContribution}%</span>
                          <span>{src.occurrences} occurrences</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            {/* All Sources Tab */}
            <TabsContent value="sources" className="m-0 p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search sources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 text-xs pl-7"
                />
              </div>
              {filteredSources.map((src) => (
                <div
                  key={src.id}
                  className="flex items-center gap-2 p-2 rounded border hover:border-accent/50 cursor-pointer text-xs"
                  onClick={() => onSourceSelect(src.id)}
                >
                  {getSourceIcon(src.type)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{src.title}</p>
                    <p className="text-[10px] text-muted-foreground">{src.type} · {src.percentContribution}%</p>
                  </div>
                </div>
              ))}
              {filteredSources.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No sources found</p>
              )}
            </TabsContent>

            {/* AI Analysis Tab */}
            <TabsContent value="ai" className="m-0 p-4 space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-center">
                <div className="text-3xl font-bold text-blue-600">{report.aiScore}%</div>
                <p className="text-xs text-muted-foreground mt-1">AI-Generated Content</p>
                <Badge variant="outline" className="mt-2 text-[10px]">
                  {report.aiScore >= 70 ? 'High' : report.aiScore >= 30 ? 'Medium' : 'Low'} Confidence
                </Badge>
              </div>

              <Separator />

              <p className="text-xs font-medium">Flagged Paragraphs ({aiParagraphs.length})</p>
              {aiParagraphs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No AI-generated paragraphs detected</p>
              ) : (
                aiParagraphs.map((p) => (
                  <div
                    key={p.id}
                    className="p-2 border rounded cursor-pointer hover:border-blue-400 transition-all"
                    onClick={() => onSpanSelect(p.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-[10px]">Page {p.pageNumber}</Badge>
                      <span className="text-[10px] font-mono text-blue-600">{p.aiProbability}%</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{p.text}...</p>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Integrity Flags Tab */}
            <TabsContent value="flags" className="m-0 p-4 space-y-3">
              {report.integrityFlags.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-8 w-8 text-accent mx-auto mb-2" />
                  <p className="text-xs font-medium">No Integrity Issues Found</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    No hidden text, suspicious formatting, or Unicode replacement detected.
                  </p>
                </div>
              ) : (
                report.integrityFlags.map((flag) => (
                  <div key={flag.id} className="p-2 border rounded flex items-start gap-2">
                    <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${flag.severity === 'high' ? 'text-destructive' : flag.severity === 'medium' ? 'text-yellow-600' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="text-xs font-medium">{flag.description}</p>
                      <p className="text-[10px] text-muted-foreground">Page {flag.pageNumber} · {flag.location}</p>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </CardContent>
      </Tabs>
    </Card>
  );
}
