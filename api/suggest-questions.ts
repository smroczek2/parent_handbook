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
    const { vectorStoreId, camperContext } = req.body;

    if (!vectorStoreId) {
      return res.status(400).json({ error: 'Missing vectorStoreId' });
    }

    // Build prompt based on whether we have camper context or not
    let questionPrompt = '';

    if (camperContext && camperContext.trim()) {
      questionPrompt = `Based on the camp documentation and the following camper information:

${camperContext}

Generate exactly 3 helpful questions that a parent would likely want to ask about their camper(s)' specific camp experience. Make the questions:
- Personalized using the campers' first names naturally
- Relevant to their specific sessions and age groups
- Practical and commonly asked by parents
- Conversational and natural-sounding

Return ONLY a valid JSON object with this exact structure:
{
  "questions": [
    "What should Alex pack for Session 1?",
    "What activities are available for Junior campers?",
    "When are visiting days during Session 1?"
  ]
}`;
    } else {
      questionPrompt = `Based on the camp documentation, generate exactly 3 helpful questions that parents commonly ask about camp. Make the questions:
- General and applicable to most parents
- Practical and informative
- Conversational and natural-sounding

Return ONLY a valid JSON object with this exact structure:
{
  "questions": [
    "What should my camper pack?",
    "What is the typical daily schedule?",
    "How can I communicate with my camper?"
  ]
}`;
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        input: questionPrompt,
        instructions: 'You are a helpful assistant that generates suggested questions for parents. Always return valid JSON only, with no additional text or explanation.',
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
    let questionsText = '';
    if (data.output && data.output.length > 0) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const contentItem of item.content) {
            if (contentItem.type === 'output_text' && contentItem.text) {
              questionsText += contentItem.text;
            }
          }
        }
      }
    }

    // Parse the JSON response
    try {
      const questionsData = JSON.parse(questionsText.trim());
      return res.status(200).json(questionsData);
    } catch (parseError) {
      console.error('Failed to parse questions JSON:', questionsText);
      // Return default questions if parsing fails
      return res.status(200).json({
        questions: [
          "What should my camper pack?",
          "What is the typical daily schedule?",
          "How can I communicate with my camper?"
        ]
      });
    }

  } catch (error) {
    console.error('Suggest questions API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
