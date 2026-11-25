// =============================================================
// NodeView.jsx — Aplikasi 3D interaktif React Three Fiber untuk
// AQUA-LOCK AI: menggabungkan Digital Twin Kolam 3D + Skematik
// Wokwi 3D + panel kontrol kanan yang dikelompokkan rapi.
// =============================================================
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { NodeFirmware, WARNA_STATE } from './firmware.js';
import { GRUP, INFO, OBJEK_ADEGAN } from './komponen.js';
import { useTeksturOled } from './oled.js';
import SceneKolam, { KAMERA_KOLAM } from './SceneKolam.jsx';
import SceneSkematik, { KAMERA_SKEMATIK } from './SceneSkematik.jsx';
import PanelNode from './PanelNode.jsx';

// Audio buzzer Web Audio API sesuai tone(PIN_BUZZER, 1200, 300)
let _ctxAudio = null;
function bunyiBuzzer(aktif) {
  if (!aktif || typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!_ctxAudio) _ctxAudio = new Ctx();
    if (_ctxAudio.state === 'suspended') _ctxAudio.resume();
    const t0 = _ctxAudio.currentTime;
    const osc = _ctxAudio.createOscillator();
    const gain = _ctxAudio.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, t0);
    gain.gain.setValueAtTime(0.08, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    osc.connect(gain);
    gain.connect(_ctxAudio.destination);
    osc.start(t0);
    osc.stop(t0 + 0.31);
  } catch { /* audio diblokir browser */ }
}

// Penggerak loop firmware + animasi transisi kamera OrbitControls
function Penggerak({ fwRef, kameraTujuan, onSelesaiKamera, onTickUi, onEvent }) {
  const { camera } = useThree();
  const ctrlRef = useRef();
  const tujuanPos = useRef(new THREE.Vector3());
  const tujuanTarget = useRef(new THREE.Vector3());
  const transisi = useRef(false);
  const jamUi = useRef(0);
  const sidikTerakhir = useRef('');
  const eventTerakhir = useRef(0);

  useEffect(() => {
    if (!kameraTujuan) return;
    tujuanPos.current.set(...kameraTujuan.pos);
    tujuanTarget.current.set(...kameraTujuan.target);
    transisi.current = true;
  }, [kameraTujuan]);

  useFrame((_, dt) => {
    const d = Math.min(0.05, dt);
    const fw = fwRef.current;
    fw.maju(d);

    if (fw.event && fw.event.id !== eventTerakhir.current) {
      eventTerakhir.current = fw.event.id;
      onEvent(fw.event);
    }

    // Perbarui React UI hanya ketika nilai benar-benar berubah (bebas stutter 60fps)
    jamUi.current += d;
    if (jamUi.current >= 0.16) {
      jamUi.current = 0;
      const sidik = `${fw.loopKe}|${fw.state}|${fw.komoditas.id}|${fw.booting ? Math.ceil(fw.booting.sisaDtk) : 0}|${fw.mosfet}|${fw.servoBuka}|${fw.buzzer}|${fw.pocL.toFixed(0)}|${fw.baca.distCm.toFixed(1)}|${fw.baca.ph.toFixed(2)}`;
      if (sidik !== sidikTerakhir.current) {
        sidikTerakhir.current = sidik;
        onTickUi();
      }
    }

    if (transisi.current && ctrlRef.current) {
      const f = 1 - Math.exp(-5.5 * d);
      camera.position.lerp(tujuanPos.current, f);
      ctrlRef.current.target.lerp(tujuanTarget.current, f);
      ctrlRef.current.update();
      if (camera.position.distanceTo(tujuanPos.current) < 0.025 &&
          ctrlRef.current.target.distanceTo(tujuanTarget.current) < 0.025) {
        transisi.current = false;
        onSelesaiKamera();
      }
    }
  });

  return (
    <OrbitControls
      ref={ctrlRef}
      makeDefault
      enableDamping
      dampingFactor={0.055}
      rotateSpeed={0.78}
      zoomSpeed={0.85}
      panSpeed={0.8}
      maxPolarAngle={Math.PI / 2 - 0.04}
      minDistance={1.8}
      maxDistance={18}
      onStart={() => { transisi.current = false; }}
    />
  );
}

