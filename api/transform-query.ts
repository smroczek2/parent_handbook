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
    const { question, conversationHistory } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Missing question' });
    }

    // Build context from conversation history if provided
    let historyContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      // Take last 3 exchanges for context (6 messages total)
      const recentHistory = conversationHistory.slice(-6);
      historyContext = '\n\nConversation History:\n' + recentHistory.join('\n');
    }

    const prompt = `Given the user question${historyContext ? ' and conversation history' : ''}, construct a short string that can be used for searching vector database. Only generate the query, no meta comments, no explanation.

Example:

Question: what are the events happening today?

Query: today's event

Example:

Question: how about the address?

Query: business address of the shop

${historyContext}

Question: ${question}

Query:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.3,
        max_tokens: 50
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return res.status(response.status).json({ error: 'OpenAI API error' });
    }

    const data = await response.json();
    const transformedQuery = data.choices[0].message.content.trim();

    return res.status(200).json({
      originalQuestion: question,
      transformedQuery: transformedQuery
    });

  } catch (error) {
    console.error('Transform query API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
