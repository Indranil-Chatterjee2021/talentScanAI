import type { VercelRequest, VercelResponse } from '@vercel/node';
import { upsertCandidates, updateRecommendation, searchCandidates } from '../backend/candidateStore';
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

  try {
    if (req.method === 'GET') {
      const query = typeof req.query.q === 'string' ? req.query.q : '';
      const candidateId = typeof req.query.candidateId === 'string' ? req.query.candidateId : '';
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 25;
      const data = await searchCandidates({ query, candidateId, limit }, connOpts);
      res.status(200).json({ data });
      return;
    }

    if (req.method === 'POST') {
      const payload = req.body?.candidates || req.body?.candidate || req.body;
      const data = await upsertCandidates(payload, connOpts);
      res.status(200).json({ data });
      return;
    }

    if (req.method === 'PATCH') {
      const candidateId: string = req.body?.candidateId;
      const recommendation: string = req.body?.recommendation;
      if (!candidateId || !recommendation) {
        res.status(400).json({ error: 'candidateId and recommendation are required' });
        return;
      }
      const data = await updateRecommendation(candidateId, recommendation, connOpts);
      res.status(200).json({ data });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Unexpected error' });
  }
}