function IsiKanvas({
  fwRef, mode, xray, label, dipilih, filterGrup, tampilDaya,
  kameraTujuan, onSelesaiKamera, onTickUi, onEvent, onFeed,
  onPilihObjekKolam, onPilihPart, onPilihGrup, versi,
}) {
  const oledTex = useTeksturOled(fwRef);
  return (
    <>
      <color attach="background" args={[mode === 'skematik' ? '#08131f' : '#e8f3f8']} />
      <ambientLight intensity={mode === 'skematik' ? 0.72 : 0.68} />
      <hemisphereLight args={[mode === 'skematik' ? '#d8f1f7' : '#f2faff', '#3d6b80', mode === 'skematik' ? 0.72 : 0.88]} />
      <directionalLight
        position={[6, 10, 7]}
        intensity={mode === 'skematik' ? 1.35 : 1.75}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-6, 5, -5]} intensity={0.45} color="#bae6fd" />

      <Penggerak
        fwRef={fwRef}
        kameraTujuan={kameraTujuan}
        onSelesaiKamera={onSelesaiKamera}
        onTickUi={onTickUi}
        onEvent={onEvent}
      />

      {mode === 'kolam' ? (
        <SceneKolam
          fwRef={fwRef}
          xray={xray}
          label={label}
          oledTex={oledTex}
          onFeed={onFeed}
          onPilih={onPilihObjekKolam}
          versi={versi}
        />
      ) : (
        <SceneSkematik
          fwRef={fwRef}
          oledTex={oledTex}
          dipilih={dipilih}
          filterGrup={filterGrup}
          tampilDaya={tampilDaya}
          label={label}
          onPilihPart={onPilihPart}
          onPilihGrup={onPilihGrup}
          onFeed={onFeed}
        />
      )}
    </>
  );
}

const PRESET_KAMERA_KOLAM = [
  { id: 'overview', label: 'Overview' },
  { id: 'box', label: 'Box Panel' },
  { id: 'sensor', label: 'Rak Sensor' },
  { id: 'feeder', label: 'Feeder' },
  { id: 'poc', label: 'Pipa & POC' },
  { id: 'dosing', label: 'Dosing pH' },
];

