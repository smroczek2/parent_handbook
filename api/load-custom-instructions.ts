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
    const { vectorStoreId } = req.body;

    if (!vectorStoreId) {
      return res.status(400).json({ error: 'Missing vectorStoreId' });
    }

    // Search for custom instructions document in the vector store
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        input: 'retrieve the complete content of the custom-instructions.md file',
        instructions: 'Return the complete content of the custom-instructions.md file exactly as written, with all formatting preserved. If the file does not exist, return an empty response.',
        stream: false,
        reasoning: {
          effort: 'low'
        },
        tools: [{
          type: 'file_search',
          vector_store_ids: [vectorStoreId],
          max_num_results: 1
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return res.status(response.status).json({ error: 'OpenAI API error' });
    }

    const data = await response.json();

    // Extract custom instructions content
    let customInstructions = '';
    if (data.output && data.output.length > 0) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const contentItem of item.content) {
            if (contentItem.type === 'output_text' && contentItem.text) {
              customInstructions += contentItem.text;
            }
          }
        }
      }
    }

    return res.status(200).json({
      customInstructions: customInstructions || ''
    });

  } catch (error) {
    console.error('Load custom instructions API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
