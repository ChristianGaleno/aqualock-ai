// =============================================================
// engine.js — Simulator klaster AQUA-LOCK AI
//
// Isi file ini dibagi menjadi 5 bagian:
//   A. Pembuatan kolam (fisik air + hardware sensor + status)
//   B. Fisika air: suhu, pH, TAN/amonia, lumpur, aliran air
//   C. Sensor: Sequential Reading pH/TDS/suhu/level + kalibrasi
//   D. Logika kendali: AI, FSM 3 status, Safety Interlock, watchdog
//   E. Class Simulator: loop waktu, pakan, skenario demo, log MQTT
//
// "Kolam kembar" = salinan tiap kolam dengan cuaca & kejadian yang
// sama, tetapi memakai cara lama (timer pakan + ganti air manual).
// Dipakai untuk membandingkan dampak AQUA-LOCK secara adil.
// =============================================================
import {
  AMBANG, AKTUATOR, KOLAM_DEFAULT, JADWAL_PAKAN, TANGKI_POC,
  AIR_INLET, INTERVAL, STATE, PORSI, KOMODITAS_DEFAULT, ambilProfilKomoditas,
} from './constants.js';
import {
  fraksiNH3, volumeKolamL, suhuHarian, phHarian, PH_V_NETRAL,
  kompensasiSuhu, ppmDariTegangan, teganganDariPpm,
} from './chemistry.js';
import { evaluasiAI, perbaruiBufferPh, hitungDosis } from './ai.js';

// Konstanta biologis (asumsi model simulasi, bisa disetel)
const BIO = {
  TAN_G_PER_KG_PAKAN: 28,   // g TAN dari 1 kg pakan yang dicerna
  TAN_G_PER_KG_LUMPUR: 20,  // g TAN dari 1 kg lumpur organik terurai
  K_SERAP_PER_JAM: 1.0,     // laju penyerapan TAN oleh bioflok/nitrifikasi
  K_URAI_PER_JAM: 0.05,     // laju dekomposisi lumpur
  FESES_PER_KG: 0.15,       // kg lumpur dari tiap kg pakan termakan
  FAKTOR_BOTTOM_DRAIN: 3.5, // lumpur 3,5× lebih pekat di dasar kolam
};

// ---------- Utilitas acak (seed agar hasil bisa diulang) ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// =============================================================
// A. PEMBUATAN KOLAM
// =============================================================
function buatVariasi(rng) {
  return {
    ph: (rng() - 0.5) * 0.2,
    suhu: (rng() - 0.5) * 0.8,
    tds: 290 + rng() * 50,
    ikan: 1500 + Math.round(rng() * 6) * 100,
    slope: 0.165 + rng() * 0.02,
    offV: (rng() - 0.5) * 0.08,
    gainTds: 0.9 + rng() * 0.08,
    gainDosis: 0.85 + rng() * 0.3,
  };
}

function buatKolam(idx, kontrol, v, t, profil) {
  const V0 = volumeKolamL(KOLAM_DEFAULT.diameterM, KOLAM_DEFAULT.tinggiAirM);
  const phAwal = (profil.ambang.PH_MIN + profil.ambang.PH_MAX) / 2 - 0.1 + v.ph;
  const kolam = {
    id: idx + 1,
    nama: `Kolam ${idx + 1}`,
    kontrol,
    V0,
    // --- kebenaran fisik (tersembunyi dari sistem; hanya simulator yang tahu)
    air: {
      ph: phAwal, suhu: 27.6, tan: 0.45, lumpurKg: 0.25, tdsDasar: v.tds,
      volumeL: V0, hujan: 0, bloom: 0, koreksiPh: 0, dosisPending: 0,
      offsetPh: v.ph, offsetSuhu: v.suhu, gainDosis: AKTUATOR.DOSING_GAIN_PH_PER_DTK * v.gainDosis,
    },
    ikan: { jumlah: profil.tebar.jumlahDefault, bobotG: profil.tebar.bobotG, isiPerutKg: 0, faktorTimer: 1, rasio: profil.tebar.rasioPakan },
    // --- karakter hardware sensor yang sebenarnya
    hw: { phSlope: v.slope, phOffsetV: v.offV, driftV: 0, tdsGain: v.gainTds, biofoul: 0, phTerasa: phAwal },
    kal: null,
    ukur: { ph: phAwal, tds: 350, suhu: 27.6, levelCm: 60, vPh: 2.5, vTds: 0.8 },
    ai: { risiko: 0, porsi: PORSI.PENUH, phPred: 7.3, phDelta: 0, anomali: 'POLA_HARIAN', dataDatar: false, fitur: [] },
    fsm: {
      state: STATE.NORMAL, sub: null, timer: 0, siklus: 0, hitKotor: 0, hitPh: 0,
      volTarget: 0, volSudah: 0, dosis: null, alasan: 'Air sehat', masukT: t, watchdogTrip: false,
    },
    akt: { servoSampai: 0, drain: false, inlet: false, pompaUpSampai: 0, pompaDownSampai: 0, drainDtk: 0 },
    kunci: { mpu: false, stm32: false, node: false },
    online: true,
    heartbeatT: t,
    gantiAirHarian: 0.1, // hanya untuk kolam kembar (cara manual)
    stat: {
      pakanJadwalKg: 0, pakanDiberiKg: 0, pakanTermakanKg: 0, pakanTerbuangKg: 0,
      menitNh3Toksik: 0, menitPhLuar: 0, kurasKali: 0, dosingKali: 0, limbahPocL: 0,
      limbahSelokanL: 0, tolakManual: 0, jadwalDilewati: 0,
    },
    riwayat: [],
    bufPh: [],
    logPakan: [],
    nh3: 0,
  };
  kolam.kal = kalibrasiIdeal(kolam);
  return kolam;
}

