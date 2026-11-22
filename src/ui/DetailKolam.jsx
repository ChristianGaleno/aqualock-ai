// Panel detail kolam terpilih: FSM, keputusan AI, aktuator, Sequential Reading, grafik
import { useEffect, useMemo, useState } from 'react';
import { AMBANG, AKTUATOR, STATE } from '../sim/constants.js';
import { LANGKAH_FSM } from '../sim/engine.js';
import { angka, infoState, NAMA_SUB, jamMenit } from './format.js';
import { PilState } from './PondCard.jsx';
import TrendChart from './Charts.jsx';

const JENDELA = [
  { id: 2, label: '2 jam' },
  { id: 6, label: '6 jam' },
  { id: 24, label: '24 jam' },
];

function progresSub(k) {
  const f = k.fsm;
  switch (f.sub) {
    case 'KURAS': return `${angka(f.volSudah)} / ${angka(f.volTarget)} L`;
    case 'ISI_ULANG': return `${angka((k.air.volumeL / k.V0) * 100, 1)}% volume`;
    case 'ENDAPKAN': return `${Math.round(f.timer)} / ${AKTUATOR.ENDAPKAN_DTK} dtk`;
    case 'DOSING': return f.dosis ? `${f.dosis.arah === 'UP' ? 'pH-Up' : 'pH-Down'} ${angka(f.dosis.durasi, 1)} dtk` : '';
    case 'HOMOGENISASI': return `${Math.round(f.timer)} / ${AKTUATOR.HOMOGENISASI_DTK} dtk`;
    default: return '';
  }
}

export function AlurFsm({ k, sim }) {
  const f = k.fsm;
  const info = infoState(k, sim);
  const langkah = LANGKAH_FSM[f.state] || [];
  const daftar = f.sub === 'DITUNDA' ? ['CEK_TANGKI', 'DITUNDA'] : langkah;
  const idx = daftar.indexOf(f.sub);
  return (
    <section className="blok">
      <div className="blok-kepala">
        <h4>Finite State Machine</h4>
        <PilState info={info} />
      </div>
      <div className="fsm-state" role="list">
        {[STATE.NORMAL, STATE.CLEANING, STATE.PH_RECOVERY].map((s) => (
          <div key={s} role="listitem" className={`fsm-kotak ${f.state === s ? `aktif aktif-${s}` : ''}`}>
            {s}
            <small>{s === 'NORMAL' ? 'pakan diizinkan' : 'kunci pakan'}</small>
          </div>
        ))}
      </div>
      {f.state !== STATE.NORMAL ? (
        <>
          <ol className="fsm-langkah">
            {daftar.map((s, i) => (
              <li key={s} className={i < idx ? 'lewat' : i === idx ? 'kini' : ''}>
                <span>{NAMA_SUB[s]}</span>
                {i === idx && <em>{progresSub(k)}</em>}
              </li>
            ))}
          </ol>
          <p className="catatan">Siklus ke-{f.siklus} · Pemicu: {f.alasan}</p>
        </>
      ) : (
        <p className="catatan">Semua parameter aman. Auto-feeder mengikuti jadwal 07.00 · 12.00 · 17.00 dengan porsi dari AI.</p>
      )}
    </section>
  );
}

const NAMA_TREN = {
  POLA_HARIAN: 'Sesuai pola siang–malam',
  TURUN_ABNORMAL: 'Turun abnormal',
  NAIK_ABNORMAL: 'Naik abnormal',
};

export function PanelAI({ k }) {
  const ai = k.ai;
  return (
    <section className="blok">
      <div className="blok-kepala"><h4>Keputusan AI</h4><span className="label-kecil">XGBoost · tiap 30 dtk</span></div>
      <dl className="daftar-ai">
        <div><dt>Risiko toksisitas NH3</dt><dd className="angka-mono besar">{angka(ai.risiko, 2)}</dd></div>
        <div><dt>Porsi pakan</dt><dd><code>{ai.porsi.kode}</code></dd></div>
        <div><dt>Prediksi pH +30 mnt</dt><dd className="angka-mono">{angka(ai.phPred, 2)}</dd></div>
        <div><dt>pH_delta 30 mnt</dt><dd className="angka-mono">{ai.phDelta >= 0 ? '+' : ''}{angka(ai.phDelta, 2)}</dd></div>
        <div><dt>Tren pH</dt><dd className={ai.anomali !== 'POLA_HARIAN' ? 'teks-serius' : ''}>{NAMA_TREN[ai.anomali]}</dd></div>
        <div><dt>NH3 sebenarnya <small>(hanya simulator)</small></dt><dd className="angka-mono">{angka(k.nh3, 3)} mg/L</dd></div>
      </dl>
      <p className="vektor" title="[ph, tds, suhu, ph_delta, jam, pakan_6j]">x = [{ai.fitur?.length ? ai.fitur.map((v, i) => angka(v, i === 1 ? 0 : 2)).join(', ') : '…'}]</p>
      {ai.dataDatar && (
        <p className="peringatan-baris">Data pH datar selama 60 menit. Probe kemungkinan berlumut: bersihkan lalu jalankan kalibrasi.</p>
      )}
    </section>
  );
}

