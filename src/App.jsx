// =============================================================
// App.jsx — Digital Twin AQUA-LOCK AI
// Tata letak: bar atas → bar simulasi → [adegan 3D | panel bernomor]
// Logika sistem ada di src/sim/, adegan 3D di src/twin/Scene3D.js.
// =============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { Simulator } from './sim/engine.js';
import { TwinScene } from './twin/Scene3D.js';
import Maskot from './twin/Maskot.jsx';
import { BAGIAN, TUR, TARGET_CARI } from './twin/konten.js';
import { Bagian1, Bagian2, Bagian3, Bagian4, Bagian5, Bagian6, Bagian7, Bagian8 } from './twin/Panel.jsx';
import ModelTab from './ui/ModelTab.jsx';
import ArsitekturTab from './ui/ArsitekturTab.jsx';
import { angka, jamMenit } from './ui/format.js';
import { IkonPlay, IkonPause, IkonReset } from './ui/Icons.jsx';

const KECEPATAN = [
  { v: 60, label: '1 mnt/dtk' },
  { v: 600, label: '10 mnt/dtk' },
  { v: 3600, label: '1 jam/dtk' },
  { v: 14400, label: '4 jam/dtk' },
];

function Logo({ ukuran = 40 }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 4c11 13 19 23 19 33a19 19 0 0 1-38 0c0-10 8-20 19-33z" fill="var(--air)" />
      <path d="M12 42a21 21 0 0 0 34 9" stroke="var(--oranye)" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M44 47l3 5 5-3" stroke="var(--oranye)" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="23" y="32" width="18" height="14" rx="3" fill="#fff" />
      <path d="M26.5 32v-4a5.5 5.5 0 0 1 11 0v4" stroke="#fff" strokeWidth="3.4" fill="none" />
      <circle cx="32" cy="39" r="2.6" fill="var(--navy)" />
    </svg>
  );
}

function Kbd({ children }) { return <kbd>{children}</kbd>; }