// Kalibrasi hasil instalasi awal (seolah tim sudah kalibrasi 3-point)
export function kalibrasiIdeal(k) {
  const s = k.hw.phSlope;
  return {
    m: -1 / s,
    c: 7 + (PH_V_NETRAL + k.hw.phOffsetV + k.hw.driftV) / s,
    k: 1 / k.hw.tdsGain,
    metode: 'Instalasi awal',
  };
}

export function biomassaKg(k) {
  return (k.ikan.jumlah * k.ikan.bobotG) / 1000;
}
export function porsiSekaliMakanKg(k) {
  return (biomassaKg(k) * k.ikan.rasio) / JADWAL_PAKAN.length;
}
export function tdsSebenarnya(k) {
  const a = k.air;
  return a.tdsDasar + 55 * a.tan + 320 * (a.lumpurKg / (a.volumeL / 1000));
}

// =============================================================
// B. FISIKA AIR
// =============================================================
function campurAirMasuk(a, vIn) {
  const V = a.volumeL;
  const f = V / (V + vIn);
  a.tan *= f;
  a.koreksiPh *= f;
  a.tdsDasar = a.tdsDasar * f + AIR_INLET.tds * (1 - f);
  a.suhu = a.suhu * f + AIR_INLET.suhu * (1 - f);
  a.ph = a.ph * f + AIR_INLET.ph * (1 - f);
  a.volumeL = V + vIn;
}

// Mengembalikan volume & lumpur yang keluar lewat drain pada langkah ini
function fisika(k, jam, dt, ambang = AMBANG) {
  const a = k.air;
  const h = dt / 3600;
  const m3 = a.volumeL / 1000;

  // Cuaca & kejadian meluruh perlahan
  a.hujan *= Math.exp(-h / 3);
  a.bloom *= Math.exp(-h / 30);
  a.koreksiPh *= Math.exp(-h / 10);

  // Suhu mengikuti pola harian, turun saat hujan
  const targetSuhu = suhuHarian(jam) + a.offsetSuhu - 5 * a.hujan;
  a.suhu += (targetSuhu - a.suhu) * (1 - Math.exp(-h / 0.8));

  // pH bergerak menuju kesetimbangan: pola harian, alga, limbah, hujan, koreksi dosing
  const lumpurPekat = a.lumpurKg / m3;
  const phDasar = (ambang.PH_MIN + ambang.PH_MAX) / 2 - 0.1;
  const phSetimbang = phDasar + a.offsetPh + phHarian(jam) * (1 + 2 * a.bloom) + 0.75 * a.bloom
    - 0.35 * lumpurPekat - 2.6 * a.hujan + a.koreksiPh;
  a.ph += (phSetimbang - a.ph) * (1 - Math.exp(-h / 1.5));
  if (Math.abs(a.dosisPending) > 1e-6) {           // homogenisasi larutan dosing ±2 menit
    const pindah = a.dosisPending * (1 - Math.exp(-dt / 120));
    a.ph += pindah;
    a.dosisPending -= pindah;
  }

  // Pencernaan pakan → TAN; dekomposisi lumpur → TAN; penyerapan bioflok
  const cerna = k.ikan.isiPerutKg * (1 - Math.exp(-h / 3));
  k.ikan.isiPerutKg -= cerna;
  const urai = a.lumpurKg * (1 - Math.exp(-h * BIO.K_URAI_PER_JAM));
  a.lumpurKg -= urai;
  a.tan += (cerna * BIO.TAN_G_PER_KG_PAKAN + urai * BIO.TAN_G_PER_KG_LUMPUR) / m3;
  a.tan *= Math.exp(-h * BIO.K_SERAP_PER_JAM);
  a.tdsDasar += cerna * 2;

  // Aliran air
  let keluarL = 0, lumpurKeluar = 0;
  if (k.akt.drain) {
    keluarL = Math.min((AKTUATOR.DEBIT_DRAIN_LPM * dt) / 60, a.volumeL * 0.5);
    lumpurKeluar = a.lumpurKg * Math.min(1, (BIO.FAKTOR_BOTTOM_DRAIN * keluarL) / a.volumeL);
    a.lumpurKg -= lumpurKeluar;
    a.volumeL -= keluarL;
  }
  if (k.akt.inlet) campurAirMasuk(a, (AKTUATOR.DEBIT_INLET_LPM * dt) / 60);

  k.nh3 = a.tan * fraksiNH3(a.ph, a.suhu);
  return { keluarL, lumpurKeluar };
}

// Nafsu makan udang/ikan turun saat air dingin / kualitas dasar buruk (sumber overfeeding & sisa pakan)
function nafsuMakan(k, ambang = AMBANG) {
  let n = 1;
  if (k.air.suhu < ambang.SUHU_DINGIN) n *= 0.55;
  if (k.nh3 > ambang.NH3_TOKSIK) n *= 0.4;
  if (k.air.ph < ambang.PH_MIN || k.air.ph > ambang.PH_MAX + 0.3) n *= 0.5;
  if (tdsSebenarnya(k) > ambang.TDS_MAX) n *= 0.7;
  return n;
}

function tebarPakan(k, kg, t, ambang = AMBANG) {
  k.logPakan.push({ t, kg });                       // log servo → fitur riwayat pakan
  while (k.logPakan.length && k.logPakan[0].t < t - 6 * 3600) k.logPakan.shift();
  const kapasitas = Math.max(0, porsiSekaliMakanKg(k) * 1.1 * nafsuMakan(k, ambang) - k.ikan.isiPerutKg);
  const dimakan = Math.min(kg, kapasitas);
  const sisa = kg - dimakan;
  k.ikan.isiPerutKg += dimakan;
  k.air.lumpurKg += sisa + dimakan * BIO.FESES_PER_KG;
  k.stat.pakanDiberiKg += kg;
  k.stat.pakanTermakanKg += dimakan;
  k.stat.pakanTerbuangKg += sisa;
  return { dimakan, sisa };
}

