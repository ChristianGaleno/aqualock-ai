// Tab penjelasan model AI: metrik, kepentingan fitur, uji "bagaimana jika", aturan keputusan
import { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { MODEL_AI, tentukanPorsi, hitungDosis } from '../sim/ai.js';
import { prediksiProba } from '../sim/model.js';
import { AMBANG, AKTUATOR } from '../sim/constants.js';
import { fraksiNH3 } from '../sim/chemistry.js';
import { angka } from './format.js';

const NAMA = { ph: 'pH', tds: 'TDS', suhu: 'Suhu', ph_delta: 'pH_delta', jam: 'Jam harian', pakan_6j: 'Pakan 6 jam' };
const SLIDER = [
  { id: 'ph', label: 'pH', min: 6, max: 9, step: 0.01, d: 2 },
  { id: 'tds', label: 'TDS (ppm)', min: 200, max: 800, step: 1, d: 0 },
  { id: 'suhu', label: 'Suhu (°C)', min: 22, max: 33, step: 0.1, d: 1 },
  { id: 'ph_delta', label: 'pH_delta 30 mnt', min: -0.6, max: 0.6, step: 0.01, d: 2 },
  { id: 'jam', label: 'Jam', min: 0, max: 23.9, step: 0.1, d: 1 },
  { id: 'pakan_6j', label: 'Pakan 6 jam (% biomassa)', min: 0, max: 3, step: 0.05, d: 2 },
];

export default function ModelTab({ sim, idPilih }) {
  const m = MODEL_AI;
  const k = sim.kolam.find((x) => x.id === idPilih);
  const [x, setX] = useState({ ph: 7.9, tds: 430, suhu: 29.5, ph_delta: 0.05, jam: 14.5, pakan_6j: 0.83 });
  const vektor = [x.ph, x.tds, x.suhu, x.ph_delta, x.jam, x.pakan_6j];
  const risiko = prediksiProba(m, vektor);
  const porsi = tentukanPorsi(risiko, x.suhu);
  const kurva = useMemo(() => {
    const titik = [];
    for (let ph = 6.5; ph <= 9.001; ph += 0.05) titik.push({ ph: +ph.toFixed(2), risiko: prediksiProba(m, [ph, x.tds, x.suhu, x.ph_delta, x.jam, x.pakan_6j]) });
    return titik;
  }, [m, x.tds, x.suhu, x.ph_delta, x.jam, x.pakan_6j]);
  const dosisContoh = hitungDosis(6.3, 6.2);

  if (!m) return <div className="tab-isi"><p>Model belum dilatih. Jalankan <code>npm run dataset</code> lalu <code>npm run train</code>.</p></div>;
  const mt = m.metrik;
  const imp = Object.entries(m.kepentingan).sort((a, b) => b[1] - a[1]);

  return (
    <div className="tab-isi">
      <div className="baris-atas">
        <div>
          <h2>Model AI: estimasi risiko toksisitas amonia</h2>
          <p className="catatan">Pengganti sensor amonia mahal. XGBoost {m.n_pohon} pohon (kedalaman {m.max_depth}) membaca 5 fitur sensor murah + riwayat pakan dari log servo, lalu menebak peluang NH3 bebas &gt; 0,05 mg/L.</p>
        </div>
      </div>

      <div className="ubin-baris">
        <div className={`ubin ${mt.f1 >= 0.88 ? 'ubin-baik' : 'ubin-kritis'}`}><span>F1-score</span><strong className="angka-mono">{angka(mt.f1, 3)}</strong><small>target PRD ≥ 0,88</small></div>
        <div className="ubin"><span>Precision</span><strong className="angka-mono">{angka(mt.precision, 3)}</strong><small>alarm yang benar</small></div>
        <div className="ubin"><span>Recall</span><strong className="angka-mono">{angka(mt.recall, 3)}</strong><small>kejadian bahaya yang tertangkap</small></div>
        <div className="ubin"><span>Data uji</span><strong className="angka-mono">{mt.n_uji.toLocaleString('id-ID')}</strong><small>20% hari terakhir · {mt.positif_uji} kejadian bahaya</small></div>
      </div>

      <div className="dua-kolom">
        <section className="kartu">
          <div className="blok-kepala"><h4>Coba sendiri: bagaimana jika…</h4>
            <button className="tombol kecil" onClick={() => setX({ ph: k.ukur.ph, tds: k.ukur.tds, suhu: k.ukur.suhu, ph_delta: k.ai.phDelta, jam: sim.jam, pakan_6j: k.ai.fitur?.[5] ?? 0 })}>Ambil data {k.nama}</button>
          </div>
          {SLIDER.map((s) => (
            <div className="form-baris" key={s.id}>
              <label htmlFor={`sl-${s.id}`}>{s.label}</label>
              <input id={`sl-${s.id}`} type="range" min={s.min} max={s.max} step={s.step} value={x[s.id]}
                onChange={(e) => setX({ ...x, [s.id]: Number(e.target.value) })} />
              <output className="angka-mono">{angka(x[s.id], s.d)}</output>
            </div>
          ))}
          <div className="hasil-ai">
            <div><span>Risiko NH3</span><strong className="angka-mono">{angka(risiko, 3)}</strong></div>
            <div><span>Keputusan porsi</span><strong><code>{porsi.kode}</code></strong></div>
            <div><span>Fraksi NH3 bebas (Emerson)</span><strong className="angka-mono">{angka(fraksiNH3(x.ph, x.suhu) * 100, 2)}%</strong></div>
          </div>
          <figure className="grafik">
            <figcaption><span>Risiko vs pH (fitur lain tetap)</span></figcaption>
            <div className="grafik-area">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={kurva} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <ReferenceLine y={AMBANG.RISIKO_LOCK} stroke="var(--kritis)" label={{ value: '0,70 lockout', position: 'insideTopLeft', fill: 'var(--ink-3)', fontSize: 10 }} />
                  <ReferenceLine y={AMBANG.RISIKO_KURANG} stroke="var(--peringatan)" label={{ value: '0,40 porsi 50%', position: 'insideTopLeft', fill: 'var(--ink-3)', fontSize: 10 }} />
                  <ReferenceLine x={+x.ph.toFixed(2)} stroke="var(--ink-3)" />
                  <XAxis dataKey="ph" type="number" domain={[6.5, 9]} tick={{ fontSize: 10, fill: 'var(--ink-3)' }} stroke="var(--grid)" />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: 'var(--ink-3)' }} stroke="var(--grid)" width={46} />
                  <Tooltip formatter={(v) => angka(v, 3)} labelFormatter={(l) => `pH ${l}`} />
                  <Line type="stepAfter" dataKey="risiko" stroke="var(--seri)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </figure>
          <p className="catatan">Kurva berundak karena model berbasis pohon keputusan. Risiko naik tajam di pH tinggi + suhu hangat, sesuai kimia kesetimbangan amonia.</p>
        </section>

        <div className="tumpuk">
          <section className="kartu">
            <div className="blok-kepala"><h4>Kepentingan fitur (gain)</h4></div>
            <ul className="batang">
              {imp.map(([f, v]) => (
                <li key={f}>
                  <span>{NAMA[f]}</span>
                  <div className="batang-jalur"><div className="batang-isi" style={{ width: `${v * 100}%` }} /></div>
                  <em className="angka-mono">{angka(v * 100, 1)}%</em>
                </li>
              ))}
            </ul>
            <div className="blok-kepala"><h4>Matriks kebingungan (data uji)</h4></div>
            <table className="tabel matriks">
              <thead><tr><th scope="col" /><th scope="col">Prediksi aman</th><th scope="col">Prediksi bahaya</th></tr></thead>
              <tbody>
                <tr><th scope="row">Sebenarnya aman</th><td className="angka-mono">{mt.confusion[0][0].toLocaleString('id-ID')}</td><td className="angka-mono">{mt.confusion[0][1]}</td></tr>
                <tr><th scope="row">Sebenarnya bahaya</th><td className="angka-mono">{mt.confusion[1][0]}</td><td className="angka-mono">{mt.confusion[1][1]}</td></tr>
              </tbody>
            </table>
          </section>

          <section className="kartu">
            <div className="blok-kepala"><h4>Aturan keputusan setelah AI</h4></div>
            <table className="tabel">
              <tbody>
                <tr><th scope="row">Risiko ≥ {angka(AMBANG.RISIKO_LOCK, 2)}</th><td><code>LOCKOUT_0%</code> → CLEANING (atau turunkan pH dulu jika pH &gt; {angka(AMBANG.PH_RISIKO_TINGGI, 1)})</td></tr>
                <tr><th scope="row">Risiko {angka(AMBANG.RISIKO_KURANG, 2)}–0,69 atau suhu &lt; {AMBANG.SUHU_DINGIN} °C</th><td><code>ALLOW_REDUCED_50%</code></td></tr>
                <tr><th scope="row">Selain itu</th><td><code>ALLOW_100%</code></td></tr>
                <tr><th scope="row">TDS &gt; {AMBANG.TDS_MAX} ppm</th><td>CLEANING, kuras ≤ {AKTUATOR.BATAS_KURAS * 100}% volume</td></tr>
                <tr><th scope="row">pH &lt; {angka(AMBANG.PH_MIN, 1)} atau &gt; {angka(AMBANG.PH_MAX, 1)}</th><td>PH_RECOVERY, keluar saat pH {angka(AMBANG.PH_KELUAR_MIN, 1)}–{angka(AMBANG.PH_KELUAR_MAX, 1)}</td></tr>
              </tbody>
            </table>
            <p className="rumus">durasi dosing = min({AKTUATOR.DOSING_MAKS_DTK} dtk, |target − pH_acuan| ÷ {angka(AKTUATOR.DOSING_GAIN_PH_PER_DTK, 2)} × 0,8)</p>
            <p className="catatan">pH_acuan = nilai yang lebih ekstrem antara pH sekarang dan prediksi 30 menit (regresi linear tren). Contoh: pH 6,30 dengan prediksi 6,20 → pompa pH-Up {angka(dosisContoh.durasi, 1)} dtk. Faktor 0,8 mencegah pH shock akibat koreksi berlebih.</p>
          </section>

          <section className="kartu">
            <div className="blok-kepala"><h4>Alur pelatihan</h4></div>
            <ol className="alur">
              <li><b>Simulator</b> dijalankan 120 hari dengan hujan, pakan berlebih, ledakan alga acak.</li>
              <li><b>Label</b> dihitung dari TAN tersembunyi × fraksi Emerson (1975): bahaya jika NH3 &gt; 0,05 mg/L.</li>
              <li><b>Fitur</b> dari sensor murah (pH, TDS, suhu, pH_delta, jam) + pakan 6 jam terakhir dari log servo.</li>
              <li><b>Split waktu</b> 80/20 agar model diuji pada hari yang belum pernah dilihat.</li>
              <li><b>Ekspor</b> pohon ke JSON; inference JS identik dengan Python (selisih &lt; 10⁻⁶).</li>
            </ol>
            <p className="catatan">Dataset ini sintetis. Sebelum dipakai di kolam mitra, model wajib dilatih ulang dengan data lapangan + uji kit amonia.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
