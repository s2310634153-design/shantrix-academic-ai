import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Text Extraction ──

function extractTextFromPDF(buffer: Uint8Array): string {
  const text = new TextDecoder('latin1').decode(buffer);
  const textParts: string[] = [];
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(text)) !== null) {
    const block = match[1];
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) textParts.push(tjMatch[1]);
    const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
    let tjArrMatch;
    while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
      const strRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = strRegex.exec(tjArrMatch[1])) !== null) textParts.push(strMatch[1]);
    }
  }
  return textParts.join(' ').replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\').replace(/\s+/g, ' ').trim();
}

function extractTextFromDOCX(buffer: Uint8Array): string {
  try {
    const unzipped = unzipSync(buffer);
    let docXml = '';
    for (const [name, data] of Object.entries(unzipped)) {
      if (name === 'word/document.xml' || name.endsWith('/document.xml')) {
        docXml = new TextDecoder().decode(data);
        break;
      }
    }
    if (!docXml) return '';
    let result = docXml.replace(/<\/w:p>/g, '\n');
    result = result.replace(/<[^>]+>/g, '');
    result = result.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    return result;
  } catch (e) {
    console.error('DOCX unzip error:', e);
    return '';
  }
}

async function extractTextWithVision(fileBuffer: Uint8Array, fileName: string, apiKey: string): Promise<string> {
  const base64Content = btoa(String.fromCharCode(...fileBuffer));
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Extract ALL text content from this document. Return ONLY the raw text, preserving paragraph breaks.' },
        { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64Content}` } }
      ]}],
      max_tokens: 16000,
    }),
  });
  if (!response.ok) throw new Error('Vision API failed');
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function extractTextWithAI(fileBuffer: Uint8Array, apiKey: string): Promise<string> {
  const rawText = new TextDecoder('latin1').decode(fileBuffer);
  const readable = rawText.match(/[A-Za-z]{3,}[A-Za-z0-9 ,.\-:;'"!?()]{10,}/g);
  if (!readable || readable.length < 3) throw new Error('No readable text found');
  const sample = readable.join(' ').substring(0, 8000);
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: `Clean up this raw document text, remove garbled characters, return readable content:\n\n${sample}` }],
      max_tokens: 16000,
    }),
  });
  if (!response.ok) throw new Error('AI text cleanup failed');
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Source Search APIs ──

interface SourceMatch {
  matchedText: string;
  sourceName: string;
  sourceType: string;
  sourceUrl: string;
  similarity: number;
  matchType: 'plagiarism';
}

function extractSearchQueries(content: string): string[] {
  const sentences = content.replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.split(/\s+/).length >= 8 && s.split(/\s+/).length <= 40)
    .map(s => s.trim());
  const queries: string[] = [];
  if (sentences.length === 0) return [];
  const step = Math.max(1, Math.floor(sentences.length / 15));
  for (let i = 0; i < sentences.length && queries.length < 20; i += step) {
    queries.push(sentences[i]);
  }
  return queries;
}

async function searchSemanticScholar(query: string): Promise<SourceMatch[]> {
  try {
    const q = encodeURIComponent(query.substring(0, 200));
    const res = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${q}&limit=3&fields=title,url,abstract`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((paper: any) => ({
      matchedText: query, sourceName: paper.title || 'Academic Paper', sourceType: 'journal',
      sourceUrl: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
      similarity: 0, matchType: 'plagiarism' as const,
    }));
  } catch { return []; }
}

async function searchCrossRef(query: string): Promise<SourceMatch[]> {
  try {
    const q = encodeURIComponent(query.substring(0, 200));
    const res = await fetch(`https://api.crossref.org/works?query=${q}&rows=3&select=title,URL,DOI,type`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Shantrix/1.0 (mailto:mdnishanrahman0@gmail.com)' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.message?.items || []).map((item: any) => ({
      matchedText: query,
      sourceName: Array.isArray(item.title) ? item.title[0] : (item.title || 'Journal Article'),
      sourceType: 'publication', sourceUrl: item.URL || `https://doi.org/${item.DOI}`,
      similarity: 0, matchType: 'plagiarism' as const,
    }));
  } catch { return []; }
}

