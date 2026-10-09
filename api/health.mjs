export default async function handler(req, res) {
  // Buka CORS untuk domain frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(200).json({
      status: 'ok',
      aiStatus: 'not_configured',
      message: 'GEMINI_API_KEY belum dikonfigurasi pada Environment Variables Vercel.'
    });
  }

  try {
    // Tes koneksi ringan ke Gemini API
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const testResponse = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: "Ping test. Respond with OK." }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 10
        }
      })
    });

    if (testResponse.ok) {
      return res.status(200).json({
        status: 'ok',
        aiStatus: 'connected',
        model: model,
        message: 'AI Terhubung dan Siap Digunakan.'
      });
    } else {
      const errData = await testResponse.json().catch(() => ({}));
      return res.status(200).json({
        status: 'ok',
        aiStatus: 'error',
        message: errData.error?.message || `Gagal terhubung ke Gemini API (${testResponse.status})`
      });
    }
  } catch (error) {
    return res.status(200).json({
      status: 'ok',
      aiStatus: 'error',
      message: 'Gangguan koneksi backend ke layanan AI: ' + error.message
    });
  }
}
