import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { MatchSpan, GeneratedReport, SOURCE_COLORS, AI_HIGHLIGHT } from "@/types/report";
import { toast } from "sonner";

interface EvidenceDrawerProps {
  span: MatchSpan | null;
  report: GeneratedReport;
  open: boolean;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  currentIndex: number;
  totalCount: number;
}

export default function EvidenceDrawer({
  span,
  report,
  open,
  onClose,
  onNavigate,
  currentIndex,
  totalCount,
}: EvidenceDrawerProps) {
  if (!span) return null;

  const colorSet = span.matchType === 'ai_generated'
    ? AI_HIGHLIGHT
    : SOURCE_COLORS[span.colorIndex % SOURCE_COLORS.length];

  // Get context around the match (50 chars before and after)
  const contextStart = Math.max(0, span.startOffset - 100);
  const contextEnd = Math.min(report.content.length, span.endOffset + 100);
  const beforeText = report.content.substring(contextStart, span.startOffset);
  const matchText = report.content.substring(span.startOffset, span.endOffset);
  const afterText = report.content.substring(span.endOffset, contextEnd);

  const copySourceUrl = () => {
    if (span.sourceUrl) {
      navigator.clipboard.writeText(span.sourceUrl);
      toast.success('Source URL copied!');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">Source Evidence Comparison</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onNavigate('prev')} disabled={currentIndex <= 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">{currentIndex + 1} / {totalCount}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onNavigate('next')} disabled={currentIndex >= totalCount - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Match Info */}
        <div className="flex flex-wrap gap-2 items-center">
          <Badge className={`${colorSet.bg} ${colorSet.text} border ${colorSet.border}`}>
            {span.matchType === 'ai_generated' ? 'AI Generated' : 'Plagiarism'}
          </Badge>
          <Badge variant="outline">{span.similarityScoreForSpan}% match</Badge>
          <Badge variant="outline">{span.matchedWordCount} words</Badge>
          <Badge variant="outline">Page {span.pageNumber}</Badge>
        </div>

        <Separator />

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-2 gap-4">
          {/* User document */}
          <div>
            <p className="text-xs font-semibold mb-2 text-muted-foreground">Your Document</p>
            <div className="p-3 bg-secondary/50 rounded-lg text-sm leading-relaxed border">
              <span className="text-muted-foreground">{beforeText}</span>
              <mark className={`${colorSet.bg} border-b-2 ${colorSet.border} px-0.5 rounded-sm font-medium`}>
                {matchText}
              </mark>
              <span className="text-muted-foreground">{afterText}</span>
            </div>
          </div>

          {/* Source document */}
          <div>
            <p className="text-xs font-semibold mb-2 text-muted-foreground">
              Source: {span.sourceTitle}
            </p>
            <div className="p-3 bg-secondary/50 rounded-lg text-sm leading-relaxed border">
              <mark className={`${colorSet.bg} border-b-2 ${colorSet.border} px-0.5 rounded-sm font-medium`}>
                {span.sourceMatchedText}
              </mark>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {span.sourceUrl ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={span.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-3 w-3" />
                  View Original Source
                </a>
              </Button>
              <Button variant="ghost" size="sm" onClick={copySourceUrl}>
                <Copy className="mr-2 h-3 w-3" />
                Copy URL
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">Source available in internal repository</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
