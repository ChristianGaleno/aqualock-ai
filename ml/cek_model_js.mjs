// Memastikan inference JavaScript identik dengan predict_proba Python
import { readFileSync } from 'node:fs';
import MODEL from '../src/sim/xgb_model.js';
import { prediksiProba } from '../src/sim/model.js';
const baris = readFileSync(new URL('./sampel_uji.csv', import.meta.url), 'utf8').trim().split('\n').slice(1);
let maks = 0;
for (const b of baris) {
  const v = b.split(',').map(Number);
  maks = Math.max(maks, Math.abs(prediksiProba(MODEL, v.slice(0, 6)) - v[6]));
}
console.log(`${baris.length} sampel, selisih maksimum JS vs Python = ${maks.toExponential(2)}`);
