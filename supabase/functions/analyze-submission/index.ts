import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Fetch submission content
    const { data: submission, error: fetchError } = await supabaseClient
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (fetchError) throw fetchError;

    const content = submission.content;
    
    // Analyze with AI for plagiarism and AI detection
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    const analysisPrompt = `Analyze the following text for plagiarism and AI-generated content. 
    
Return a JSON object with:
1. originalityScore (0-100, higher is better)
2. aiScore (0-100, percentage of content that appears AI-generated)
3. matches (array of objects with: matchedText, startPos, endPos, sourceType, sourceName, sourceUrl, similarity, matchType)

For matches:
- matchType can be "plagiarism" or "ai_generated"
- sourceType can be "journal", "web", "student", or "ai_detector"
- For AI-generated content, use sourceType "ai_detector" and sourceName "AI Content Detector"
- startPos and endPos are character positions in the original text
- similarity is a percentage

Text to analyze:
${content}`;

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
            content: 'You are an expert plagiarism and AI content detector. Return only valid JSON.' 
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
          }
        ],
        tool_choice: { type: "function", function: { name: "analyze_content" } }
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI Gateway error:', await aiResponse.text());
      throw new Error('Failed to analyze content');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const analysis = JSON.parse(toolCall?.function?.arguments || '{}');

    console.log('Analysis result:', analysis);

    // Create report
    const { data: report, error: reportError } = await supabaseClient
      .from('reports')
      .insert({
        submission_id: submissionId,
        originality_score: analysis.originalityScore,
        ai_score: analysis.aiScore,
        total_matches: analysis.matches?.length || 0
      })
      .select()
      .single();

    if (reportError) throw reportError;

    // Insert matches
    if (analysis.matches && analysis.matches.length > 0) {
      const matchesData = analysis.matches.map((match: any) => ({
        report_id: report.id,
        source_type: match.sourceType,
        source_name: match.sourceName,
        source_url: match.sourceUrl || null,
        similarity_percentage: match.similarity,
        matched_text: match.matchedText,
        start_position: match.startPos,
        end_position: match.endPos,
        match_type: match.matchType
      }));

      const { error: matchesError } = await supabaseClient
        .from('matches')
        .insert(matchesData);

      if (matchesError) throw matchesError;
    }

    // Update submission status
    await supabaseClient
      .from('submissions')
      .update({ 
        status: 'completed',
        originality_score: analysis.originalityScore,
        ai_score: analysis.aiScore
      })
      .eq('id', submissionId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        reportId: report.id,
        originalityScore: analysis.originalityScore,
        aiScore: analysis.aiScore
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