// Polls a Replicate prediction by ID. Used if the initial harmonize call
// returned 202 (still processing) so the frontend can check status.

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return res.status(500).json({ error: 'REPLICATE_API_TOKEN not set' });

  const id = req.query?.id;
  if (!id) return res.status(400).json({ error: 'id query param required' });

  try {
    const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.detail || 'poll failed' });

    if (data.status === 'succeeded' && data.output) {
      const outputUrl = Array.isArray(data.output) ? data.output[0] : data.output;
      return res.status(200).json({ status: 'succeeded', outputUrl });
    }
    if (data.status === 'failed' || data.status === 'canceled') {
      return res.status(500).json({ status: data.status, error: data.error });
    }
    return res.status(202).json({ status: data.status });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
