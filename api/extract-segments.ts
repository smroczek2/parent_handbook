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

    const segmentExtractionPrompt = `Analyze the camp documentation in this vector store and identify ONLY these two specific categories:

1. Session names or dates (e.g., Session 1, Session 2, Full Summer, etc.)
2. Age groups or divisions (e.g., Junior, Intermediate, Senior, age ranges, etc.)

Return ONLY a valid JSON object with this exact structure:
{
  "segments": [
    {
      "label": "Session",
      "values": ["Session 1", "Session 2", "Full Summer"]
    },
    {
      "label": "Age Group",
      "values": ["Junior", "Intermediate", "Senior"]
    }
  ]
}

IMPORTANT:
- Only include "Session" and "Age Group" categories
- Keep values concise (limit to 10 words or less per value)
- If a category is not found in the documentation, omit it entirely
- Return empty segments array if neither category is found: {"segments": []}`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        input: segmentExtractionPrompt,
        instructions: 'You are a helpful assistant that extracts structured data from documentation. Always return valid JSON only, with no additional text or explanation.',
        stream: false,
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

    const data = await response.json();

    // Extract the text content from the response
    let segmentsText = '';
    if (data.output && data.output.length > 0) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const contentItem of item.content) {
            if (contentItem.type === 'output_text' && contentItem.text) {
              segmentsText += contentItem.text;
            }
          }
        }
      }
    }

    // Parse the JSON response
    try {
      const segmentsData = JSON.parse(segmentsText.trim());
      return res.status(200).json(segmentsData);
    } catch (parseError) {
      console.error('Failed to parse segments JSON:', segmentsText);
      // Return empty segments if parsing fails
      return res.status(200).json({ segments: [] });
    }

  } catch (error) {
    console.error('Extract segments API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
