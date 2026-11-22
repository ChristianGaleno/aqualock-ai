// Uji cepat dinamika simulator tanpa UI (untuk penyetelan)
import { Simulator, tdsSebenarnya } from '../src/sim/engine.js';
const sim = new Simulator({ kembar: true });
const ringkas = (k) => `${k.nama} st=${k.fsm.state.padEnd(11)} pH=${k.air.ph.toFixed(2)}/${k.ukur.ph.toFixed(2)} T=${k.air.suhu.toFixed(1)} TAN=${k.air.tan.toFixed(2)} NH3=${k.nh3.toFixed(3)} TDS=${tdsSebenarnya(k).toFixed(0)}/${k.ukur.tds.toFixed(0)} lumpur=${k.air.lumpurKg.toFixed(2)}`;
const jamStr = () => `H${sim.hari} ${String(Math.floor(sim.jam)).padStart(2,'0')}:${String(Math.floor((sim.jam%1)*60)).padStart(2,'0')}`;
const ev = process.argv[2] || 'none';
for (let i = 0; i < 48 * 4; i++) {   // 48 jam, cetak tiap 15 menit
  sim.maju(900);
  if (i === 16 && ev !== 'none') sim.skenario(ev, 1);
  if (i % 4 === 0) console.log(jamStr(), '|', ringkas(sim.kolam[0]), '| kembar', ringkas(sim.kembar[0]).slice(10));
}
console.log('stat', sim.kolam[0].stat);
console.log('kembar', sim.kembar[0].stat);
console.log('tangki', sim.tangki);
console.log(sim.log.slice(0, 25).reverse().map(l => `${l.t} K${l.kolam} ${l.level} ${l.teks}`).join('\n'));
