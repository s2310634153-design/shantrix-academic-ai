import {
  GeneratedReport,
  MatchSpan,
  AISpan,
  SourceDocument,
  SubmissionPage,
  IntegrityFlag,
  clampScore,
} from "@/types/report";

const WORDS_PER_PAGE = 300;

/**
 * Splits content into pages based on word count.
 */
function paginateContent(content: string): SubmissionPage[] {
  const words = content.split(/\s+/);
  const pages: SubmissionPage[] = [];
  let currentOffset = 0;

  for (let i = 0; i < words.length; i += WORDS_PER_PAGE) {
    const pageWords = words.slice(i, i + WORDS_PER_PAGE);
    const pageText = pageWords.join(' ');
    const startOffset = content.indexOf(pageWords[0], currentOffset);
    const endOffset = startOffset + pageText.length;
    pages.push({
      pageNumber: pages.length + 1,
      startOffset,
      endOffset,
      text: content.substring(startOffset, endOffset),
    });
    currentOffset = endOffset;
  }

  if (pages.length === 0) {
    pages.push({ pageNumber: 1, startOffset: 0, endOffset: content.length, text: content });
  }

  return pages;
}

/**
 * Transforms raw database rows into a GeneratedReport.
 */
export function buildReport(
  submission: any,
  report: any,
  matches: any[]
): GeneratedReport {
  const content: string = submission.content || '';
  const pages = paginateContent(content);
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  // Group matches by source to build sources list
  const sourceMap = new Map<string, SourceDocument>();
  const matchSpans: MatchSpan[] = [];
  const aiSpans: AISpan[] = [];
  let colorCounter = 0;

  // Sort matches by start_position for consistent processing
  const sortedMatches = [...matches].sort((a, b) => a.start_position - b.start_position);

  for (const m of sortedMatches) {
    const sourceKey = m.source_name + '|' + (m.source_url || '');

    if (!sourceMap.has(sourceKey)) {
      sourceMap.set(sourceKey, {
        id: sourceKey,
        colorIndex: colorCounter++,
        title: m.source_name,
        type: m.source_type as any,
        url: m.source_url || null,
        matchedWords: 0,
        percentContribution: 0,
        occurrences: 0,
        matchSpanIds: [],
      });
    }

    const source = sourceMap.get(sourceKey)!;
    const matchedWordCount = (m.matched_text || '').split(/\s+/).filter(Boolean).length;
    source.matchedWords += matchedWordCount;
    source.occurrences += 1;
    source.matchSpanIds.push(m.id);

    // Find which page this span belongs to
    const pageNumber = pages.findIndex(
      (p) => m.start_position >= p.startOffset && m.start_position < p.endOffset
    ) + 1 || 1;

    if (m.match_type === 'ai_generated') {
      aiSpans.push({
        id: m.id,
        pageNumber,
        paragraphIndex: 0,
        sentenceIndex: 0,
        startOffset: m.start_position,
        endOffset: m.end_position,
        aiProbability: m.similarity_percentage,
        confidence: m.similarity_percentage >= 80 ? 'high' : m.similarity_percentage >= 50 ? 'medium' : 'low',
        explanationLabel: `AI-generated content detected (${m.similarity_percentage}% confidence)`,
      });
    }

    matchSpans.push({
      id: m.id,
      pageNumber,
      paragraphIndex: 0,
      sentenceIndex: 0,
      startOffset: m.start_position,
      endOffset: m.end_position,
      matchedText: m.matched_text,
      matchedWordCount: matchedWordCount,
      sourceId: sourceKey,
      sourceTitle: m.source_name,
      sourceType: m.source_type as any,
      sourceUrl: m.source_url || null,
      sourceSnippet: m.matched_text,
      sourceMatchedText: m.matched_text,
      similarityScoreForSpan: m.similarity_percentage,
      colorIndex: source.colorIndex,
      matchType: m.match_type as any,
    });
  }

  // Calculate percent contributions
  const totalMatchedWords = Array.from(sourceMap.values()).reduce((s, src) => s + src.matchedWords, 0);
  for (const src of sourceMap.values()) {
    src.percentContribution = totalMatchedWords > 0
      ? clampScore(Math.round((src.matchedWords / Math.max(wordCount, 1)) * 100))
      : 0;
  }

  const sources = Array.from(sourceMap.values()).sort((a, b) => b.percentContribution - a.percentContribution);

  // Generate mock integrity flags (ready for real backend later)
  const integrityFlags: IntegrityFlag[] = [];

  return {
    id: report.id,
    submissionId: submission.id,
    title: submission.title,
    fileName: submission.file_name || null,
    submissionDate: submission.created_at,
    content,
    wordCount,
    charCount: content.length,
    totalPages: pages.length,
    pages,
    similarityScore: clampScore(report.originality_score != null ? 100 - report.originality_score : 0),
    aiScore: clampScore(report.ai_score || 0),
    totalMatches: matchSpans.length,
    totalSources: sources.length,
    matchSpans,
    aiSpans,
    sources,
    integrityFlags,
  };
}
