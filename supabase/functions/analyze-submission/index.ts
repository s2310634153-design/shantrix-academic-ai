import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractTextFromPDF(buffer: Uint8Array): string {
  const text = new TextDecoder('latin1').decode(buffer);
  const textParts: string[] = [];
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(text)) !== null) {
    const block = match[1];
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      textParts.push(tjMatch[1]);
    }
    const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
    let tjArrMatch;
    while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
      const arrContent = tjArrMatch[1];
      const strRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = strRegex.exec(arrContent)) !== null) {
        textParts.push(strMatch[1]);
      }
    }
  }
  return textParts.join(' ')
    .replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\')
    .replace(/\s+/g, ' ').trim();
}

function extractTextFromDOCX(buffer: Uint8Array): string {
  try {
    const unzipped = unzipSync(buffer);
    // Find word/document.xml
    let docXml = '';
    for (const [name, data] of Object.entries(unzipped)) {
      if (name === 'word/document.xml' || name.endsWith('/document.xml')) {
        docXml = new TextDecoder().decode(data);
        break;
      }
    }
    if (!docXml) return '';
    
    // Extract text from <w:t> tags
    const parts: string[] = [];
    const wtRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let m;
    while ((m = wtRegex.exec(docXml)) !== null) {
      parts.push(m[1]);
    }
    
    // Add paragraph breaks at </w:p>
    let result = docXml.replace(/<\/w:p>/g, '\n');
    // Strip all XML tags
    result = result.replace(/<[^>]+>/g, '');
    // Clean up whitespace
    result = result.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    
    return result.length > parts.join(' ').length ? result : parts.join(' ').trim();
  } catch (e) {
    console.error('DOCX unzip error:', e);
    return '';
  }
}

async function extractTextWithVision(
  fileBuffer: Uint8Array,
  fileName: string,
  apiKey: string
): Promise<string> {
  // Gemini only supports PDF for documents, not DOCX
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension !== 'pdf') {
    throw new Error('Vision API only supports PDF files');
  }
  
  const base64Content = btoa(String.fromCharCode(...fileBuffer));
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Extract ALL the text content from this document. Return ONLY the raw text, preserving paragraph breaks. Do not add any commentary.' },
          { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64Content}` } }
        ]
      }],
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    console.error('Vision API error:', await response.text());
    throw new Error('Failed to extract text with Vision API');
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * For DOCX files where ZIP extraction failed, use AI to extract text
 * by sending as a text prompt describing the raw content.
 */
async function extractTextWithAI(
  fileBuffer: Uint8Array,
  apiKey: string
): Promise<string> {
  // Try to find any readable text in the raw bytes
  const rawText = new TextDecoder('latin1').decode(fileBuffer);
  // Extract anything that looks like words
  const readable = rawText.match(/[A-Za-z]{3,}[A-Za-z0-9 ,.\-:;'"!?()]{10,}/g);
  if (!readable || readable.length < 3) {
    throw new Error('No readable text found in file');
  }
  
  const sample = readable.join(' ').substring(0, 8000);
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: `The following is raw extracted text from a document. Clean it up, remove any garbled characters, and return the readable content preserving paragraph structure:\n\n${sample}`
      }],
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    throw new Error('AI text cleanup failed');
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

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
          console.log(`DOCX extraction: ${extractedText.length} chars`);
        } else if (extension === 'pdf') {
          extractedText = extractTextFromPDF(fileBuffer);
          console.log(`PDF extraction: ${extractedText.length} chars`);
        }

        // Fallback: Vision API for PDFs, AI cleanup for DOCX
        if (extractedText.length < 50) {
          console.log('Programmatic extraction insufficient, using AI fallback...');
          if (extension === 'pdf') {
            extractedText = await extractTextWithVision(fileBuffer, fileName, LOVABLE_API_KEY);
          } else {
            extractedText = await extractTextWithAI(fileBuffer, LOVABLE_API_KEY);
          }
          console.log(`AI fallback extraction: ${extractedText.length} chars`);
        }

        if (extractedText.length > 10) {
          content = extractedText;
          await supabaseClient.from('submissions')
            .update({ content }).eq('id', submissionId);
          console.log(`Updated submission content: ${content.length} chars`);
        } else {
          throw new Error('Could not extract text. Please paste the text directly.');
        }
      } catch (extractError: any) {
        console.error('Extraction error:', extractError);
        await supabaseClient.from('submissions')
          .update({ status: 'failed' }).eq('id', submissionId);
        throw new Error(`Text extraction failed: ${extractError.message}`);
      }
    }

    console.log(`Analyzing: ${content.length} chars`);

    const maxLen = 12000;
    const analysisContent = content.length > maxLen
      ? content.substring(0, maxLen) + '\n\n[Content truncated for analysis]'
      : content;

    const analysisPrompt = `Analyze the following text for plagiarism and AI-generated content.

Return JSON with:
1. originalityScore (0-100, 100=fully original)
2. aiScore (0-100, % AI-generated)
3. matches (array of suspicious sections)

Each match needs:
- matchedText: exact verbatim text from document (10+ words)
- startPos: character position start
- endPos: character position end
- sourceType: "journal", "web", "student", or "ai_detector"
- sourceName: realistic source name
- sourceUrl: plausible URL
- similarity: 50-100
- matchType: "plagiarism" or "ai_generated"

Check every paragraph thoroughly.

Text:
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
          { role: 'system', content: 'You are an expert plagiarism and AI content detector. Return only valid JSON via the function call.' },
          { role: 'user', content: analysisPrompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_content",
            description: "Analyze text for plagiarism and AI content",
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

    // Validate match positions
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
    });

    console.log(`Results: originality=${originalityScore}, ai=${aiScore}, matches=${validatedMatches.length}`);

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
      const { error: matchesError } = await supabaseClient
        .from('matches').insert(matchesData);
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