async function searchArxiv(query: string): Promise<SourceMatch[]> {
  try {
    const q = encodeURIComponent(query.substring(0, 150));
    const res = await fetch(`https://export.arxiv.org/api/query?search_query=all:${q}&max_results=3`);
    if (!res.ok) return [];
    const xml = await res.text();
    const entries: SourceMatch[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let m;
    while ((m = entryRegex.exec(xml)) !== null) {
      const titleMatch = m[1].match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = m[1].match(/<id>([\s\S]*?)<\/id>/);
      if (titleMatch) {
        entries.push({
          matchedText: query,
          sourceName: titleMatch[1].replace(/\s+/g, ' ').trim(),
          sourceType: 'journal',
          sourceUrl: linkMatch ? linkMatch[1].trim() : '',
          similarity: 0, matchType: 'plagiarism',
        });
      }
    }
    return entries;
  } catch { return []; }
}

async function searchPubMed(query: string): Promise<SourceMatch[]> {
  try {
    const q = encodeURIComponent(query.substring(0, 200));
    const searchRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=3&term=${q}`);
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const ids = searchData.esearchresult?.idlist || [];
    if (ids.length === 0) return [];
    const summaryRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`);
    if (!summaryRes.ok) return [];
    const summaryData = await summaryRes.json();
    return ids.map((id: string) => {
      const article = summaryData.result?.[id];
      return {
        matchedText: query, sourceName: article?.title || 'PubMed Article', sourceType: 'publication',
        sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, similarity: 0, matchType: 'plagiarism' as const,
      };
    });
  } catch { return []; }
}

async function searchWikipedia(query: string): Promise<SourceMatch[]> {
  try {
    const q = encodeURIComponent(query.substring(0, 150));
    const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&format=json&srlimit=3&srprop=snippet`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.query?.search || []).map((r: any) => ({
      matchedText: query, sourceName: `Wikipedia: ${r.title}`, sourceType: 'web',
      sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
      similarity: 0, matchType: 'plagiarism' as const,
    }));
  } catch { return []; }
}

/** Search CORE (open access research papers) */
async function searchCORE(query: string): Promise<SourceMatch[]> {
  try {
    const q = encodeURIComponent(query.substring(0, 150));
    const res = await fetch(`https://api.core.ac.uk/v3/search/works?q=${q}&limit=3`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((item: any) => ({
      matchedText: query,
      sourceName: item.title || 'Open Access Paper',
      sourceType: 'repository',
      sourceUrl: item.downloadUrl || item.sourceFulltextUrls?.[0] || `https://core.ac.uk/outputs/${item.id}`,
      similarity: 0, matchType: 'plagiarism' as const,
    }));
  } catch { return []; }
}

/** Search OpenAlex (academic knowledge graph) */
async function searchOpenAlex(query: string): Promise<SourceMatch[]> {
  try {
    const q = encodeURIComponent(query.substring(0, 200));
    const res = await fetch(`https://api.openalex.org/works?search=${q}&per_page=3&select=id,title,doi,type`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Shantrix/1.0 (mailto:mdnishanrahman0@gmail.com)' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((item: any) => ({
      matchedText: query,
      sourceName: item.title || 'Academic Work',
      sourceType: 'publication',
      sourceUrl: item.doi ? `https://doi.org/${item.doi.replace('https://doi.org/','')}` : item.id,
      similarity: 0, matchType: 'plagiarism' as const,
    }));
  } catch { return []; }
}

