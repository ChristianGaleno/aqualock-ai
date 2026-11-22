// =============================================================
// constants.js — Semua ambang batas & parameter diambil dari PRD
// AQUA-LOCK AI (Bab 5, 6, 7, 9). Ubah di sini saja, jangan di
// tempat lain, supaya mudah dijelaskan ke juri.
// =============================================================

export const AMBANG = {
  PH_MIN: 6.5,            // F2 & Matriks FSM: pH < 6.5 → PH_RECOVERY
  PH_MAX: 8.2,            // pH > 8.2 → PH_RECOVERY
  PH_KELUAR_MIN: 6.7,     // histeresis: baru dianggap pulih jika ≥ 6.7
  PH_KELUAR_MAX: 8.0,     // dan ≤ 8.0 (mencegah status bolak-balik)
  PH_RISIKO_TINGGI: 7.8,  // risiko NH3 tinggi + pH > 7.8 → turunkan pH (bukan kuras)
  TDS_MAX: 600,           // ppm, TDS > 600 → CLEANING
  RISIKO_LOCK: 0.70,      // risiko NH3 ≥ 0.70 → CLEANING (LOCKOUT_0%)
  RISIKO_KURANG: 0.40,    // 0.40–0.69 → ALLOW_REDUCED_50%
  SUHU_DINGIN: 24,        // °C, suhu < 24 → porsi 50%
  NH3_TOKSIK: 0.05,       // mg/L NH3 bebas: label "berbahaya" di dataset (asumsi tim)
  DEBOUNCE_EVAL: 2,       // kondisi harus terpenuhi 2 evaluasi berturut-turut (60 dtk)
};

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
  diameterM: 3,           // terpal bundar Ø 3 m (Business Case Brief)
  tinggiAirM: 0.6,        // tinggi air operasional
  jumlahIkan: 1500,       // padat tebar 1.500–3.000 ekor
  bobotIkanG: 60,
  rasioPakanHarian: 0.025, // 2,5% biomassa per hari
};

export const JADWAL_PAKAN = [7, 12, 17]; // jam pemberian pakan otomatis

export const TANGKI_POC = {
  pilihan: [
    { id: 'ibc', nama: 'IBC Tank 1.000 L', kapasitasL: 1000 },
    { id: 'drum', nama: 'Drum HDPE 200 L', kapasitasL: 200 },
  ],
  SISA_MIN_L: 50,          // < 50 L tersisa → kuras ditunda
};

export const AIR_INLET = { tds: 180, ph: 7.2, suhu: 25 };

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
