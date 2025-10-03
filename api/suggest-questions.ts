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
      questionPrompt = `You are helping generate suggested questions for a parent chatbot. Your task is to analyze the camp documentation and suggest questions that can be FULLY ANSWERED using the available content.

Parent's camper(s):
${camperContext}

IMPORTANT:
1. First, identify what topics are actually covered in the camp documentation
2. Generate exactly 3 questions about those well-documented topics
3. Try to personalize questions with camper names, sessions, or age groups when it naturally fits the documented content
4. DO NOT suggest questions about topics that aren't thoroughly covered in the documentation
5. Prioritize questions about the most detailed/comprehensive topics in the documentation

Make the questions:
- Answerable from the available documentation
- Personalized when possible (using camper names/sessions/age groups)
- Practical and commonly asked by parents
- Conversational and natural-sounding

Return ONLY a valid JSON object with this exact structure:
{
  "questions": [
    "What activities are available for Junior campers?",
    "When are visiting days during Alex's Session 1?",
    "What is the daily schedule at camp?"
  ]
}`;
    } else {
      questionPrompt = `You are helping generate suggested questions for a parent chatbot. Your task is to analyze the camp documentation and suggest questions that can be FULLY ANSWERED using the available content.

IMPORTANT:
1. First, identify what topics are actually covered in the camp documentation
2. Generate exactly 3 questions about those well-documented topics
3. DO NOT suggest questions about topics that aren't thoroughly covered in the documentation
4. Prioritize questions about the most detailed/comprehensive topics in the documentation

Make the questions:
- Answerable from the available documentation
- Practical and commonly asked by parents
- Conversational and natural-sounding

Return ONLY a valid JSON object with this exact structure:
{
  "questions": [
    "What activities are available at camp?",
    "What is the typical daily schedule?",
    "When are visiting days?"
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
        instructions: 'You are a helpful assistant that generates suggested questions for parents. Base your questions ONLY on the information retrieved from file_search. Always return valid JSON only, with no additional text or explanation.',
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
