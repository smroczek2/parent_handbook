import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const { userMessage, vectorStoreId, instructions } = req.body;

    if (!userMessage || !vectorStoreId || !instructions) {
        return res.status(400).json({ error: 'Missing required fields: userMessage, vectorStoreId, instructions' });
    }

    try {
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-5-mini',
                input: userMessage,
                instructions: instructions,
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
            return res.status(response.status).json({
                error: `OpenAI API error: ${response.status}`
            });
        }

        // Set headers for SSE streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');

        // Pipe the OpenAI stream directly to the response
        if (response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    res.write(chunk);
                }
            } catch (error) {
                console.error('Streaming error:', error);
            } finally {
                res.end();
            }
        } else {
            res.status(500).json({ error: 'No response body from OpenAI' });
        }

    } catch (error) {
        console.error('Error in chat endpoint:', error);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Failed to process chat request' });
        }
    }
}
