// Panel samping: Tangki POC, skenario demo untuk juri, perbandingan kolam kembar
import { TANGKI_POC } from '../sim/constants.js';
import { angka } from './format.js';

export function TangkiPoc({ sim, onKosongkan, onGantiTangki }) {
  const tk = sim.tangki;
  const persen = Math.min(100, (tk.isiL / tk.kapasitasL) * 100);
  const nada = persen >= 95 ? 'kritis' : persen >= 70 ? 'peringatan' : 'aksen';
  return (
    <section className="kartu">
      <div className="blok-kepala">
        <h4>Tangki Penampungan POC</h4>
        <select aria-label="Jenis tangki" value={sim.opsi.tangkiId} onChange={(e) => onGantiTangki(e.target.value)}>
          {TANGKI_POC.pilihan.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
        </select>
      </div>
      <div className="tangki">
        <div className="tangki-badan" role="meter" aria-valuenow={Math.round(persen)} aria-valuemin={0} aria-valuemax={100} aria-label="Isi tangki POC">
          <div className={`tangki-isi isi-${nada}`} style={{ height: `${persen}%` }} />
        </div>
        <dl className="tangki-info">
          <div><dt>Isi</dt><dd className="angka-mono">{angka(tk.isiL)} / {angka(tk.kapasitasL)} L</dd></div>
          <div><dt>Bahan organik</dt><dd className="angka-mono">±{angka(tk.organikKg, 1)} kg</dd></div>
          <div><dt>Sudah dipanen</dt><dd className="angka-mono">{angka(tk.panenL)} L</dd></div>
          {tk.luapanL > 0 && <div className="luar"><dt>Meluap</dt><dd className="angka-mono">{angka(tk.luapanL)} L</dd></div>}
        </dl>
      </div>
      <button className="tombol" onClick={onKosongkan} disabled={tk.isiL < 1}>Panen POC (kosongkan tangki)</button>
      <p className="catatan">Satu kali kuras 15% kolam Ø3 m (air 60 cm) ≈ {angka(0.15 * sim.kolam[0].V0)} L. Kuras ditunda jika sisa tangki &lt; {TANGKI_POC.SISA_MIN_L} L.</p>
    </section>
  );
}

const SKENARIO = [
  { id: 'hujan', judul: 'Hujan deras', isi: 'pH turun, suhu air turun di semua kolam', semua: true },
  { id: 'pakanBerlebih', judul: 'Pakan berlebih manual', isi: '3 kg ditabur pekerja tanpa alat → TDS naik' },
  { id: 'bloom', judul: 'Ledakan alga', isi: 'pH siang naik tajam, NH3 bebas meningkat' },
  { id: 'nodeOffline', judul: 'Node offline (LWT)', isi: 'Wi-Fi node putus, kunci failsafe lokal', toggle: true },
  { id: 'biofouling', judul: 'Probe pH berlumut', isi: 'Sinyal datar & drift → minta kalibrasi' },
  { id: 'sequential', judul: 'Matikan Sequential Reading', isi: 'Demo ground loop TDS ↔ pH', semua: true, toggle: true },
  { id: 'tangkiPenuh', judul: 'Tangki POC hampir penuh', isi: 'Kuras berikutnya parsial atau ditunda', semua: true },
  { id: 'mpuHang', judul: 'MPU Linux hang saat kuras', isi: 'Watchdog ESP32 & lock STM32 diuji' },
];

export function PanelSkenario({ sim, idPilih, onSkenario }) {
  const k = sim.kolam.find((x) => x.id === idPilih);
  const aktif = { nodeOffline: !k.online, sequential: !sim.opsi.sequentialReading };
  return (
    <section className="kartu">
      <div className="blok-kepala">
        <h4>Skenario demo juri</h4>
        <span className="label-kecil">target: {k.nama}</span>
      </div>
      <div className="skenario">
        {SKENARIO.map((s) => (
          <button key={s.id} className={`skenario-btn ${aktif[s.id] ? 'aktif' : ''}`} onClick={() => onSkenario(s.id)}>
            <strong>{aktif[s.id] ? (s.id === 'nodeOffline' ? 'Sambungkan node lagi' : 'Aktifkan Sequential Reading') : s.judul}</strong>
            <span>{s.isi}{s.semua ? ' · semua kolam' : ''}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function jumlah(daftar, kunci) {
  return daftar.reduce((s, k) => s + k.stat[kunci], 0);
}

export function Perbandingan({ sim }) {
  const baris = [
    { label: 'Pakan diberikan', kunci: 'pakanDiberiKg', satuan: 'kg', d: 1 },
    { label: 'Pakan terbuang (tak termakan)', kunci: 'pakanTerbuangKg', satuan: 'kg', d: 2 },
    { label: 'Paparan NH3 > 0,05 mg/L', kunci: 'menitNh3Toksik', satuan: 'menit', d: 0 },
    { label: 'pH di luar 6,5–8,2', kunci: 'menitPhLuar', satuan: 'menit', d: 0 },
    { label: 'Limbah dibuang ke selokan', kunci: 'limbahSelokanL', satuan: 'L', d: 0 },
    { label: 'Limbah ke tangki POC', kunci: 'limbahPocL', satuan: 'L', d: 0 },
  ];
  return (
    <section className="kartu">
      <div className="blok-kepala">
        <h4>Dampak: AQUA-LOCK vs cara lama</h4>
        <span className="label-kecil">total 4 kolam sejak simulasi mulai</span>
      </div>
      <div className="tabel-wrap">
        <table className="tabel">
          <thead>
            <tr><th scope="col">Indikator</th><th scope="col">AQUA-LOCK</th><th scope="col">Timer + manual</th><th scope="col">Selisih</th></tr>
          </thead>
          <tbody>
            {baris.map((b) => {
              const a = jumlah(sim.kolam, b.kunci);
              const m = jumlah(sim.kembar, b.kunci);
              const selisih = m > 0.001 ? ((a - m) / m) * 100 : null;
              const baik = b.kunci === 'limbahPocL' ? a >= m : a <= m;
              return (
                <tr key={b.kunci}>
                  <th scope="row">{b.label}</th>
                  <td className="angka-mono">{angka(a, b.d)} {b.satuan}</td>
                  <td className="angka-mono">{angka(m, b.d)} {b.satuan}</td>
                  <td className={`angka-mono ${selisih === null || Math.abs(selisih) < 0.5 ? '' : baik ? 'teks-baik' : 'teks-kritis'}`}>
                    {selisih === null ? '–' : `${selisih > 0 ? '+' : ''}${angka(selisih, 0)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="catatan">Kolam kembar mengalami cuaca & kejadian yang sama, tetapi memakai timer pakan 3×/hari dan ganti air manual 10% pukul 08.00 yang dibuang ke selokan. Jalankan beberapa skenario untuk melihat selisihnya.</p>
    </section>
  );
}
