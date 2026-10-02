/**
 * Vercel Serverless Function — /api/generate-review
 * Proxies review generation requests to Google Gemini API.
 * Keeps the API key server-side via process.env.GEMINI_API_KEY.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-3.5-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export default async function handler(req, res) {
  // ── CORS headers ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Validate environment ──
  if (!GEMINI_API_KEY) {
    console.error('[generate-review] GEMINI_API_KEY is not set in environment.');
    return res.status(500).json({ error: 'Server misconfiguration — API key not set.' });
  }

  // ── Validate request body ──
  const { rating, businessName, businessType, keywords } = req.body || {};

  if (!rating || !businessName || !businessType) {
    return res.status(400).json({
      error: 'Missing required fields: rating, businessName, businessType'
    });
  }

  const clampedRating = Math.max(3, Math.min(5, parseInt(rating, 10)));
  if (isNaN(clampedRating)) {
    return res.status(400).json({ error: 'Invalid rating value' });
  }

  // ── Build Gemini prompt ──
  const keywordsClause = keywords
    ? ` Incorporate some of these aspects naturally: ${keywords}.`
    : '';

  const prompt = `You are a real customer writing a Google review. Write 5 completely unique ${clampedRating}-star Google reviews for "${businessName}", a ${businessType}.${keywordsClause}

Rules:
- Each review MUST be different in wording, structure, and focus — no two should sound alike.
- Keep each review 1-2 short sentences, casual and human-sounding.
- No hashtags, no emojis, no quotation marks, no exclamation marks at the start.
- Vary the tone: some grateful, some matter-of-fact, some enthusiastic.
- Return ONLY a valid JSON array of exactly 5 strings, nothing else.`;

  const geminiBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 1.0,
      maxOutputTokens: 2048
    }
  };

  // ── Call Gemini API ──
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error(`[generate-review] Gemini API returned ${response.status}:`, errData);
      return res.status(502).json({
        error: `Gemini API error (${response.status})`,
        details: errData?.error?.message || 'Unknown error'
      });
    }

    const data = await response.json();

    // Extract text from Gemini response
    const textContent = data?.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
    if (!textContent) {
      console.error('[generate-review] Unexpected Gemini response structure:', JSON.stringify(data));
      return res.status(502).json({ error: 'Unexpected response from Gemini API' });
    }

    // Parse and validate the JSON array
    const reviews = JSON.parse(textContent);

    if (!Array.isArray(reviews) || reviews.length === 0) {
      return res.status(502).json({ error: 'Gemini returned invalid review format' });
    }

    const validReviews = reviews.filter(r => typeof r === 'string' && r.trim().length > 0);
    if (validReviews.length === 0) {
      return res.status(502).json({ error: 'All generated reviews were empty' });
    }

    console.log(`[generate-review] ✓ Generated ${validReviews.length} reviews for ${clampedRating}★`);
    return res.status(200).json({ reviews: validReviews });

  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[generate-review] Gemini API timed out.');
      return res.status(504).json({ error: 'Gemini API timed out' });
    }
    console.error('[generate-review] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
