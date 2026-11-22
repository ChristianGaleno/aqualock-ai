// Guided Calibration (PRD F5 & Bab 6) — tanpa mengedit kode program.
// pH  : regresi linear 2-point / 3-point → pH = m·V + c
// TDS : V_comp = V_raw / (1 + 0,02·(T − 25)), lalu k = TDS_standar / TDS_terbaca
import { useMemo, useState } from 'react';
import { bacaLarutanStandar } from '../sim/engine.js';
import { regresiLinear, kompensasiSuhu, ppmDariTegangan, KALIBRASI_PABRIK } from '../sim/chemistry.js';
import { angka, labelWaktu } from './format.js';

const BUFFER = { 2: [6.86, 4.01], 3: [4.01, 6.86, 9.18] };

export default function KalibrasiTab({ sim, idPilih, setIdPilih }) {
  const k = sim.kolam.find((x) => x.id === idPilih);
  const [mode, setMode] = useState(3);
  const [bersih, setBersih] = useState(true);
  const [titik, setTitik] = useState({});
  const [standarTds, setStandarTds] = useState(342);
  const [suhuLarutan, setSuhuLarutan] = useState(26.5);
  const [bacaTds, setBacaTds] = useState(null);
  const [salin, setSalin] = useState('');

  const buffer = BUFFER[mode];
  const lengkap = buffer.every((b) => titik[b] !== undefined);
  const hasil = useMemo(() => (lengkap ? regresiLinear(buffer.map((b) => ({ v: titik[b], ph: b }))) : null), [lengkap, titik, buffer]);

  const errPh = k.ukur.ph - k.air.ph;
  const errTds = k.ukur.tds - (k.air.tdsDasar + 55 * k.air.tan + 320 * (k.air.lumpurKg / (k.air.volumeL / 1000)));

  function ganti(id) { setIdPilih(id); setTitik({}); setBacaTds(null); }
  function baca(b) { setTitik((t) => ({ ...t, [b]: bacaLarutanStandar(k, 'ph', b, 25, bersih) })); }
  function bacaStandarTds() {
    const vRaw = bacaLarutanStandar(k, 'tds', standarTds, suhuLarutan);
    const vComp = kompensasiSuhu(vRaw, suhuLarutan);
    const ppmMentah = ppmDariTegangan(vComp);
    setBacaTds({ vRaw, vComp, ppmMentah, kBaru: standarTds / ppmMentah });
  }
  function simpanPh() {
    sim.terapkanKalibrasi(k.id, { m: hasil.m, c: hasil.c, metode: `pH ${mode}-point`, r2: hasil.r2 }, bersih);
    setTitik({});
  }
  function simpanTds() {
    sim.terapkanKalibrasi(k.id, { k: bacaTds.kBaru, metode: `TDS ${standarTds} ppm` }, false);
    setBacaTds(null);
  }
  function resetPabrik() {
    sim.terapkanKalibrasi(k.id, { ...KALIBRASI_PABRIK, metode: 'Reset ke nilai pabrik' }, false);
  }

  const json = {
    kolam: k.id,
    node: `esp32-k${k.id}`,
    ph: { m: +k.kal.m.toFixed(4), c: +k.kal.c.toFixed(4), ...(k.kal.r2 ? { r2: +k.kal.r2.toFixed(5) } : {}) },
    tds: { k: +k.kal.k.toFixed(4), suhu_ref_c: 25, koef_suhu: 0.02 },
    metode_terakhir: k.kal.metode,
    diperbarui: labelWaktu(sim.t),
  };
  const teksJson = JSON.stringify(json, null, 2);

  async function salinJson() {
    try { await navigator.clipboard.writeText(teksJson); setSalin('Tersalin'); } catch { setSalin('Gagal menyalin, pilih teks manual'); }
    setTimeout(() => setSalin(''), 2000);
  }

  return (
    <div className="tab-isi">
      <div className="baris-atas">
        <div>
          <h2>Kalibrasi sensor terpandu</h2>
          <p className="catatan">Operator cukup menekan tombol di dashboard. Parameter tersimpan permanen di <code>calibration.json</code> per kolam.</p>
        </div>
        <div className="segmen" role="group" aria-label="Pilih kolam">
          {sim.kolam.map((x) => (
            <button key={x.id} className={x.id === idPilih ? 'aktif' : ''} onClick={() => ganti(x.id)}>{x.nama}</button>
          ))}
        </div>
      </div>

      <div className="ubin-baris">
        <div className={`ubin ${Math.abs(errPh) > 0.15 ? 'ubin-kritis' : ''}`}>
          <span>Error pH saat ini</span>
          <strong className="angka-mono">{errPh >= 0 ? '+' : ''}{angka(errPh, 3)}</strong>
          <small>KPI ≤ ±0,15 pH · nilai sebenarnya hanya diketahui simulator</small>
        </div>
        <div className={`ubin ${Math.abs(errTds) > 25 ? 'ubin-kritis' : ''}`}>
          <span>Error TDS saat ini</span>
          <strong className="angka-mono">{errTds >= 0 ? '+' : ''}{angka(errTds, 0)} ppm</strong>
          <small>setelah kompensasi suhu & faktor k</small>
        </div>
        <div className={`ubin ${k.ai.dataDatar ? 'ubin-kritis' : ''}`}>
          <span>Status probe pH</span>
          <strong>{k.hw.biofoul > 0 ? (k.ai.dataDatar ? 'Data datar terdeteksi' : 'Berlumut') : 'Bersih'}</strong>
          <small>deteksi anomali data datar 60 menit</small>
        </div>
      </div>

      <div className="dua-kolom">
        <section className="kartu">
          <div className="blok-kepala">
            <h4>Kalibrasi pH</h4>
            <div className="segmen kecil" role="group" aria-label="Jumlah titik">
              <button className={mode === 2 ? 'aktif' : ''} onClick={() => { setMode(2); setTitik({}); }}>2-point</button>
              <button className={mode === 3 ? 'aktif' : ''} onClick={() => { setMode(3); setTitik({}); }}>3-point</button>
            </div>
          </div>
          <label className="saklar">
            <input type="checkbox" checked={bersih} onChange={(e) => { setBersih(e.target.checked); setTitik({}); }} />
            Probe sudah disikat &amp; dibilas akuades
          </label>
          <ol className="wizard">
            {buffer.map((b, i) => (
              <li key={b} className={titik[b] !== undefined ? 'selesai' : ''}>
                <span className="wizard-no">{i + 1}</span>
                <div>
                  <strong>Buffer pH {angka(b, 2)}</strong>
                  <small>{titik[b] !== undefined ? `V = ${titik[b].toFixed(4)} V (rata-rata 10 sampel ADS1115)` : 'Celupkan probe, tunggu 30 detik'}</small>
                </div>
                <button className="tombol kecil" onClick={() => baca(b)}>{titik[b] !== undefined ? 'Baca ulang' : 'Baca'}</button>
              </li>
            ))}
          </ol>
          {hasil && (
            <div className="hasil-kal">
              <p className="rumus">pH = <b>{hasil.m.toFixed(4)}</b> × V + <b>{hasil.c.toFixed(4)}</b> <span>R² = {hasil.r2.toFixed(5)}</span></p>
              <table className="tabel">
                <thead><tr><th scope="col">Buffer</th><th scope="col">Kalibrasi lama</th><th scope="col">Kalibrasi baru</th></tr></thead>
                <tbody>
                  {buffer.map((b) => (
                    <tr key={b}>
                      <th scope="row">{angka(b, 2)}</th>
                      <td className="angka-mono">{angka(k.kal.m * titik[b] + k.kal.c - b, 3)}</td>
                      <td className="angka-mono">{angka(hasil.m * titik[b] + hasil.c - b, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasil.r2 < 0.999 && <p className="peringatan-baris">R² rendah. Biasanya karena probe kotor: bersihkan probe lalu ulangi.</p>}
              <button className="tombol utama" onClick={simpanPh}>Simpan ke calibration.json</button>
            </div>
          )}
        </section>

        <section className="kartu">
          <div className="blok-kepala"><h4>Kalibrasi TDS + kompensasi suhu</h4></div>
          <div className="form-baris">
            <label htmlFor="std-tds">Larutan standar</label>
            <select id="std-tds" value={standarTds} onChange={(e) => { setStandarTds(Number(e.target.value)); setBacaTds(null); }}>
              <option value={342}>342 ppm (NaCl)</option>
              <option value={500}>500 ppm</option>
            </select>
          </div>
          <div className="form-baris">
            <label htmlFor="suhu-larutan">Suhu larutan (DS18B20)</label>
            <input id="suhu-larutan" type="range" min="20" max="32" step="0.1" value={suhuLarutan}
              onChange={(e) => { setSuhuLarutan(Number(e.target.value)); setBacaTds(null); }} />
            <output className="angka-mono">{angka(suhuLarutan, 1)} °C</output>
          </div>
          <button className="tombol" onClick={bacaStandarTds}>Celupkan &amp; baca</button>
          {bacaTds && (
            <div className="hasil-kal">
              <dl className="daftar-ai">
                <div><dt>V_raw</dt><dd className="angka-mono">{bacaTds.vRaw.toFixed(4)} V</dd></div>
                <div><dt>V_comp = V_raw / (1 + 0,02·({angka(suhuLarutan, 1)} − 25))</dt><dd className="angka-mono">{bacaTds.vComp.toFixed(4)} V</dd></div>
                <div><dt>TDS terbaca (k = 1)</dt><dd className="angka-mono">{angka(bacaTds.ppmMentah, 1)} ppm</dd></div>
                <div><dt>k = {standarTds} / {angka(bacaTds.ppmMentah, 1)}</dt><dd className="angka-mono besar">{bacaTds.kBaru.toFixed(4)}</dd></div>
              </dl>
              <button className="tombol utama" onClick={simpanTds}>Simpan faktor k</button>
            </div>
          )}
          <hr />
          <div className="blok-kepala">
            <h4>calibration.json · {k.nama}</h4>
            <button className="tombol kecil" onClick={salinJson}>{salin || 'Salin'}</button>
          </div>
          <pre className="kode">{teksJson}</pre>
          <div className="aksi-baris">
            <button className="tombol kecil" onClick={resetPabrik}>Reset ke kalibrasi pabrik</button>
          </div>
          <p className="catatan">Coba “Reset ke kalibrasi pabrik” untuk melihat error pH melebar karena kemiringan probe asli bukan 0,18 V/pH.</p>
        </section>
      </div>
    </div>
  );
}
