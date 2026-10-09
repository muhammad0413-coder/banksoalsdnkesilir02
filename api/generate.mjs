export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode HTTP tidak diizinkan. Gunakan POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY tidak ditemukan di environment variable Vercel.'
    });
  }

  const formData = req.body || {};

  // Batasi dan validasi input
  const {
    judul = 'Asesmen Tanpa Judul',
    jenjang = 'SD',
    kelas = '4',
    mapel = 'Bahasa Indonesia',
    materi = 'Teks Narasi',
    submateri = '',
    capaian = '',
    tujuan = '',
    jenis = 'Sumatif',
    bentukSoal = ['Pilihan Ganda'],
    jumlahSoal = 5,
    kesulitan = 'Sedang',
    levelKognitif = 'C3',
    stimulus = false,
    pembahasan = true,
    rubrik = false
  } = formData;

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const systemPrompt = `Anda adalah pakar pembuat asesmen pendidikan dan penyusun soal kurikulum merdeka profesional di Indonesia.
Tugas Anda adalah menghasilkan Naskah Soal, Kisi-Kisi, Kunci Jawaban, Pembahasan, dan Pedoman Penskoran lengkap berdasarkan spesifikasi input.

HARUS MENGHASILKAN OUTPUT HANYA DALAM FORMAT JSON STERIL TANPA MARKDOWN TAGS SEPERTI \`\`\`json ATAU \`\`\`.

Struktur JSON yang WAJIB dipatuhi:
{
  "title": "${judul}",
  "meta": {
    "jenjang": "${jenjang}",
    "kelas": "${kelas}",
    "mapel": "${mapel}",
    "materi": "${materi}",
    "jenis": "${jenis}",
    "jumlahSoal": ${jumlahSoal}
  },
  "questions": [
    {
      "id": 1,
      "number": 1,
      "type": "Pilihan Ganda | Pilihan Ganda Kompleks | Benar/Salah | Isian Singkat | Uraian | Menjodohkan",
      "materi": "Materi spesifik",
      "tujuan": "Tujuan Pembelajaran",
      "indikator": "Indikator Soal",
      "cognitiveLevel": "C1 - C6",
      "difficulty": "Mudah | Sedang | Sulit",
      "stimulus": "Teks stimulus/bacaan/studi kasus (jika ada, atau null)",
      "question": "Kalimat pertanyaan yang jelas dan tidak ambigu",
      "options": ["A. pilihan 1", "B. pilihan 2", "C. pilihan 3", "D. pilihan 4"], // Untuk PG/PG Kompleks, isi null jika Uraian/Isian
      "correctAnswer": "A / Kunci Jawaban Lengkap",
      "explanation": "Pembahasan rinci dan rasional jawaban",
      "score": 10,
      "rubric": "Pedoman penskoran/kriteria penilaian jika uraian"
    }
  ]
}`;

  const userPrompt = `Buatkan ${jumlahSoal} butir soal asesmen untuk:
- Sekolah/Jenjang: ${jenjang} (Kelas ${kelas})
- Mata Pelajaran: ${mapel}
- Materi Pokok: ${materi} ${submateri ? `(${submateri})` : ''}
- Capaian Pembelajaran: ${capaian || 'Sesuai Kurikulum'}
- Tujuan Pembelajaran: ${tujuan || 'Sesuai Capaian Materi'}
- Jenis Asesmen: ${jenis}
- Bentuk Soal yang Diminta: ${Array.isArray(bentukSoal) ? bentukSoal.join(', ') : bentukSoal}
- Tingkat Kesulitan: ${kesulitan}
- Level Kognitif Utama: ${levelKognitif}
- Sertakan Stimulus Teks: ${stimulus ? 'Ya' : 'Tidak'}
- Sertakan Pembahasan: ${pembahasan ? 'Ya' : 'Tidak'}
- Sertakan Rubrik: ${rubrik ? 'Ya' : 'Tidak'}

Pastikan seluruh pertanyaan bermutu tinggi, tidak ambigu, menggunakan Bahasa Indonesia baku sesuai PUEBI/EYD, dan ramah peserta didik kelas ${kelas} ${jenjang}.`;

  try {
    // Panggil Gemini REST API dengan fallback model jika diperlukan
    let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json'
        }
      })
    });

    // Fallback ke model gemini-1.5-flash jika gemini-2.5-flash bermasalah
    if (!response.ok && model !== 'gemini-1.5-flash') {
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
            }
          ],
          generationConfig: {
            temperature: 0.4
          }
        })
      });
    }

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.error?.message || `Gemini API Error (HTTP ${response.status})`);
    }

    const data = await response.json();
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Bersihkan tag markdown ```json jika Gemini tidak sengaja menyertakannya
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsedResult;
    try {
      parsedResult = JSON.parse(rawText);
    } catch (parseErr) {
      // Upaya perbaikan JSON darurat
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        parsedResult = JSON.parse(match[0]);
      } else {
        throw new Error('Gagal menguraikan struktur JSON dari respon AI. Silakan coba lagi.');
      }
    }

    return res.status(200).json({
      success: true,
      data: parsedResult
    });

  } catch (err) {
    console.error('Error generating questions:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Terjadi kesalahan internal server saat memproses soal.'
    });
  }
}
