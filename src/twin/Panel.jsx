// Panel kanan: 8 bagian bernomor (gaya laporan digital twin)
import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid, ReferenceLine } from 'recharts';
import { AMBANG } from '../sim/constants.js';
import { angka, jamMenit, infoState } from '../ui/format.js';
import { AlurFsm, PanelAI, Aktuator, SequentialReading } from '../ui/DetailKolam.jsx';
import TrendChart from '../ui/Charts.jsx';
import Gateway from '../ui/Gateway.jsx';
import { TangkiPoc, PanelSkenario, Perbandingan } from '../ui/SidePanels.jsx';
import { LogKejadian } from '../ui/Logs.jsx';
import KalibrasiTab from '../ui/KalibrasiTab.jsx';
import { PilState } from '../ui/PondCard.jsx';
import { BAGIAN } from './konten.js';

function Kepala({ no, judul, children }) {
  const b = BAGIAN.find((x) => x.no === no);
  return (
    <header className="p-kepala">
      <span className="p-alis">{String(no).padStart(2, '0')} · {b.label}</span>
      <h2>{judul}</h2>
      {children && <p>{children}</p>}
    </header>
  );
}

function Stat({ label, nilai, sub, nada }) {
  return (
    <div className="p-stat">
      <span>{label}</span>
      <strong className={nada ? `teks-${nada}` : ''}>{nilai}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export function PilihKolam({ sim, idPilih, onPilih }) {
  return (
    <div className="p-chip-kolam" role="group" aria-label="Pilih kolam">
      {sim.kolam.map((k) => {
        const info = infoState(k, sim);
        return (
          <button key={k.id} className={k.id === idPilih ? 'aktif' : ''} onClick={() => onPilih(k.id)}>
            <span className={`titik titik-${info.nada}`} />Kolam {k.id}
          </button>
        );
      })}
    </div>
  );
}

const jumlah = (daftar, kunci) => daftar.reduce((s, k) => s + k.stat[kunci], 0);

function RisikoPerJam({ k, ambang = AMBANG }) {
  const tAkhir = k.riwayat.length ? k.riwayat[k.riwayat.length - 1].t : 0;
  const data = useMemo(() => {
    const per = new Map();
    for (const d of k.riwayat) {
      if (d.t < tAkhir - 24 * 3600 || d.risiko === null) continue;
      const j = Math.floor(d.t / 3600);
      per.set(j, Math.max(per.get(j) ?? 0, d.risiko));
    }
    return [...per.entries()].map(([j, r]) => ({ t: j * 3600, risiko: r }));
  }, [k.id, Math.floor(tAkhir / 600)]);
  const warna = (r) => (r >= ambang.RISIKO_LOCK ? 'var(--kritis)' : r >= ambang.RISIKO_KURANG ? 'var(--peringatan)' : 'var(--navy)');
  return (
    <figure className="p-grafik">
      <div className="p-grafik-area">
        {data.length < 2 ? <p className="catatan">Data per jam akan muncul setelah simulasi berjalan ±2 jam.</p> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -24 }} barCategoryGap={3}>
              <CartesianGrid stroke="var(--garis)" vertical={false} />
              <ReferenceLine y={ambang.RISIKO_LOCK} stroke="var(--kritis)" />
              <XAxis dataKey="t" tickFormatter={(t) => jamMenit(t).slice(0, 2)} tick={{ fontSize: 11, fill: 'var(--ink-3)' }} stroke="var(--garis)" interval="preserveStartEnd" />
              <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tick={{ fontSize: 11, fill: 'var(--ink-3)' }} stroke="var(--garis)" />
              <Tooltip cursor={{ fill: 'var(--krem-2)' }} formatter={(v) => [angka(v, 2), 'Risiko maks']} labelFormatter={(t) => `Jam ${jamMenit(t)}`} />
              <Bar dataKey="risiko" radius={[4, 4, 0, 0]} isAnimationActive={false} minPointSize={3}>
                {data.map((d) => <Cell key={d.t} fill={warna(d.risiko)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <figcaption className="p-legenda">
        <span><i style={{ background: 'var(--navy)' }} />aman</span>
        <span><i style={{ background: 'var(--peringatan)' }} />porsi 50%</span>
        <span><i style={{ background: 'var(--kritis)' }} />lockout ≥ {angka(ambang.RISIKO_LOCK, 2)}</span>
        <em>24 jam terakhir · Kolam {k.id}</em>
      </figcaption>
    </figure>
  );
}

const LINGKARAN = [
  ['Sensor membaca', 'pH, TDS, suhu, level tiap 30 dtk'],
  ['MQTT lokal', 'tanpa internet, Rp 0 cloud'],
  ['AI mengevaluasi', 'risiko amonia NH₃ 0–1 (simulasi)'],
  ['Kunci / porsi pakan', '100% · 50% · 0% cegah overfeeding'],
  ['Kuras & dosing', 'FSM jaga dasar & pH kolam'],
  ['Tangki POC', 'sisa pakan & lumpur dasar ditampung'],
  ['Pupuk cair', 'dipulihkan ke kebun warga'],
];

export function Bagian1({ sim, k, latensi, jalan }) {
  const profil = sim.komoditas;
  const A = sim.ambang;
  const izin = sim.kolam.filter((x) => !sim.terkunci(x)).length;
  const status = sim.booting ? ['BOOTING', 'peringatan'] : izin === 4 ? ['AMAN', 'baik'] : izin >= 2 ? ['WASPADA', 'peringatan'] : ['BAHAYA', 'kritis'];
  const dicegah = jumlah(sim.kembar, 'pakanTerbuangKg') - jumlah(sim.kolam, 'pakanTerbuangKg');
  const latMaks = latensi.length ? Math.max(...latensi) : null;
  return (
    <>
      <Kepala no={1} judul={`Klaster 01 · 4 kolam bundar ${profil.nama.toLowerCase()}`}>
        Satu Master Gateway menjaga 4 kolam terpal bundar Ø3 m (mode aktif: <b>{profil.label}</b>). {profil.narasiFokus} Parameter padat tebar &amp; kimia air pada tampilan ini merupakan asumsi simulasi.
      </Kepala>
      <div className="profil-aktif-box">
        <div className="profil-aktif-atas">
          <strong>{profil.ikon} Profil Aktif: {profil.label}</strong>
          <span>Asumsi Simulasi</span>
        </div>
        <div className="profil-aktif-param">
          <code>pH {angka(A.PH_MIN, 1)}–{angka(A.PH_MAX, 1)}</code>
          <code>TDS ≤ {A.TDS_MAX} ppm</code>
          <code>Suhu ≥ {A.SUHU_DINGIN} °C</code>
          <code>Lock NH₃ ≥ {angka(A.RISIKO_LOCK, 2)}</code>
          <code>Pakan {angka(profil.tebar.rasioPakan * 100, 1)}%</code>
        </div>
      </div>
      <div className="p-stat-grid">
        <Stat label="Waktu simulasi" nilai={`H${sim.hari} · ${jamMenit(sim.t)}`} sub={jalan ? 'berjalan' : 'dijeda'} />
        <Stat label="Status klaster" nilai={status[0]} nada={status[1]} sub={sim.booting ? `memuat patokan ${sim.booting.targetNama}` : `${izin}/4 kolam boleh diberi pakan`} />
        <Stat label="Pakan terbuang dicegah" nilai={`${angka(Math.max(0, dicegah), 2)} kg`} sub="dibanding timer biasa" />
        <Stat label="Limbah ke tangki POC" nilai={`${angka(jumlah(sim.kolam, 'limbahPocL'))} L`} sub={`${angka(jumlah(sim.kolam, 'limbahSelokanL'))} L ke selokan`} />
        <Stat label="Interlock menolak" nilai={`${latensi.length}×`} sub={latMaks !== null ? `terlama ${angka(latMaks, 0)} ms · batas 200` : 'belum ada percobaan'} />
        <Stat label="Biaya cloud" nilai="Rp0" nada="baik" sub="AI, database, dasbor lokal" />
      </div>
      <h3 className="p-sub">Risiko amonia per jam</h3>
      <RisikoPerJam k={k} ambang={A} />
      <h3 className="p-sub">Lingkaran sistem</h3>
      <ol className="p-lingkaran">
        {LINGKARAN.map(([a, b]) => <li key={a}><b>{a}</b><span>{b}</span></li>)}
      </ol>
    </>
  );
}

function ambilData(riwayat, jam) {
  if (!riwayat.length) return [];
  const akhir = riwayat[riwayat.length - 1].t;
  const pilih = riwayat.filter((d) => d.t >= akhir - jam * 3600);
  const langkah = Math.max(1, Math.ceil(pilih.length / 200));
  return pilih.filter((_, i) => i % langkah === 0 || i === pilih.length - 1);
}

function useData(k) {
  const tAkhir = k.riwayat.length ? k.riwayat[k.riwayat.length - 1].t : 0;
  return useMemo(() => ambilData(k.riwayat, 6), [k.id, tAkhir, k.riwayat]);
}

export function Bagian2({ sim, k, onPilih }) {
  const data = useData(k);
  const A = sim.ambang;
  const ubin = [
    ['pH', angka(k.ukur.ph, 2), '', k.ukur.ph < A.PH_MIN || k.ukur.ph > A.PH_MAX],
    ['TDS', angka(k.ukur.tds), 'ppm', k.ukur.tds > A.TDS_MAX],
    ['Suhu', angka(k.ukur.suhu, 1), '°C', k.ukur.suhu < A.SUHU_DINGIN],
    ['Level air', angka(k.ukur.levelCm, 0), 'cm', false],
  ];
  return (
    <>
      <Kepala no={2} judul={`Sensor Node · Kolam ${k.id}`}>
        ESP32 membaca pH-4502C, TDS, DS18B20, dan JSN-SR04T lewat ADS1115 16-bit, lalu publish JSON ke topik <code>aqualock/kolam{k.id}/sensor</code>. Patokan aktif: <b>{sim.komoditas.nama}</b> (pH {angka(A.PH_MIN, 1)}–{angka(A.PH_MAX, 1)}, TDS ≤ {A.TDS_MAX} ppm).
      </Kepala>
      <PilihKolam sim={sim} idPilih={k.id} onPilih={onPilih} />
      <div className="p-ubin4">
        {ubin.map(([l, v, s, luar]) => (
          <div key={l} className={luar ? 'luar' : ''}><span>{l}</span><strong>{k.online ? v : '–'}<small> {s}</small></strong></div>
        ))}
      </div>
      <SequentialReading aktif={sim.opsi.sequentialReading} />
      <div className="p-grafik-tumpuk">
        <TrendChart judul="pH · 6 jam" data={data} kunci="ph" desimal={2} domain={[5.5, 9]} ticks={[6, 7, 8, 9]} pita={[A.PH_MIN, A.PH_MAX]}
          batas={[{ y: A.PH_MIN, warna: 'var(--serius)', label: angka(A.PH_MIN, 1) }, { y: A.PH_MAX, warna: 'var(--serius)', label: angka(A.PH_MAX, 1) }]} />
        <TrendChart judul="TDS · 6 jam" data={data} kunci="tds" satuan="ppm" domain={[200, 850]} ticks={[200, 400, 600, 800]}
          batas={[{ y: A.TDS_MAX, warna: 'var(--kritis)', label: `${A.TDS_MAX} ppm` }]} />
        <TrendChart judul="Suhu · 6 jam" data={data} kunci="suhu" satuan="°C" desimal={1} domain={[20, 33]} ticks={[20, 24, 28, 32]}
          batas={[{ y: A.SUHU_DINGIN, warna: 'var(--peringatan)', label: `${A.SUHU_DINGIN} °C` }]} />
      </div>
    </>
  );
}

export function Bagian3({ sim, k, onPilih, onBukaModel }) {
  const data = useData(k);
  const A = sim.ambang;
  return (
    <>
      <Kepala no={3} judul="AI di Master Gateway">
        XGBoost membaca 6 fitur sensor murah &amp; riwayat pakan (pH, TDS, suhu, pH_delta, jam, pakan 6 jam) untuk menaksir peluang amonia bebas &gt; {angka(A.NH3_TOKSIK, 2)} mg/L (asumsi ambang simulasi mode {sim.komoditas.nama}), sehingga mencegah overfeeding tanpa sensor amonia mahal.
      </Kepala>
      <PilihKolam sim={sim} idPilih={k.id} onPilih={onPilih} />
      <PanelAI k={k} />
      <TrendChart judul="Risiko NH3 · 6 jam" data={data} kunci="risiko" desimal={2} domain={[0, 1]} ticks={[0, 0.5, 1]}
        batas={[{ y: A.RISIKO_KURANG, warna: 'var(--peringatan)', label: angka(A.RISIKO_KURANG, 2) }, { y: A.RISIKO_LOCK, warna: 'var(--kritis)', label: angka(A.RISIKO_LOCK, 2) }]} />
      <button className="tombol" onClick={onBukaModel}>Lihat cara kerja model &amp; uji sendiri</button>
    </>
  );
}

export function Bagian4({ sim, k, onPilih, hasilTombol, onTekanFisik, onPakanDashboard, suara, setSuara, latensi }) {
  const kunci = sim.terkunci(k);
  return (
    <>
      <Kepala no={4} judul={`Safety Interlock pakan ${sim.komoditas.nama.toLowerCase()}`}>
        Saat air membahayakan {sim.komoditas.nama.toLowerCase()} atau sistem sedang booting patokan baru, tombol dashboard dinonaktifkan dan tombol fisik ditolak oleh STM32 sebelum servo bergerak agar sisa pakan tidak memperparah amonia. Target KPI: penolakan &lt; 200 ms.
      </Kepala>
      <PilihKolam sim={sim} idPilih={k.id} onPilih={onPilih} />
      <div className={`p-kunci ${kunci ? 'terkunci' : 'terbuka'}`}>
        <PilState info={infoState(k, sim)} />
        <span>{kunci ? sim.alasanKunci(k) : `Pakan diizinkan · ${k.ai.porsi.kode}`}</span>
      </div>
      <Gateway sim={sim} idPilih={k.id} setIdPilih={onPilih} hasilTombol={hasilTombol} onTekanFisik={onTekanFisik} suara={suara} setSuara={setSuara} />
      <button className="tombol" disabled={kunci} onClick={onPakanDashboard}
        title={kunci ? 'Tombol dashboard dinonaktifkan selama kunci pakan / booting aktif' : 'Beri pakan sesuai porsi AI'}>
        Beri makan dari dashboard
      </button>
      {latensi.length > 0 && (
        <p className="catatan">Penolakan terakhir: {latensi.slice(-6).map((l) => `${angka(l, 0)} ms`).join(' · ')}</p>
      )}
    </>
  );
}

export function Bagian5({ sim, k, onPilih }) {
  const A = sim.ambang;
  return (
    <>
      <Kepala no={5} judul="Finite State Machine & aktuator">
        Mode <b>{sim.komoditas.nama}</b> — Prioritas: CLEANING (TDS &gt; {A.TDS_MAX} ppm) &gt; PH_RECOVERY (pH di luar {angka(A.PH_MIN, 1)}–{angka(A.PH_MAX, 1)}) &gt; NORMAL. Kondisi harus terpenuhi 2 evaluasi berturut-turut agar status tidak berkedip karena derau sensor.
      </Kepala>
      <PilihKolam sim={sim} idPilih={k.id} onPilih={onPilih} />
      <AlurFsm k={k} sim={sim} />
      <Aktuator k={k} sim={sim} />
      <LogKejadian sim={sim} idPilih={k.id} />
    </>
  );
}

export function Bagian6({ sim, onKosongkan, onGantiTangki }) {
  return (
    <>
      <Kepala no={6} judul={`Limbah dasar ${sim.komoditas.nama.toLowerCase()} → pupuk cair`}>
        Bottom drain di pusat kolam bundar mengalirkan sisa pakan &amp; lumpur organik dasar yang pekat ke tangki POC bersama. Jika tangki hampir penuh, kuras dibuat parsial atau ditunda sementara kunci pakan tetap aktif.
      </Kepala>
      <TangkiPoc sim={sim} onKosongkan={onKosongkan} onGantiTangki={onGantiTangki} />
      <div className="p-stat-grid">
        {sim.kolam.map((k) => (
          <Stat key={k.id} label={`Kolam ${k.id}`} nilai={`${angka(k.stat.limbahPocL)} L`} sub={`${k.stat.kurasKali}× kuras`} />
        ))}
      </div>
    </>
  );
}

export function Bagian7({ sim, k, onSkenario }) {
  return (
    <>
      <Kepala no={7} judul="Uji skenario & dampak">
        Skenario simulasi berlaku untuk kolam {sim.komoditas.nama.toLowerCase()} terpilih (Kolam {k.id}). Kolam kembar mengalami cuaca &amp; overfeeding yang sama, tetapi memakai timer pakan biasa tanpa interlock.
      </Kepala>
      <PanelSkenario sim={sim} idPilih={k.id} onSkenario={onSkenario} />
      <Perbandingan sim={sim} />
    </>
  );
}

export function Bagian8({ sim, k, onPilih }) {
  return (
    <>
      <Kepala no={8} judul="Kalibrasi terpandu" />
      <KalibrasiTab sim={sim} idPilih={k.id} setIdPilih={onPilih} />
    </>
  );
}
