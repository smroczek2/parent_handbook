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
    const { message, vectorStoreId, instructions, camperContext } = req.body;

    if (!message || !vectorStoreId || !instructions) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Prepend camper context to instructions if provided
    let enhancedInstructions = instructions;
    if (camperContext && camperContext.trim()) {
      enhancedInstructions = `${camperContext}\n\n${instructions}\n\nIMPORTANT: Use the camper context provided above to personalize your responses. Reference the specific camper details when searching for and providing information.`;
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
        instructions: enhancedInstructions,
        stream: true,
        reasoning: {
          effort: 'low'
        },
        tools: [{
          type: 'file_search',
          vector_store_ids: [vectorStoreId],
          max_num_results: 20
        }]
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