export default function App() {
  const simRef = useRef(null);
  if (!simRef.current) {
    simRef.current = new Simulator();
    simRef.current.aturIkan(1800, 0.025);
  }
  const sim = simRef.current;

  const [, setVersi] = useState(0);
  const segarkan = useCallback(() => setVersi((v) => v + 1), []);
  const [jalan, setJalan] = useState(true);
  const [kecepatan, setKecepatan] = useState(60);
  const [bagian, setBagian] = useState(1);
  const [idPilih, setIdPilih] = useState(1);
  const [intro, setIntro] = useState(true);
  const [lembar, setLembar] = useState(null); // 'model' | 'arsitektur'
  const [labelTampil, setLabelTampil] = useState(true);
  const [tur, setTur] = useState(null);
  const [timelapse, setTimelapse] = useState(null);
  const [hasilTombol, setHasilTombol] = useState(null);
  const [latensi, setLatensi] = useState([]);
  const [suara, setSuara] = useState(true);
  const [cari, setCari] = useState('');
  const [ikan, setIkan] = useState(1800);
  const [rasio, setRasio] = useState(2.5);
  const [pesanMaskot, setPesanMaskot] = useState(BAGIAN[0].teks);
  const [webglGagal, setWebglGagal] = useState(false);

  const wadahRef = useRef(null);
  const labelRef = useRef(null);
  const adeganRef = useRef(null);
  const panelRef = useRef(null);

  // ---------------- Loop simulasi ----------------
  useEffect(() => {
    if (!jalan) return undefined;
    let terakhir = performance.now();
    const id = setInterval(() => {
      const kini = performance.now();
      const dt = Math.min(0.25, (kini - terakhir) / 1000);
      terakhir = kini;
      simRef.current.maju(dt * kecepatan);
      segarkan();
    }, 100);
    return () => clearInterval(id);
  }, [jalan, kecepatan, segarkan]);

  // Timelapse berhenti otomatis setelah durasinya tercapai
  useEffect(() => {
    if (timelapse && sim.t >= timelapse.selesai) {
      setKecepatan(60);
      setTimelapse(null);
      setPesanMaskot(`Timelapse selesai. Sekarang Hari ${sim.hari} pukul ${jamMenit(sim.t)}. Cek grafik risiko per jam di panel kanan.`);
    }
  });

  // ---------------- Adegan 3D ----------------
  const pilihKolam = useCallback((id) => {
    setIdPilih(id);
    adeganRef.current?.pilihKolam(id);
  }, []);

  const bukaBagian = useCallback((no, opsi = {}) => {
    setBagian(no);
    const b = BAGIAN.find((x) => x.no === no);
    if (!opsi.tanpaKamera) adeganRef.current?.fokus(b.kamera);
    if (!opsi.tanpaPesan) setPesanMaskot(b.teks);
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    try {
      adeganRef.current = new TwinScene(wadahRef.current, labelRef.current, simRef.current, {
        saatPilihKolam: (id) => {
          setIdPilih(id);
          adeganRef.current?.pilihKolam(id);
          adeganRef.current?.fokus(`kolam${id}`);
          setBagian((b) => (b === 1 || b === 6 ? 2 : b));
          setPesanMaskot(`Ini Kolam ${id}. Lihat sensor, keputusan AI, dan status kuncinya di panel kanan.`);
        },
        saatBagian: (no) => bukaBagian(no),
      });
    } catch (e) {
      setWebglGagal(true);
    }
    return () => adeganRef.current?.dispose();
  }, [bukaBagian]);

  useEffect(() => { adeganRef.current?.aturLabel(labelTampil); }, [labelTampil]);

  // ---------------- Aksi ----------------
  function catatHasil(h) {
    setHasilTombol({ ...h, waktu: Date.now() });
    if (!h.diterima) setLatensi((l) => [...l.slice(-49), h.latensiMs]);
    setTimeout(segarkan, 3600);
    segarkan();
  }
  const tekanFisik = useCallback((id) => catatHasil(simRef.current.tekanPakanManual(id, 'fisik')), []);

  function reset() {
    simRef.current = new Simulator({ seed: Math.floor(Math.random() * 1e9) });
    simRef.current.aturIkan(ikan, rasio / 100);
    adeganRef.current?.aturSim(simRef.current);
    setHasilTombol(null);
    setLatensi([]);
    setTimelapse(null);
    setTur(null);
    segarkan();
  }

  function mulaiTimelapse(jam) {
    setIntro(false);
    setTur(null);
    setJalan(true);
    setKecepatan(jam > 24 ? 14400 : 3600);
    setTimelapse({ mulai: sim.t, selesai: sim.t + jam * 3600, jam });
    adeganRef.current?.fokus('overview');
    setPesanMaskot(jam > 24 ? 'Timelapse 7 hari: perhatikan pola siang–malam dan kapan kunci pakan aktif.' : 'Timelapse 24 jam: matahari terbit, pakan 3×, pH naik siang dan turun malam.');
  }

  // ---------------- Tur ----------------
  const jalankanLangkah = useCallback((i) => {
    const l = TUR[i];
    setTur(i);
    setTimelapse(null);
    setJalan(true);
    setKecepatan(l.kecepatan);
    setBagian(l.bagian);
    adeganRef.current?.fokus(l.kamera);
    setPesanMaskot(l.teks);
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    l.aksi?.({ sim: simRef.current, pilihKolam, tekanFisik });
  }, [pilihKolam, tekanFisik]);

  function mulaiTur() { setIntro(false); setLembar(null); jalankanLangkah(0); }
  function hentikanTur() { setTur(null); setKecepatan(60); setPesanMaskot('Tur selesai. Silakan jelajah sendiri: klik kolam atau nomor di layar.'); }

  useEffect(() => {
    if (tur === null) return undefined;
    const id = setTimeout(() => {
      if (tur + 1 < TUR.length) jalankanLangkah(tur + 1);
      else hentikanTur();
    }, TUR[tur].durasi * 1000);
    return () => clearTimeout(id);
  }, [tur, jalankanLangkah]);

  // ---------------- Keyboard ----------------
  useEffect(() => {
    const f = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 't') { e.preventDefault(); tur === null ? mulaiTur() : hentikanTur(); }
      else if (k === 'enter' && intro) { e.preventDefault(); setIntro(false); }
      else if (k === 'l') mulaiTimelapse(24);
      else if (k === 'h') setLabelTampil((v) => !v);
      else if (k === ' ') { e.preventDefault(); setJalan((v) => !v); }
      else if (k === 'escape') { if (lembar) setLembar(null); else if (tur !== null) hentikanTur(); else if (intro) setIntro(false); }
      else if (tur !== null && k === 'arrowright' && tur + 1 < TUR.length) jalankanLangkah(tur + 1);
      else if (tur !== null && k === 'arrowleft' && tur > 0) jalankanLangkah(tur - 1);
      else if (/^[1-8]$/.test(k) && !intro) bukaBagian(Number(k));
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  });

  function kirimCari(e) {
    e.preventDefault();
    const q = cari.trim().toLowerCase();
    if (!q) return;
    const t = TARGET_CARI.find((x) => x.teks.toLowerCase().includes(q)) || TARGET_CARI.find((x) => q.includes(x.teks.toLowerCase().split(' ')[1] || '~'));
    if (!t) { setPesanMaskot(`Aku tidak menemukan "${cari}". Coba: kolam 2, tangki POC, gateway.`); return; }
    if (t.kolam) pilihKolam(t.kolam);
    setBagian(t.bagian);
    adeganRef.current?.fokus(t.kamera);
    setPesanMaskot(`Ini ${t.teks}.`);
    setCari('');
  }

  // ---------------- Data turunan ----------------
  const k = sim.kolam.find((x) => x.id === idPilih);
  const hang = sim.t < sim.master.hangSampai;
  const aman = sim.kolam.filter((x) => !sim.terkunci(x)).length;
  const risikoMaks = sim.kolam.reduce((m, x) => (x.online && x.ai.risiko > m.r ? { r: x.ai.risiko, id: x.id } : m), { r: 0, id: 1 });
  const dicegah = sim.kembar.reduce((s, x) => s + x.stat.pakanTerbuangKg, 0) - sim.kolam.reduce((s, x) => s + x.stat.pakanTerbuangKg, 0);
  const pocL = sim.kolam.reduce((s, x) => s + x.stat.limbahPocL, 0);
  const langkahTur = tur !== null ? TUR[tur] : null;

  const propsUmum = { sim, k, onPilih: pilihKolam };
  let isiPanel;
  switch (bagian) {
    case 2: isiPanel = <Bagian2 {...propsUmum} />; break;
    case 3: isiPanel = <Bagian3 {...propsUmum} onBukaModel={() => setLembar('model')} />; break;
    case 4: isiPanel = <Bagian4 {...propsUmum} hasilTombol={hasilTombol} onTekanFisik={() => tekanFisik(idPilih)}
      onPakanDashboard={() => catatHasil(sim.tekanPakanManual(idPilih, 'dashboard'))} suara={suara} setSuara={setSuara} latensi={latensi} />; break;
    case 5: isiPanel = <Bagian5 {...propsUmum} />; break;
    case 6: isiPanel = <Bagian6 sim={sim} onKosongkan={() => { sim.kosongkanTangki(); segarkan(); }} onGantiTangki={(id) => { sim.aturTangki(id); segarkan(); }} />; break;
    case 7: isiPanel = <Bagian7 {...propsUmum} onSkenario={(id) => { sim.skenario(id, idPilih); segarkan(); }} />; break;
    case 8: isiPanel = <Bagian8 {...propsUmum} />; break;
    default: isiPanel = <Bagian1 sim={sim} k={k} latensi={latensi} jalan={jalan} />;
  }

  return (
    <div className={`twin ${intro ? 'mode-intro' : ''}`}>
      {/* ---------- Bar atas ---------- */}
      <header className="bar-atas">
        <div className="merek">
          <Logo />
          <div>
            <strong>AQUA-LOCK AI</strong>
            <span>Digital Twin</span>
          </div>
        </div>
        <nav className="tampilan" aria-label="Tampilan">
          <button className={!lembar ? 'aktif' : ''} onClick={() => setLembar(null)}>Twin klaster</button>
          <button className={lembar === 'model' ? 'aktif' : ''} onClick={() => setLembar('model')}>Model AI</button>
          <button className={lembar === 'arsitektur' ? 'aktif' : ''} onClick={() => setLembar('arsitektur')}>Arsitektur &amp; MQTT</button>
        </nav>
        <form className="cari" onSubmit={kirimCari} role="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari: kolam 2, tangki POC, gateway" aria-label="Cari bagian klaster" list="daftar-cari" />
          <datalist id="daftar-cari">{TARGET_CARI.map((t) => <option key={t.teks} value={t.teks} />)}</datalist>
        </form>
        <button className="btn-garis" onClick={() => setLabelTampil(!labelTampil)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
          {labelTampil ? 'Bersihkan layar' : 'Tampilkan label'} <Kbd>H</Kbd>
        </button>
        <button className="btn-oranye" onClick={() => (tur === null ? mulaiTur() : hentikanTur())}>
          {tur === null ? '▶ Tur Si Kumis' : '■ Hentikan tur'} <Kbd>T</Kbd>
        </button>
        <div className="jam-pil"><span className={`titik ${jalan ? 'titik-baik' : 'titik-mati'}`} />Hari {sim.hari} · {jamMenit(sim.t)}</div>
        <div className="lencana">IDTC 2.0<small>AIoT 2026</small></div>
      </header>

      {/* ---------- Bar simulasi ---------- */}
      <div className="bar-sim">
        <button className="btn-garis" onClick={() => setJalan(!jalan)} aria-label={jalan ? 'Jeda' : 'Jalankan'}>
          {jalan ? <IkonPause size={15} /> : <IkonPlay size={15} />}{jalan ? 'Jeda' : 'Jalan'}
        </button>
        <button className="btn-garis" onClick={reset}><IkonReset size={15} />Ulang</button>
        <div className="segmen-twin" role="group" aria-label="Kecepatan simulasi">
          {KECEPATAN.map((c) => (
            <button key={c.v} className={kecepatan === c.v ? 'aktif' : ''} onClick={() => { setKecepatan(c.v); setTimelapse(null); }}>{c.label}</button>
          ))}
        </div>
        <label className="geser">
          <span>Ikan/kolam</span>
          <input type="range" min="1000" max="3000" step="100" value={ikan}
            onChange={(e) => { const v = Number(e.target.value); setIkan(v); sim.aturIkan(v, null); }} />
          <b>{ikan.toLocaleString('id-ID')} ekor</b>
        </label>
        <label className="geser">
          <span>Pakan harian</span>
          <input type="range" min="1.5" max="4" step="0.1" value={rasio}
            onChange={(e) => { const v = Number(e.target.value); setRasio(v); sim.aturIkan(null, v / 100); }} />
          <b>{angka(rasio, 1)}% biomassa</b>
        </label>
        <div className="bar-sim-kanan">
          <button className="btn-teks" onClick={() => mulaiTimelapse(24)}>Timelapse 24 jam <Kbd>L</Kbd></button>
          <button className="btn-teks" onClick={() => mulaiTimelapse(168)}>7 hari</button>
        </div>
      </div>

      {/* ---------- Isi utama ---------- */}
      <div className="utama">
        <section className="panggung" aria-label="Adegan 3D klaster kolam">
          <div className="kanvas" ref={wadahRef} />
          <div className="lapisan-label" ref={labelRef} />
          {webglGagal && <p className="webgl-gagal">Browser ini tidak mendukung WebGL, jadi adegan 3D tidak bisa ditampilkan. Panel di kanan tetap berfungsi.</p>}

          <div className={`kpi-melayang ${labelTampil ? '' : 'sembunyi'}`}>
            <div><span><i className="titik titik-baik" />Boleh makan</span><b>{aman}/4</b><small>{4 - aman ? `${4 - aman} terkunci` : 'semua aman'}</small></div>
            <div><span><i className="titik titik-peringatan" />Risiko tertinggi</span><b>{angka(risikoMaks.r, 2)}</b><small>Kolam {risikoMaks.id}</small></div>
            <div><span><i className="titik titik-navy" />Pakan dihemat</span><b>{angka(Math.max(0, dicegah), 1)} kg</b><small>tak terbuang vs timer</small></div>
            <div><span><i className="titik titik-coklat" />Limbah → POC</span><b>{angka(pocL)} L</b><small>0 L ke selokan</small></div>
            <div><span><i className="titik titik-baik" />Biaya cloud</span><b>Rp0</b><small>semua di Uno Q</small></div>
          </div>

          {hang && <div className="pita-hang">MPU Linux reboot · {Math.ceil(sim.master.hangSampai - sim.t)} dtk lagi. STM32 tetap memegang kunci pakan, watchdog ESP32 membatasi drain.</div>}
          {timelapse && (
            <div className="pita-timelapse">
              Timelapse {timelapse.jam > 24 ? '7 hari' : '24 jam'} · {Math.min(100, Math.round(((sim.t - timelapse.mulai) / (timelapse.selesai - timelapse.mulai)) * 100))}%
              <button onClick={() => { setTimelapse(null); setKecepatan(60); }}>Berhenti</button>
            </div>
          )}

          <div className={`pemandu ${langkahTur ? 'tur' : ''}`}>
            <div className="pemandu-kartu">
              <span className="pemandu-nama">{langkahTur ? `${langkahTur.judul} · ${tur + 1}/${TUR.length}` : 'Si Kumis'}</span>
              <p>{pesanMaskot}</p>
              <div className="pemandu-aksi">
                {langkahTur ? (
                  <>
                    <button className="btn-kecil" disabled={tur === 0} onClick={() => jalankanLangkah(tur - 1)} aria-label="Langkah sebelumnya">◀</button>
                    <button className="btn-kecil" onClick={() => (tur + 1 < TUR.length ? jalankanLangkah(tur + 1) : hentikanTur())}>{tur + 1 < TUR.length ? 'Lanjut ▶' : 'Selesai'}</button>
                    <button className="btn-kecil garis" onClick={hentikanTur}>Berhenti</button>
                    <span className="progres-tur"><i key={tur} style={{ animationDuration: `${langkahTur.durasi}s` }} /></span>
                  </>
                ) : (
                  <button className="btn-kecil" onClick={mulaiTur}>▶ Tur 2 menit</button>
                )}
              </div>
            </div>
            <Maskot ukuran={langkahTur ? 132 : 104} />
          </div>

          <nav className="nav-bawah" aria-label="Bagian">
            {BAGIAN.map((b) => (
              <button key={b.no} className={bagian === b.no ? 'aktif' : ''} onClick={() => bukaBagian(b.no)}>
                <span>{b.no}</span>{b.label}
              </button>
            ))}
          </nav>
        </section>

        <aside className="panel" ref={panelRef} aria-label={`Bagian ${bagian}`}>
          <div className="p-isi">{isiPanel}</div>
        </aside>
      </div>

      {/* ---------- Lembar Model / Arsitektur ---------- */}
      {lembar && (
        <div className="lembar" role="dialog" aria-modal="true" aria-label={lembar === 'model' ? 'Model AI' : 'Arsitektur'}>
          <div className="lembar-isi">
            <button className="lembar-tutup" onClick={() => setLembar(null)} aria-label="Tutup">✕</button>
            {lembar === 'model' ? <ModelTab sim={sim} idPilih={idPilih} /> : <ArsitekturTab sim={sim} />}
          </div>
        </div>
      )}

      {/* ---------- Intro ---------- */}
      {intro && (
        <div className="intro" role="dialog" aria-label="Pembuka">
          <div className="intro-kiri">
            <span className="intro-lencana">IDTC 2.0 · Kompetisi AIoT 2026</span>
            <div className="intro-judul">
              <Logo ukuran={132} />
              <h1><span className="navy">Aqua-Lock</span><span className="oranye">AI</span></h1>
            </div>
            <h2>Digital Twin</h2>
            <p className="intro-sub">Safety interlock pakan berbasis AI untuk klaster kolam bioflok: pakan dikunci saat air berbahaya, lumpur dasar jadi pupuk cair.</p>
            <div className="intro-tombol">
              <button className="btn-oranye besar" onClick={mulaiTur}>▶ Mulai tur 2 menit <Kbd>T</Kbd></button>
              <button className="btn-putih besar" onClick={() => setIntro(false)}>Jelajahi sendiri <Kbd>Enter</Kbd></button>
            </div>
            <div className="intro-tombol">
              <button className="btn-putih" onClick={() => mulaiTimelapse(24)}>Timelapse 24 jam <Kbd>L</Kbd></button>
              <button className="btn-putih" onClick={() => mulaiTimelapse(168)}>Timelapse 7 hari</button>
            </div>
            <p className="intro-kaki">Tim AQUA-LOCK AI · data simulasi dari model fisika air (Emerson et al., 1975) · bukan data lapangan</p>
          </div>
          <div className="intro-kanan">
            <div className="intro-gelembung">
              <b>Halo, aku Si Kumis!</b>
              <p>Lele penjaga kolam. Ayo lihat bagaimana AI menjaga pakan kami tetap aman.</p>
            </div>
            <Maskot ukuran={300} />
          </div>
        </div>
      )}
    </div>
  );
}
