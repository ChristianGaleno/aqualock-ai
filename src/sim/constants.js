// =============================================================
// constants.js — Profil komoditas & ambang batas simulasi
// AQUA-LOCK AI. Default komoditas utama: UDANG, dengan opsi
// berpindah ke Nila, Lele, atau Patin.
// Catatan: seluruh angka patokan adalah ASUMSI SIMULASI.
// =============================================================

export const KOMODITAS_DEFAULT = 'udang';

export const PROFIL_KOMODITAS = {
  udang: {
    id: 'udang',
    nama: 'Udang',
    label: 'Udang (Utama)',
    ikon: '🦐',
    ringkas: 'Kolam bundar udang (biota dasar)',
    narasiFokus: 'Udang hidup dan makan di dasar kolam bundar sehingga sangat sensitif terhadap overfeeding, penumpukan sisa pakan & lumpur dasar, pH shock, dan lonjakan amonia bebas (NH₃).',
    asumsi: 'Asumsi simulasi udang: 2.000 ekor/kolam · pakan 3,2% biomassa · pH aman 7,0–8,5 · TDS kuras > 600 ppm · suhu dingin < 26 °C · NH₃ bahaya > 0,05 mg/L.',
    suhuOptimalTeks: '26–31 °C',
    ambang: {
      PH_MIN: 7.0,
      PH_MAX: 8.5,
      PH_KELUAR_MIN: 7.2,
      PH_KELUAR_MAX: 8.3,
      PH_TARGET_UP: 7.5,
      PH_TARGET_DOWN: 7.9,
      PH_RISIKO_TINGGI: 8.1,
      TDS_MAX: 600,
      TDS_PORSI: 450,
      RISIKO_LOCK: 0.70,
      RISIKO_KURANG: 0.40,
      SUHU_DINGIN: 26,
      NH3_TOKSIK: 0.05,
      DEBOUNCE_EVAL: 2,
    },
    tebar: {
      jumlahDefault: 2000,
      bobotG: 45,
      rasioPakan: 0.032,
    },
    presetNormal: { ph: 7.7, tdsRaw: 380, temp: 28.5, distCm: 30 },
  },
  nila: {
    id: 'nila',
    nama: 'Nila',
    label: 'Ikan Nila',
    ikon: '🐟',
    ringkas: 'Kolam bundar ikan nila',
    narasiFokus: 'Ikan nila pada padat tebar intensif rentan terhadap fluktuasi pH harian serta kelebihan pakan yang mengendap menjadi lumpur organik dan amonia bebas (NH₃).',
    asumsi: 'Asumsi simulasi nila: 1.800 ekor/kolam · pakan 2,5% biomassa · pH aman 6,5–8,2 · TDS kuras > 600 ppm · suhu dingin < 24 °C · NH₃ bahaya > 0,05 mg/L.',
    suhuOptimalTeks: '25–30 °C',
    ambang: {
      PH_MIN: 6.5,
      PH_MAX: 8.2,
      PH_KELUAR_MIN: 6.7,
      PH_KELUAR_MAX: 8.0,
      PH_TARGET_UP: 7.0,
      PH_TARGET_DOWN: 7.5,
      PH_RISIKO_TINGGI: 7.8,
      TDS_MAX: 600,
      TDS_PORSI: 450,
      RISIKO_LOCK: 0.70,
      RISIKO_KURANG: 0.40,
      SUHU_DINGIN: 24,
      NH3_TOKSIK: 0.05,
      DEBOUNCE_EVAL: 2,
    },
    tebar: {
      jumlahDefault: 1800,
      bobotG: 60,
      rasioPakan: 0.025,
    },
    presetNormal: { ph: 7.2, tdsRaw: 380, temp: 28, distCm: 30 },
  },
  lele: {
    id: 'lele',
    nama: 'Lele',
    label: 'Ikan Lele',
    ikon: '🐠',
    ringkas: 'Kolam bundar ikan lele padat tebar',
    narasiFokus: 'Ikan lele lebih toleran terhadap padatan terlarut (TDS) lebih tinggi, namun produksi feses dan sisa pakan cepat menumpuk di dasar sehingga kuras bottom drain ke POC & interlock pakan tetap krusial.',
    asumsi: 'Asumsi simulasi lele: 2.400 ekor/kolam · pakan 3,0% biomassa · pH aman 6,5–8,0 · TDS kuras > 700 ppm · suhu dingin < 25 °C · NH₃ bahaya > 0,06 mg/L.',
    suhuOptimalTeks: '25–30 °C',
    ambang: {
      PH_MIN: 6.5,
      PH_MAX: 8.0,
      PH_KELUAR_MIN: 6.7,
      PH_KELUAR_MAX: 7.8,
      PH_TARGET_UP: 7.0,
      PH_TARGET_DOWN: 7.4,
      PH_RISIKO_TINGGI: 7.7,
      TDS_MAX: 700,
      TDS_PORSI: 520,
      RISIKO_LOCK: 0.75,
      RISIKO_KURANG: 0.45,
      SUHU_DINGIN: 25,
      NH3_TOKSIK: 0.06,
      DEBOUNCE_EVAL: 2,
    },
    tebar: {
      jumlahDefault: 2400,
      bobotG: 50,
      rasioPakan: 0.030,
    },
    presetNormal: { ph: 7.1, tdsRaw: 420, temp: 28, distCm: 30 },
  },
  patin: {
    id: 'patin',
    nama: 'Patin',
    label: 'Ikan Patin',
    ikon: '🐡',
    ringkas: 'Kolam bundar ikan patin',
    narasiFokus: 'Ikan patin membutuhkan kualitas air lebih bersih dengan batas padatan terlarut lebih ketat agar nafsu makan terjaga dan terhindar dari paparan amonia bebas.',
    asumsi: 'Asumsi simulasi patin: 1.500 ekor/kolam · pakan 2,6% biomassa · pH aman 6,5–8,0 · TDS kuras > 550 ppm · suhu dingin < 25 °C · NH₃ bahaya > 0,05 mg/L.',
    suhuOptimalTeks: '26–30 °C',
    ambang: {
      PH_MIN: 6.5,
      PH_MAX: 8.0,
      PH_KELUAR_MIN: 6.7,
      PH_KELUAR_MAX: 7.8,
      PH_TARGET_UP: 7.0,
      PH_TARGET_DOWN: 7.5,
      PH_RISIKO_TINGGI: 7.7,
      TDS_MAX: 550,
      TDS_PORSI: 420,
      RISIKO_LOCK: 0.68,
      RISIKO_KURANG: 0.38,
      SUHU_DINGIN: 25,
      NH3_TOKSIK: 0.05,
      DEBOUNCE_EVAL: 2,
    },
    tebar: {
      jumlahDefault: 1500,
      bobotG: 70,
      rasioPakan: 0.026,
    },
    presetNormal: { ph: 7.2, tdsRaw: 350, temp: 28, distCm: 30 },
  },
};

