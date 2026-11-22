// Panel Master Gateway (Arduino Uno Q): layar OLED, tombol Manual Feed fisik,
// buzzer. Bagian ini dikendalikan MCU STM32 sehingga tetap hidup saat MPU hang.
import { useEffect, useRef, useState } from 'react';
import { AKTUATOR } from '../sim/constants.js';
import { jamMenit } from './format.js';
import { IkonSuara, IkonBisu } from './Icons.jsx';

const LEBAR = 21; // font 6×8 px pada OLED 128×64 → 21 karakter × 8 baris
const potong = (s) => s.slice(0, LEBAR).padEnd(LEBAR, ' ');

function barisRingkas(sim, idPilih) {
  const hang = sim.t < sim.master.hangSampai;
  const online = sim.kolam.filter((k) => k.online).length;
  const baris = [`AQUA-LOCK H${sim.hari} ${jamMenit(sim.t)}`];
  for (const k of sim.kolam) {
    let s;
    if (!k.online) s = 'OFFLINE  LOCK';
    else if (k.fsm.state === 'CLEANING') s = `LOCK KURAS ${k.fsm.sub === 'DITUNDA' ? 'TUNDA' : ''}`;
    else if (k.fsm.state === 'PH_RECOVERY') s = `LOCK pH ${k.ukur.ph.toFixed(2)}`;
    else s = `SEHAT ${String(k.ai.porsi.faktor * 100).padStart(3)}%`;
    baris.push(`${k.id === idPilih ? '>' : ' '}K${k.id} ${s}`);
  }
  const poc = Math.round((sim.tangki.isiL / sim.tangki.kapasitasL) * 100);
  baris.push(`POC ${String(poc).padStart(3)}%  MQTT ${online}/${sim.kolam.length}`);
  baris.push(hang ? 'MPU HANG: STM32 AKTIF' : 'MPU OK  AI XGB ONLINE');
  return baris.map(potong);
}

function barisTolak(h) {
  return [
    `!! DITOLAK ${h.latensiMs.toFixed(0)} ms !!`,
    `Kolam ${h.kolam}:`,
    ...pecah(h.alasan, LEBAR).slice(0, 3),
    'Servo diam',
    'Buzzer ON',
    `Batas KPI <${AKTUATOR.INTERLOCK_MAKS_MS} ms: OK`,
  ].slice(0, 8).map(potong);
}

function barisTerima(h) {
  return [`PAKAN MANUAL OK`, `Kolam ${h.kolam}`, `${Math.round(h.gram)} g sesuai porsi AI`, `Respons ${h.latensiMs.toFixed(0)} ms`, '', '', '', ''].map(potong);
}

function pecah(teks, n) {
  const kata = teks.split(' ');
  const hasil = [];
  let baris = '';
  for (const w of kata) {
    if ((baris + ' ' + w).trim().length > n) { hasil.push(baris.trim()); baris = w; } else baris += ' ' + w;
  }
  if (baris.trim()) hasil.push(baris.trim());
  return hasil;
}

// Bunyi buzzer pendek lewat Web Audio (hanya setelah ada klik pengguna)
let ctx = null;
let terakhirBunyi = 0;
export function bunyiBuzzer(pola = 3) {
  const kini = performance.now();
  if (kini - terakhirBunyi < 1500) return; // jangan berbunyi beruntun saat simulasi dipercepat
  terakhirBunyi = kini;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    for (let i = 0; i < pola; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = 2300;
      g.gain.value = 0.035;
      o.connect(g).connect(ctx.destination);
      const t = ctx.currentTime + i * 0.16;
      o.start(t);
      o.stop(t + 0.09);
    }
  } catch { /* audio tidak tersedia */ }
}

export default function Gateway({ sim, idPilih, setIdPilih, hasilTombol, onTekanFisik, suara, setSuara }) {
  const [buzz, setBuzz] = useState(false);
  const terakhir = useRef(sim.master.buzzer);
  const tampil = hasilTombol && Date.now() - hasilTombol.waktu < 3500 ? hasilTombol : null;
  const baris = tampil ? (tampil.diterima ? barisTerima(tampil) : barisTolak(tampil)) : barisRingkas(sim, idPilih);

  useEffect(() => {
    if (sim.master.buzzer !== terakhir.current) {
      terakhir.current = sim.master.buzzer;
      setBuzz(true);
      if (suara) bunyiBuzzer(2);
      const id = setTimeout(() => setBuzz(false), 1200);
      return () => clearTimeout(id);
    }
    return undefined;
  });

  return (
    <section className="kartu gateway">
      <div className="blok-kepala">
        <h4>Master Gateway · Arduino Uno Q</h4>
        <button className="tombol-ikon" onClick={() => setSuara(!suara)} aria-label={suara ? 'Matikan suara buzzer' : 'Nyalakan suara buzzer'}>
          {suara ? <IkonSuara /> : <IkonBisu />}
        </button>
      </div>
      <div className={`oled ${tampil && !tampil.diterima ? 'oled-tolak' : ''}`} aria-label="Layar OLED 1,3 inci">
        {baris.map((b, i) => <pre key={i} className={i === 0 ? 'oled-judul' : ''}>{b}</pre>)}
      </div>
      <div className="panel-fisik">
        <label className="label-kecil" htmlFor="pilih-kolam-fisik">Kolam tujuan</label>
        <select id="pilih-kolam-fisik" value={idPilih} onChange={(e) => setIdPilih(Number(e.target.value))}>
          {sim.kolam.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
        </select>
        <button className="tombol-fisik" onClick={onTekanFisik}>
          <span>MANUAL FEED</span>
          <small>tombol fisik · STM32</small>
        </button>
        <div className={`buzzer ${buzz ? 'bunyi' : ''}`} aria-live="polite">
          <span className="buzzer-titik" />
          Buzzer {buzz ? 'berbunyi' : 'diam'}
        </div>
      </div>
      <p className="catatan">Tombol fisik selalu bisa ditekan. Saat kunci aktif, STM32 menolaknya lebih dulu sehingga servo tidak bergerak.</p>
    </section>
  );
}
