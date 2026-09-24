module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { rating, business } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key is missing in Vercel settings.' });
  }

  try {
    const prompt = `Write a realistic, 1-2 sentence Google review for ${business?.name || 'the business'}. The customer gave it ${rating} out of 5 stars. Keep it natural, focus on wholesale/B2B services, gifts, or decorations, and do not use hashtags.`;

    // FIX: This now uses the universally supported 'gemini-pro' model
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
       throw new Error(data.error?.message || 'Gemini API Error');
    }

    const reviewText = data.candidates[0].content.parts[0].text.trim();
    return res.status(200).json([reviewText]);

  } catch (error) {
    console.error('Backend Error:', error.message);
    return res.status(500).json({ error: 'Failed to generate review.' });
  }
};
