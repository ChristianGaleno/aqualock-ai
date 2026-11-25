// Isi teks bagian 1–8 dan naskah tur 2 menit Si Aqua
// (maskot hybrid: muka lele berkumis + badan udang bersegmen + buntut ikan)
// yang beradaptasi otomatis dengan mode komoditas aktif (default: Udang).
import { KOMODITAS_DEFAULT, ambilProfilKomoditas } from '../sim/constants.js';

const fmt = (v, d = 1) => v.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });

export function buatBagian(profil = ambilProfilKomoditas(KOMODITAS_DEFAULT)) {
  const n = profil.nama;
  const nl = n.toLowerCase();
  const A = profil.ambang;
  return [
    { no: 1, label: 'Ringkasan', kamera: 'overview', teks: `Halo, aku Si Aqua! Mode aktif: ${n} (${profil.ringkas}, simulasi). Klik kolam mana pun atau ganti komoditas di bilah atas.` },
    { no: 2, label: 'Sensor node', kamera: 'node1', teks: `Tiap kolam ${nl} punya Sensor Node ESP32. TDS dibaca dulu, probe-nya dimatikan lewat MOSFET, baru pH dibaca agar bebas ground loop.` },
    { no: 3, label: 'AI & porsi', kamera: 'gateway', teks: `Model XGBoost di Master Gateway menaksir risiko amonia (NH₃) tiap 30 detik dan mengatur porsi pakan ${nl} (lock ≥ ${fmt(A.RISIKO_LOCK, 2)}) agar bebas overfeeding.` },
    { no: 4, label: 'Safety interlock', kamera: 'feeder2', teks: `Saat air berbahaya bagi ${nl} atau sistem sedang booting mode baru, pakan dikunci di tiga lapis: MPU, STM32, dan ESP32. Tombol manual pun ditolak.` },
    { no: 5, label: 'FSM & aktuator', kamera: 'kolam3', teks: `FSM pakai patokan ${n} (pH ${fmt(A.PH_MIN)}–${fmt(A.PH_MAX)}, TDS > ${A.TDS_MAX} ppm): NORMAL, CLEANING (kuras dasar), atau PH_RECOVERY (dosing bertahap).` },
    { no: 6, label: 'Limbah POC', kamera: 'tangki', teks: `Sisa pakan dan lumpur dasar kolam ${nl} tidak dibuang ke selokan, melainkan ditampung ke tangki untuk diolah menjadi pupuk organik cair (POC).` },
    { no: 7, label: 'Uji & dampak', kamera: 'overview', teks: `Uji skenario hujan, overfeeding ${nl}, atau node mati, lalu bandingkan dengan kolam kembar (simulasi) yang masih memakai timer pakan biasa.` },
    { no: 8, label: 'Kalibrasi', kamera: 'node4', teks: 'Kalibrasi probe pH dan TDS cukup lewat tombol terpandu tanpa edit kode. Hasilnya tersimpan otomatis di calibration.json.' },
  ];
}

// aksi(ctx): ctx = { sim, pilihKolam, tekanFisik }
export function buatTur(profil = ambilProfilKomoditas(KOMODITAS_DEFAULT)) {
  const n = profil.nama;
  const nl = n.toLowerCase();
  const A = profil.ambang;
  return [
    {
      bagian: 1, kamera: 'overview', kecepatan: 600, durasi: 11,
      judul: 'Halo, aku Si Aqua!',
      teks: `Aku maskot hybrid AQUA-LOCK—muka lele berkumis, badan udang bersegmen, buntut ikan! Sekarang mode utama ${n} aktif di 4 kolam bundar Ø3 m (simulasi). ${profil.narasiFokus}`,
    },
    {
      bagian: 2, kamera: 'node1', kecepatan: 60, durasi: 12,
      judul: 'Sensor Node ESP32',
      teks: `Tiap kolam ${nl} punya node sendiri. Ia menyalakan probe TDS lewat MOSFET, membacanya, memutus daya probe TDS, baru membaca pH dan suhu agar data kualitas air akurat.`,
      aksi: ({ pilihKolam }) => pilihKolam(1),
    },
    {
      bagian: 3, kamera: 'gateway', kecepatan: 60, durasi: 12,
      judul: 'Otak AI di Master Gateway',
      teks: `Data dikirim via MQTT lokal tiap 30 detik. Model XGBoost di Arduino Uno Q menaksir risiko NH₃ dan mengatur porsi pakan ${nl} 100%, 50% (suhu < ${A.SUHU_DINGIN} °C / risiko ≥ ${fmt(A.RISIKO_KURANG, 2)}), atau 0%.`,
    },
    {
      bagian: 5, kamera: 'drain', kecepatan: 20, durasi: 11,
      judul: 'Awas, overfeeding!',
      teks: `Saat 3 kg pakan ${nl} ditabur berlebih di Kolam 2, sisa pakan mengendap jadi limbah dasar dan TDS melewati patokan ${A.TDS_MAX} ppm. FSM masuk CLEANING dan menguras lumpur dasar lewat bottom drain.`,
      aksi: ({ sim, pilihKolam }) => { pilihKolam(2); sim.skenario('pakanBerlebih', 2); },
    },
    {
      bagian: 6, kamera: 'tangki', kecepatan: 20, durasi: 10,
      judul: 'Limbah dasar jadi pupuk cair (POC)',
      teks: `Kuras dibatasi maksimal 15% volume agar ${nl} tidak stres. Lumpur kaya organik dialirkan ke tangki POC untuk pemulihan pupuk cair—bukan ke selokan—lalu air bersih mengisi ulang kolam.`,
    },
    {
      bagian: 4, kamera: 'feeder2', kecepatan: 20, durasi: 11,
      judul: 'Uji Safety Interlock pakan',
      teks: 'Aku tekan tombol Manual Feed di Kolam 2 saat CLEANING… langsung ditolak! Servo terkunci, buzzer berbunyi, dan OLED menampilkan alasannya dalam hitungan milidetik agar amonia tidak melonjak.',
      aksi: ({ pilihKolam, tekanFisik }) => { pilihKolam(2); setTimeout(() => tekanFisik(2), 900); },
    },
    {
      bagian: 5, kamera: 'overview', kecepatan: 600, durasi: 14,
      judul: 'Hujan deras & pemulihan pH',
      teks: `Hujan menurunkan pH seluruh kolam ${nl}. Saat pH < ${fmt(A.PH_MIN)} (patokan simulasi ${n}), FSM masuk PH_RECOVERY, mengunci pakan, lalu menakar pompa pH-Up maks 4 detik + homogenisasi 10 menit agar ${nl} bebas pH shock.`,
      aksi: ({ sim }) => sim.skenario('hujan', 1),
    },
    {
      bagian: 7, kamera: 'overview', kecepatan: 600, durasi: 11,
      judul: 'Bandingkan dengan cara lama',
      teks: `Tiap kolam ${nl} punya kembaran (skenario simulasi) yang memakai timer pakan biasa & buang air ke selokan. Lihat tabel dampak: pakan terbuang, paparan NH₃, dan limbah yang diselamatkan ke tangki POC.`,
    },
    {
      bagian: 1, kamera: 'overview', kecepatan: 60, durasi: 10,
      judul: 'Coba ganti komoditas juga!',
      teks: 'Buntut ikanku, badan udangku, dan kumis leleku mewakili mode multi-komoditas! Coba ganti komoditas di bilah atas (dengan jeda booting 30 dtk + tombol Skip) atau chat Si Aqua Bot di kanan bawah.',
    },
  ];
}

export const BAGIAN = buatBagian();
export const TUR = buatTur();

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
