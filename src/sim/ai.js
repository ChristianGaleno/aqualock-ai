// =============================================================
// ai.js — Mesin Evaluasi AI (PRD F2)
//  1. Fitur: [pH, TDS, Suhu, pH_delta (30 mnt), jam_harian, pakan_6j]
//     pakan_6j = pakan yang dijatuhkan servo 6 jam terakhir (% biomassa),
//     diambil dari log servo sendiri — tanpa sensor tambahan.
//  2. XGBoost → probabilitas risiko toksisitas NH3 (0.00–1.00)
//  3. Porsi pakan dinamis: 100% / 50% / 0%
//  4. Prediksi tren pH 30 menit (regresi linear) + deteksi anomali
//  5. Durasi dosing proporsional (maks 4 detik)
//  6. Deteksi data datar (indikasi probe berlumut / sensor drift)
// =============================================================
import MODEL from './xgb_model.js';
import { prediksiProba } from './model.js';
import { AMBANG, AKTUATOR, PORSI } from './constants.js';
import { turunanPhHarian } from './chemistry.js';

export const NAMA_FITUR = ['ph', 'tds', 'suhu', 'ph_delta', 'jam', 'pakan_6j'];
export const MODEL_AI = MODEL;

const JENDELA_DELTA_DTK = 1800;   // 30 menit
const JENDELA_DATAR_DTK = 3600;   // 60 menit

// Simpan pembacaan pH tiap 30 detik ke buffer (maks 65 menit)
export function perbaruiBufferPh(kolam, t) {
  kolam.bufPh.push({ t, ph: kolam.ukur.ph });
  while (kolam.bufPh.length && kolam.bufPh[0].t < t - 3900) kolam.bufPh.shift();
}

function regresi(titik) {
  const n = titik.length;
  if (n < 3) return { slope: 0, sisaStd: 1 };
  const t0 = titik[0].t;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of titik) {
    const x = p.t - t0;
    sx += x; sy += p.ph; sxx += x * x; sxy += x * p.ph;
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const c = (sy - slope * sx) / n;
  let ss = 0;
  for (const p of titik) ss += (p.ph - (slope * (p.t - t0) + c)) ** 2;
  return { slope, sisaStd: Math.sqrt(ss / n) };
}

// Hitung fitur model dari data terukur (dipakai juga oleh generator dataset)
export function hitungFitur(kolam, t, jam) {
  const buf = kolam.bufPh;
  let phDelta = 0;
  if (buf.length && t - buf[0].t >= JENDELA_DELTA_DTK - 60) {
    const acuan = buf.find((p) => p.t >= t - JENDELA_DELTA_DTK) || buf[0];
    phDelta = kolam.ukur.ph - acuan.ph;
  }
  const biomassaKg = (kolam.ikan.jumlah * kolam.ikan.bobotG) / 1000;
  const pakanKg = kolam.logPakan.reduce((s, p) => (p.t >= t - 6 * 3600 ? s + p.kg : s), 0);
  const pakan6j = (pakanKg / biomassaKg) * 100;
  return [kolam.ukur.ph, kolam.ukur.tds, kolam.ukur.suhu, phDelta, jam, pakan6j];
}

export function tentukanPorsi(risiko, suhu, ambang = AMBANG) {
  if (risiko >= ambang.RISIKO_LOCK) return PORSI.KUNCI;
  if (risiko >= ambang.RISIKO_KURANG || suhu < ambang.SUHU_DINGIN) return PORSI.KURANG;
  return PORSI.PENUH;
}

export function evaluasiAI(kolam, t, jam, ambang = AMBANG) {
  const x = hitungFitur(kolam, t, jam);
  const risiko = prediksiProba(MODEL, x);
  const porsi = tentukanPorsi(risiko, x[2], ambang);

  // Prediksi pH 30 menit ke depan dari tren 30 menit terakhir
  const buf30 = kolam.bufPh.filter((p) => p.t >= t - JENDELA_DELTA_DTK);
  const { slope } = regresi(buf30);
  const phPred = kolam.ukur.ph + slope * 1800;

  // Bedakan fluktuasi harian normal vs perubahan abnormal (limbah/hujan)
  const deltaHarian = turunanPhHarian(jam) * 0.5; // perubahan wajar dalam 30 mnt
  const selisih = x[3] - deltaHarian;
  const anomali = selisih < -0.15 ? 'TURUN_ABNORMAL' : selisih > 0.15 ? 'NAIK_ABNORMAL' : 'POLA_HARIAN';

  // Data datar: sisa regresi 60 menit sangat kecil → probe kemungkinan berlumut
  const buf60 = kolam.bufPh.filter((p) => p.t >= t - JENDELA_DATAR_DTK);
  const cukup = buf60.length >= 100;
  const dataDatar = cukup && regresi(buf60).sisaStd < 0.005;

  return { fitur: x, risiko, porsi, phPred, phDelta: x[3], anomali, dataDatar, t };
}

// Durasi dosing proporsional + feed-forward prediksi tren (PRD F2)
// durasi = (selisih pH ke target ÷ gain pompa) × 0,8  → dibatasi 0,5–4 detik
export function hitungDosis(ph, phPred, ambang = AMBANG) {
  let arah, target, acuan;
  const tengah = (ambang.PH_MIN + ambang.PH_MAX) / 2;
  if (ph < tengah) {
    arah = 'UP'; target = ambang.PH_TARGET_UP ?? 7.0; acuan = Math.min(ph, phPred);
  } else {
    arah = 'DOWN'; target = ambang.PH_TARGET_DOWN ?? 7.5; acuan = Math.max(ph, phPred);
  }
  const selisih = Math.abs(target - acuan);
  const durasi = Math.min(AKTUATOR.DOSING_MAKS_DTK,
    Math.max(0.5, (selisih / AKTUATOR.DOSING_GAIN_PH_PER_DTK) * 0.8));
  return { arah, target, acuan, selisih, durasi };
}
