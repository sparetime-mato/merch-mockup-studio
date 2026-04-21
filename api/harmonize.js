// Vercel Serverless Function — proxies image harmonization requests to Replicate.
// The REPLICATE_API_TOKEN env var MUST be set in your Vercel project settings.
// This file is deployed automatically when pushed to the repo.

export const config = {
  runtime: 'nodejs',
  maxDuration: 60, // allow up to 60s for AI rendering
};

const MODEL = 'google/nano-banana'; // Gemini 2.5 Flash Image via Replicate

const DEFAULT_PROMPT =
  "Make the logo or design on this garment look like it is naturally and realistically printed on the fabric. " +
  "Match the lighting, shadows, fabric folds, wrinkles, and surface texture of the garment. " +
  "Preserve the logo's exact shape, colors, and position. " +
  "Do not move, resize, or redesign the logo. Do not change the garment itself. " +
  "Only blend the logo photometrically into the fabric so the composite looks like a single real photograph.";

export default async function handler(req, res) {
  // CORS — allow the frontend to call this endpoint.
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

    // Create a prediction on Replicate (synchronous "wait" mode).
    const replicateRes = await fetch('https://api.replicate.com/v1/models/' + MODEL + '/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=55', // wait up to 55s for the prediction to complete
      },
      body: JSON.stringify({
        input: {
          prompt: prompt || DEFAULT_PROMPT,
          image_input: [compositeImage], // Nano Banana accepts data URLs directly
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

    // The response shape: { status, output, ... }
    // When successful and synchronous, output is a URL string (or array of URLs).
    if (data.status === 'succeeded' && data.output) {
      const outputUrl = Array.isArray(data.output) ? data.output[0] : data.output;
      return res.status(200).json({ outputUrl, predictionId: data.id });
    }

    // Still running — return prediction id so frontend can poll.
    if (data.status === 'starting' || data.status === 'processing') {
      return res.status(202).json({
        status: data.status,
        predictionId: data.id,
        pollUrl: `/api/poll?id=${data.id}`,
      });
    }

    // Failed or canceled.
    return res.status(500).json({
      error: data.error || `Prediction ${data.status}`,
      status: data.status,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
