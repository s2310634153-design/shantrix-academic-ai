import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  GeneratedReport,
  MatchSpan,
  ReportSettings,
  SOURCE_COLORS,
  AI_HIGHLIGHT,
} from "@/types/report";

interface DocumentViewerProps {
  report: GeneratedReport;
  settings: ReportSettings;
  onSpanClick: (span: MatchSpan) => void;
  selectedSpanId: string | null;
}

// Turnitin-style colors for source numbers
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

export default function DocumentViewer({ report, settings, onSpanClick, selectedSpanId }: DocumentViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Build source index map for quick lookup
  const sourceIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    report.sources.forEach((src, idx) => {
      map.set(src.id, idx);
    });
    return map;
  }, [report.sources]);

  // Filter spans based on settings
  const visibleSpans = useMemo(() => {
    let spans = report.matchSpans;

    if (settings.showSimilarityOnly) {
      spans = spans.filter((s) => s.matchType === 'plagiarism');
    } else if (settings.showAIOnly) {
      spans = spans.filter((s) => s.matchType === 'ai_generated');
    } else if (!settings.showAllHighlights) {
      spans = [];
    }

    if (settings.selectedSourceId) {
      spans = spans.filter((s) => s.sourceId === settings.selectedSourceId);
    }

    if (settings.excludeSmallMatchesUnder > 0) {
      spans = spans.filter((s) => s.matchedWordCount >= settings.excludeSmallMatchesUnder);
    }

    return spans.sort((a, b) => a.startOffset - b.startOffset);
  }, [report.matchSpans, settings]);

  const renderPage = useCallback((pageNum: number) => {
    const page = report.pages.find((p) => p.pageNumber === pageNum);
    if (!page) return null;

    const pageSpans = visibleSpans.filter(
      (s) => s.startOffset < page.endOffset && s.endOffset > page.startOffset
    );

    if (pageSpans.length === 0 && !settings.highlightsOnlyMode) {
      return <div className="whitespace-pre-wrap leading-relaxed">{page.text}</div>;
    }

    if (pageSpans.length === 0 && settings.highlightsOnlyMode) {
      return <div className="text-muted-foreground italic text-sm">No highlights on this page.</div>;
    }

    const parts: JSX.Element[] = [];
    let cursor = page.startOffset;

    for (const span of pageSpans) {
      const spanStart = Math.max(span.startOffset, page.startOffset);
      const spanEnd = Math.min(span.endOffset, page.endOffset);

      // Text before span
      if (spanStart > cursor && !settings.highlightsOnlyMode) {
        parts.push(
          <span key={`t-${cursor}`}>{report.content.substring(cursor, spanStart)}</span>
        );
      }

      // Determine color and source number
      const isAI = span.matchType === 'ai_generated';
      const sourceIdx = sourceIndexMap.get(span.sourceId) ?? 0;
      const colorSet = isAI
        ? AI_HIGHLIGHT
        : SOURCE_COLORS[span.colorIndex % SOURCE_COLORS.length];
      const turnitinColor = TURNITIN_COLORS[sourceIdx % TURNITIN_COLORS.length];
      const isSelected = selectedSpanId === span.id;

      parts.push(
        <Tooltip key={`m-${span.id}`}>
          <TooltipTrigger asChild>
            <span className="inline relative">
              <mark
                className={`${colorSet.bg} border-b-2 ${colorSet.border} ${isSelected ? 'ring-2 ring-accent shadow-lg' : ''} px-0.5 rounded-sm cursor-pointer transition-all`}
                onClick={() => onSpanClick(span)}
                id={`span-${span.id}`}
              >
                {report.content.substring(spanStart, spanEnd)}
              </mark>
              {/* Turnitin-style numbered badge at end of highlight */}
              <sup
                className={`inline-flex items-center justify-center w-4 h-4 rounded-sm text-[9px] font-bold ${turnitinColor.bg} ${turnitinColor.text} ml-0.5 cursor-pointer align-super`}
                onClick={() => onSpanClick(span)}
              >
                {isAI ? 'AI' : sourceIdx + 1}
              </sup>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="text-xs space-y-1">
              <p className="font-semibold">{span.sourceTitle}</p>
              <p>Type: {isAI ? 'AI Generated' : 'Plagiarism'}</p>
              <p>Words: {span.matchedWordCount} | Similarity: {span.similarityScoreForSpan}%</p>
              {span.sourceUrl && <p className="text-accent truncate">{span.sourceUrl}</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      );

      cursor = spanEnd;
    }

    // Remaining text
    if (cursor < page.endOffset && !settings.highlightsOnlyMode) {
      parts.push(
        <span key={`t-end`}>{report.content.substring(cursor, page.endOffset)}</span>
      );
    }

    return <div className="whitespace-pre-wrap leading-relaxed">{parts}</div>;
  }, [report, visibleSpans, settings.highlightsOnlyMode, selectedSpanId, onSpanClick, sourceIndexMap]);

  // Scroll to selected span
  useEffect(() => {
    if (selectedSpanId) {
      const el = document.getElementById(`span-${selectedSpanId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedSpanId]);

  const zoom = settings.zoomLevel / 100;

  return (
    <Card className="shadow-elevated h-full">
      <CardHeader className="border-b py-3 px-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base">Document Text</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {report.totalPages} {report.totalPages === 1 ? 'page' : 'pages'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {report.wordCount} words
            </Badge>
          </div>
        </div>
        {/* Turnitin-style color legend with numbered badges */}
        <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-sm text-[9px] font-bold bg-blue-500 text-white`}>AI</span>
            <span>AI Generated</span>
          </div>
          {report.sources.slice(0, 8).map((src, i) => {
            const tc = TURNITIN_COLORS[i % TURNITIN_COLORS.length];
            return (
              <div key={src.id} className="flex items-center gap-1">
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-sm text-[9px] font-bold ${tc.bg} ${tc.text}`}>{i + 1}</span>
                <span className="truncate max-w-[80px]">{src.title}</span>
              </div>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[750px]" ref={scrollRef}>
          <div
            className="p-8 bg-background"
            style={{ fontSize: `${14 * zoom}px`, lineHeight: '1.8', fontFamily: 'Georgia, serif' }}
          >
            {report.pages.map((page) => (
              <div key={page.pageNumber} className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <Badge
                    variant={currentPage === page.pageNumber ? 'default' : 'outline'}
                    className="text-xs cursor-pointer"
                    onClick={() => setCurrentPage(page.pageNumber)}
                  >
                    Page {page.pageNumber}
                  </Badge>
                </div>
                {renderPage(page.pageNumber)}
                {page.pageNumber < report.totalPages && (
                  <hr className="my-6 border-dashed border-muted-foreground/20" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
