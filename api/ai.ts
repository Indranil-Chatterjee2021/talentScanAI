import type { VercelRequest, VercelResponse } from '@vercel/node';

interface AiRequestBody {
  system: string;
  user: string;
  provider?: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { system, user, provider = 'anthropic', apiKey, model, maxTokens } = req.body as AiRequestBody;

  if (!system || !user) {
    res.status(400).json({ error: 'Missing system or user message' });
    return;
  }

  const effectiveKey = apiKey || process.env.REACT_APP_AI_API_KEY;
  const requestedMax = Number(maxTokens);
  const cappedMaxTokens = Number.isFinite(requestedMax)
    ? Math.min(1024, Math.max(128, Math.floor(requestedMax)))
    : 512;

  if (!effectiveKey) {
    res.status(503).json({ error: 'No API key. Paste yours in the app settings.' });
    return;
  }

  try {
    if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': effectiveKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-sonnet-20241022',
          max_tokens: cappedMaxTokens,
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: user }],
        }),
      });

      if (!response.ok) {
        const error = await response.json() as { error?: { message?: string } };
        throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
      }

      const data = await response.json() as {
        content: Array<{ text: string }>;
        usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
      };
      res.json({
        content: data.content[0].text,
        usage: {
          input_tokens: data.usage.input_tokens,
          output_tokens: data.usage.output_tokens,
          cache_read_input_tokens: data.usage.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: data.usage.cache_creation_input_tokens ?? 0,
        },
      });

    } else if (provider === 'gemini') {
      const geminiModel = model || 'gemini-1.5-pro-latest';
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${effectiveKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
            generationConfig: { maxOutputTokens: cappedMaxTokens, temperature: 0.2 },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json() as { error?: { message?: string } };
        throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
      }

      const data = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      res.json({
        content: text,
        usage: {
          input_tokens: data.usageMetadata?.promptTokenCount || 0,
          output_tokens: data.usageMetadata?.candidatesTokenCount || 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      });

    } else {
      res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }
  } catch (err) {
    console.error(`[vercel] ${provider} error:`, (err as Error).message);
    res.status(500).json({ error: (err as Error).message });
  }
}
