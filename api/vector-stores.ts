import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    try {
        const response = await fetch('https://api.openai.com/v1/vector_stores', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API error:', response.status, errorText);
            return res.status(response.status).json({
                error: `OpenAI API error: ${response.status}`
            });
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error('Error fetching vector stores:', error);
        return res.status(500).json({ error: 'Failed to fetch vector stores' });
    }
}
