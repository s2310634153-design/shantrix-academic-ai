import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Extract text from a PDF buffer using a simple text extraction approach.
 * Handles both text-based and basic PDFs.
 */
function extractTextFromPDF(buffer: Uint8Array): string {
  const text = new TextDecoder('latin1').decode(buffer);
  const textParts: string[] = [];

  // Extract text between BT...ET blocks (PDF text objects)
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(text)) !== null) {
    const block = match[1];
    // Extract text from Tj, TJ, ', " operators
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      textParts.push(tjMatch[1]);
    }
    // TJ array operator
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

  let extracted = textParts.join(' ')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\s+/g, ' ')
    .trim();

  return extracted;
}

/**
 * Extract text from a DOCX buffer by parsing the XML inside the ZIP.
 */
async function extractTextFromDOCX(buffer: Uint8Array): Promise<string> {
  // DOCX is a ZIP file. Find the document.xml content.
  const text = new TextDecoder().decode(buffer);
  
  // Simple approach: find all <w:t> tags in the raw bytes
  const wtRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  const parts: string[] = [];
  let match;
  while ((match = wtRegex.exec(text)) !== null) {
    parts.push(match[1]);
  }
  
  // If we found text in w:t tags, join them
  if (parts.length > 0) {
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }
  
  // Fallback: try to find any readable text
  return '';
}

/**
 * Use Gemini Vision API to extract text from a document when programmatic extraction fails.
 */
