// =============================================================
// PanelNode.jsx — Panel kontrol kanan AQUA-LOCK AI yang
// dikelompokkan menjadi 4 tab rapi:
// 1. Kontrol & Uji (preset state, slider pH/TDS/Suhu/Level, POC)
// 2. Aktuator & FSM (Sequential Reading, Safety Interlock, 4 Relay)
// 3. Komponen 3D (fungsi 25 part Wokwi + pinout ESP32)
// 4. Serial & Kode (JSON telemetri 115200 baud + sketch.ino)
// =============================================================
import { useMemo, useState } from 'react';
import { AMBANG_NODE, GEOM, WARNA_STATE, barisOled } from './firmware.js';
import {
  ANAK, GRUP, INDUK, INFO, OBJEK_ADEGAN, PETA_PIN, WARNA_KABEL,
  daftarPerGrup, koneksiPart, objekUntuk,
} from './komponen.js';
import sketchRaw from '../../wokwi/sketch.ino?raw';

const PRESET = [
  { id: 'normal', label: 'NORMAL (100%)', sub: 'pH 7,2 · TDS 360', nada: 'normal', v: { ph: 7.2, tdsRaw: 380, temp: 28, distCm: 30 } },
  { id: 'normal50', label: 'NORMAL (50%)', sub: 'T 23 °C / TDS 500', nada: 'normal', v: { ph: 7.2, tdsRaw: 500, temp: 23, distCm: 30 } },
  { id: 'clean_drain', label: 'CLEANING · Kuras', sub: 'TDS 760 · Jarak 25 cm', nada: 'cleaning', v: { ph: 7.2, tdsRaw: 800, temp: 28, distCm: 25 } },
  { id: 'clean_inlet', label: 'CLEANING · Inlet', sub: 'TDS 720 · Jarak 52 cm', nada: 'cleaning', v: { ph: 7.2, tdsRaw: 760, temp: 28, distCm: 52 } },
  { id: 'ph_up', label: 'PH_RECOVERY · Up', sub: 'pH 5,6 (asam)', nada: 'recovery', v: { ph: 5.6, tdsRaw: 380, temp: 28, distCm: 30 } },
  { id: 'ph_down', label: 'PH_RECOVERY · Down', sub: 'pH 8,9 (basa)', nada: 'recovery', v: { ph: 8.9, tdsRaw: 380, temp: 28, distCm: 30 } },
];

const TAB_PANEL = [
  { id: 'kontrol', label: 'Kontrol & Uji' },
  { id: 'aktuator', label: 'Aktuator & FSM' },
  { id: 'komponen', label: 'Komponen 3D' },
  { id: 'serial', label: 'Serial & Kode' },
];

const NAMA_STATE = {
  NORMAL: { teks: 'NORMAL', ket: 'Air aman · pakan diizinkan', kelas: 'st-normal' },
  CLEANING: { teks: 'CLEANING', ket: 'TDS > 600 ppm · kuras POC & isi ulang', kelas: 'st-cleaning' },
  PH_RECOVERY: { teks: 'PH_RECOVERY', ket: 'pH di luar 6,5–8,2 · dosing otomatis', kelas: 'st-recovery' },
};

function MiniOled({ baris }) {
  const layar = barisOled(baris);
  return (
    <div className="nd-oled" aria-label="Layar OLED SSD1306">
      <div className="nd-oled-bar"><span>SSD1306 · 128×64</span><span>I²C 0x3C</span></div>
      <pre>{layar.join('\n')}</pre>
    </div>
  );
}

function IkonGembok({ terkunci }) {
  return terkunci ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M12 3v12m0 0-4-4m4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" strokeLinecap="round" />
    </svg>
  );
}

