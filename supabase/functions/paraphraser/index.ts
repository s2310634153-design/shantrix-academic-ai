import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, mode, tone } = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const modeInstructions: Record<string, string> = {
      standard: "Paraphrase the text while maintaining the original meaning. Use different sentence structures and synonyms.",
      fluent: "Rewrite the text to make it flow naturally and smoothly. Focus on readability and natural language flow.",
      formal: "Rewrite the text in a formal, academic tone. Use scholarly language, passive voice where appropriate, and professional vocabulary.",
      creative: "Creatively rewrite the text with vivid language, varied sentence structures, and engaging phrasing while keeping the core meaning.",
      humanize: "Rewrite this text to sound completely human-written. Remove any patterns typical of AI-generated content such as: overly structured sentences, repetitive transition words, generic phrasing, unnaturally perfect grammar. Add natural imperfections, varied sentence lengths, colloquial expressions where appropriate, personal touches, and authentic human voice. The output should pass AI detection tools as human-written.",
      shorten: "Condense the text to be shorter while preserving all key information and meaning.",
      expand: "Expand the text with more detail, examples, and elaboration while maintaining the core message."
    };

    const selectedMode = mode || 'standard';
    const instruction = modeInstructions[selectedMode] || modeInstructions.standard;

    const prompt = `${instruction}

${tone ? `Tone: ${tone}` : ''}

Original text:
${text}

Important rules:
- Maintain the same meaning as the original
- Do not add new facts or information not present in the original
- Keep the same general structure (paragraphs, lists, etc.)
- Ensure the output is grammatically correct
- The paraphrased version should be significantly different from the original in wording
- Return ONLY the paraphrased text, nothing else`;

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
            content: 'You are an expert writer and paraphrasing specialist. You excel at rewriting text in different styles while preserving meaning. When humanizing text, you make it sound authentically human-written, avoiding AI-detection patterns. Return only the paraphrased text with no extra commentary.'
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error('Failed to paraphrase text');
    }

    const aiData = await aiResponse.json();
    const paraphrasedText = aiData.choices?.[0]?.message?.content || '';

    // Calculate basic stats
    const originalWords = text.trim().split(/\s+/).length;
    const newWords = paraphrasedText.trim().split(/\s+/).length;

    return new Response(
      JSON.stringify({
        paraphrasedText,
        stats: {
          originalWordCount: originalWords,
          newWordCount: newWords,
          mode: selectedMode,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in paraphraser:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
