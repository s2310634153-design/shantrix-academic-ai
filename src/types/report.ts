// Report data model types for Shantrix Originality Checker
// These interfaces map to the database schema and support the Turnitin-style report UI

export interface MatchSpan {
  id: string;
  pageNumber: number;
  paragraphIndex: number;
  sentenceIndex: number;
  startOffset: number;
  endOffset: number;
  matchedText: string;
  matchedWordCount: number;
  sourceId: string;
  sourceTitle: string;
  sourceType: 'journal' | 'web' | 'student' | 'ai_detector' | 'publication' | 'repository';
  sourceUrl: string | null;
  sourceSnippet: string;
  sourceMatchedText: string;
  similarityScoreForSpan: number;
  colorIndex: number;
  matchType: 'plagiarism' | 'ai_generated';
}

export interface AISpan {
  id: string;
  pageNumber: number;
  paragraphIndex: number;
  sentenceIndex: number;
  startOffset: number;
  endOffset: number;
  aiProbability: number;
  confidence: 'high' | 'medium' | 'low';
  explanationLabel: string;
}

export interface SourceDocument {
  id: string;
  colorIndex: number;
  title: string;
  type: 'journal' | 'web' | 'student' | 'ai_detector' | 'publication' | 'repository';
  url: string | null;
  matchedWords: number;
  percentContribution: number;
  occurrences: number;
  matchSpanIds: string[];
}

export interface IntegrityFlag {
  id: string;
  type: 'hidden_text' | 'unicode_replacement' | 'white_on_white' | 'ocr_issue' | 'suspicious_formatting';
  severity: 'high' | 'medium' | 'low';
  description: string;
  location: string;
  pageNumber: number;
}

export interface SubmissionPage {
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  text: string;
}

export interface ReportSettings {
  showAllHighlights: boolean;
  showSimilarityOnly: boolean;
  showAIOnly: boolean;
  excludeQuotes: boolean;
  excludeBibliography: boolean;
  excludeSmallMatchesUnder: number; // word count threshold
  selectedSourceId: string | null;
  highlightsOnlyMode: boolean;
  zoomLevel: number; // percentage, e.g. 100
}

export interface GeneratedReport {
  id: string;
  submissionId: string;
  title: string;
  fileName: string | null;
  submissionDate: string;
  content: string;
  wordCount: number;
  charCount: number;
  totalPages: number;
  pages: SubmissionPage[];

  similarityScore: number;
  aiScore: number;
  totalMatches: number;
  totalSources: number;

  matchSpans: MatchSpan[];
  aiSpans: AISpan[];
  sources: SourceDocument[];
  integrityFlags: IntegrityFlag[];
}

// Source color palette for consistent source highlighting
export const SOURCE_COLORS = [
  { bg: 'bg-red-200 dark:bg-red-900/40', border: 'border-red-400', text: 'text-red-700', hex: '#fca5a5' },
  { bg: 'bg-orange-200 dark:bg-orange-900/40', border: 'border-orange-400', text: 'text-orange-700', hex: '#fdba74' },
  { bg: 'bg-amber-200 dark:bg-amber-900/40', border: 'border-amber-400', text: 'text-amber-700', hex: '#fcd34d' },
  { bg: 'bg-yellow-200 dark:bg-yellow-900/40', border: 'border-yellow-400', text: 'text-yellow-700', hex: '#fde047' },
  { bg: 'bg-lime-200 dark:bg-lime-900/40', border: 'border-lime-400', text: 'text-lime-700', hex: '#bef264' },
  { bg: 'bg-teal-200 dark:bg-teal-900/40', border: 'border-teal-400', text: 'text-teal-700', hex: '#5eead4' },
  { bg: 'bg-cyan-200 dark:bg-cyan-900/40', border: 'border-cyan-400', text: 'text-cyan-700', hex: '#67e8f9' },
  { bg: 'bg-violet-200 dark:bg-violet-900/40', border: 'border-violet-400', text: 'text-violet-700', hex: '#c4b5fd' },
  { bg: 'bg-pink-200 dark:bg-pink-900/40', border: 'border-pink-400', text: 'text-pink-700', hex: '#f9a8d4' },
  { bg: 'bg-rose-200 dark:bg-rose-900/40', border: 'border-rose-400', text: 'text-rose-700', hex: '#fda4af' },
];

export const AI_HIGHLIGHT = {
  bg: 'bg-blue-200 dark:bg-blue-900/40',
  border: 'border-blue-400',
  text: 'text-blue-700',
  hex: '#93c5fd',
};

// Clamp a score between 0 and 100
export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
