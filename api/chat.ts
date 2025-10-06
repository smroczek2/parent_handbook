import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { message, vectorStoreId, instructions, camperContext, customInstructions, conversationHistory } = req.body;

    if (!message || !vectorStoreId || !instructions) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Build enhanced instructions with custom instructions having highest priority
    let finalInstructions = instructions;

    // 1. Add custom instructions FIRST (highest priority)
    if (customInstructions && customInstructions.trim()) {
      finalInstructions = `${customInstructions}\n\n${'='.repeat(80)}\n\nREGULAR INSTRUCTIONS:\n\n${instructions}`;
    }

    // 2. Add camper context
    if (camperContext && camperContext.trim()) {
      finalInstructions = `${finalInstructions}\n\n${'='.repeat(80)}\n\nPERSONALIZATION CONTEXT:\n\n${camperContext}\n\nIMPORTANT PERSONALIZATION GUIDELINES:
- Always use first names when referring to specific campers (never use full names or last names)
- Tailor your answers to the specific sessions and age groups the campers are enrolled in
- When searching documentation, prioritize information relevant to their enrollment details
- Make responses feel personal and parent-focused by naturally referencing the campers by their first names
- If information applies to specific sessions or age groups, clearly indicate which camper(s) it relates to
- Respond conversationally as if you know these specific campers and their camp plans
- The user may ask questions that are not specific or clear. Think about what they might be asking and provide a helpful answer.`;
    }

    // 3. Add conversation history context
    if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      const historyText = conversationHistory.join('\n');
      finalInstructions = `${finalInstructions}\n\n${'='.repeat(80)}\n\nCONVERSATION HISTORY:\n\n${historyText}\n\nIMPORTANT: Use this conversation history to maintain context and provide coherent follow-up responses. Reference previous questions and answers when relevant.`;
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: message,
        instructions: finalInstructions,
        stream: true,
        reasoning: {
          effort: 'low'
        },
        tools: [{
          type: 'file_search',
          vector_store_ids: [vectorStoreId],
          max_num_results: 20
        }],
        include: ['file_search_call.results']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return res.status(response.status).json({ error: 'OpenAI API error' });
    }

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream the response
    const reader = response.body?.getReader();
    if (!reader) {
      return res.status(500).json({ error: 'Failed to read response' });
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }

    res.end();
  } catch (error) {
    console.error('Chat API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