export const DAFTAR_KOMODITAS = Object.values(PROFIL_KOMODITAS);

export function ambilProfilKomoditas(id) {
  return PROFIL_KOMODITAS[id] || PROFIL_KOMODITAS[KOMODITAS_DEFAULT];
}

export const DURASI_BOOTING_DTK = 30;

// Ambang default (mengikuti komoditas utama: Udang)
export const AMBANG = { ...PROFIL_KOMODITAS[KOMODITAS_DEFAULT].ambang };

export const AKTUATOR = {
  DOSING_MAKS_DTK: 4,        // F2: maksimal 4 detik per siklus dosing
  DOSING_GAIN_PH_PER_DTK: 0.12, // asumsi: 1 detik pompa ≈ 0,12 pH (perlu uji lapangan)
  HOMOGENISASI_DTK: 600,     // tunggu 10 menit setelah dosing
  BATAS_KURAS: 0.15,         // F4: kuras maks 15–20% volume kolam
  DEBIT_DRAIN_LPM: 250,      // L/menit, bottom drain 3" gravitasi
  DEBIT_INLET_LPM: 120,      // L/menit, inlet air bersih
  WATCHDOG_DRAIN_DTK: 180,   // Bab 9: watchdog ESP32 maks 3 menit katup drain
  ENDAPKAN_DTK: 300,         // jeda homogenisasi setelah isi ulang
  SERVO_G_PER_DTK: 50,       // gram pakan per detik bukaan servo
  TAKARAN_MANUAL_G: 200,     // satu kali tekan tombol manual
  INTERLOCK_MAKS_MS: 200,    // KPI: penolakan < 200 ms
};

export const KOLAM_DEFAULT = {
  diameterM: 3,           // terpal bundar Ø 3 m
  tinggiAirM: 0.6,        // tinggi air operasional
  jumlahIkan: PROFIL_KOMODITAS[KOMODITAS_DEFAULT].tebar.jumlahDefault,
  bobotIkanG: PROFIL_KOMODITAS[KOMODITAS_DEFAULT].tebar.bobotG,
  rasioPakanHarian: PROFIL_KOMODITAS[KOMODITAS_DEFAULT].tebar.rasioPakan,
};

export const JADWAL_PAKAN = [7, 12, 17]; // jam pemberian pakan otomatis

export const TANGKI_POC = {
  pilihan: [
    { id: 'ibc', nama: 'IBC Tank 1.000 L', kapasitasL: 1000 },
    { id: 'drum', nama: 'Drum HDPE 200 L', kapasitasL: 200 },
  ],
  SISA_MIN_L: 50,          // < 50 L tersisa → kuras ditunda
};

export const AIR_INLET = { tds: 180, ph: 7.4, suhu: 26 };

// Interval kerja sistem (detik simulasi)
export const INTERVAL = {
  LANGKAH_DTK: 5,         // resolusi fisika simulator
  EVAL_AI_DTK: 30,        // ESP32 publish sensor + AI evaluasi tiap 30 dtk
  RIWAYAT_DTK: 60,        // simpan titik grafik tiap 1 menit
  HEARTBEAT_TIMEOUT_DTK: 60, // node mengunci lokal bila master diam > 60 dtk
};

export const STATE = { NORMAL: 'NORMAL', CLEANING: 'CLEANING', PH_RECOVERY: 'PH_RECOVERY' };

export const PORSI = {
  PENUH: { kode: 'ALLOW_100%', faktor: 1 },
  KURANG: { kode: 'ALLOW_REDUCED_50%', faktor: 0.5 },
  KUNCI: { kode: 'LOCKOUT_0%', faktor: 0 },
};
