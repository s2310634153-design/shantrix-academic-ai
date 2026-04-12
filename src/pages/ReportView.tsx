import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { FileCheck, Download, Share2, ArrowLeft, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildReport } from "@/lib/reportBuilder";
import { GeneratedReport, MatchSpan, ReportSettings, clampScore } from "@/types/report";
import DocumentViewer from "@/components/report/DocumentViewer";
import ReportFilters from "@/components/report/ReportFilters";
import ReportSidebar from "@/components/report/ReportSidebar";
import EvidenceDrawer from "@/components/report/EvidenceDrawer";
import { exportReportPDF } from "@/lib/pdfExport";

const DEFAULT_SETTINGS: ReportSettings = {
  showAllHighlights: true,
  showSimilarityOnly: false,
  showAIOnly: false,
  excludeQuotes: false,
  excludeBibliography: false,
  excludeSmallMatchesUnder: 0,
  selectedSourceId: null,
  highlightsOnlyMode: false,
  zoomLevel: 100,
};

export default function ReportView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<ReportSettings>(DEFAULT_SETTINGS);
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  useEffect(() => {
    loadReport();
  }, [id]);

  const loadReport = async () => {
    try {
      const { data: submissionData, error: subError } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', id)
        .single();
      if (subError) throw subError;

      const { data: reportData, error: repError } = await supabase
        .from('reports')
        .select('*')
        .eq('submission_id', id)
        .single();
      if (repError) throw repError;

      const { data: matchesData, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('report_id', reportData.id)
        .order('start_position', { ascending: true });
      if (matchError) throw matchError;

      const built = buildReport(submissionData, reportData, matchesData || []);
      setReport(built);
    } catch (error: any) {
      console.error('Error loading report:', error);
      toast.error('Failed to load report');
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedSpan = useMemo(() => {
    if (!report || !selectedSpanId) return null;
    return report.matchSpans.find((s) => s.id === selectedSpanId) || null;
  }, [report, selectedSpanId]);

  const sortedSpans = useMemo(() => {
    if (!report) return [];
    return [...report.matchSpans].sort((a, b) => a.startOffset - b.startOffset);
  }, [report]);

  const currentSpanIndex = useMemo(() => {
    if (!selectedSpanId) return -1;
    return sortedSpans.findIndex((s) => s.id === selectedSpanId);
  }, [sortedSpans, selectedSpanId]);

  const handleSpanClick = useCallback((span: MatchSpan) => {
    setSelectedSpanId(span.id);
    setEvidenceOpen(true);
  }, []);

  const handleNavigateEvidence = useCallback((dir: 'prev' | 'next') => {
    const newIndex = dir === 'prev' ? currentSpanIndex - 1 : currentSpanIndex + 1;
    if (newIndex >= 0 && newIndex < sortedSpans.length) {
      setSelectedSpanId(sortedSpans[newIndex].id);
    }
  }, [currentSpanIndex, sortedSpans]);

  const handleSourceSelect = useCallback((sourceId: string | null) => {
    setSettings((s) => ({ ...s, selectedSourceId: sourceId }));
  }, []);

  const handleSpanSelect = useCallback((spanId: string) => {
    setSelectedSpanId(spanId);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'n') handleNavigateEvidence('next');
      if (e.key === 'ArrowLeft' || e.key === 'p') handleNavigateEvidence('prev');
      if (e.key === 'Escape') setEvidenceOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleNavigateEvidence]);

  const downloadReport = () => {
    if (!report) return;

    const reportText = `
═══════════════════════════════════════════════════════
                SHANTRIX SIMILARITY REPORT
═══════════════════════════════════════════════════════

SUBMISSION DETAILS
----------------------------------------------------------
Document Title:      ${report.title}
Submission Date:     ${new Date(report.submissionDate).toLocaleString()}
Submission ID:       ${report.submissionId}
${report.fileName ? `File Name:           ${report.fileName}` : ''}

DOCUMENT STATISTICS
----------------------------------------------------------
Word Count:          ${report.wordCount}
Character Count:     ${report.charCount}
Total Pages:         ${report.totalPages}

ANALYSIS RESULTS
----------------------------------------------------------
Similarity Score:    ${report.similarityScore}%
AI-Generated:        ${report.aiScore}%
Total Matches:       ${report.totalMatches}
Total Sources:       ${report.totalSources}

MATCHED SOURCES
----------------------------------------------------------
${report.sources.map((src, idx) => `
${idx + 1}. ${src.title}
   Type:              ${src.type}
   Contribution:      ${src.percentContribution}%
   Matched Words:     ${src.matchedWords}
   Occurrences:       ${src.occurrences}
   ${src.url ? `URL:               ${src.url}` : ''}
`).join('\n')}

FULL DOCUMENT TEXT
═══════════════════════════════════════════════════════
${report.content}

═══════════════════════════════════════════════════════
Report Generated by Shantrix - AI-Powered Academic Integrity Platform
Generated on: ${new Date().toLocaleString()}
═══════════════════════════════════════════════════════
    `;

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shantrix-report-${report.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Report downloaded!');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary/30">
        <nav className="border-b bg-background sticky top-0 z-50">
          <div className="container mx-auto px-4 h-14 flex items-center">
            <Skeleton className="h-6 w-48" />
          </div>
        </nav>
        <div className="container mx-auto px-4 py-6">
          <Skeleton className="h-32 w-full mb-6" />
          <div className="grid lg:grid-cols-6 gap-4">
            <Skeleton className="h-[700px]" />
            <Skeleton className="h-[700px] lg:col-span-3" />
            <Skeleton className="h-[700px] lg:col-span-2" />
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
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
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2 font-bold text-lg">
              <FileCheck className="h-5 w-5 text-accent" />
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                Shantrix Similarity Report
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadReport}>
              <Download className="mr-1 h-4 w-4" />
              TXT
            </Button>
            <Button variant="outline" size="sm" onClick={async () => { if (report) { toast.info('Generating PDF...'); await exportReportPDF(report); toast.success('PDF downloaded!'); } }}>
              <FileDown className="mr-1 h-4 w-4" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.info('Share feature coming soon!')}>
              <Share2 className="mr-1 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </nav>

      {/* Metadata bar */}
      <div className="border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <div>
              <span className="text-muted-foreground">File: </span>
              <span className="font-medium">{report.fileName || report.title}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Date: </span>
              <span className="font-medium">{new Date(report.submissionDate).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">ID: </span>
              <span className="font-mono">{report.submissionId.substring(0, 13)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Words: </span>
              <span className="font-medium">{report.wordCount.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Pages: </span>
              <span className="font-medium">{report.totalPages}</span>
            </div>

            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <span className="font-semibold text-yellow-600">{report.similarityScore}% Similarity</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span className="font-semibold text-blue-600">{report.aiScore}% AI</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {report.totalMatches} matches · {report.totalSources} sources
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="container mx-auto px-4 py-4">
        <div className="grid lg:grid-cols-6 gap-4">
          {/* Left: Filters */}
          <div className="lg:col-span-1 lg:sticky lg:top-[120px] lg:self-start">
            <ReportFilters settings={settings} onSettingsChange={setSettings} report={report} />
          </div>

          {/* Center: Document Viewer */}
          <div className="lg:col-span-3">
            <DocumentViewer
              report={report}
              settings={settings}
              onSpanClick={handleSpanClick}
              selectedSpanId={selectedSpanId}
            />
          </div>

          {/* Right: Sidebar */}
          <div className="lg:col-span-2 lg:sticky lg:top-[120px] lg:self-start">
            <ReportSidebar
              report={report}
              selectedSpanId={selectedSpanId}
              onSourceSelect={handleSourceSelect}
              onSpanSelect={handleSpanSelect}
            />
          </div>
        </div>
      </div>

      {/* Evidence Drawer */}
      <EvidenceDrawer
        span={selectedSpan}
        report={report}
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        onNavigate={handleNavigateEvidence}
        currentIndex={currentSpanIndex}
        totalCount={sortedSpans.length}
      />
    </div>
  );
}
