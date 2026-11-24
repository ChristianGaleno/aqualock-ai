// Isi teks bagian 1–8 dan naskah tur 2 menit Si Nila (ikan nila)
export const BAGIAN = [
  { no: 1, label: 'Ringkasan', kamera: 'overview', teks: 'Ini klaster 4 kolam bioflok. Klik kolam mana pun atau nomor di layar untuk melihat detailnya.' },
  { no: 2, label: 'Sensor node', kamera: 'node1', teks: 'Tiap kolam punya Sensor Node ESP32. TDS dibaca dulu, probe-nya dimatikan lewat MOSFET, baru pH dibaca. Begitu caranya mencegah ground loop.' },
  { no: 3, label: 'AI & porsi', kamera: 'gateway', teks: 'Model XGBoost di Master Gateway menebak risiko amonia tiap 30 detik, tanpa sensor amonia yang mahal.' },
  { no: 4, label: 'Safety interlock', kamera: 'feeder2', teks: 'Saat air berbahaya, pakan dikunci di tiga tempat: MPU, STM32, dan ESP32. Tombol manual pun ditolak.' },
  { no: 5, label: 'FSM & aktuator', kamera: 'kolam3', teks: 'Mesin status memutuskan: NORMAL, CLEANING (kuras dasar), atau PH_RECOVERY (pompa pH).' },
  { no: 6, label: 'Limbah POC', kamera: 'tangki', teks: 'Lumpur dasar tidak dibuang ke selokan. Semuanya masuk tangki untuk diolah jadi pupuk organik cair.' },
  { no: 7, label: 'Uji & dampak', kamera: 'overview', teks: 'Coba skenario hujan, pakan berlebih, atau node mati. Lalu bandingkan dengan kolam kembar yang memakai cara lama.' },
  { no: 8, label: 'Kalibrasi', kamera: 'node4', teks: 'Kalibrasi pH dan TDS cukup dengan menekan tombol, tanpa mengedit kode. Hasilnya tersimpan di calibration.json.' },
];

// aksi(ctx): ctx = { sim, pilihKolam, tekanFisik }
export const TUR = [
  {
    bagian: 1, kamera: 'overview', kecepatan: 600, durasi: 11,
    judul: 'Halo, aku Si Nila!',
    teks: 'Aku ikan nila pemandu klaster AQUA-LOCK. Ada 4 kolam bioflok Ø3 m di sini. Pakan hanya keluar kalau air aman untuk kami.',
  },
  {
    bagian: 2, kamera: 'node1', kecepatan: 60, durasi: 12,
    judul: 'Sensor Node ESP32',
    teks: 'Tiap kolam punya node sendiri. Ia membaca TDS, mematikan probe TDS lewat MOSFET, baru membaca pH dan suhu. Lihat urutannya di panel kanan.',
    aksi: ({ pilihKolam }) => pilihKolam(1),
  },
  {
    bagian: 3, kamera: 'gateway', kecepatan: 60, durasi: 12,
    judul: 'Otak di Master Gateway',
    teks: 'Data dikirim lewat MQTT lokal tiap 30 detik. Model XGBoost di Arduino Uno Q menebak risiko amonia, lalu memutuskan porsi pakan 100%, 50%, atau 0%.',
  },
  {
    bagian: 5, kamera: 'drain', kecepatan: 20, durasi: 10,
    judul: 'Ups, pakan berlebih!',
    teks: 'Pekerja menabur 3 kg pakan ke Kolam 2. TDS melonjak lewat 600 ppm, FSM pindah ke CLEANING dan katup drain mengalirkan lumpur dasar.',
    aksi: ({ sim, pilihKolam }) => { pilihKolam(2); sim.skenario('pakanBerlebih', 2); },
  },
  {
    bagian: 6, kamera: 'tangki', kecepatan: 20, durasi: 9,
    judul: 'Limbah jadi pupuk',
    teks: 'Kuras dibatasi 15% volume dan masuk tangki POC, bukan selokan. Setelah itu air bersih dari tandon mengisi ulang kolam.',
  },
  {
    bagian: 4, kamera: 'feeder2', kecepatan: 20, durasi: 10,
    judul: 'Coba paksa beri makan',
    teks: 'Aku tekan tombol Manual Feed untuk Kolam 2… ditolak! Servo diam, buzzer bunyi, dan OLED menampilkan alasannya dalam hitungan milidetik.',
    aksi: ({ pilihKolam, tekanFisik }) => { pilihKolam(2); setTimeout(() => tekanFisik(2), 900); },
  },
  {
    bagian: 5, kamera: 'overview', kecepatan: 600, durasi: 14,
    judul: 'Hujan deras turun',
    teks: 'Air hujan menurunkan pH semua kolam. Saat pH < 6,5, AI menghitung durasi pompa pH-Up (maks 4 detik), lalu menunggu homogenisasi 10 menit.',
    aksi: ({ sim }) => sim.skenario('hujan', 1),
  },
  {
    bagian: 7, kamera: 'overview', kecepatan: 600, durasi: 11,
    judul: 'Bandingkan dengan cara lama',
    teks: 'Setiap kolam punya kembaran yang memakai timer pakan dan ganti air manual. Lihat tabel dampak: pakan terbuang dan menit amonia beracun.',
  },
  {
    bagian: 1, kamera: 'overview', kecepatan: 60, durasi: 10,
    judul: 'Sekarang giliranmu',
    teks: 'Klik kolam atau nomor di layar untuk menjelajah. Tekan L untuk timelapse 24 jam, H untuk membersihkan layar.',
  },
];

export const TARGET_CARI = [
  { teks: 'Kolam 1', kamera: 'kolam1', kolam: 1, bagian: 2 },
  { teks: 'Kolam 2', kamera: 'kolam2', kolam: 2, bagian: 2 },
  { teks: 'Kolam 3', kamera: 'kolam3', kolam: 3, bagian: 2 },
  { teks: 'Kolam 4', kamera: 'kolam4', kolam: 4, bagian: 2 },
  { teks: 'Tangki POC', kamera: 'tangki', bagian: 6 },
  { teks: 'Master Gateway', kamera: 'gateway', bagian: 3 },
  { teks: 'Node ESP32', kamera: 'node1', bagian: 2 },
  { teks: 'Auto-feeder', kamera: 'feeder1', bagian: 4 },
  { teks: 'Tandon air bersih', kamera: 'tandon', bagian: 5 },
  { teks: 'Pipa drain', kamera: 'drain', bagian: 6 },
];
