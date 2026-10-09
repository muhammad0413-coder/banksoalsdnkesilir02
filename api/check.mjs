export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode HTTP tidak diizinkan.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi.' });
  }

  const { questions = [], mapel = 'Umum', kelas = 'SD' } = req.body || {};

  if (!questions || questions.length === 0) {
    return res.status(400).json({ error: 'Tidak ada data soal untuk diperiksa.' });
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const apiUrl = `[https://generativelanguage.googleapis.com/v1beta/models/$](https://generativelanguage.googleapis.com/v1beta/models/$){model}:generateContent?key=${apiKey}`;

  const prompt = `Anda adalah pakar evaluasi asesmen pendidikan. Analisis draf naskah soal berikut:
Mata Pelajaran: ${mapel}, Jenjang: ${kelas}
Data Soal: ${JSON.stringify(questions)}

Berikan audit dalam format JSON steril berikut:
{
  "overallScore": 85,
  "summary": "Ringkasan kualitas asesmen",
  "strengths": ["Kelebihan 1", "Kelebihan 2"],
  "weaknesses": ["Kekurangan 1", "Kekurangan 2"],
  "itemAudits": [
    {
      "number": 1,
      "status": "Baik | Perlu Perbaikan | Ambigu",
      "note": "Catatan khusus atau saran perbaikan untuk nomor ini"
    }
  ],
  "recommendations": ["Rekomendasi 1", "Rekomendasi 2"]
}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Gagal memeriksa soal melalui AI.');
    }

    const data = await response.json();
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    return res.status(200).json({
      success: true,
      audit: JSON.parse(rawText)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
