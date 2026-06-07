import express, { Request, Response } from 'express';
import { upsertCandidates, updateRecommendation, searchCandidates, getReportSummary } from './candidateStore';
import { getSettings, saveSettings } from './settingsStore';
import { AiRequestBody, ApiSettings } from './interfaces';

const app = express();
app.use(express.json({ limit: '10mb' }));
const PORT = process.env.SERVER_PORT || 3001;

console.log('[server] Multi-provider AI proxy ready (Anthropic + Gemini)');

app.get('/api/candidates', async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const candidateId = typeof req.query.candidateId === 'string' ? req.query.candidateId : '';
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 25;
    const data = await searchCandidates({ query, candidateId, limit });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Failed to search candidates' });
  }
});

app.post('/api/candidates', async (req: Request, res: Response) => {
  try {
    const payload = req.body?.candidates || req.body?.candidate || req.body;
    const data = await upsertCandidates(payload);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Failed to upsert candidates' });
  }
});

app.patch('/api/candidates', async (req: Request, res: Response) => {
  try {
    const candidateId: string = req.body?.candidateId;
    const recommendation: string = req.body?.recommendation;
    if (!candidateId || !recommendation) {
      res.status(400).json({ error: 'candidateId and recommendation are required' });
      return;
    }
    const data = await updateRecommendation(candidateId, recommendation);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Failed to update recommendation' });
  }
});

app.get('/api/settings', async (_req: Request, res: Response) => {
  try {
    const data = await getSettings();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Failed to load settings' });
  }
});

app.post('/api/settings', async (req: Request, res: Response) => {
  try {
    const { ai_configured, ai_provider, ai_model, ai_api_key } = req.body || {};
    await saveSettings({ ai_configured, ai_provider, ai_model, ai_api_key });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Failed to save settings' });
  }
});

app.get('/api/reports', async (_req: Request, res: Response) => {
  try {
    const data = await getReportSummary();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Failed to load report summary' });
  }
});

app.post('/api/ai', async (req: Request<object, object, AiRequestBody>, res: Response) => {
  const { system, user, provider = 'anthropic', apiKey, model, maxTokens } = req.body;

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
    res.status(503).json({ error: 'No API key provided. Paste your key in the app settings.' });
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
      console.log('[DEBUG] Anthropic API Response Usage:', JSON.stringify(data.usage, null, 2));
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
      const promptTokens = data.usageMetadata?.promptTokenCount || 0;
      const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;

      res.json({
        content: text,
        usage: { input_tokens: promptTokens, output_tokens: outputTokens, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      });

    } else {
      res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }
  } catch (err) {
    console.error(`[server] ${provider} error:`, (err as Error).message);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`[server] Proxy listening on http://localhost:${PORT}`);
});
