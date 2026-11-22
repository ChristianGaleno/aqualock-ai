// =============================================================
// chemistry.js — Rumus kimia air & sensor (PRD Bab 6)
// =============================================================

// Fraksi amonia bebas (NH3) dari Total Ammonia Nitrogen (TAN).
// Emerson et al. (1975): pKa = 0.09018 + 2729.92 / T(Kelvin)
// fraksi = 1 / (10^(pKa − pH) + 1)
export function fraksiNH3(ph, suhuC) {
  const pKa = 0.09018 + 2729.92 / (suhuC + 273.15);
  return 1 / (Math.pow(10, pKa - ph) + 1);
}

export function volumeKolamL(diameterM, tinggiM) {
  return Math.PI * (diameterM / 2) ** 2 * tinggiM * 1000;
}

// Pola harian suhu: minimum ±03.00 (26 °C), maksimum ±15.00 (30 °C)
export function suhuHarian(jam) {
  return 28 + 2 * Math.sin((2 * Math.PI * (jam - 9)) / 24);
}

// Pola harian pH akibat fotosintesis (siang naik) & respirasi (malam turun)
export function phHarian(jam) {
  return 0.3 * Math.sin((2 * Math.PI * (jam - 8)) / 24);
}

// Turunan pola harian pH per jam (dipakai deteksi anomali tren)
export function turunanPhHarian(jam) {
  return 0.3 * ((2 * Math.PI) / 24) * Math.cos((2 * Math.PI * (jam - 8)) / 24);
}

// ---------- Sensor pH (modul pH-4502C via ADS1115) ----------
// Tegangan netral 2,5 V pada pH 7; kemiringan pabrik ≈ 0,18 V/pH.
export const PH_V_NETRAL = 2.5;
export const PH_SLOPE_PABRIK = 0.18;

// Kalibrasi pabrik: pH = m·V + c (m negatif karena V turun saat pH naik)
export const KALIBRASI_PABRIK = {
  m: -1 / PH_SLOPE_PABRIK,
  c: 7 + PH_V_NETRAL / PH_SLOPE_PABRIK,
  k: 1,
};

// Regresi linear kuadrat terkecil untuk kalibrasi 2-point / 3-point
// Input: titik [{ v, ph }] → output { m, c, r2 }
export function regresiLinear(titik) {
  const n = titik.length;
  const sx = titik.reduce((s, p) => s + p.v, 0);
  const sy = titik.reduce((s, p) => s + p.ph, 0);
  const sxx = titik.reduce((s, p) => s + p.v * p.v, 0);
  const sxy = titik.reduce((s, p) => s + p.v * p.ph, 0);
  const m = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const c = (sy - m * sx) / n;
  const rata = sy / n;
  const ssTot = titik.reduce((s, p) => s + (p.ph - rata) ** 2, 0);
  const ssRes = titik.reduce((s, p) => s + (p.ph - (m * p.v + c)) ** 2, 0);
  return { m, c, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
}

// ---------- Sensor TDS (formula modul TDS DFRobot) ----------
// Kompensasi suhu 2%/°C terhadap suhu referensi 25 °C (PRD Bab 6)
export function kompensasiSuhu(vRaw, suhuC) {
  return vRaw / (1 + 0.02 * (suhuC - 25));
}

// Konversi tegangan terkompensasi → ppm
export function ppmDariTegangan(v) {
  return (133.42 * v ** 3 - 255.86 * v ** 2 + 857.39 * v) * 0.5;
}

// Kebalikan rumus di atas (hanya untuk simulator membangkitkan tegangan)
export function teganganDariPpm(ppm) {
  let v = ppm / 430; // tebakan awal
  for (let i = 0; i < 20; i++) {
    const f = ppmDariTegangan(v) - ppm;
    const df = (3 * 133.42 * v ** 2 - 2 * 255.86 * v + 857.39) * 0.5;
    v -= f / df;
  }
  return v;
}