/** Search DOAJ (Directory of Open Access Journals) */
async function searchDOAJ(query: string): Promise<SourceMatch[]> {
  try {
    const q = encodeURIComponent(query.substring(0, 150));
    const res = await fetch(`https://doaj.org/api/search/articles/${q}?pageSize=3`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((item: any) => {
      const bib = item.bibjson || {};
      const link = bib.link?.[0]?.url || '';
      return {
        matchedText: query,
        sourceName: bib.title || 'DOAJ Article',
        sourceType: 'journal',
        sourceUrl: link || `https://doaj.org/article/${item.id}`,
        similarity: 0, matchType: 'plagiarism' as const,
      };
    });
  } catch { return []; }
}

/** Search all sources in parallel */
async function searchAllSources(query: string): Promise<SourceMatch[]> {
  const results = await Promise.allSettled([
    searchSemanticScholar(query),
    searchCrossRef(query),
    searchArxiv(query),
    searchPubMed(query),
    searchWikipedia(query),
    searchCORE(query),
    searchOpenAlex(query),
    searchDOAJ(query),
  ]);
  const allMatches: SourceMatch[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allMatches.push(...r.value);
  }
  return allMatches;
}

// ── Main Handler ──

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { submissionId } = await req.json();
    if (!submissionId) throw new Error('Submission ID is required');
    console.log('Analyzing submission:', submissionId);

    const { data: submission, error: fetchError } = await supabaseClient
      .from('submissions').select('*').eq('id', submissionId).single();
    if (fetchError) throw fetchError;

    let content: string = submission.content || '';
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';
    const isPlaceholder = content.startsWith('[Document:') || content.length < 50;

    // ── Extract text from file if needed ──
    if (isPlaceholder && submission.file_url) {
      console.log('Extracting text from uploaded file...');
      try {
        const filePath = submission.file_url.split('/submissions/')[1];
        if (!filePath) throw new Error('Invalid file URL');
        const { data: fileData, error: downloadError } = await supabaseClient.storage
          .from('submissions').download(decodeURIComponent(filePath));
        if (downloadError) throw downloadError;

        const fileBuffer = new Uint8Array(await fileData.arrayBuffer());
        const fileName = submission.file_name || 'document';
        const extension = fileName.split('.').pop()?.toLowerCase();
        console.log(`File: ${fileName}, size: ${fileBuffer.length} bytes`);

        let extractedText = '';
        if (extension === 'txt') {
          extractedText = new TextDecoder().decode(fileBuffer);
        } else if (extension === 'docx') {
          extractedText = extractTextFromDOCX(fileBuffer);
        } else if (extension === 'pdf') {
          extractedText = extractTextFromPDF(fileBuffer);
        }

        if (extractedText.length < 50) {
          console.log('Using AI fallback for extraction...');
          if (extension === 'pdf') {
            extractedText = await extractTextWithVision(fileBuffer, fileName, LOVABLE_API_KEY);
          } else {
            extractedText = await extractTextWithAI(fileBuffer, LOVABLE_API_KEY);
          }
        }

        if (extractedText.length > 10) {
          content = extractedText;
          await supabaseClient.from('submissions').update({ content }).eq('id', submissionId);
          console.log(`Updated content: ${content.length} chars`);
        } else {
          throw new Error('Could not extract text.');
        }
      } catch (extractError: any) {
        console.error('Extraction error:', extractError);
        await supabaseClient.from('submissions').update({ status: 'failed' }).eq('id', submissionId);
        throw new Error(`Text extraction failed: ${extractError.message}`);
      }
    }

    console.log(`Content length: ${content.length} chars`);

    // ── Step 1: Search real sources ──
    const searchQueries = extractSearchQueries(content);
    console.log(`Searching ${searchQueries.length} queries across 8 academic & web sources...`);

    const allSourceResults: SourceMatch[] = [];
    for (let i = 0; i < searchQueries.length; i += 4) {
      const batch = searchQueries.slice(i, i + 4);
      const batchResults = await Promise.allSettled(batch.map(q => searchAllSources(q)));
      for (const r of batchResults) {
        if (r.status === 'fulfilled') allSourceResults.push(...r.value);
      }
      if (i + 4 < searchQueries.length) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }

    console.log(`Found ${allSourceResults.length} potential source matches`);

    // Deduplicate sources by name
    const uniqueSources = new Map<string, SourceMatch>();
    for (const s of allSourceResults) {
      if (!uniqueSources.has(s.sourceName)) {
        uniqueSources.set(s.sourceName, s);
      }
    }

    // ── Step 2: AI analysis with real source context ──
    const sourceContext = Array.from(uniqueSources.values()).slice(0, 25).map(s =>
      `- "${s.sourceName}" (${s.sourceType}) ${s.sourceUrl}`
    ).join('\n');

    const maxLen = 14000;
    const analysisContent = content.length > maxLen
      ? content.substring(0, maxLen) + '\n\n[Content truncated for analysis]'
      : content;

    const analysisPrompt = `You are an expert plagiarism and AI content detector. Analyze this text thoroughly.

REAL SOURCES FOUND (use these as actual matches where the text overlaps):
${sourceContext || 'No external sources found - rely on your own analysis.'}

INSTRUCTIONS:
1. Compare the text against the real sources listed above
2. Identify exact text spans that match or closely paraphrase content from these sources
3. Also detect any AI-generated writing patterns
4. For each match, use the EXACT source name and URL from the list above
5. matchedText must be VERBATIM text from the document (minimum 10 words, prefer 15-40 words)
6. Carefully set startPos to the exact character offset where the matched text starts in the document
7. Check EVERY paragraph - do not skip sections
8. Be thorough - check for paraphrasing, not just exact copies

Return JSON with:
- originalityScore: 0-100 (100 = fully original)
- aiScore: 0-100 (% AI-generated)
- matches: array of detected matches

Each match needs:
- matchedText: exact verbatim text from the document
- startPos: character position start (0-indexed)
- endPos: character position end
- sourceType: "journal", "web", "publication", "repository", or "ai_detector"
- sourceName: exact source title from the list above (or descriptive name for AI matches)
- sourceUrl: exact URL from the list above (or empty for AI matches)
- similarity: 50-100 (how similar)
- matchType: "plagiarism" or "ai_generated"

TEXT TO ANALYZE:
${analysisContent}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a plagiarism and AI content detection engine. Return only valid JSON via the function call. Be thorough and check every paragraph.' },
          { role: 'user', content: analysisPrompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_content",
            description: "Report plagiarism and AI analysis results",
            parameters: {
              type: "object",
              properties: {
                originalityScore: { type: "number" },
                aiScore: { type: "number" },
                matches: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      matchedText: { type: "string" },
                      startPos: { type: "number" },
                      endPos: { type: "number" },
                      sourceType: { type: "string" },
                      sourceName: { type: "string" },
                      sourceUrl: { type: "string" },
                      similarity: { type: "number" },
                      matchType: { type: "string" }
                    },
                    required: ["matchedText", "startPos", "endPos", "sourceType", "sourceName", "similarity", "matchType"]
                  }
                }
              },
              required: ["originalityScore", "aiScore", "matches"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_content" } }
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI error:', await aiResponse.text());
      throw new Error('AI analysis failed');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const analysis = JSON.parse(toolCall?.function?.arguments || '{}');

    const originalityScore = Math.max(0, Math.min(100, analysis.originalityScore || 0));
    const aiScore = Math.max(0, Math.min(100, analysis.aiScore || 0));

    // Validate and fix match positions
    const validatedMatches = (analysis.matches || []).map((match: any) => {
      let startPos = match.startPos || 0;
      let endPos = match.endPos || 0;
      const matchedText = match.matchedText || '';

      if (matchedText.length > 10) {
        const idx = content.indexOf(matchedText);
        if (idx >= 0) {
          startPos = idx;
          endPos = idx + matchedText.length;
        } else {
          const partial = content.indexOf(matchedText.substring(0, 50));
          if (partial >= 0) {
            startPos = partial;
            endPos = partial + matchedText.length;
          }
        }
      }
      startPos = Math.max(0, Math.min(startPos, content.length - 1));
      endPos = Math.max(startPos + 1, Math.min(endPos, content.length));
      return { ...match, startPos, endPos };
    }).filter((m: any) => m.matchedText && m.matchedText.length > 10);

    console.log(`Results: originality=${originalityScore}, ai=${aiScore}, matches=${validatedMatches.length}`);

    // ── Save to DB ──
    const { data: report, error: reportError } = await supabaseClient
      .from('reports').insert({
        submission_id: submissionId,
        originality_score: originalityScore,
        ai_score: aiScore,
        total_matches: validatedMatches.length
      }).select().single();
    if (reportError) throw reportError;

    if (validatedMatches.length > 0) {
      const matchesData = validatedMatches.map((m: any) => ({
        report_id: report.id,
        source_type: m.sourceType || 'web',
        source_name: m.sourceName || 'Unknown Source',
        source_url: m.sourceUrl || null,
        similarity_percentage: Math.max(0, Math.min(100, m.similarity || 0)),
        matched_text: m.matchedText,
        start_position: m.startPos,
        end_position: m.endPos,
        match_type: m.matchType || 'plagiarism'
      }));
      const { error: matchesError } = await supabaseClient.from('matches').insert(matchesData);
      if (matchesError) throw matchesError;
    }

    await supabaseClient.from('submissions').update({
      status: 'completed',
      originality_score: originalityScore,
      ai_score: aiScore
    }).eq('id', submissionId);

    return new Response(
      JSON.stringify({ success: true, reportId: report.id, originalityScore, aiScore, matchCount: validatedMatches.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