// =============================================================
// C. SENSOR (Sequential Reading, PRD F1)
//   TDS ON → stabil → baca TDS → TDS OFF → jeda isolasi → baca pH → baca suhu
// =============================================================
function gauss(rng) {
  const u = Math.max(1e-9, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

function bacaSensor(k, dt, sim) {
  const { hw, air: a } = k;
  const r = sim.rng;
  // 1) TDS (probe dinyalakan via MOSFET, lalu dibaca)
  const vRaw = teganganDariPpm(tdsSebenarnya(k) * hw.tdsGain) * (1 + 0.02 * (a.suhu - 25)) + gauss(r) * 0.003;
  // 2) Suhu DS18B20 (dipakai untuk kompensasi TDS)
  const suhu = a.suhu + gauss(r) * 0.05;
  // 3) pH — probe berlumut membuat respons lambat & sinyal "datar"
  if (hw.biofoul > 0) {
    hw.phTerasa += (a.ph - hw.phTerasa) * (1 - Math.exp(-dt / (4 * 3600)));
    hw.driftV += (0.01 * hw.biofoul * dt) / 3600;
  } else hw.phTerasa = a.ph;
  const derau = hw.biofoul > 0 ? 0.0004 : 0.002;
  let vPh = PH_V_NETRAL + hw.phOffsetV + hw.driftV + (7 - hw.phTerasa) * hw.phSlope + gauss(r) * derau;
  // Tanpa Sequential Reading: probe TDS masih bertegangan → ground loop
  if (!sim.opsi.sequentialReading) vPh += 0.055 + gauss(r) * 0.03;

  k.ukur.vTds = vRaw;
  k.ukur.vPh = vPh;
  k.ukur.suhu = suhu;
  k.ukur.tds = k.kal.k * ppmDariTegangan(kompensasiSuhu(vRaw, suhu));
  k.ukur.ph = k.kal.m * vPh + k.kal.c;
  const luas = Math.PI * (KOLAM_DEFAULT.diameterM / 2) ** 2;
  k.ukur.levelCm = (a.volumeL / 1000 / luas) * 100 + gauss(r) * 0.3;
}

// Pembacaan untuk wizard kalibrasi: probe dicelup ke larutan standar
export function bacaLarutanStandar(k, jenis, nilai, suhuLarutan, probeBersih = true, rng = Math.random) {
  const n = () => gauss(rng);
  if (jenis === 'ph') {
    // Probe berlumut yang tidak dibersihkan tidak sempat merespons penuh larutan buffer
    const terasa = k.hw.biofoul > 0 && !probeBersih ? nilai * 0.6 + k.hw.phTerasa * 0.4 : nilai;
    let v = 0;
    for (let i = 0; i < 10; i++) {                  // rata-rata 10 sampel ADS1115
      v += PH_V_NETRAL + k.hw.phOffsetV + k.hw.driftV + (7 - terasa) * k.hw.phSlope + n() * 0.002;
    }
    return v / 10;
  }
  let v = 0;
  for (let i = 0; i < 10; i++) v += teganganDariPpm(nilai * k.hw.tdsGain) * (1 + 0.02 * (suhuLarutan - 25)) + n() * 0.002;
  return v / 10;
}

// =============================================================
// D. LOGIKA KENDALI (FSM + Safety Interlock)
// =============================================================
const SUB_CLEANING = ['CEK_TANGKI', 'KURAS', 'ISI_ULANG', 'ENDAPKAN', 'EVALUASI'];
const SUB_PH = ['HITUNG_DOSIS', 'DOSING', 'HOMOGENISASI', 'EVALUASI'];
export const LANGKAH_FSM = { CLEANING: SUB_CLEANING, PH_RECOVERY: SUB_PH };

// =============================================================
// E. SIMULATOR
// =============================================================
export class Simulator {
  constructor(opsi = {}) {
    this.opsi = {
      jumlahKolam: 4,
      kembar: true,
      seed: 20261205,
      sequentialReading: true,
      batasKuras: AKTUATOR.BATAS_KURAS,
      tangkiId: 'ibc',
      komoditasId: KOMODITAS_DEFAULT,
      ...opsi,
    };
    this.komoditas = ambilProfilKomoditas(this.opsi.komoditasId);
    this.ambang = this.komoditas.ambang;
    this.booting = null;
    this.rng = mulberry32(this.opsi.seed);
    this.t = 6 * 3600; // Hari 1, pukul 06.00
    this.kolam = [];
    this.kembar = [];
    for (let i = 0; i < this.opsi.jumlahKolam; i++) {
      const v = buatVariasi(this.rng);
      this.kolam.push(buatKolam(i, true, v, this.t, this.komoditas));
      if (this.opsi.kembar) this.kembar.push(buatKolam(i, false, v, this.t, this.komoditas));
    }
    const tipe = TANGKI_POC.pilihan.find((p) => p.id === this.opsi.tangkiId);
    this.tangki = { nama: tipe.nama, kapasitasL: tipe.kapasitasL, isiL: 120, organikKg: 0.4, luapanL: 0, panenL: 0 };
    this.master = { hangSampai: 0, sedangHang: false, buzzer: 0 };
    this.log = [];
    this.mqtt = [];
    this.nomor = 0;
    this.versi = 0;
    this.pesanOled = null;
    this.catat(null, 'info', `Sistem menyala (mode ${this.komoditas.nama}). Master Gateway terhubung ke 4 Sensor Node lewat MQTT lokal.`);
  }

  get jam() { return (this.t % 86400) / 3600; }
  get hari() { return Math.floor(this.t / 86400) + 1; }
  get semuaKolam() { return [...this.kolam, ...this.kembar]; }

  // ---------------- Log & MQTT ----------------
  catat(kolam, level, teks) {
    this.log.unshift({ id: ++this.nomor, t: this.t, kolam: kolam ? kolam.id : null, level, teks });
    if (this.log.length > 250) this.log.pop();
    if (level === 'kritis' || level === 'tolak') this.master.buzzer++;
  }

  kirimMqtt(topik, arah, payload, retain = false) {
    this.totalMqtt = (this.totalMqtt || 0) + 1;
    this.mqtt.unshift({ id: ++this.nomor, t: this.t, topik, arah, qos: 1, retain, payload });
    if (this.mqtt.length > 80) this.mqtt.pop();
  }

  // ---------------- Loop utama ----------------
  maju(detik) {
    const dt = INTERVAL.LANGKAH_DTK;
    this._sisa = (this._sisa || 0) + detik;
    while (this._sisa >= dt) {
      this.langkah(dt);
      this._sisa -= dt;
    }
    this.versi++;
  }

  langkah(dt) {
    const tLama = this.t;
    this.t += dt;
    const jam = this.jam;
    const hang = this.t < this.master.hangSampai;
    const waktuEval = Math.floor(this.t / INTERVAL.EVAL_AI_DTK) > Math.floor(tLama / INTERVAL.EVAL_AI_DTK);
    const waktuRiwayat = Math.floor(this.t / INTERVAL.RIWAYAT_DTK) > Math.floor(tLama / INTERVAL.RIWAYAT_DTK);

    if (this.master.sedangHang && !hang) {
      this.master.sedangHang = false;
      for (const k of this.kolam) { k.kunci.node = k.kunci.mpu; k.kunci.stm32 = k.kunci.mpu; k.heartbeatT = this.t; }
      this.catat(null, 'info', 'MPU Linux selesai reboot. State tiap kolam disinkronkan ulang dari node & STM32.');
    }

    for (const k of this.semuaKolam) {
      const { keluarL, lumpurKeluar } = fisika(k, jam, dt, this.ambang);
      if (keluarL > 0) this.alirkanLimbah(k, keluarL, lumpurKeluar);
      bacaSensor(k, dt, this);
      this.jadwalPakan(k, tLama, jam);
      if (k.nh3 > this.ambang.NH3_TOKSIK) k.stat.menitNh3Toksik += dt / 60;
      if (k.air.ph < this.ambang.PH_MIN || k.air.ph > this.ambang.PH_MAX) k.stat.menitPhLuar += dt / 60;
      if (waktuEval && k.online) perbaruiBufferPh(k, this.t);
    }

    // Kolam kembar: ganti air manual rutin pukul 08.00, limbah ke selokan
    if (this.lewatJam(tLama, 8)) {
      for (const k of this.kembar) {
        const vol = k.V0 * k.gantiAirHarian;
        k.stat.limbahSelokanL += vol;
        k.air.lumpurKg *= 1 - Math.min(1, 2 * k.gantiAirHarian);
        k.air.volumeL -= vol;
        campurAirMasuk(k.air, vol);
      }
    }

    for (const k of this.kolam) {
      this.logikaNode(k, dt, hang);
      if (hang || !k.online) continue;
      if (waktuEval) {
        k.ai = evaluasiAI(k, this.t, jam, this.ambang);
        this.publishSensor(k);
      }
      if (!this.booting) this.langkahFsm(k, dt, waktuEval);
    }

    if (waktuRiwayat) {
      for (const k of this.kolam) {
        k.riwayat.push({
          t: this.t, ph: k.ukur.ph, tds: k.ukur.tds, suhu: k.ukur.suhu,
          risiko: k.online ? k.ai.risiko : null, nh3: k.nh3, state: k.fsm.state,
        });
        if (k.riwayat.length > 1440) k.riwayat.shift();
      }
    }
  }

  lewatJam(tLama, jamTarget) {
    const o = jamTarget * 3600;
    return Math.floor((tLama - o) / 86400) < Math.floor((this.t - o) / 86400);
  }

  alirkanLimbah(k, liter, lumpurKg) {
    k.fsm.volSudah += liter;
    if (!k.kontrol) { k.stat.limbahSelokanL += liter; return; }
    const ruang = this.tangki.kapasitasL - this.tangki.isiL;
    const masuk = Math.min(ruang, liter);
    this.tangki.isiL += masuk;
    this.tangki.organikKg += lumpurKg * (masuk / liter);
    k.stat.limbahPocL += masuk;
    if (liter > masuk) {
      this.tangki.luapanL += liter - masuk;
      k.stat.limbahSelokanL += liter - masuk;
    }
  }

  // ---------------- Pakan ----------------
  jadwalPakan(k, tLama, jam) {
    for (const j of JADWAL_PAKAN) {
      if (!this.lewatJam(tLama, j)) continue;
      const porsi = porsiSekaliMakanKg(k);
      k.stat.pakanJadwalKg += porsi;
      const label = `${String(j).padStart(2, '0')}.00`;
      if (!k.kontrol) { tebarPakan(k, porsi * k.ikan.faktorTimer, this.t, this.ambang); continue; }
      if (this.terkunci(k)) {
        k.stat.jadwalDilewati++;
        const sebab = this.booting
          ? `BOOTING patokan ${this.booting.targetNama} (keputusan pakan ditahan)`
          : `${k.fsm.state} (kunci pakan aktif)`;
        this.catat(k, 'peringatan', `Jadwal pakan ${label} dilewati: ${sebab}.`);
        continue;
      }
      const kg = porsi * k.ai.porsi.faktor;
      tebarPakan(k, kg, this.t, this.ambang);
      k.akt.servoSampai = this.t + (kg * 1000) / AKTUATOR.SERVO_G_PER_DTK;
      this.catat(k, 'info', `Pakan otomatis ${label}: ${Math.round(kg * 1000)} g (${k.ai.porsi.kode}).`);
      this.kirimMqtt(`aqualock/kolam${k.id}/cmd`, 'master→node', { servo_ms: Math.round((kg * 1e6) / AKTUATOR.SERVO_G_PER_DTK), porsi: k.ai.porsi.kode });
    }
  }

  terkunci(k) {
    return Boolean(this.booting) || !k.online || k.kunci.node || k.kunci.stm32 || this.t < this.master.hangSampai;
  }

  alasanKunci(k) {
    if (this.booting) return `BOOTING: Memuat patokan ${this.booting.targetNama} (${Math.ceil(this.booting.sisaDtk)} dtk)`;
    if (!k.online) return 'NODE OFFLINE (failsafe lokal)';
    if (this.t < this.master.hangSampai) return 'MPU REBOOT, kunci dipegang STM32';
    if (k.fsm.state === STATE.CLEANING) return 'LOCKOUT: Kuras Limbah ke Tangki POC';
    if (k.fsm.state === STATE.PH_RECOVERY) return 'LOCKOUT: Stabilisasi pH Aktif';
    return '';
  }

  // Tombol Manual Feed: fisik (di Master Gateway) atau dari dashboard
  tekanPakanManual(idKolam, sumber) {
    const k = this.kolam.find((x) => x.id === idKolam);
    const t0 = performance.now();
    const kunci = this.terkunci(k);
    const komputasiMs = performance.now() - t0;
    // Model latensi jalur: tombol fisik → interrupt STM32 (lokal),
    // dashboard → WebSocket → FastAPI → MQTT → ESP32
    const jalurMs = sumber === 'fisik' ? 3 + this.rng() * 4 : 28 + this.rng() * 40;
    const latensiMs = jalurMs + komputasiMs;
    if (kunci) {
      k.stat.tolakManual++;
      const alasan = this.alasanKunci(k);
      this.catat(k, 'tolak', `Tombol Manual Feed (${sumber}) DITOLAK dalam ${latensiMs.toFixed(0)} ms. Servo diam, buzzer berbunyi. Alasan: ${alasan}.`);
      this.kirimMqtt(`aqualock/kolam${k.id}/event`, 'node→master', { event: 'MANUAL_FEED_REJECTED', sumber, latency_ms: +latensiMs.toFixed(1), reason: alasan });
      this.versi++;
      return { diterima: false, latensiMs, alasan, kolam: k.id };
    }
    const kg = (AKTUATOR.TAKARAN_MANUAL_G / 1000) * k.ai.porsi.faktor;
    tebarPakan(k, kg, this.t, this.ambang);
    k.akt.servoSampai = this.t + (kg * 1000) / AKTUATOR.SERVO_G_PER_DTK;
    this.catat(k, 'info', `Pakan manual (${sumber}) diizinkan: ${Math.round(kg * 1000)} g sesuai porsi AI ${k.ai.porsi.kode}.`);
    this.kirimMqtt(`aqualock/kolam${k.id}/cmd`, 'master→node', { servo_ms: Math.round((kg * 1e6) / AKTUATOR.SERVO_G_PER_DTK), sumber });
    this.versi++;
    return { diterima: true, latensiMs, gram: kg * 1000, kolam: k.id };
  }

  // ---------------- Node ESP32 (berjalan walau master hang) ----------------
  logikaNode(k, dt, hang) {
    // Watchdog drain berjalan di ESP32 sendiri, tidak bergantung Wi-Fi/master
    if (k.akt.drain) {
      k.akt.drainDtk += dt;
      if (k.akt.drainDtk >= AKTUATOR.WATCHDOG_DRAIN_DTK) {
        k.akt.drain = false;
        k.fsm.watchdogTrip = true;
        this.catat(k, 'kritis', `Watchdog ESP32 menutup katup drain paksa setelah ${AKTUATOR.WATCHDOG_DRAIN_DTK} dtk (${Math.round(k.fsm.volSudah)} L terkuras).`);
      }
    } else k.akt.drainDtk = 0;

    if (!k.online) { k.kunci.node = true; return; }
    if (hang) {
      if (this.t - k.heartbeatT > INTERVAL.HEARTBEAT_TIMEOUT_DTK && !k.kunci.node) {
        k.kunci.node = true;
        this.catat(k, 'peringatan', 'ESP32: heartbeat master hilang > 60 dtk, kunci pakan lokal diaktifkan (failsafe).');
      }
    } else k.heartbeatT = this.t;
  }

  publishSensor(k) {
    this.kirimMqtt(`aqualock/kolam${k.id}/sensor`, 'node→master', {
      node: `esp32-k${k.id}`,
      ph: +k.ukur.ph.toFixed(2), tds: Math.round(k.ukur.tds), suhu: +k.ukur.suhu.toFixed(1),
      level_cm: +k.ukur.levelCm.toFixed(1),
      seq: this.opsi.sequentialReading ? 'TDS_ON>TDS_READ>TDS_OFF>ISO>PH_READ>TEMP_READ' : 'PARALEL (ground loop!)',
    });
    this.kirimMqtt(`aqualock/kolam${k.id}/ai`, 'master→dashboard', {
      risk_nh3: +k.ai.risiko.toFixed(3), porsi: k.ai.porsi.kode, ph_pred_30m: +k.ai.phPred.toFixed(2),
      tren: k.ai.anomali, state: k.fsm.state,
    });
  }

  kirimPerintah(k) {
    this.kirimMqtt(`aqualock/kolam${k.id}/cmd`, 'master→node', {
      state: k.fsm.state, step: k.fsm.sub, feed_lock: k.kunci.mpu,
      drain: k.akt.drain ? 1 : 0, inlet: k.akt.inlet ? 1 : 0,
      dose: k.fsm.dosis && k.fsm.sub === 'DOSING' ? { pump: k.fsm.dosis.arah, ms: Math.round(k.fsm.dosis.durasi * 1000) } : null,
    });
  }

  aturKunci(k, kunci) {
    if (k.kunci.mpu === kunci && k.kunci.node === kunci) return;
    k.kunci.mpu = kunci; k.kunci.stm32 = kunci; k.kunci.node = kunci;
  }

  masukState(k, state, sub, alasan) {
    const f = k.fsm;
    f.state = state; f.sub = sub; f.timer = 0; f.siklus = 1; f.alasan = alasan;
    f.hitKotor = 0; f.hitPh = 0; f.masukT = this.t; f.watchdogTrip = false;
    this.aturKunci(k, state !== STATE.NORMAL);
    if (state === STATE.CLEANING) this.catat(k, 'kritis', `Masuk CLEANING: ${alasan}. Kunci pakan AKTIF.`);
    else if (state === STATE.PH_RECOVERY) this.catat(k, 'kritis', `Masuk PH_RECOVERY: ${alasan}. Kunci pakan AKTIF.`);
    this.kirimPerintah(k);
  }

  keNormal(k, alasan) {
    const f = k.fsm;
    f.state = STATE.NORMAL; f.sub = null; f.timer = 0; f.alasan = 'Air sehat';
    f.hitKotor = 0; f.hitPh = 0; f.dosis = null;
    k.akt.drain = false; k.akt.inlet = false;
    this.aturKunci(k, false);
    this.catat(k, 'aman', `${alasan}. Kembali NORMAL, kunci pakan DIBUKA.`);
    this.kirimPerintah(k);
  }

  langkahFsm(k, dt, waktuEval) {
    const f = k.fsm, u = k.ukur, ai = k.ai, A = this.ambang;
    const phLuar = u.ph < A.PH_MIN || u.ph > A.PH_MAX;
    const tdsTinggi = u.tds > A.TDS_MAX;
    const risikoTinggi = ai.risiko >= A.RISIKO_LOCK;
    f.timer += dt;

    // Penyempurnaan: tindakan dipilih sesuai PENYEBAB risiko.
    // Risiko NH3 tinggi + pH tinggi → turunkan pH dulu, karena
    // fraksi NH3 bebas naik ±3× tiap pH naik 0,5. Selain itu → kuras.
    const perluPh = phLuar || (risikoTinggi && u.ph > A.PH_RISIKO_TINGGI);
    const perluKuras = tdsTinggi || (risikoTinggi && !perluPh);
    const sudahAman = u.tds <= A.TDS_MAX - 20 && ai.risiko < A.RISIKO_LOCK - 0.1
      && u.ph >= A.PH_KELUAR_MIN && u.ph <= A.PH_KELUAR_MAX;

    if (f.state === STATE.NORMAL) {
      if (!waktuEval) return;
      f.hitKotor = perluKuras ? f.hitKotor + 1 : 0;
      f.hitPh = perluPh ? f.hitPh + 1 : 0;
      if (f.hitKotor >= A.DEBOUNCE_EVAL) {
        const alasan = tdsTinggi ? `TDS ${Math.round(u.tds)} ppm > ${A.TDS_MAX}` : `Risiko NH3 ${ai.risiko.toFixed(2)} ≥ ${A.RISIKO_LOCK}`;
        this.masukState(k, STATE.CLEANING, 'CEK_TANGKI', alasan);
      } else if (f.hitPh >= A.DEBOUNCE_EVAL) {
        const alasan = phLuar ? `pH ${u.ph.toFixed(2)} di luar ${A.PH_MIN}–${A.PH_MAX}`
          : `Risiko NH3 ${ai.risiko.toFixed(2)} dipicu pH tinggi ${u.ph.toFixed(2)}`;
        this.masukState(k, STATE.PH_RECOVERY, 'HITUNG_DOSIS', alasan);
      }
      return;
    }

    if (f.state === STATE.CLEANING) this.langkahCleaning(k, waktuEval, { perluKuras, perluPh, risikoTinggi, sudahAman });
    else this.langkahPh(k, { tdsTinggi, risikoTinggi });
  }

  langkahCleaning(k, waktuEval, c) {
    const f = k.fsm, tk = this.tangki;
    const ruang = tk.kapasitasL - tk.isiL;
    switch (f.sub) {
      case 'CEK_TANGKI': {
        if (ruang < TANGKI_POC.SISA_MIN_L) {
          f.sub = 'DITUNDA';
          this.catat(k, 'kritis', `Tangki POC penuh (${Math.round(tk.isiL)}/${tk.kapasitasL} L). Kuras DITUNDA, kunci pakan tetap aktif. Kosongkan tangki untuk melanjutkan.`);
          break;
        }
        f.volTarget = Math.min(this.opsi.batasKuras * k.V0, ruang - 10);
        f.volSudah = 0; f.watchdogTrip = false; f.timer = 0;
        k.akt.drain = true;
        k.stat.kurasKali++;
        f.sub = 'KURAS';
        const parsial = f.volTarget < this.opsi.batasKuras * k.V0 - 1 ? ' (parsial, mengikuti sisa tangki)' : '';
        this.catat(k, 'peringatan', `Siklus kuras ${f.siklus}: Solenoid Drain dibuka, target ${Math.round(f.volTarget)} L ke Tangki POC${parsial}.`);
        this.kirimPerintah(k);
        break;
      }
      case 'KURAS':
        if (f.volSudah >= f.volTarget || ruang <= 5 || f.watchdogTrip || !k.akt.drain) {
          k.akt.drain = false;
          k.akt.inlet = true;
          f.sub = 'ISI_ULANG'; f.timer = 0;
          this.catat(k, 'info', `Drain ditutup (${Math.round(f.volSudah)} L, ${((f.volSudah / k.V0) * 100).toFixed(1)}% volume). Solenoid Inlet dibuka.`);
          this.kirimPerintah(k);
        }
        break;
      case 'ISI_ULANG':
        if (k.air.volumeL >= k.V0) {
          k.akt.inlet = false;
          f.sub = 'ENDAPKAN'; f.timer = 0;
          this.kirimPerintah(k);
        }
        break;
      case 'ENDAPKAN':
        if (f.timer >= AKTUATOR.ENDAPKAN_DTK) { f.sub = 'EVALUASI'; f.timer = 0; }
        break;
      case 'EVALUASI':
        if (!waktuEval) break;
        if (c.perluKuras) {
          f.siklus++;
          f.sub = 'CEK_TANGKI';
          this.catat(k, 'peringatan', `Air belum aman (TDS ${Math.round(k.ukur.tds)} ppm, risiko ${k.ai.risiko.toFixed(2)}). Lanjut siklus kuras ${f.siklus}.`);
        } else if (c.perluPh || c.risikoTinggi) {
          this.masukState(k, STATE.PH_RECOVERY, 'HITUNG_DOSIS', `Setelah kuras, pH ${k.ukur.ph.toFixed(2)} perlu distabilkan`);
        } else this.keNormal(k, `Kuras selesai, TDS ${Math.round(k.ukur.tds)} ppm & risiko NH3 ${k.ai.risiko.toFixed(2)}`);
        break;
      case 'DITUNDA':
        if (!waktuEval) break;
        if (c.sudahAman) this.keNormal(k, 'Kualitas air membaik sendiri selama kuras ditunda');
        else if (c.perluPh && !c.perluKuras) this.masukState(k, STATE.PH_RECOVERY, 'HITUNG_DOSIS', 'Kuras ditunda, risiko ditangani lewat stabilisasi pH');
        else if (ruang >= TANGKI_POC.SISA_MIN_L) { f.sub = 'CEK_TANGKI'; this.catat(k, 'info', 'Tangki POC kembali tersedia, kuras dilanjutkan.'); }
        break;
      default:
        break;
    }
  }

  langkahPh(k, c) {
    const f = k.fsm, u = k.ukur, A = this.ambang;
    switch (f.sub) {
      case 'HITUNG_DOSIS': {
        const d = hitungDosis(u.ph, k.ai.phPred, A);
        f.dosis = d;
        const arah = d.arah === 'UP' ? 1 : -1;
        const efek = arah * k.air.gainDosis * d.durasi;   // efek fisik sebenarnya
        k.air.dosisPending += efek;
        k.air.koreksiPh += efek;
        if (d.arah === 'UP') k.akt.pompaUpSampai = this.t + d.durasi;
        else k.akt.pompaDownSampai = this.t + d.durasi;
        k.stat.dosingKali++;
        f.sub = 'DOSING'; f.timer = 0;
        this.catat(k, 'info', `Dosing pH-${d.arah === 'UP' ? 'Up' : 'Down'} ${d.durasi.toFixed(1)} dtk (pH ${u.ph.toFixed(2)}, prediksi 30 mnt ${k.ai.phPred.toFixed(2)}, target ${d.target}).`);
        this.kirimPerintah(k);
        break;
      }
      case 'DOSING':
        if (f.timer >= Math.max(f.dosis.durasi, 5)) { f.sub = 'HOMOGENISASI'; f.timer = 0; }
        break;
      case 'HOMOGENISASI':
        if (f.timer >= AKTUATOR.HOMOGENISASI_DTK) { f.sub = 'EVALUASI'; f.timer = 0; }
        break;
      case 'EVALUASI':
        if (c.tdsTinggi) { this.masukState(k, STATE.CLEANING, 'CEK_TANGKI', `TDS ${Math.round(u.tds)} ppm > ${A.TDS_MAX}`); break; }
        if (u.ph >= A.PH_KELUAR_MIN && u.ph <= A.PH_KELUAR_MAX && !(c.risikoTinggi && u.ph > A.PH_RISIKO_TINGGI)) {
          if (c.risikoTinggi) this.masukState(k, STATE.CLEANING, 'CEK_TANGKI', `pH pulih tetapi risiko NH3 ${k.ai.risiko.toFixed(2)} masih tinggi`);
          else this.keNormal(k, `pH stabil di ${u.ph.toFixed(2)}, risiko NH3 ${k.ai.risiko.toFixed(2)}`);
        } else {
          f.siklus++;
          f.sub = 'HITUNG_DOSIS';
          if (f.siklus === 6) this.catat(k, 'kritis', 'pH sulit pulih setelah 5 siklus dosing. Cek larutan pH-Up/Down & pompa peristaltik.');
        }
        break;
      default:
        break;
    }
  }

  // ---------------- Skenario demo untuk juri ----------------
  skenario(nama, idKolam) {
    const k = this.kolam.find((x) => x.id === idKolam);
    const kembar = this.kembar.find((x) => x.id === idKolam);
    const pasangan = [k, kembar].filter(Boolean);
    switch (nama) {
      case 'hujan':
        for (const x of this.semuaKolam) x.air.hujan = 1;
        this.catat(null, 'peringatan', 'Skenario: hujan deras di seluruh klaster (pH air turun, suhu turun).');
        break;
      case 'pakanBerlebih':
        for (const x of pasangan) { x.air.lumpurKg += 3; x.stat.pakanDiberiKg += 3; x.stat.pakanTerbuangKg += 3; }
        this.catat(k, 'peringatan', `Skenario: overfeeding 3 kg pakan ${this.komoditas.nama.toLowerCase()} manual tanpa alat. Sisa pakan mengendap jadi lumpur dasar.`);
        break;
      case 'bloom':
        for (const x of pasangan) x.air.bloom = 1;
        this.catat(k, 'peringatan', 'Skenario: ledakan alga. pH siang hari naik tajam, fraksi NH3 bebas ikut naik.');
        break;
      case 'nodeOffline':
        k.online = !k.online;
        this.kirimMqtt(`aqualock/kolam${k.id}/status`, k.online ? 'node→master' : 'broker (LWT)', k.online ? 'online' : 'offline', true);
        if (k.online) {
          k.kunci.node = k.kunci.mpu;
          this.catat(k, 'info', 'Node kembali online. Master mengirim ulang state & kunci pakan.');
        } else {
          k.kunci.node = true;
          this.catat(k, 'kritis', 'LWT diterima: node ESP32 offline. Pakan terkunci (failsafe lokal) sampai node kembali.');
        }
        break;
      case 'biofouling':
        k.hw.biofoul = 1;
        this.catat(k, 'peringatan', 'Skenario: probe pH berlumut. Sinyal jadi lambat & datar, nilai melenceng pelan.');
        break;
      case 'sequential':
        this.opsi.sequentialReading = !this.opsi.sequentialReading;
        this.catat(null, this.opsi.sequentialReading ? 'aman' : 'kritis',
          this.opsi.sequentialReading ? 'Sequential Reading AKTIF kembali: probe TDS dimatikan sebelum membaca pH.'
            : 'Sequential Reading DIMATIKAN: probe TDS & pH aktif bersamaan → ground loop, pembacaan pH melonjak.');
        break;
      case 'tangkiPenuh':
        this.tangki.isiL = this.tangki.kapasitasL * 0.96;
        this.catat(null, 'peringatan', `Skenario: Tangki POC terisi ${Math.round(this.tangki.isiL)} L dari ${this.tangki.kapasitasL} L.`);
        break;
      case 'mpuHang':
        if (k.fsm.state !== STATE.CLEANING || k.fsm.sub !== 'KURAS') {
          k.air.lumpurKg += 1.5;
          this.masukState(k, STATE.CLEANING, 'CEK_TANGKI', 'Uji: kuras dimulai sebelum MPU hang');
          this.langkahCleaning(k, false, { perluKuras: true });
        }
        if (k.fsm.sub === 'KURAS') bukaTargetDrainPenuh(k);
        this.master.hangSampai = this.t + 360;
        this.master.sedangHang = true;
        this.catat(null, 'kritis', 'Skenario: OS Linux MPU hang saat kuras. Dashboard & AI berhenti; STM32 dan ESP32 tetap jalan.');
        break;
      default:
        break;
    }
    this.versi++;
  }

  kosongkanTangki() {
    const isi = Math.round(this.tangki.isiL);
    this.catat(null, 'aman', `Panen POC: ${isi} L limbah dasar (±${this.tangki.organikKg.toFixed(1)} kg bahan organik) dipindah ke pengolahan pupuk cair.`);
    this.tangki.panenL += this.tangki.isiL;
    this.tangki.isiL = 0;
    this.tangki.organikKg = 0;
    this.versi++;
  }

  aturTangki(id) {
    const tipe = TANGKI_POC.pilihan.find((p) => p.id === id);
    this.opsi.tangkiId = id;
    this.tangki.nama = tipe.nama;
    this.tangki.kapasitasL = tipe.kapasitasL;
    this.tangki.isiL = Math.min(this.tangki.isiL, tipe.kapasitasL);
    this.catat(null, 'info', `Tangki POC diganti: ${tipe.nama}.`);
    this.versi++;
  }

  // Pengaturan dari slider dashboard: padat tebar & rasio pakan harian
  aturIkan(jumlah, rasio) {
    for (const k of this.semuaKolam) {
      if (jumlah) k.ikan.jumlah = jumlah;
      if (rasio) k.ikan.rasio = rasio;
    }
    this.versi++;
  }

  // Jeda booting 30 dtk saat pergantian mode komoditas: tahan keputusan pakan & FSM
  mulaiBooting(targetId, totalDtk = 30) {
    const target = ambilProfilKomoditas(targetId);
    this.booting = { targetId: target.id, targetNama: target.nama, sisaDtk: totalDtk, totalDtk };
    this.catat(null, 'peringatan', `Booting patokan mode ${target.nama} (${totalDtk} dtk). Keputusan pakan & transisi FSM ditahan sampai selesai.`);
    this.versi++;
  }

  perbaruiBooting(sisaDtk) {
    if (!this.booting) return;
    this.booting = { ...this.booting, sisaDtk: Math.max(0, sisaDtk) };
    this.versi++;
  }

  terapkanKomoditas(targetId, dilewati = false) {
    const profil = ambilProfilKomoditas(targetId);
    this.opsi.komoditasId = profil.id;
    this.komoditas = profil;
    this.ambang = profil.ambang;
    this.booting = null;
    for (const k of this.semuaKolam) {
      k.ikan.jumlah = profil.tebar.jumlahDefault;
      k.ikan.bobotG = profil.tebar.bobotG;
      k.ikan.rasio = profil.tebar.rasioPakan;
      k.fsm.hitKotor = 0;
      k.fsm.hitPh = 0;
    }
    for (const k of this.kolam) {
      if (k.online) k.ai = evaluasiAI(k, this.t, this.jam, this.ambang);
    }
    this.catat(
      null,
      'aman',
      `Patokan mode ${profil.nama} aktif${dilewati ? ' (Skip Booting)' : ''}: pH ${profil.ambang.PH_MIN}–${profil.ambang.PH_MAX}, TDS ≤ ${profil.ambang.TDS_MAX} ppm, suhu dingin < ${profil.ambang.SUHU_DINGIN} °C, pakan ${(profil.tebar.rasioPakan * 100).toFixed(1)}%.`,
    );
    this.kirimMqtt('aqualock/system/profile', 'master→node', {
      commodity: profil.id,
      ph_min: profil.ambang.PH_MIN,
      ph_max: profil.ambang.PH_MAX,
      tds_max: profil.ambang.TDS_MAX,
      temp_cold: profil.ambang.SUHU_DINGIN,
      risk_lock: profil.ambang.RISIKO_LOCK,
      skipped: dilewati,
    }, true);
    this.versi++;
  }

  terapkanKalibrasi(idKolam, kal, bersihkanProbe) {
    const k = this.kolam.find((x) => x.id === idKolam);
    if (bersihkanProbe) {
      k.hw.biofoul = 0;
      k.hw.phTerasa = k.air.ph;
    }
    k.kal = { ...k.kal, ...kal };
    k.bufPh = [];
    this.catat(k, 'aman', `Kalibrasi disimpan ke calibration.json (${kal.metode}).${bersihkanProbe ? ' Probe dibersihkan.' : ''}`);
    this.versi++;
  }
}

// Saat MPU hang, master tidak bisa menutup drain di target volume.
// Target dinaikkan agar hanya watchdog ESP32 yang menghentikannya.
function bukaTargetDrainPenuh(k) {
  k.fsm.volTarget = k.V0;
}
