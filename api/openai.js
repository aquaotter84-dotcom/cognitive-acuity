// Serverless handler: POST { prompt, model?, max_tokens? }
// Expects OPENAI_API_KEY in environment (do NOT commit the key).
// Compatible with Vercel/Netlify/Base44 function conventions that call the default export.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, model = 'gpt-4o-mini', max_tokens = 512 } = req.body ?? {};
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Missing or invalid prompt' });
    }

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      console.error('Missing OPENAI_API_KEY in environment');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    // TODO: Insert rate-limiting, authentication, and input sanitization here.

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('OpenAI error', data);
      return res.status(resp.status).json({ error: data });
    }

    const output = data?.choices?.[0]?.message?.content ?? null;
    // Consider redacting or aggregating sensitive content before returning.
    return res.status(200).json({ output, raw: data });
  } catch (err) {
    console.error('Proxy error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
