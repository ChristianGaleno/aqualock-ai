// =============================================================
// generate_dataset.mjs — Membuat dataset sintetis untuk melatih XGBoost
//
// Cara kerja: simulator dijalankan tanpa UI selama 120 hari simulasi
// dengan kejadian acak (hujan, pakan berlebih, ledakan alga, kebiasaan
// pakan & ganti air yang berbeda-beda). Tiap 10 menit dicatat:
//   fitur  = [ph, tds, suhu, ph_delta, jam, pakan_6j] ← sensor + log servo
//   label  = 1 jika NH3 bebas sebenarnya > 0.05 mg/L (rumus Emerson)
// Model tidak pernah melihat TAN/NH3 langsung (tidak ada sensor amonia),
// jadi ia harus belajar menebak risiko dari sensor murah.
//
// Jalankan:  node ml/generate_dataset.mjs   → ml/dataset.csv
// =============================================================
import { writeFileSync } from 'node:fs';
import { Simulator } from '../src/sim/engine.js';
import { hitungFitur } from '../src/sim/ai.js';
import { AMBANG } from '../src/sim/constants.js';

const HARI = 120;
const rows = ['hari,kolam,mode,ph,tds,suhu,ph_delta,jam,pakan_6j,nh3_sebenarnya,label'];
let seed = 7;
const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

for (const ulang of [1, 2]) {
  const sim = new Simulator({ kembar: true, seed: 1000 + ulang });
  for (const k of sim.kembar) {
    k.ikan.faktorTimer = 0.9 + rng() * 0.7;   // ada pembudidaya yang memberi pakan berlebih
    k.gantiAirHarian = rng() * 0.2;
  }
  for (let hari = 0; hari < HARI / 2; hari++) {
    const jamHujan = rng() < 0.35 ? rng() * 24 : -1;
    const kejadian = sim.semuaKolam.map(() => ({
      jamPakan: rng() < 0.25 ? rng() * 24 : -1, kg: 1 + rng() * 3,
      jamBloom: rng() < 0.08 ? 8 + rng() * 6 : -1, kuat: 0.5 + rng() * 0.7,
    }));
    for (let menit = 0; menit < 1440; menit += 10) {
      sim.maju(600);
      const jam = sim.jam;
      if (jamHujan >= 0 && Math.abs(jam - jamHujan) < 0.09) for (const k of sim.semuaKolam) k.air.hujan = 0.6 + rng() * 0.6;
      sim.semuaKolam.forEach((k, i) => {
        const e = kejadian[i];
        if (e.jamPakan >= 0 && Math.abs(jam - e.jamPakan) < 0.09) k.air.lumpurKg += e.kg;
        if (e.jamBloom >= 0 && Math.abs(jam - e.jamBloom) < 0.09) k.air.bloom = e.kuat;
        if (!k.online || k.bufPh.length < 3) return;
        const x = hitungFitur(k, sim.t, jam);
        const label = k.nh3 > AMBANG.NH3_TOKSIK ? 1 : 0;
        const h = (ulang - 1) * (HARI / 2) + hari;
        rows.push([h, k.id, k.kontrol ? 'aqualock' : 'timer', ...x.map((v) => +v.toFixed(4)), +k.nh3.toFixed(4), label].join(','));
      });
    }
    // kosongkan tangki POC berkala agar kolam terkendali tidak tertahan
    if (sim.tangki.isiL > sim.tangki.kapasitasL * 0.5) sim.kosongkanTangki();
  }
}
writeFileSync(new URL('./dataset.csv', import.meta.url), rows.join('\n'));
const n = rows.length - 1;
const pos = rows.slice(1).filter((r) => r.endsWith(',1')).length;
console.log(`dataset.csv: ${n} baris, label berbahaya ${pos} (${((pos / n) * 100).toFixed(1)}%)`);
