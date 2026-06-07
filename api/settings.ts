import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSettings, saveSettings } from '../backend/settingsStore';
import type { ConnOpts } from '../backend/dbStore';

function getConnOpts(req: VercelRequest): ConnOpts | undefined {
  const uri = req.headers['x-mongo-uri'] as string | undefined;
  const dbName = process.env.MONGODB_DB_NAME;
  if (uri && dbName) return { uri, dbName };
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const connOpts = getConnOpts(req);
  if (!connOpts) {
    res.status(400).json({ error: 'MongoDB not configured. Please enter your MongoDB URI in Settings.' });
    return;
  }

  if (req.method === 'GET') {
    try {
      const data = await getSettings(connOpts);
      res.status(200).json({ data });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message || 'Failed to load settings' });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const { ai_configured, ai_provider, ai_model, ai_api_key } = req.body || {};
      await saveSettings({ ai_configured, ai_provider, ai_model, ai_api_key }, connOpts);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message || 'Failed to save settings' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
