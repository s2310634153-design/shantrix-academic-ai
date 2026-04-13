import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, BookOpen, FileText, Bot, Search, AlertTriangle, Shield, ChevronRight } from "lucide-react";
import { GeneratedReport, MatchSpan, SOURCE_COLORS, AI_HIGHLIGHT, clampScore } from "@/types/report";

interface ReportSidebarProps {
  report: GeneratedReport;
  selectedSpanId: string | null;
  onSourceSelect: (sourceId: string | null) => void;
  onSpanSelect: (spanId: string) => void;
}

// Turnitin-style source colors
const TURNITIN_COLORS = [
  { bg: "bg-red-600", text: "text-white" },
  { bg: "bg-orange-500", text: "text-white" },
  { bg: "bg-amber-500", text: "text-white" },
  { bg: "bg-green-600", text: "text-white" },
  { bg: "bg-teal-600", text: "text-white" },
  { bg: "bg-blue-600", text: "text-white" },
  { bg: "bg-indigo-600", text: "text-white" },
  { bg: "bg-purple-600", text: "text-white" },
  { bg: "bg-pink-600", text: "text-white" },
  { bg: "bg-rose-600", text: "text-white" },
];

const getSourceIcon = (type: string) => {
  switch (type) {
    case 'journal': case 'publication': return <BookOpen className="h-4 w-4" />;
    case 'web': return <Globe className="h-4 w-4" />;
    case 'ai_detector': return <Bot className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

const getSourceTypeLabel = (type: string) => {
  switch (type) {
    case 'journal': return 'Journal';
    case 'publication': return 'Publication';
    case 'web': return 'Internet Source';
    case 'student': return 'Student Paper';
    case 'repository': return 'Repository';
    default: return type;
  }
};

export default function ReportSidebar({ report, selectedSpanId, onSourceSelect, onSpanSelect }: ReportSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("summary");

  const webSources = report.sources.filter((s) => s.type === 'web').length;
  const pubSources = report.sources.filter((s) => s.type === 'journal' || s.type === 'publication').length;
  const repoSources = report.sources.filter((s) => s.type === 'student' || s.type === 'repository').length;

  const plagiarismSpans = report.matchSpans.filter((s) => s.matchType === 'plagiarism');
  const aiSpans = report.matchSpans.filter((s) => s.matchType === 'ai_generated');

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
          <TabsList className="grid grid-cols-4 h-8">
            <TabsTrigger value="summary" className="text-[10px] px-1">Summary</TabsTrigger>
            <TabsTrigger value="sources" className="text-[10px] px-1">Sources</TabsTrigger>
            <TabsTrigger value="ai" className="text-[10px] px-1">AI</TabsTrigger>
            <TabsTrigger value="flags" className="text-[10px] px-1">Flags</TabsTrigger>
          </TabsList>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-[700px]">
            {/* Summary Tab - Turnitin Style */}
            <TabsContent value="summary" className="m-0 p-0 space-y-0">
              {/* Turnitin-style score header */}
              <div className="border-b px-4 py-4">
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">Originality Report</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-2xl font-bold text-foreground">{report.similarityScore}<span className="text-sm">%</span></div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Similarity Index</p>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-muted-foreground">{webSources}<span className="text-sm">%</span></div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Internet Sources</p>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-muted-foreground">{pubSources}<span className="text-sm">%</span></div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Publications</p>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-muted-foreground">{repoSources}<span className="text-sm">%</span></div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Student Papers</p>
                  </div>
                </div>
              </div>

              {/* AI Score */}
              <div className="border-b px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">AI Content Detection</p>
                  <Badge variant={report.aiScore >= 50 ? "destructive" : "outline"} className="text-xs">
                    {report.aiScore}%
                  </Badge>
                </div>
              </div>

              {/* Primary Sources - Turnitin Style */}
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-3">Primary Sources</p>
                <div className="space-y-0">
                  {report.sources.map((src, idx) => {
                    const tc = TURNITIN_COLORS[idx % TURNITIN_COLORS.length];
                    return (
                      <div
                        key={src.id}
                        className="flex items-center gap-3 py-3 border-b last:border-b-0 cursor-pointer hover:bg-secondary/30 transition-colors -mx-4 px-4"
                        onClick={() => onSourceSelect(src.id)}
                      >
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold ${tc.bg} ${tc.text} flex-shrink-0`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-accent truncate">{src.title}</p>
                          <p className="text-[10px] text-muted-foreground">{getSourceTypeLabel(src.type)}</p>
                        </div>
                        <span className="text-xl font-light text-foreground flex-shrink-0">
                          {src.percentContribution < 1 ? '<1' : src.percentContribution}<span className="text-sm">%</span>
                        </span>
                      </div>
                    );
                  })}
                  {report.sources.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No sources detected</p>
                  )}
                </div>
              </div>

              {/* Exclusion settings display */}
              <div className="border-t px-4 py-3">
                <div className="flex items-center gap-6 text-[10px] text-muted-foreground">
                  <span>Exclude quotes <span className="font-medium text-foreground">On</span></span>
                  <span>Exclude matches <span className="font-medium text-foreground">Off</span></span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Exclude bibliography <span className="font-medium text-foreground">On</span>
                </div>
              </div>
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
              <p className="text-xs text-muted-foreground">
                {report.totalSources} sources · {report.totalMatches} matched spans
              </p>
              {filteredSources.map((src, idx) => {
                const realIdx = report.sources.indexOf(src);
                const tc = TURNITIN_COLORS[realIdx % TURNITIN_COLORS.length];
                return (
                  <div
                    key={src.id}
                    className="flex items-center gap-2 p-2 rounded border hover:border-accent/50 cursor-pointer text-xs"
                    onClick={() => onSourceSelect(src.id)}
                  >
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold ${tc.bg} ${tc.text} flex-shrink-0`}>
                      {realIdx + 1}
                    </span>
                    {getSourceIcon(src.type)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{src.title}</p>
                      <p className="text-[10px] text-muted-foreground">{getSourceTypeLabel(src.type)} · {src.percentContribution}%</p>
                    </div>
                  </div>
                );
              })}
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
