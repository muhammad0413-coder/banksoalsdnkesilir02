export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ 
      success: false, 
      error: 'GEMINI_API_KEY tidak ditemukan di environment variable Vercel.' 
    });
  }

  const {
    sekolah,
    pendidik,
    tahunAjaran,
    semester,
    jenjang,
    kelas,
    subject,
    topic,
    subTopic,
    cp,
    referensi,
    jenisAsesmen,
    jumlahSoal,
    alokasiWaktu,
    kesulitan,
    bentukSoal,
    levelKognitif
  } = req.body;

  const promptText = `
Anda adalah seorang pakar pembuat soal dan penyusun kurikulum asesmen sekolah profesional.
Buatkan naskah soal asesmen lengkap beserta KUNCI JAWABAN dan PEDOMAN PENSKORAN berdasarkan spesifikasi berikut:

- Sekolah / Institusi: ${sekolah || 'SDN KESILIR 02 LABS'}
- Nama Pendidik: ${pendidik || '-'}
- Tahun Ajaran / Semester: ${tahunAjaran || '2026/2027'} / ${semester || 'Ganjil'}
- Jenjang / Kelas: ${jenjang || 'SD/MI'} / Kelas ${kelas || '4'}
- Mata Pelajaran: ${subject || 'Umum'}
- Materi Pokok / Bab: ${topic || 'Umum'} ${subTopic ? `(Sub Bab: \${subTopic})` : ''}
- Capaian Pembelajaran (CP): ${cp || 'Auto-generate sesuai materi'}
- Referensi Teks Materi: ${referensi || 'Tidak ada'}

SPESIFIKASI EVALUASI:
- Jenis Asesmen: ${jenisAsesmen || 'Sumatif'}
- Jumlah Soal Total: ${jumlahSoal || 10}
- Alokasi Waktu: ${alokasiWaktu || '90 Menit'}
- Tingkat Kesulitan: ${kesulitan || 'Campuran'}
- Variasi Bentuk Soal: ${Array.isArray(bentukSoal) ? bentukSoal.join(', ') : (bentukSoal || 'Pilihan Ganda')}
- Target Level Kognitif Bloom: ${Array.isArray(levelKognitif) ? levelKognitif.join(', ') : (levelKognitif || 'C2, C3')}

PETUNJUK FORMAT OUTPUT:
1. Awali dengan KOP SOAL resmi sekolah.
2. Tuliskan Petunjuk Umum pengerjaan soal.
3. Kelompokkan soal berdasarkan bentuk soalnya dengan penomoran yang rapi.
4. Sertakan KUNCI JAWABAN LENGKAP dan PEDOMAN PENSKORAN di bagian paling akhir.
`;

  // Daftar model yang akan dicoba secara berurutan jika terjadi error antrean tinggi
  const candidateModels = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ];

  let lastErrorMessage = '';

  for (const modelName of candidateModels) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: promptText }]
            }
          ]
        })
      });

      const data = await response.json();

      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return res.status(200).json({
          success: true,
          data: data.candidates[0].content.parts[0].text
        });
      }

      lastErrorMessage = data.error?.message || `Gagal memproses dengan ${modelName}`;
    } catch (err) {
      lastErrorMessage = err.message;
    }
  }

  return res.status(503).json({
    success: false,
    error: `Server Google AI sedang mengalami beban lalu lintas tinggi pada semua jalur. Silakan klik tombol Generate kembali dalam beberapa detik. (Detail: ${lastErrorMessage})`
  });
}