export default function NodeView({ mode, onGantiMode, sembunyiLabel = false, apiRef, fwRef: fwRefProp, booting = null, onSkipBooting }) {
  const internalFwRef = useRef(null);
  const fwRef = fwRefProp || internalFwRef;
  if (!fwRef.current) {
    fwRef.current = new NodeFirmware();
    fwRef.current.maju(0.1);
  }
  const fw = fwRef.current;

  const [versi, setVersi] = useState(0);
  const segarkan = useCallback(() => setVersi((v) => v + 1), []);
  const [xray, setXray] = useState(false);
  const [label, setLabel] = useState(true);
  const [tampilDaya, setTampilDaya] = useState(true);
  const [filterGrup, setFilterGrup] = useState(null);
  const [dipilih, setDipilih] = useState(null);
  const [tab, setTab] = useState('kontrol');
  const [suara, setSuara] = useState(true);
  const [notif, setNotif] = useState(null);
  const [kamera, setKamera] = useState(() => (mode === 'skematik' ? KAMERA_SKEMATIK.overview : KAMERA_KOLAM.overview));
  const [aktifKam, setAktifKam] = useState('overview');

  const timerNotif = useRef(null);
  const kameraTertunda = useRef(null);

  // Atur kamera otomatis saat berpindah mode Kolam 3D ↔ Skematik 3D
  useEffect(() => {
    const id = kameraTertunda.current || 'overview';
    kameraTertunda.current = null;
    const peta = mode === 'skematik' ? KAMERA_SKEMATIK : KAMERA_KOLAM;
    setAktifKam(peta[id] ? id : 'overview');
    setKamera({ ...(peta[id] || peta.overview) });
  }, [mode]);

  useEffect(() => () => clearTimeout(timerNotif.current), []);

  const tanganiEvent = useCallback((ev) => {
    if (ev.jenis === 'FEED_BLOCKED') bunyiBuzzer(suara);
    setNotif(ev);
    clearTimeout(timerNotif.current);
    timerNotif.current = setTimeout(() => setNotif(null), 4200);
    segarkan();
  }, [suara, segarkan]);

  const tekanFeed = useCallback(() => {
    fwRef.current.tekanFeed();
    fwRef.current.jalankanLoop();
    segarkan();
  }, [segarkan]);

  const lompatKe = useCallback((targetMode, targetKam) => {
    if (targetMode === mode) {
      const peta = targetMode === 'skematik' ? KAMERA_SKEMATIK : KAMERA_KOLAM;
      if (peta[targetKam]) {
        setAktifKam(targetKam);
        setKamera({ ...peta[targetKam] });
      }
    } else {
      kameraTertunda.current = targetKam;
      onGantiMode(targetMode);
    }
  }, [mode, onGantiMode]);

  const ubahSlider = useCallback((kunci, nilai) => {
    fwRef.current.input[kunci] = nilai;
    fwRef.current.jalankanLoop();
    segarkan();
  }, [segarkan]);

  const terapkanPreset = useCallback((nilai) => {
    Object.assign(fwRef.current.input, nilai);
    fwRef.current.jalankanLoop();
    segarkan();
  }, [segarkan]);

  const fokusKamera = useCallback((id, targetMode) => {
    const m = targetMode || mode;
    const peta = m === 'skematik' ? KAMERA_SKEMATIK : KAMERA_KOLAM;
    if (peta[id]) {
      setAktifKam(id);
      setKamera({ ...peta[id] });
    }
  }, [mode]);

  const pilihObjekKolam = useCallback((idObj) => {
    const obj = OBJEK_ADEGAN[idObj];
    if (!obj) {
      fokusKamera('overview', 'kolam');
      return;
    }
    fokusKamera(obj.kamera, 'kolam');
    setDipilih(obj.ids[0]);
    setTab('komponen');
  }, [fokusKamera]);

  const pilihPart = useCallback((idPart) => {
    setDipilih(idPart);
    if (idPart) setTab('komponen');
  }, []);

  const pilihGrupSkematik = useCallback((idGrup) => {
    setFilterGrup(idGrup);
    if (idGrup && KAMERA_SKEMATIK[idGrup]) fokusKamera(idGrup, 'skematik');
    else fokusKamera('overview', 'skematik');
  }, [fokusKamera]);

  // Ekspos API kontrol langsung agar Chatbot Si Aqua bisa menyetting node secara real-time
  useEffect(() => {
    if (!apiRef) return;
    const status = () => {
      const f = fwRef.current;
      return {
        state: f.state, ph: f.baca.ph, tds: f.baca.tds, tdsRaw: f.baca.tdsRaw,
        temp: f.baca.temp, distCm: f.baca.distCm, levelCm: f.levelCm,
        feedLocked: f.feedLocked, feedPortion: f.feedPortion, pocL: f.pocL,
        drain: f.out.drain, inlet: f.out.inlet, up: f.out.up, down: f.out.down, fisika: f.fisika,
      };
    };
    apiRef.current = {
      status,
      setParam: (kunci, val) => { ubahSlider(kunci, val); return status(); },
      terapkanPreset: (obj) => { terapkanPreset(obj); return status(); },
      tekanFeed: () => { tekanFeed(); return fwRef.current.event; },
      kosongkanPoc: () => { fwRef.current.kosongkanPoc(); segarkan(); },
      setFisika: (val) => { fwRef.current.fisika = Boolean(val); segarkan(); },
      setXray: (val) => setXray(Boolean(val)),
      reset: () => { fwRef.current.reset(); fwRef.current.maju(0.1); setNotif(null); segarkan(); },
    };
    return () => { apiRef.current = null; };
  }, [apiRef, ubahSlider, terapkanPreset, tekanFeed, segarkan]);

  const warnaState = WARNA_STATE[fw.state];
  const labelEfektif = label && !sembunyiLabel;

  return (
    <div className="utama nd-utama">
      {/* ===== Kiri: Adegan 3D Interaktif React Three Fiber ===== */}
      <section className={`panggung nd-panggung ${mode === 'skematik' ? 'gelap' : ''}`} aria-label={mode === 'kolam' ? 'Digital Twin 3D Kolam' : 'Skematik 3D Wokwi ESP32'}>
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.04 }}
          camera={{ position: [5.4, 4.1, 6.6], fov: 38, near: 0.1, far: 100 }}
          onPointerMissed={() => setDipilih(null)}
        >
          <Suspense fallback={null}>
            <IsiKanvas
              fwRef={fwRef}
              mode={mode}
              xray={xray}
              label={labelEfektif}
              dipilih={dipilih}
              filterGrup={filterGrup}
              tampilDaya={tampilDaya}
              kameraTujuan={kamera}
              onSelesaiKamera={() => {}}
              onTickUi={segarkan}
              onEvent={tanganiEvent}
              onFeed={tekanFeed}
              onPilihObjekKolam={pilihObjekKolam}
              onPilihPart={pilihPart}
              onPilihGrup={pilihGrupSkematik}
              versi={versi}
            />
          </Suspense>
        </Canvas>

        {/* Bilah atas panggung: Pengalih mode + kontrol kamera/filter */}
        <div className="nd-toolbar-atas">
          <div className="nd-segmen" role="group" aria-label="Mode tampilan 3D">
            <button type="button" className={mode === 'kolam' ? 'aktif' : ''} onClick={() => onGantiMode('kolam')}>
              Kolam 3D
            </button>
            <button type="button" className={mode === 'skematik' ? 'aktif' : ''} onClick={() => onGantiMode('skematik')}>
              Skematik 3D (Wokwi)
            </button>
          </div>

          {mode === 'kolam' ? (
            <div className="nd-toolbar-grup">
              {PRESET_KAMERA_KOLAM.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  className={`nd-pil-btn ${aktifKam === k.id ? 'aktif' : ''}`}
                  onClick={() => fokusKamera(k.id, 'kolam')}
                >
                  {k.label}
                </button>
              ))}
              <button
                type="button"
                className={`nd-pil-btn aksen ${xray ? 'aktif' : ''}`}
                onClick={() => setXray((v) => !v)}
              >
                {xray ? '✓ X-Ray' : 'X-Ray'}
              </button>
            </div>
          ) : (
            <div className="nd-toolbar-grup">
              <button
                type="button"
                className={`nd-pil-btn ${!filterGrup ? 'aktif' : ''}`}
                onClick={() => pilihGrupSkematik(null)}
              >
                Semua (25)
              </button>
              {GRUP.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`nd-pil-btn ${filterGrup === g.id ? 'aktif' : ''}`}
                  onClick={() => pilihGrupSkematik(filterGrup === g.id ? null : g.id)}
                >
                  <i className="nd-dot-kecil" style={{ background: g.warna }} />{g.judul.split(' ')[0]}
                </button>
              ))}
              <button
                type="button"
                className={`nd-pil-btn ${aktifKam === 'atas' ? 'aktif' : ''}`}
                onClick={() => fokusKamera(aktifKam === 'atas' ? 'overview' : 'atas', 'skematik')}
              >
                {aktifKam === 'atas' ? 'Perspektif' : 'Tampak Atas'}
              </button>
            </div>
          )}

          <button
            type="button"
            className={`nd-pil-btn ${label ? 'aktif' : ''}`}
            onClick={() => setLabel((v) => !v)}
          >
            {label ? 'Label: ON' : 'Label: OFF'}
          </button>
        </div>

        {/* Kartu KPI ringkas di sudut kiri bawah (terkelompok rapi) */}
        <div className="nd-hud-bawah">
          <div className="nd-hud-item">
            <span>STATE FSM</span>
            <strong style={{ color: warnaState }}>{fw.state}</strong>
          </div>
          <div className="nd-hud-item">
            <span>pH AIR</span>
            <strong>{fw.baca.ph.toFixed(2)}</strong>
          </div>
          <div className="nd-hud-item">
            <span>TDS KOMP.</span>
            <strong>{fw.baca.tds.toFixed(0)} ppm</strong>
          </div>
          <div className="nd-hud-item">
            <span>SUHU</span>
            <strong>{fw.baca.temp.toFixed(1)} °C</strong>
          </div>
          <div className="nd-hud-item">
            <span>LEVEL AIR</span>
            <strong>{fw.levelCm.toFixed(0)} cm</strong>
          </div>
          <div className="nd-hud-item">
            <span>SAFETY LOCK</span>
            <strong style={{ color: fw.feedLocked ? '#EF4444' : '#10B981' }}>
              {fw.feedLocked ? 'LOCKED' : `READY ${fw.feedPortion}%`}
            </strong>
          </div>
        </div>

        {/* Notifikasi Toast Safety Interlock / Feed OK */}
        {notif && (
          <div className={`nd-toast ${notif.jenis === 'FEED_BLOCKED' ? 'blok' : 'ok'}`} role="alert">
            <div className="nd-toast-ikon">
              {notif.jenis === 'FEED_BLOCKED' ? '🔒' : '✓'}
            </div>
            <div>
              <strong>
                {notif.jenis === 'FEED_BLOCKED'
                  ? notif.state === 'BOOTING'
                    ? 'BOOTING PATOKAN BARU — Pakan Ditahan'
                    : `SAFETY INTERLOCK AKTIF — Pakan Ditolak (${notif.state})`
                  : `Pakan Diberikan — Servo 90° (Porsi ${notif.portion}%)`}
              </strong>
              <p>
                {notif.jenis === 'FEED_BLOCKED'
                  ? notif.state === 'BOOTING'
                    ? 'Eksekusi pakan ditahan selama proses booting 30 detik. Tunggu hingga selesai atau tekan tombol Skip Booting.'
                    : `Servo dikunci di 0°, LED LOCK menyala, dan buzzer berbunyi 1200 Hz (300 ms) untuk mencegah overfeeding & penumpukan amonia di dasar kolam ${fw.komoditas.nama.toLowerCase()}.`
                  : `Katup corong pakan terbuka selama ${notif.portion === 100 ? '1,2 detik' : '0,6 detik'} lalu kembali ke 0°.`}
              </p>
              <code>
                {notif.jenis === 'FEED_BLOCKED'
                  ? `{"event":"FEED_BLOCKED","state":"${notif.state}"}`
                  : `{"event":"FEED_OK","portion":${notif.portion}}`}
              </code>
            </div>
            <button type="button" className="nd-toast-tutup" onClick={() => setNotif(null)} aria-label="Tutup notifikasi">✕</button>
          </div>
        )}

        {/* Info cepat komponen terpilih di skematik */}
        {mode === 'skematik' && dipilih && INFO[dipilih] && !notif && (
          <div className="nd-part-toast">
            <b>{INFO[dipilih].nama}</b> <code>{dipilih}</code>
            <span>{INFO[dipilih].nilai(fw)}</span>
          </div>
        )}
      </section>

      {/* ===== Kanan: Panel Kontrol Terkelompok ===== */}
      <PanelNode
        fw={fw}
        mode={mode}
        xray={xray}
        setXray={setXray}
        tampilDaya={tampilDaya}
        setTampilDaya={setTampilDaya}
        tab={tab}
        setTab={setTab}
        dipilih={dipilih}
        onPilihPart={pilihPart}
        onLompat={lompatKe}
        onSlider={ubahSlider}
        onPreset={terapkanPreset}
        onFeed={tekanFeed}
        onToggleFisika={() => { fw.fisika = !fw.fisika; segarkan(); }}
        onKosongkanPoc={() => { fw.kosongkanPoc(); segarkan(); }}
        onReset={() => { fw.reset(); fw.maju(0.1); setNotif(null); segarkan(); }}
        suara={suara}
        setSuara={setSuara}
        booting={booting}
        onSkipBooting={onSkipBooting}
      />
    </div>
  );
}