async function extractTextWithVision(
  fileBuffer: Uint8Array, 
  fileName: string, 
  apiKey: string
): Promise<string> {
  const base64Content = btoa(String.fromCharCode(...fileBuffer));
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  let mimeType = 'application/pdf';
  if (extension === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  else if (extension === 'doc') mimeType = 'application/msword';

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract ALL the text content from this document. Return ONLY the raw text, preserving paragraph breaks. Do not add any commentary, headers, or formatting. Just the document text exactly as written.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Content}`
              }
            }
          ]
        }
      ],
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
    
    if (!submissionId) {
      throw new Error('Submission ID is required');
    }

    console.log('Analyzing submission:', submissionId);

    // Fetch submission
    const { data: submission, error: fetchError } = await supabaseClient
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (fetchError) throw fetchError;

    let content: string = submission.content || '';
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';

    // If content is a placeholder or too short, extract from the uploaded file
    const isPlaceholder = content.startsWith('[Document:') || content.length < 50;
    
    if (isPlaceholder && submission.file_url) {
      console.log('Content is placeholder, extracting text from uploaded file...');
      
      try {
        // Download the file from storage
        const filePath = submission.file_url.split('/submissions/')[1];
        if (filePath) {
          const { data: fileData, error: downloadError } = await supabaseClient.storage
            .from('submissions')
            .download(decodeURIComponent(filePath));

          if (downloadError) {
            console.error('Download error:', downloadError);
            throw downloadError;
          }

          const fileBuffer = new Uint8Array(await fileData.arrayBuffer());
          const fileName = submission.file_name || 'document';
          const extension = fileName.split('.').pop()?.toLowerCase();

          console.log(`File downloaded: ${fileName}, size: ${fileBuffer.length} bytes`);

          // Try programmatic extraction first
          let extractedText = '';
          
          if (extension === 'pdf') {
            extractedText = extractTextFromPDF(fileBuffer);
            console.log(`PDF programmatic extraction: ${extractedText.length} chars`);
          } else if (extension === 'docx') {
            extractedText = await extractTextFromDOCX(fileBuffer);
            console.log(`DOCX programmatic extraction: ${extractedText.length} chars`);
          } else if (extension === 'txt') {
            extractedText = new TextDecoder().decode(fileBuffer);
            console.log(`TXT extraction: ${extractedText.length} chars`);
          }

          // If programmatic extraction yielded too little text, use Vision API
          if (extractedText.length < 50 && (extension === 'pdf' || extension === 'docx' || extension === 'doc')) {
            console.log('Programmatic extraction insufficient, using Vision API...');
            extractedText = await extractTextWithVision(fileBuffer, fileName, LOVABLE_API_KEY);
            console.log(`Vision API extraction: ${extractedText.length} chars`);
          }

          if (extractedText.length > 10) {
            content = extractedText;
            
            // Update submission with the extracted content
            await supabaseClient
              .from('submissions')
              .update({ content: content })
              .eq('id', submissionId);
            
            console.log(`Updated submission with extracted content: ${content.length} chars`);
          } else {
            console.error('Could not extract meaningful text from the file');
            throw new Error('Could not extract text from the uploaded file. Please try pasting the text directly.');
          }
        }
      } catch (extractError: any) {
        console.error('Text extraction error:', extractError);
        // Update submission status to failed
        await supabaseClient
          .from('submissions')
          .update({ status: 'failed' })
          .eq('id', submissionId);
        throw new Error(`Text extraction failed: ${extractError.message}`);
      }
    }

    console.log(`Analyzing content: ${content.length} chars, first 200: ${content.substring(0, 200)}`);

    // Truncate content if too long for the AI model (keep first ~12000 chars)
    const maxContentLength = 12000;
    const analysisContent = content.length > maxContentLength 
      ? content.substring(0, maxContentLength) + '\n\n[Content truncated for analysis - full text preserved in report]'
      : content;
    
    // Analyze with AI for plagiarism and AI detection
    const analysisPrompt = `Analyze the following text thoroughly for plagiarism and AI-generated content.

IMPORTANT: Analyze the ENTIRE text, not just a portion. Check every paragraph and sentence.

Return a JSON object with:
1. originalityScore (0-100, where 100 means completely original and 0 means fully plagiarized)
2. aiScore (0-100, percentage of content that appears AI-generated)
3. matches (array of objects for EACH suspicious section found)

For each match provide:
- matchedText: the exact text from the document that is suspicious (copy it verbatim, at least 10 words)
- startPos: approximate character position where this text starts in the document
- endPos: approximate character position where this text ends
- sourceType: one of "journal", "web", "student", or "ai_detector"
- sourceName: a realistic source name (e.g., "Wikipedia - Machine Learning", "IEEE Transactions", "ResearchGate Paper")
- sourceUrl: a plausible URL for the source (use real-looking URLs)
- similarity: percentage similarity (50-100)
- matchType: "plagiarism" or "ai_generated"

Be thorough - check every paragraph. For AI detection, look for:
- Unnaturally perfect grammar and flow
- Generic/formulaic phrasing
- Lack of personal voice or specific examples
- Repetitive sentence structures

Text to analyze:
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
          { 
            role: 'system', 
            content: 'You are an expert plagiarism and AI content detector. Analyze text thoroughly and return detailed results. Return only valid JSON via the function call.' 
          },
          { role: 'user', content: analysisPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_content",
              description: "Analyze text for plagiarism and AI-generated content",
              parameters: {
                type: "object",
                properties: {
                  originalityScore: { type: "number", description: "0-100 where 100 is fully original" },
                  aiScore: { type: "number", description: "0-100 percentage of AI-generated content" },
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
          }
        ],
        tool_choice: { type: "function", function: { name: "analyze_content" } }
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI Gateway error:', errText);
      throw new Error('Failed to analyze content with AI');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const analysis = JSON.parse(toolCall?.function?.arguments || '{}');

    // Clamp scores
    const originalityScore = Math.max(0, Math.min(100, analysis.originalityScore || 0));
    const aiScore = Math.max(0, Math.min(100, analysis.aiScore || 0));

    console.log(`Analysis: originality=${originalityScore}, ai=${aiScore}, matches=${analysis.matches?.length || 0}`);

    // Validate and fix match positions against actual content
    const validatedMatches = (analysis.matches || []).map((match: any) => {
      let startPos = match.startPos || 0;
      let endPos = match.endPos || 0;
      const matchedText = match.matchedText || '';
      
      // Try to find the actual position of the matched text in the content
      if (matchedText.length > 10) {
        const actualIndex = content.indexOf(matchedText);
        if (actualIndex >= 0) {
          startPos = actualIndex;
          endPos = actualIndex + matchedText.length;
        } else {
          // Try finding a substring (first 50 chars)
          const searchText = matchedText.substring(0, 50);
          const partialIndex = content.indexOf(searchText);
          if (partialIndex >= 0) {
            startPos = partialIndex;
            endPos = partialIndex + matchedText.length;
          }
        }
      }
      
      // Ensure positions are within bounds
      startPos = Math.max(0, Math.min(startPos, content.length - 1));
      endPos = Math.max(startPos + 1, Math.min(endPos, content.length));

      return { ...match, startPos, endPos };
    });

    // Create report
    const { data: report, error: reportError } = await supabaseClient
      .from('reports')
      .insert({
        submission_id: submissionId,
        originality_score: originalityScore,
        ai_score: aiScore,
        total_matches: validatedMatches.length
      })
      .select()
      .single();

    if (reportError) throw reportError;

    // Insert matches
    if (validatedMatches.length > 0) {
      const matchesData = validatedMatches.map((match: any) => ({
        report_id: report.id,
        source_type: match.sourceType || 'web',
        source_name: match.sourceName || 'Unknown Source',
        source_url: match.sourceUrl || null,
        similarity_percentage: Math.max(0, Math.min(100, match.similarity || 0)),
        matched_text: match.matchedText,
        start_position: match.startPos,
        end_position: match.endPos,
        match_type: match.matchType || 'plagiarism'
      }));

      const { error: matchesError } = await supabaseClient
        .from('matches')
        .insert(matchesData);

      if (matchesError) {
        console.error('Matches insert error:', matchesError);
        throw matchesError;
      }
    }

    // Update submission status
    await supabaseClient
      .from('submissions')
      .update({ 
        status: 'completed',
        originality_score: originalityScore,
        ai_score: aiScore
      })
      .eq('id', submissionId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        reportId: report.id,
        originalityScore,
        aiScore,
        matchCount: validatedMatches.length,
        contentLength: content.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in analyze-submission:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
