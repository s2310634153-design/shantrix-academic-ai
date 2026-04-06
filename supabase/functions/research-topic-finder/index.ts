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
    const { field, level, keywords } = await req.json();

    if (!field) {
      return new Response(
        JSON.stringify({ error: 'Research field is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const prompt = `You are an expert academic research advisor. Generate 8 unique, original, and unpublished research topic ideas for the following:

Field/Subject: ${field}
Academic Level: ${level || 'Masters/PhD'}
${keywords ? `Keywords/Focus Areas: ${keywords}` : ''}

Requirements:
- Each topic must be highly specific and novel - not generic
- Topics should address current gaps in literature
- Include interdisciplinary angles where possible
- Each topic should be feasible for academic research
- Topics should NOT be commonly found in existing literature
- Make them unique enough that a Google Scholar search would return few or no exact matches

For each topic provide:
1. A precise research title
2. A brief description (2-3 sentences) explaining the research gap it addresses
3. Suggested methodology (1 sentence)
4. Potential impact/contribution to the field
5. 3-4 relevant keywords`;

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
            content: 'You are an expert academic research advisor who specializes in identifying novel, unpublished research gaps across all academic disciplines. Return only valid JSON.'
          },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_topics",
              description: "Generate unique research topic suggestions",
              parameters: {
                type: "object",
                properties: {
                  topics: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        methodology: { type: "string" },
                        impact: { type: "string" },
                        keywords: {
                          type: "array",
                          items: { type: "string" }
                        },
                        noveltyScore: { type: "number" }
                      },
                      required: ["title", "description", "methodology", "impact", "keywords"]
                    }
                  }
                },
                required: ["topics"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_topics" } }
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
      throw new Error('Failed to generate topics');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const result = JSON.parse(toolCall?.function?.arguments || '{"topics":[]}');

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in research-topic-finder:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
