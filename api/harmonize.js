// Vercel Serverless Function — proxies image harmonization requests to Replicate.
// The REPLICATE_API_TOKEN env var MUST be set in your Vercel project settings.

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

const MODEL = 'google/nano-banana';

// The prompt is deliberately surgical: we give it ONE job (photometric blending
// of the printed area) and explicitly list everything that must NOT change.
// Based on early testing, Nano Banana tends to "tidy up" garments it sees —
// removing drawstrings, pocket lines, tags — unless told not to.
const DEFAULT_PROMPT = [
  "Make the printed design on this garment look like a real screen or DTG print on the fabric.",
  "Only adjust the design's appearance so it follows the garment's existing lighting, shadows, fabric folds, wrinkles, and surface texture.",
  "",
  "STRICT PRESERVATION RULES — do not change any of the following:",
  "- Do NOT move, resize, rotate, reposition, or recolor the printed design.",
  "- Do NOT redesign, redraw, simplify, or alter the design's shape, text, or colors.",
  "- Do NOT remove or modify ANY part of the garment, including but not limited to: drawstrings, laces, cords, hood, hood opening, collar, ribbing, cuffs, pockets, kangaroo pocket, pocket openings, zippers, buttons, seams, stitching, hem, neck tag, brand label, care label, wrinkles, creases, shadows on the fabric.",
  "- Do NOT change the garment's color, material, fit, or silhouette.",
  "- Do NOT change the background or anything outside the garment.",
  "",
  "Your ONLY task is photometric harmonization of the printed design area:",
  "subtly adapt its lighting, micro-shadows and fabric-texture integration so it looks printed ON the fabric rather than pasted on top.",
  "Treat everything else as read-only.",
].join('\n');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(500).json({
      error: 'Server misconfigured: REPLICATE_API_TOKEN is not set. ' +
             'Add it in Vercel → Project Settings → Environment Variables.',
    });
  }

  try {
    const { compositeImage, prompt } = req.body || {};
    if (!compositeImage || typeof compositeImage !== 'string') {
      return res.status(400).json({ error: 'compositeImage (data URL) is required' });
    }

    const replicateRes = await fetch('https://api.replicate.com/v1/models/' + MODEL + '/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=55',
      },
      body: JSON.stringify({
        input: {
          prompt: prompt || DEFAULT_PROMPT,
          image_input: [compositeImage],
          output_format: 'png',
        },
      }),
    });

    const data = await replicateRes.json();

    if (!replicateRes.ok) {
      return res.status(replicateRes.status).json({
        error: data.detail || data.error || 'Replicate API error',
        raw: data,
      });
    }

    if (data.status === 'succeeded' && data.output) {
      const outputUrl = Array.isArray(data.output) ? data.output[0] : data.output;
      return res.status(200).json({ outputUrl, predictionId: data.id });
    }

    if (data.status === 'starting' || data.status === 'processing') {
      return res.status(202).json({
        status: data.status,
        predictionId: data.id,
        pollUrl: `/api/poll?id=${data.id}`,
      });
    }

    return res.status(500).json({
      error: data.error || `Prediction ${data.status}`,
      status: data.status,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
