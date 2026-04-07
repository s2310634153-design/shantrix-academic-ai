import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { ReportSettings, GeneratedReport, SOURCE_COLORS } from "@/types/report";

interface ReportFiltersProps {
  settings: ReportSettings;
  onSettingsChange: (s: ReportSettings) => void;
  report: GeneratedReport;
}

export default function ReportFilters({ settings, onSettingsChange, report }: ReportFiltersProps) {
  const update = (partial: Partial<ReportSettings>) => {
    onSettingsChange({ ...settings, ...partial });
  };

  return (
    <div className="space-y-4">
      {/* Page chips */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Pages</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="flex flex-wrap gap-1">
            {report.pages.map((p) => (
              <Badge key={p.pageNumber} variant="outline" className="text-xs cursor-pointer hover:bg-accent/10">
                {p.pageNumber}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Highlight Filters */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Highlight Mode</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">All Highlights</Label>
            <Switch
              checked={settings.showAllHighlights}
              onCheckedChange={(v) => update({ showAllHighlights: v, showSimilarityOnly: false, showAIOnly: false })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Similarity Only</Label>
            <Switch
              checked={settings.showSimilarityOnly}
              onCheckedChange={(v) => update({ showSimilarityOnly: v, showAllHighlights: false, showAIOnly: false })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">AI Only</Label>
            <Switch
              checked={settings.showAIOnly}
              onCheckedChange={(v) => update({ showAIOnly: v, showAllHighlights: false, showSimilarityOnly: false })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Highlights Only View</Label>
            <Switch
              checked={settings.highlightsOnlyMode}
              onCheckedChange={(v) => update({ highlightsOnlyMode: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Exclusions */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Exclusions</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Exclude Quotes</Label>
            <Switch checked={settings.excludeQuotes} onCheckedChange={(v) => update({ excludeQuotes: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Exclude Bibliography</Label>
            <Switch checked={settings.excludeBibliography} onCheckedChange={(v) => update({ excludeBibliography: v })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Min. match words</Label>
            <Input
              type="number"
              min={0}
              max={50}
              value={settings.excludeSmallMatchesUnder}
              onChange={(e) => update({ excludeSmallMatchesUnder: parseInt(e.target.value) || 0 })}
              className="h-7 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Zoom */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Zoom</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => update({ zoomLevel: Math.max(50, settings.zoomLevel - 10) })}>
              <ZoomOut className="h-3 w-3" />
            </Button>
            <span className="text-xs font-mono w-10 text-center">{settings.zoomLevel}%</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => update({ zoomLevel: Math.min(200, settings.zoomLevel + 10) })}>
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Source Color Legend */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Source Colors</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-1">
          {report.sources.map((src) => {
            const c = SOURCE_COLORS[src.colorIndex % SOURCE_COLORS.length];
            const isSelected = settings.selectedSourceId === src.id;
            return (
              <div
                key={src.id}
                className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs transition-all ${isSelected ? 'bg-accent/10 ring-1 ring-accent' : 'hover:bg-secondary/50'}`}
                onClick={() => update({ selectedSourceId: isSelected ? null : src.id })}
              >
                <div className={`w-3 h-3 rounded-sm flex-shrink-0 ${c.bg} border ${c.border}`} />
                <span className="truncate">{src.title}</span>
                <span className="ml-auto font-mono text-muted-foreground">{src.percentContribution}%</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
