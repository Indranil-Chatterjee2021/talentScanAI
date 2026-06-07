import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getReportSummary } from '../backend/candidateStore';
import type { ConnOpts } from '../backend/dbStore';

function getConnOpts(req: VercelRequest): ConnOpts | undefined {
  const uri = req.headers['x-mongo-uri'] as string | undefined;
  const dbName = process.env.MONGODB_DB_NAME;
  if (uri && dbName) return { uri, dbName };
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const connOpts = getConnOpts(req);
  if (!connOpts) {
    res.status(400).json({ error: 'MongoDB not configured. Please enter your MongoDB URI in Settings.' });
    return;
  }

  try {
    const data = await getReportSummary(connOpts);
    res.status(200).json({ data });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Unexpected error' });
  }
}
