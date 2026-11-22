// Kartu ringkas per kolam (PRD F6): status FSM, sensor, risiko AI, kunci pakan
import { AMBANG } from '../sim/constants.js';
import { angka, infoState } from './format.js';
import { IkonState, IkonKunci, IkonBuka } from './Icons.jsx';

export function PilState({ info }) {
  return (
    <span className={`pil pil-${info.nada}`}>
      <IkonState nada={info.nada} size={13} />
      {info.label}
    </span>
  );
}

export function MeterRisiko({ nilai, offline }) {
  const persen = Math.max(0, Math.min(1, nilai)) * 100;
  const nada = nilai >= AMBANG.RISIKO_LOCK ? 'kritis' : nilai >= AMBANG.RISIKO_KURANG ? 'peringatan' : 'baik';
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={nilai} aria-label="Risiko toksisitas NH3">
      <div className="meter-jalur">
        <div className={`meter-isi isi-${offline ? 'mati' : nada}`} style={{ width: `${persen}%` }} />
        <span className="meter-tanda" style={{ left: `${AMBANG.RISIKO_KURANG * 100}%` }} />
        <span className="meter-tanda" style={{ left: `${AMBANG.RISIKO_LOCK * 100}%` }} />
      </div>
    </div>
  );
}

export default function PondCard({ k, sim, dipilih, onPilih, onPakan }) {
  const info = infoState(k, sim);
  const kunci = sim.terkunci(k);
  const phLuar = k.ukur.ph < AMBANG.PH_MIN || k.ukur.ph > AMBANG.PH_MAX;
  const tdsTinggi = k.ukur.tds > AMBANG.TDS_MAX;
  return (
    <article className={`kartu kartu-kolam garis-${info.nada} ${dipilih ? 'dipilih' : ''}`}>
      <button className="kartu-klik" onClick={onPilih} aria-pressed={dipilih}>
        <header className="kartu-kepala">
          <h3>{k.nama}</h3>
          <PilState info={info} />
        </header>
        <dl className="metrik4">
          <div className={phLuar ? 'luar' : ''}><dt>pH</dt><dd>{k.online ? angka(k.ukur.ph, 2) : '–'}</dd></div>
          <div className={tdsTinggi ? 'luar' : ''}><dt>TDS</dt><dd>{k.online ? angka(k.ukur.tds) : '–'}<small> ppm</small></dd></div>
          <div className={k.ukur.suhu < AMBANG.SUHU_DINGIN ? 'luar' : ''}><dt>Suhu</dt><dd>{k.online ? angka(k.ukur.suhu, 1) : '–'}<small> °C</small></dd></div>
          <div><dt>Level</dt><dd>{k.online ? angka(k.ukur.levelCm, 0) : '–'}<small> cm</small></dd></div>
        </dl>
        <div className="risiko-baris">
          <span className="label-kecil">Risiko NH3 (AI)</span>
          <strong className="angka-mono">{k.online ? angka(k.ai.risiko, 2) : '–'}</strong>
        </div>
        <MeterRisiko nilai={k.ai.risiko} offline={!k.online} />
      </button>
      <div className={`baris-kunci ${kunci ? 'terkunci' : 'terbuka'}`}>
        {kunci ? <IkonKunci size={15} /> : <IkonBuka size={15} />}
        <span>{kunci ? sim.alasanKunci(k) : `Pakan diizinkan · ${k.ai.porsi.kode}`}</span>
      </div>
      <button className="tombol tombol-pakan" disabled={kunci} onClick={onPakan}
        title={kunci ? 'Tombol dashboard dinonaktifkan selama kunci pakan aktif' : 'Beri pakan sesuai porsi AI'}>
        Beri makan manual
      </button>
    </article>
  );
}