export default function PanelNode({
  fw, mode, xray, setXray, tampilDaya, setTampilDaya,
  tab, setTab, dipilih, onPilihPart, onLompat,
  onSlider, onPreset, onFeed, onToggleFisika, onKosongkanPoc, onReset,
  suara, setSuara,
}) {
  const [bukaGrup, setBukaGrup] = useState({ mcu: true, sensor: true, safety: true, aktuator: true });
  const [tampilKode, setTampilKode] = useState(false);
  const [jedaSerial, setJedaSerial] = useState(false);
  const [salinOk, setSalinOk] = useState(false);

  const daftarGrup = useMemo(() => daftarPerGrup(), []);
  const infoSt = NAMA_STATE[fw.state] || NAMA_STATE.NORMAL;
  const warnaSt = WARNA_STATE[fw.state];

  const idEfektif = dipilih ? (INFO[dipilih] ? dipilih : null) : null;
  const infoDipilih = idEfektif ? INFO[idEfektif] : null;
  const koneksiDipilih = useMemo(() => (idEfektif ? koneksiPart(idEfektif) : []), [idEfektif]);
  const objekTerkait = idEfektif ? objekUntuk(idEfektif) : null;
  const anakDipilih = idEfektif ? (ANAK[idEfektif] || []) : [];

  const [bekuSerial, setBekuSerial] = useState([]);
  const daftarSerial = jedaSerial ? bekuSerial : [...fw.serial].reverse();

  function toggleJedaSerial() {
    if (!jedaSerial) setBekuSerial([...fw.serial].reverse());
    setJedaSerial((v) => !v);
  }

  function salinSketch() {
    navigator.clipboard?.writeText(sketchRaw).then(() => {
      setSalinOk(true);
      setTimeout(() => setSalinOk(false), 1800);
    }).catch(() => {});
  }

  return (
    <aside className="panel nd-panel" aria-label="Panel kontrol AQUA-LOCK AI">
      {/* ===== Ringkasan Status & Aksi Cepat (Selalu Terlihat) ===== */}
      <div className="nd-kepala">
        <div className={`nd-status-banner ${infoSt.kelas}`} style={{ '--st-warna': warnaSt }}>
          <div className="nd-status-atas">
            <span className="nd-pil-state"><i style={{ background: warnaSt }} />{infoSt.teks}</span>
            <span className={`nd-pil-lock ${fw.feedLocked ? 'terkunci' : 'aman'}`}>
              {fw.feedLocked ? 'FEED LOCKED · 0%' : `FEED READY · ${fw.feedPortion}%`}
            </span>
          </div>
          <p className="nd-status-ket">{infoSt.ket}</p>
        </div>

        <MiniOled baris={fw.oled} />

        {/* Tombol Utama sesuai spesifikasi interactive_controls */}
        <div className="nd-aksi-utama">
          <button
            type="button"
            className={`nd-btn-feed ${fw.feedLocked ? 'terkunci' : 'siap'}`}
            onClick={onFeed}
          >
            <IkonGembok terkunci={fw.feedLocked} />
            <span>{fw.feedLocked ? 'Manual Feed (Test Safety Interlock)' : `Trigger Manual Feed (${fw.feedPortion}%)`}</span>
          </button>

          <div className="nd-aksi-baris">
            {mode === 'kolam' ? (
              <button
                type="button"
                className={`nd-btn-sek ${xray ? 'aktif' : ''}`}
                onClick={() => setXray((v) => !v)}
              >
                {xray ? '✓ X-Ray Wiring ESP32' : 'Toggle X-Ray Mode'}
              </button>
            ) : (
              <button
                type="button"
                className={`nd-btn-sek ${tampilDaya ? 'aktif' : ''}`}
                onClick={() => setTampilDaya((v) => !v)}
              >
                {tampilDaya ? '✓ Kabel Daya 3V3/5V/GND' : 'Tampilkan Kabel Daya'}
              </button>
            )}
            <button
              type="button"
              className="nd-btn-ikon"
              title={suara ? 'Matikan suara buzzer' : 'Aktifkan suara buzzer 1200 Hz'}
              onClick={() => setSuara((v) => !v)}
            >
              {suara ? '🔊' : '🔇'}
            </button>
            <button type="button" className="nd-btn-ikon" title="Reset simulasi node" onClick={onReset}>
              ↺
            </button>
          </div>
        </div>

        {/* Navigasi Tab Panel (Pengelompokan rapi) */}
        <div className="nd-tab-bar" role="tablist" aria-label="Kelompok panel kontrol">
          {TAB_PANEL.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'aktif' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Isi Tab ===== */}
      <div className="nd-isi">
        {/* ---------- TAB 1: KONTROL & UJI ---------- */}
        {tab === 'kontrol' && (
          <>
            <section className="nd-kartu">
              <div className="nd-kartu-judul">
                <h3>1. Slider Sensor Real-Time</h3>
                <span className="nd-badge-kecil">Input Wokwi</span>
              </div>

              {/* Slider pH (4.0 - 10.0) */}
              <div className="nd-slider-grup">
                <div className="nd-slider-kepala">
                  <label htmlFor="sl-ph">pH Air <small>(aman 6,5–8,2)</small></label>
                  <strong className={fw.baca.ph < AMBANG_NODE.phMin || fw.baca.ph > AMBANG_NODE.phMax ? 'bahaya' : 'aman'}>
                    {fw.baca.ph.toFixed(2)}
                  </strong>
                </div>
                <input
                  id="sl-ph" type="range" min="4.0" max="10.0" step="0.05"
                  value={fw.input.ph}
                  onChange={(e) => onSlider('ph', Number(e.target.value))}
                />
                <div className="nd-skala">
                  <span>4,0 (Asam)</span>
                  <span className="nd-tanda">6,5 – 8,2</span>
                  <span>10,0 (Basa)</span>
                </div>
              </div>

              {/* Slider TDS (100 - 900 ppm) */}
              <div className="nd-slider-grup">
                <div className="nd-slider-kepala">
                  <label htmlFor="sl-tds">TDS Sensor <small>(batas &gt; 600 ppm)</small></label>
                  <strong className={fw.baca.tds > AMBANG_NODE.tds ? 'kritis' : fw.baca.tds > AMBANG_NODE.tdsPorsi ? 'waspada' : 'aman'}>
                    {fw.baca.tds.toFixed(0)} ppm
                  </strong>
                </div>
                <input
                  id="sl-tds" type="range" min="100" max="900" step="5"
                  value={fw.input.tdsRaw}
                  onChange={(e) => onSlider('tdsRaw', Number(e.target.value))}
                />
                <div className="nd-skala">
                  <span>100 ppm</span>
                  <span className="nd-tanda">mentah {fw.baca.tdsRaw.toFixed(0)} → komp. {fw.baca.tds.toFixed(0)}</span>
                  <span>900 ppm</span>
                </div>
              </div>

              {/* Slider Suhu (20 - 34 °C) */}
              <div className="nd-slider-grup">
                <div className="nd-slider-kepala">
                  <label htmlFor="sl-temp">Suhu Air <small>(&lt; 24 °C → porsi 50%)</small></label>
                  <strong className={fw.baca.temp < AMBANG_NODE.suhuDingin ? 'waspada' : 'aman'}>
                    {fw.baca.temp.toFixed(1)} °C
                  </strong>
                </div>
                <input
                  id="sl-temp" type="range" min="20" max="34" step="0.5"
                  value={fw.input.temp}
                  onChange={(e) => onSlider('temp', Number(e.target.value))}
                />
                <div className="nd-skala">
                  <span>20 °C</span>
                  <span className="nd-tanda">komp. TDS 2%/°C (ref 25°C)</span>
                  <span>34 °C</span>
                </div>
              </div>

              {/* Slider Jarak Ultrasonik HC-SR04 */}
              <div className="nd-slider-grup">
                <div className="nd-slider-kepala">
                  <label htmlFor="sl-dist">Jarak HC-SR04 <small>(&lt; 45 kuras / ≥ 45 isi)</small></label>
                  <strong>{fw.baca.distCm.toFixed(1)} cm <small>(air {fw.levelCm.toFixed(0)} cm)</small></strong>
                </div>
                <input
                  id="sl-dist" type="range" min="15" max="75" step="1"
                  value={fw.input.distCm}
                  onChange={(e) => onSlider('distCm', Number(e.target.value))}
                />
                <div className="nd-skala">
                  <span>15 cm (penuh)</span>
                  <span className="nd-tanda">batas 45 cm</span>
                  <span>75 cm (surut)</span>
                </div>
              </div>
            </section>

            {/* Preset Uji Transisi State */}
            <section className="nd-kartu">
              <div className="nd-kartu-judul">
                <h3>2. Uji Cepat Transisi State</h3>
                <span className="nd-badge-kecil">6 skenario</span>
              </div>
              <div className="nd-preset-grid">
                {PRESET.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`nd-preset nd-preset-${p.nada}`}
                    onClick={() => onPreset(p.v)}
                  >
                    <b>{p.label}</b>
                    <span>{p.sub}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Pengaturan Fisika & Tangki POC */}
            <section className="nd-kartu">
              <div className="nd-kartu-judul">
                <h3>3. Fisika Air &amp; Tangki POC</h3>
                <label className="nd-saklar">
                  <input type="checkbox" checked={fw.fisika} onChange={onToggleFisika} />
                  <span>{fw.fisika ? 'Auto' : 'Tahan nilai'}</span>
                </label>
              </div>
              <p className="nd-catatan">
                {fw.fisika
                  ? 'Aktif: pompa drain menguras kolam ke IBC POC, inlet mengencerkan TDS, dan dosing memulihkan pH secara otomatis.'
                  : 'Mode tahan nilai: slider tidak berubah otomatis agar animasi CLEANING / PH_RECOVERY bisa diamati lebih lama.'}
              </p>
              <div className="nd-poc-bar">
                <div>
                  <span>IBC Tank Limbah POC</span>
                  <strong>{fw.pocL.toFixed(0)} / {GEOM.kapasitasPocL} L</strong>
                </div>
                <div className="nd-progres">
                  <i style={{ width: `${Math.min(100, (fw.pocL / GEOM.kapasitasPocL) * 100)}%` }} />
                </div>
                <div className="nd-poc-kaki">
                  <span>Feed OK: <b>{fw.stat.feedOk}×</b> · Diblokir: <b className="teks-kritis">{fw.stat.feedBlok}×</b></span>
                  <button type="button" className="nd-btn-mini" onClick={onKosongkanPoc} disabled={fw.pocL < 1}>
                    Kosongkan POC
                  </button>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ---------- TAB 2: AKTUATOR & FSM ---------- */}
        {tab === 'aktuator' && (
          <>
            <section className="nd-kartu">
              <div className="nd-kartu-judul">
                <h3>Sequential Reading (Anti-Interferensi)</h3>
                <span className={`nd-lampu ${fw.mosfet ? 'cyan' : ''}`}>MOSFET {fw.mosfet ? 'ON' : 'OFF'}</span>
              </div>
              <p className="nd-catatan">
                <code>GPIO25</code> menyalakan probe TDS selama 150 ms → <code>analogRead(35)</code> → mematikan MOSFET 100 ms → baru membaca probe pH (<code>GPIO34</code>) agar tidak terjadi ground-loop.
              </p>
              <div className="nd-grid-2">
                <div className="nd-metrik"><span>pH (GPIO34)</span><b>{fw.baca.ph.toFixed(2)}</b></div>
                <div className="nd-metrik"><span>TDS komp. (GPIO35)</span><b>{fw.baca.tds.toFixed(0)} ppm</b></div>
                <div className="nd-metrik"><span>Suhu DHT22 (GPIO4)</span><b>{fw.baca.temp.toFixed(1)} °C</b></div>
                <div className="nd-metrik"><span>Ultrasonik (5/18)</span><b>{fw.baca.distCm.toFixed(1)} cm</b></div>
              </div>
            </section>

            <section className="nd-kartu">
              <div className="nd-kartu-judul">
                <h3>4 Kanal Relay &amp; Beban</h3>
                <span className="nd-badge-kecil">GPIO 26/27/32/33</span>
              </div>
              <div className="nd-daftar-aktuator">
                {[
                  { nama: 'Relay Drain → POC', pin: 'GPIO26', on: fw.out.drain, warna: '#eab308', ket: `Kuras saat TDS > 600 & jarak < 45 cm (${fw.pocL.toFixed(0)} L)` },
                  { nama: 'Relay Inlet Air Bersih', pin: 'GPIO27', on: fw.out.inlet, warna: '#3b82f6', ket: 'Isi ulang saat TDS > 600 & jarak ≥ 45 cm' },
                  { nama: 'Relay Dosing pH-Up', pin: 'GPIO32', on: fw.out.up, warna: '#22c55e', ket: `Dosing basa saat pH < 6,5 (${fw.dosisMl.up.toFixed(0)} mL)` },
                  { nama: 'Relay Dosing pH-Down', pin: 'GPIO33', on: fw.out.down, warna: '#a855f7', ket: `Dosing asam saat pH > 8,2 (${fw.dosisMl.down.toFixed(0)} mL)` },
                ].map((a) => (
                  <div key={a.pin} className={`nd-item-akt ${a.on ? 'aktif' : ''}`}>
                    <span className="nd-dot" style={{ background: a.on ? a.warna : '#cbd5e1', boxShadow: a.on ? `0 0 10px ${a.warna}` : 'none' }} />
                    <div>
                      <b>{a.nama} <code>{a.pin}</code></b>
                      <small>{a.ket}</small>
                    </div>
                    <em className={a.on ? 'on' : ''}>{a.on ? 'ON' : 'OFF'}</em>
                  </div>
                ))}
              </div>
            </section>

            <section className="nd-kartu">
              <div className="nd-kartu-judul">
                <h3>Safety Interlock &amp; Pakan</h3>
                <span className="nd-badge-kecil">Hard Lock</span>
              </div>
              <div className="nd-daftar-aktuator">
                {[
                  { nama: 'LED Safety Lock', pin: 'GPIO23', on: fw.out.ledLock, warna: '#ef4444', ket: fw.out.ledLock ? 'Menyala — pakan diblokir' : 'Mati — pakan aman' },
                  { nama: 'Buzzer Alarm', pin: 'GPIO19', on: fw.buzzer, warna: '#9333ea', ket: 'tone(19, 1200 Hz, 300 ms) saat ditolak' },
                  { nama: 'Servo Auto Feeder', pin: 'GPIO13', on: fw.servoBuka, warna: '#f97316', ket: `Sudut ${fw.servoSudut}° · durasi ${fw.feedPortion === 100 ? '1,2 dtk' : '0,6 dtk'}` },
                ].map((a) => (
                  <div key={a.pin} className={`nd-item-akt ${a.on ? 'aktif' : ''}`}>
                    <span className="nd-dot" style={{ background: a.on ? a.warna : '#cbd5e1', boxShadow: a.on ? `0 0 10px ${a.warna}` : 'none' }} />
                    <div>
                      <b>{a.nama} <code>{a.pin}</code></b>
                      <small>{a.ket}</small>
                    </div>
                    <em className={a.on ? 'on' : ''}>{a.on ? 'AKTIF' : 'SIAGA'}</em>
                  </div>
                ))}
              </div>
            </section>

            <section className="nd-kartu">
              <div className="nd-kartu-judul">
                <h3>Logika FSM (<code>sketch.ino</code>)</h3>
              </div>
              <div className="nd-fsm-list">
                <div className={`nd-fsm-row ${fw.state === 'CLEANING' ? 'aktif cleaning' : ''}`}>
                  <b>1. CLEANING</b>
                  <span><code>tds &gt; 600</code> → <code>feedLocked = true</code>, drain (&lt;45 cm) / inlet (≥45 cm)</span>
                </div>
                <div className={`nd-fsm-row ${fw.state === 'PH_RECOVERY' ? 'aktif recovery' : ''}`}>
                  <b>2. PH_RECOVERY</b>
                  <span><code>ph &lt; 6.5 || ph &gt; 8.2</code> → <code>feedLocked = true</code>, dosing pH-Up / pH-Down</span>
                </div>
                <div className={`nd-fsm-row ${fw.state === 'NORMAL' ? 'aktif normal' : ''}`}>
                  <b>3. NORMAL</b>
                  <span><code>feedLocked = false</code>, porsi 50% jika <code>T &lt; 24 || tds &gt; 450</code>, else 100%</span>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ---------- TAB 3: KOMPONEN & SKEMATIK 3D ---------- */}
        {tab === 'komponen' && (
          <>
            {/* Detail komponen yang sedang dipilih */}
            {infoDipilih ? (
              <section className="nd-kartu nd-detail-part">
                <div className="nd-kartu-judul">
                  <div>
                    <span className="nd-sub-id"><code>{idEfektif}</code> · {infoDipilih.peran}</span>
                    <h3>{infoDipilih.nama}</h3>
                  </div>
                  <button type="button" className="nd-btn-mini" onClick={() => onPilihPart(null)}>Tutup</button>
                </div>
                <div className="nd-nilai-live">Status saat ini: <b>{infoDipilih.nilai(fw)}</b></div>
                <p className="nd-fungsi-teks">{infoDipilih.fungsi}</p>
                {anakDipilih.length > 0 && (
                  <div className="nd-sub-chip">
                    Bagian terkait: {anakDipilih.map((a) => <code key={a}>{a}</code>)}
                  </div>
                )}
                {koneksiDipilih.length > 0 && (
                  <div className="nd-koneksi">
                    <span>Wiring dari <code>diagram.json</code>:</span>
                    <ul>
                      {koneksiDipilih.map((k, i) => (
                        <li key={i}>
                          <i className="nd-dot-kecil" style={{ background: WARNA_KABEL[k.warna] || '#64748b' }} />
                          <code>{k.pin}</code> → <code>{k.ke}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="nd-aksi-baris">
                  <button type="button" className="nd-btn-sek" onClick={() => onLompat('skematik', infoDipilih.grup)}>
                    Lihat di Skematik 3D
                  </button>
                  {objekTerkait && (
                    <button type="button" className="nd-btn-sek" onClick={() => onLompat('kolam', OBJEK_ADEGAN[objekTerkait].kamera)}>
                      Fokus di Kolam 3D
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <p className="nd-tip-atas">Klik komponen di daftar bawah atau langsung di adegan 3D untuk melihat fungsi &amp; jalur kabelnya.</p>
            )}

            {/* Daftar 4 kelompok subsistem komponen Wokwi */}
            {daftarGrup.map((g) => {
              const terbuka = bukaGrup[g.id];
              return (
                <section key={g.id} className="nd-kartu nd-akordeon">
                  <button
                    type="button"
                    className="nd-akordeon-kepala"
                    aria-expanded={terbuka}
                    onClick={() => setBukaGrup((s) => ({ ...s, [g.id]: !s[g.id] }))}
                  >
                    <span className="nd-grup-tanda" style={{ background: g.warna }} />
                    <b>{g.judul}</b>
                    <small>{g.item.length} modul</small>
                    <span className="nd-panah">{terbuka ? '▾' : '▸'}</span>
                  </button>
                  {terbuka && (
                    <div className="nd-akordeon-isi">
                      {g.item.map((id) => {
                        const info = INFO[id];
                        const aktif = idEfektif === id || INDUK[idEfektif] === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            className={`nd-part-row ${aktif ? 'aktif' : ''}`}
                            onClick={() => onPilihPart(id)}
                          >
                            <div>
                              <b>{info.nama}</b>
                              <small>{info.peran}</small>
                            </div>
                            <span className="nd-part-val">{info.nilai(fw)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}

            {/* Peta 16 GPIO ESP32 */}
            <section className="nd-kartu">
              <div className="nd-kartu-judul">
                <h3>Peta Pin ESP32 (16 GPIO)</h3>
                <span className="nd-badge-kecil">DevKitC V4</span>
              </div>
              <div className="nd-pin-tabel">
                {PETA_PIN.map((p) => {
                  const on = fw.levelPin(p.gpio);
                  const warna = GRUP.find((g) => g.id === p.grup)?.warna || '#0B4F6C';
                  return (
                    <div key={p.gpio} className={`nd-pin-row ${on ? 'nyala' : ''}`}>
                      <span className="nd-gpio-pil" style={{ borderColor: warna }}>GPIO{p.gpio}</span>
                      <span className="nd-pin-mode">{p.mode}</span>
                      <span className="nd-pin-ket" title={p.fungsi}>{p.ke}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* ---------- TAB 4: SERIAL & KODE ---------- */}
        {tab === 'serial' && (
          <>
            <section className="nd-kartu">
              <div className="nd-kartu-judul">
                <h3>Serial Monitor · 115200 baud</h3>
                <button type="button" className="nd-btn-mini" onClick={toggleJedaSerial}>
                  {jedaSerial ? '▶ Lanjut' : '⏸ Jeda'}
                </button>
              </div>
              <div className="nd-serial-box" role="log" aria-live="polite">
                {daftarSerial.length === 0 ? (
                  <div className="nd-serial-kosong">Menunggu output Serial.printf()...</div>
                ) : (
                  daftarSerial.map((s) => (
                    <div key={s.id} className={`nd-serial-line ${s.jenis}`}>
                      <span className="nd-serial-t">{s.t.toFixed(1)}s</span>
                      <code>{s.teks}</code>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="nd-kartu">
              <div className="nd-kartu-judul">
                <h3>Kode Firmware (<code>wokwi/sketch.ino</code>)</h3>
                <div className="nd-aksi-inline">
                  <button type="button" className="nd-btn-mini" onClick={salinSketch}>
                    {salinOk ? '✓ Tersalin' : 'Salin'}
                  </button>
                  <button type="button" className="nd-btn-mini" onClick={() => setTampilKode((v) => !v)}>
                    {tampilKode ? 'Sembunyikan' : 'Buka kode'}
                  </button>
                </div>
              </div>
              {tampilKode ? (
                <pre className="nd-kode-box">{sketchRaw}</pre>
              ) : (
                <p className="nd-catatan">
                  Berisi kode C++ ESP32 asli yang diemulasikan secara real-time di web ini: Sequential Reading MOSFET TDS, kompensasi suhu 2%/°C, ultrasonik HC-SR04, FSM 3 status, Hard Safety Interlock, OLED SSD1306, dan telemetri JSON.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