export function Aktuator({ k, sim }) {
  const d = k.fsm.sub === 'DOSING' && k.fsm.dosis;
  const daftar = [
    ['Servo pakan', sim.t < k.akt.servoSampai],
    ['Solenoid drain', k.akt.drain],
    ['Solenoid inlet', k.akt.inlet],
    ['Pompa pH-Up', d && k.fsm.dosis.arah === 'UP'],
    ['Pompa pH-Down', d && k.fsm.dosis.arah === 'DOWN'],
  ];
  return (
    <section className="blok">
      <div className="blok-kepala"><h4>Aktuator node ESP32</h4></div>
      <ul className="aktuator">
        {daftar.map(([nama, on]) => (
          <li key={nama} className={on ? 'nyala' : ''}><span className="lampu" />{nama}<em>{on ? 'ON' : 'OFF'}</em></li>
        ))}
      </ul>
      <div className="kunci-redundan">
        <span className="label-kecil">feed_lock tersimpan di</span>
        {[['MPU', k.kunci.mpu], ['STM32', k.kunci.stm32], ['ESP32', k.kunci.node]].map(([n, v]) => (
          <span key={n} className={`chip ${v ? 'chip-kritis' : 'chip-baik'}`}>{n}: {v ? 'true' : 'false'}</span>
        ))}
      </div>
    </section>
  );
}

const LANGKAH_SEQ = [
  ['MOSFET ON', 'Daya probe TDS dinyalakan'],
  ['Stabilisasi', 'Tunggu sinyal TDS stabil'],
  ['Baca TDS', 'ADS1115 kanal A1'],
  ['MOSFET OFF', 'VCC TDS diputus total'],
  ['Jeda isolasi', 'Hilangkan arus sisa'],
  ['Baca pH', 'ADS1115 kanal A0'],
  ['Baca suhu', 'DS18B20 1-Wire'],
];

export function SequentialReading({ aktif }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % LANGKAH_SEQ.length), 650);
    return () => clearInterval(id);
  }, []);
  return (
    <section className="blok">
      <div className="blok-kepala">
        <h4>Sequential Reading</h4>
        <span className={`chip ${aktif ? 'chip-baik' : 'chip-kritis'}`}>{aktif ? 'Aktif' : 'Mati: ground loop'}</span>
      </div>
      {aktif ? (
        <ol className="seq">
          {LANGKAH_SEQ.map(([n, d], j) => (
            <li key={n} className={j === i ? 'kini' : ''} title={d}>{n}</li>
          ))}
        </ol>
      ) : (
        <p className="peringatan-baris">Probe TDS & pH aktif bersamaan. Arus dari probe TDS bocor ke elektroda pH, pembacaan pH melonjak ±0,2–0,5 dan bisa memicu dosing yang salah.</p>
      )}
    </section>
  );
}

function ambilData(riwayat, jamJendela) {
  if (!riwayat.length) return [];
  const tAkhir = riwayat[riwayat.length - 1].t;
  const awal = tAkhir - jamJendela * 3600;
  const pilih = riwayat.filter((d) => d.t >= awal);
  const langkah = Math.max(1, Math.ceil(pilih.length / 240));
  return pilih.filter((_, i) => i % langkah === 0 || i === pilih.length - 1);
}

export default function DetailKolam({ k, sim }) {
  const [jendela, setJendela] = useState(6);
  const tAkhir = k.riwayat.length ? k.riwayat[k.riwayat.length - 1].t : 0;
  const data = useMemo(() => ambilData(k.riwayat, jendela), [k.id, tAkhir, jendela, k.riwayat]);
  return (
    <div className="detail">
      <div className="detail-kepala">
        <h2>{k.nama} <small>· esp32-k{k.id} · {angka(k.V0)} L · {k.ikan.jumlah.toLocaleString('id-ID')} ekor</small></h2>
      </div>
      <div className="detail-grid">
        <AlurFsm k={k} sim={sim} />
        <PanelAI k={k} />
        <Aktuator k={k} sim={sim} />
        <SequentialReading aktif={sim.opsi.sequentialReading} />
      </div>
      <div className="grafik-kepala">
        <h4>Tren sensor &amp; risiko</h4>
        <div className="segmen" role="group" aria-label="Rentang waktu grafik">
          {JENDELA.map((j) => (
            <button key={j.id} className={jendela === j.id ? 'aktif' : ''} onClick={() => setJendela(j.id)}>{j.label}</button>
          ))}
        </div>
      </div>
      <p className="catatan">Latar merah = CLEANING, oranye = PH_RECOVERY (kunci pakan aktif). Data tercatat tiap 1 menit{data.length ? `, terakhir ${jamMenit(tAkhir)}` : ''}.</p>
      <div className="grafik-grid">
        <TrendChart judul="pH" data={data} kunci="ph" desimal={2} domain={[5.5, 9]} ticks={[6, 7, 8, 9]} pita={[AMBANG.PH_MIN, AMBANG.PH_MAX]}
          batas={[{ y: AMBANG.PH_MIN, warna: 'var(--serius)', label: '6,5' }, { y: AMBANG.PH_MAX, warna: 'var(--serius)', label: '8,2' }]} />
        <TrendChart judul="TDS" data={data} kunci="tds" satuan="ppm" domain={[200, 800]} ticks={[200, 400, 600, 800]}
          batas={[{ y: AMBANG.TDS_MAX, warna: 'var(--kritis)', label: '600 ppm' }]} />
        <TrendChart judul="Suhu air" data={data} kunci="suhu" satuan="°C" desimal={1} domain={[20, 33]} ticks={[20, 24, 28, 32]}
          batas={[{ y: AMBANG.SUHU_DINGIN, warna: 'var(--peringatan)', label: '24 °C' }]} />
        <TrendChart judul="Risiko NH3 (AI)" data={data} kunci="risiko" desimal={2} domain={[0, 1]} ticks={[0, 0.5, 1]}
          batas={[{ y: AMBANG.RISIKO_KURANG, warna: 'var(--peringatan)', label: '0,40' }, { y: AMBANG.RISIKO_LOCK, warna: 'var(--kritis)', label: '0,70' }]} />
      </div>
    </div>
  );
}
