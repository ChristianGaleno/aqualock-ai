// =============================================================
// SceneKolam.jsx — Digital twin 3D kolam bioflok AQUA-LOCK AI
// scene_objects: round_biofloc_pond, esp32_control_box,
// sensor_probe_rack, auto_feeder_hopper, piping_and_poc_tank.
// Semua animasi membaca emulator firmware (fwRef) tiap frame.
// =============================================================
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { GEOM, WARNA_STATE } from './firmware.js';
import { Aliran, Kabel, Label, Pipa, V, busur, dunia, garis, kursor } from './bagian3d.jsx';

const R = 1.5;
const DINDING = 1.0;
const PALET = { aqua: '#0E75BB', teal: '#21979F', deepTeal: '#00969B' };
const AIR_JERNIH = new THREE.Color('#21979F');
const AIR_KERUH = new THREE.Color('#7a5a2c');
const _c = new THREE.Color();

// Penempatan objek (sudut di bibir kolam, rotY = π − θ agar sumbu +x lokal menghadap pusat)
const BOX = { pos: [-2.15, 0, 1.55], rot: 0.8 };
const RAK_T = (140 * Math.PI) / 180;
const RAK = { pos: [R * Math.cos(RAK_T), 0, R * Math.sin(RAK_T)], rot: Math.PI - RAK_T };
const FEED_T = (70 * Math.PI) / 180;
const FEEDER = { pos: [R * Math.cos(FEED_T), 0, R * Math.sin(FEED_T)], rot: Math.PI - FEED_T };
const IBC = [3.1, 0, -1.4];
const POMPA_DRAIN = [2.0, 0, -1.1];
const POMPA_INLET = [-2.2, 0, -1.2];
const TANDON = [-3.45, 0, -1.4];
const DOSING = { meja: [2.4, 0, 0.6], up: [2.32, 0, 0.42], down: [2.32, 0, 0.8] };

const levelM = (fw) => Math.max(0.02, fw.levelCm / 100);
const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------
function Tanah() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[16, 64]} />
        <meshStandardMaterial color="#e4f1f7" roughness={0.95} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.002} receiveShadow>
        <ringGeometry args={[R + 0.05, R + 0.9, 64]} />
        <meshStandardMaterial color="#cfe4ee" roughness={0.95} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------
// round_biofloc_pond
function Kolam({ fwRef, xray, onPilih }) {
  const air = useRef();
  const permukaan = useRef();
  const cincin = useRef();
  const pusaran = useRef();
  const ikan = useRef([]);
  const geoPermukaan = useMemo(() => new THREE.RingGeometry(0.005, R - 0.02, 72, 10), []);
  useEffect(() => () => geoPermukaan.dispose(), [geoPermukaan]);
  const dasar = useMemo(() => Float32Array.from(geoPermukaan.attributes.position.array), [geoPermukaan]);
  const dataIkan = useMemo(() => Array.from({ length: 9 }, (_, i) => ({
    r: 0.35 + ((i * 37) % 9) / 9 * 0.85, f: i * 0.7, w: 0.25 + ((i * 13) % 7) / 18, d: 0.15 + ((i * 29) % 10) / 14, arah: i % 3 === 0 ? -1 : 1,
  })), []);
  const tiang = useMemo(() => Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2), []);

  const hRef = useRef(0.8);
  const warnaAirRef = useRef(AIR_JERNIH.clone());
  const warnaCincinRef = useRef(new THREE.Color(WARNA_STATE.NORMAL));

  useFrame(({ clock }, dt) => {
    const fw = fwRef.current;
    const t = clock.elapsedTime;
    const damp = 1 - Math.exp(-6 * dt);
    const dampWarna = 1 - Math.exp(-4.5 * dt);

    hRef.current += (levelM(fw) - hRef.current) * damp;
    const h = hRef.current;
    air.current.scale.y = h;
    air.current.position.y = h / 2;

    const keruh = smooth(fw.baca.tds, 480, 640);
    _c.copy(AIR_JERNIH).lerp(AIR_KERUH, keruh);
    warnaAirRef.current.lerp(_c, dampWarna);
    air.current.material.color.copy(warnaAirRef.current);
    permukaan.current.material.color.copy(warnaAirRef.current).offsetHSL(0, -0.04, 0.08);
    permukaan.current.position.y = h + 0.003;

    const pos = geoPermukaan.attributes.position;
    const amp = fw.out.inlet ? 0.018 : fw.out.drain ? 0.012 : 0.007;
    for (let i = 0; i < pos.count; i++) {
      const x = dasar[i * 3], y = dasar[i * 3 + 1];
      pos.array[i * 3 + 2] = amp * Math.sin(x * 3.8 + t * 1.6) + amp * 0.65 * Math.sin(y * 4.6 - t * 1.2);
    }
    pos.needsUpdate = true;
    geoPermukaan.computeVertexNormals();

    _c.set(WARNA_STATE[fw.state]);
    warnaCincinRef.current.lerp(_c, dampWarna);
    cincin.current.material.color.copy(warnaCincinRef.current);
    cincin.current.material.emissive.copy(warnaCincinRef.current);
    cincin.current.material.emissiveIntensity = fw.feedLocked ? 0.6 + 0.45 * Math.sin(t * 4.5) : 0.45;

    pusaran.current.visible = fw.out.drain;
    pusaran.current.position.y = h + 0.006;
    pusaran.current.rotation.z += dt * 2.6;

    const kunci = fw.feedLocked;
    ikan.current.forEach((g, i) => {
      if (!g) return;
      const u = dataIkan[i];
      u.f += dt * u.w * u.arah * (kunci ? 0.55 : 1);
      const bob = Math.sin(t * 2.2 + i * 1.3) * 0.018;
      g.position.set(
        Math.cos(u.f) * u.r,
        Math.min(h - 0.06, Math.max(0.07, h * u.d + bob)),
        Math.sin(u.f) * u.r,
      );
      g.rotation.y = -u.f + (u.arah > 0 ? 0 : Math.PI);
      g.children[1].rotation.y = Math.sin(t * 8 + i) * 0.4;
      g.visible = h > 0.1;
    });
  });

  return (
    <group onClick={(e) => { e.stopPropagation(); onPilih('round_biofloc_pond'); }}>
      {/* Terpal bundar */}
      <mesh position-y={DINDING / 2} castShadow receiveShadow>
        <cylinderGeometry args={[R, R, DINDING, 72, 1, true]} />
        <meshStandardMaterial color={PALET.aqua} roughness={0.75} side={THREE.DoubleSide} transparent={xray} opacity={xray ? 0.28 : 1} depthWrite={!xray} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} receiveShadow>
        <circleGeometry args={[R, 72]} />
        <meshStandardMaterial color="#095285" roughness={0.88} />
      </mesh>
      {/* Rangka wiremesh galvanis */}
      {[0.06, 0.5, DINDING - 0.02].map((y) => (
        <mesh key={y} position-y={y} rotation-x={Math.PI / 2}>
          <torusGeometry args={[R + 0.025, 0.012, 6, 96]} />
          <meshStandardMaterial color="#b9c1c8" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      {tiang.map((a) => (
        <mesh key={a} position={[Math.cos(a) * (R + 0.03), DINDING / 2, Math.sin(a) * (R + 0.03)]}>
          <cylinderGeometry args={[0.012, 0.012, DINDING, 6]} />
          <meshStandardMaterial color="#b9c1c8" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      {/* Cincin status FSM di bibir kolam */}
      <mesh ref={cincin} position-y={DINDING + 0.02} rotation-x={Math.PI / 2}>
        <torusGeometry args={[R + 0.03, 0.03, 10, 96]} />
        <meshStandardMaterial color={WARNA_STATE.NORMAL} emissive={WARNA_STATE.NORMAL} emissiveIntensity={0.45} roughness={0.4} />
      </mesh>
      {/* Air */}
      <mesh ref={air}>
        <cylinderGeometry args={[R - 0.012, R - 0.012, 1, 72, 1, true]} />
        <meshStandardMaterial color={AIR_JERNIH} transparent opacity={xray ? 0.25 : 0.62} roughness={0.2} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={permukaan} geometry={geoPermukaan} rotation-x={-Math.PI / 2}>
        <meshStandardMaterial color={AIR_JERNIH} transparent opacity={xray ? 0.35 : 0.86} roughness={0.12} metalness={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={pusaran} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.08, 0.32, 32, 1, 0, Math.PI * 1.5]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Lubang bottom drain */}
      <mesh position-y={0.012} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.09, 24]} />
        <meshStandardMaterial color="#20262b" roughness={0.6} />
      </mesh>
      {/* Ikan nila merah berenang */}
      {dataIkan.map((_, i) => {
        const warnaNila = i % 3 === 0 ? '#eb6834' : i % 3 === 1 ? '#f48647' : '#dc532f';
        return (
          <group key={i} ref={(el) => { ikan.current[i] = el; }}>
            {/* Badan oval pipih ikan nila */}
            <mesh scale={[1.45, 0.85, 0.42]}>
              <sphereGeometry args={[0.068, 12, 10]} />
              <meshStandardMaterial color={warnaNila} roughness={0.42} metalness={0.08} />
            </mesh>
            {/* Ekor kipas bergoyang (children[1]) */}
            <group position-x={-0.1}>
              <mesh rotation-z={Math.PI / 2} scale={[1.1, 1, 0.22]}>
                <coneGeometry args={[0.048, 0.08, 6]} />
                <meshStandardMaterial color="#c93e22" roughness={0.5} />
              </mesh>
            </group>
            {/* Sirip punggung khas ikan nila */}
            <mesh position={[-0.01, 0.056, 0]} scale={[1.25, 0.45, 0.12]}>
              <coneGeometry args={[0.055, 0.07, 4]} />
              <meshStandardMaterial color="#d44326" roughness={0.5} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------
// esp32_control_box
function BoxPanel({ fwRef, xray, oledTex, onFeed, onPilih, label }) {
  const tombol = useRef();
  const led = useRef();
  const gelombang = useRef([]);
  const ledRelay = useRef([]);
  const boxEdges = useMemo(() => {
    const b = new THREE.BoxGeometry(0.5, 0.62, 0.2);
    const e = new THREE.EdgesGeometry(b);
    b.dispose();
    return e;
  }, []);
  useEffect(() => () => boxEdges.dispose(), [boxEdges]);
  useFrame(({ clock }) => {
    const fw = fwRef.current;
    const t = clock.elapsedTime;
    tombol.current.position.z = fw.tombolTertekan ? 0.158 : 0.172;
    led.current.material.emissiveIntensity = fw.out.ledLock ? 2.4 : 0.05;
    gelombang.current.forEach((g, i) => {
      if (!g) return;
      g.visible = fw.buzzer;
      const u = (t * 2.4 + i / 3) % 1;
      g.scale.setScalar(0.4 + u * 1.6);
      g.material.opacity = (1 - u) * 0.7;
    });
    const aktif = [fw.out.drain, fw.out.inlet, fw.out.up, fw.out.down];
    ledRelay.current.forEach((m, i) => { if (m) m.material.emissiveIntensity = aktif[i] ? 2.2 : 0.05; });
  });

  return (
    <group position={BOX.pos} rotation-y={BOX.rot} onClick={(e) => { e.stopPropagation(); onPilih('esp32_control_box'); }}>
      <mesh position={[0, 0.85, -0.07]} castShadow>
        <cylinderGeometry args={[0.04, 0.045, 1.7, 12]} />
        <meshStandardMaterial color="#8d969e" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.02, -0.07]}>
        <cylinderGeometry args={[0.16, 0.18, 0.04, 20]} />
        <meshStandardMaterial color="#9aa1a6" />
      </mesh>
      {/* Cangkang IP65 */}
      <RoundedBox args={[0.5, 0.62, 0.2]} radius={0.025} position={[0, 1.35, 0.05]} castShadow>
        <meshStandardMaterial color="#dfe3e6" roughness={0.45} transparent={xray} opacity={xray ? 0.13 : 1} depthWrite={!xray} />
      </RoundedBox>
      {xray && (
        <lineSegments position={[0, 1.35, 0.05]} geometry={boxEdges}>
          <lineBasicMaterial color="#00969B" />
        </lineSegments>
      )}
      {/* OLED */}
      <mesh position={[0, 1.52, 0.152]}>
        <boxGeometry args={[0.3, 0.17, 0.008]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0, 1.52, 0.157]}>
        <planeGeometry args={[0.27, 0.135]} />
        <meshBasicMaterial map={oledTex} toneMapped={false} />
      </mesh>
      {/* Tombol merah Manual Feed (bisa diklik) */}
      <mesh position={[-0.12, 1.22, 0.155]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.055, 0.055, 0.02, 24]} />
        <meshStandardMaterial color="#e8c21a" />
      </mesh>
      <mesh ref={tombol} position={[-0.12, 1.22, 0.172]} rotation-x={Math.PI / 2} {...kursor}
        onClick={(e) => { e.stopPropagation(); onFeed(); }}>
        <cylinderGeometry args={[0.042, 0.046, 0.04, 24]} />
        <meshStandardMaterial color="#d92b2b" roughness={0.3} emissive="#7a0d0d" emissiveIntensity={0.3} />
      </mesh>
      {/* LED LOCK */}
      <mesh position={[0.06, 1.22, 0.152]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.026, 0.006, 8, 20]} />
        <meshStandardMaterial color="#888" metalness={0.8} />
      </mesh>
      <mesh ref={led} position={[0.06, 1.22, 0.158]}>
        <sphereGeometry args={[0.021, 16, 16]} />
        <meshStandardMaterial color="#ff4040" emissive="#ff2020" emissiveIntensity={0.05} toneMapped={false} />
      </mesh>
      {/* Buzzer */}
      <mesh position={[0.17, 1.22, 0.16]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.03, 0.03, 0.02, 20]} />
        <meshStandardMaterial color="#1b1b1b" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => { gelombang.current[i] = el; }} position={[0.17, 1.22, 0.18]} visible={false}>
          <torusGeometry args={[0.04, 0.004, 6, 24]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.6} />
        </mesh>
      ))}
      {/* Isi box (terlihat saat X-Ray) */}
      <group visible={xray}>
        <mesh position={[-0.1, 1.42, 0.03]}>
          <boxGeometry args={[0.1, 0.2, 0.012]} />
          <meshStandardMaterial color="#1c2430" />
        </mesh>
        <mesh position={[-0.1, 1.46, 0.04]}>
          <boxGeometry args={[0.06, 0.07, 0.008]} />
          <meshStandardMaterial color="#c9ccd1" metalness={0.8} roughness={0.3} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} position={[0.1, 1.53 - i * 0.075, 0.03]}>
            <mesh>
              <boxGeometry args={[0.13, 0.06, 0.01]} />
              <meshStandardMaterial color="#1d4ed8" />
            </mesh>
            <mesh position={[0, 0, 0.018]}>
              <boxGeometry args={[0.05, 0.04, 0.03]} />
              <meshStandardMaterial color="#1e3a8a" />
            </mesh>
            <mesh ref={(el) => { ledRelay.current[i] = el; }} position={[-0.05, 0.018, 0.008]}>
              <sphereGeometry args={[0.007, 8, 8]} />
              <meshStandardMaterial color="#ff3b3b" emissive="#ff3b3b" emissiveIntensity={0.05} toneMapped={false} />
            </mesh>
          </group>
        ))}
        <Label tampil={label} posisi={[-0.1, 1.6, 0.06]} judul="ESP32" kecil />
        <Label tampil={label} posisi={[0.18, 1.6, 0.06]} judul="4× Relay" kecil />
      </group>
      <Label tampil={label} posisi={[0, 1.82, 0.05]} judul="Box Panel IP65" sub="ESP32 · OLED · Feed · LOCK" />
    </group>
  );
}

// ---------------------------------------------------------------
// sensor_probe_rack
function Probe({ x, warnaBadan, warnaTutup, panjang = 0.18, logam = false, children }) {
  return (
    <group position-x={x}>
      <mesh position-y={0.86}>
        <cylinderGeometry args={[0.005, 0.005, 0.52, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position-y={1.13}>
        <cylinderGeometry args={[0.022, 0.022, 0.05, 12]} />
        <meshStandardMaterial color={warnaTutup} />
      </mesh>
      <mesh position-y={0.6 - panjang / 2 + 0.02}>
        <cylinderGeometry args={[0.016, 0.016, panjang, 14]} />
        <meshStandardMaterial color={warnaBadan} metalness={logam ? 0.85 : 0.1} roughness={logam ? 0.25 : 0.5} />
      </mesh>
      {children}
    </group>
  );
}

function RakSensor({ fwRef, xray, onPilih, label }) {
  const ringTds = useRef();
  const sinar = useRef();
  const ping = useRef();
  const fw = fwRef.current;

  useFrame(({ clock }) => {
    const f = fwRef.current;
    const t = clock.elapsedTime;
    if (ringTds.current) ringTds.current.material.emissiveIntensity = f.mosfet ? 3 : 0.05;
    const h = levelM(f);
    const panjang = Math.max(0.02, 1.1 - h);
    if (sinar.current) {
      sinar.current.scale.y = panjang;
      sinar.current.position.y = 1.1 - panjang / 2;
      sinar.current.material.opacity = 0.1 + 0.08 * Math.sin(t * 6);
    }
    const u = (f.t - f.pingMulai) / 0.45;
    if (ping.current) {
      ping.current.visible = u >= 0 && u < 1;
      ping.current.position.y = h + 0.008;
      ping.current.scale.setScalar(0.3 + u * 1.4);
      ping.current.material.opacity = Math.max(0, 1 - u) * 0.8;
    }
  });

  return (
    <group position={RAK.pos} rotation-y={RAK.rot} onClick={(e) => { e.stopPropagation(); onPilih('sensor_probe_rack'); }}>
      {/* Braket pipa PVC */}
      <mesh position={[-0.07, 0.86, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.6, 12]} />
        <meshStandardMaterial color="#eef0f2" roughness={0.4} />
      </mesh>
      <mesh position={[0.26, 1.16, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.024, 0.024, 0.7, 12]} />
        <meshStandardMaterial color="#eef0f2" roughness={0.4} />
      </mesh>
      <mesh position={[-0.02, 1.02, 0]}>
        <boxGeometry args={[0.08, 0.06, 0.07]} />
        <meshStandardMaterial color="#9aa3aa" metalness={0.5} />
      </mesh>
      {/* Probe pH */}
      <Probe x={0.16} warnaBadan="#2b6cb0" warnaTutup="#1e3a8a">
        <mesh position-y={0.43}>
          <sphereGeometry args={[0.02, 14, 14]} />
          <meshStandardMaterial color="#cfe8ff" transparent opacity={0.7} roughness={0.05} />
        </mesh>
      </Probe>
      {/* Probe TDS + LED MOSFET cyan */}
      <Probe x={0.28} warnaBadan="#222" warnaTutup="#111">
        <mesh ref={ringTds} position-y={1.085} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.026, 0.008, 8, 24]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.05} toneMapped={false} />
        </mesh>
        {[-0.007, 0.007].map((z) => (
          <mesh key={z} position={[0, 0.41, z]}>
            <cylinderGeometry args={[0.003, 0.003, 0.05, 6]} />
            <meshStandardMaterial color="#d0d4d8" metalness={0.9} />
          </mesh>
        ))}
      </Probe>
      {/* Probe suhu (DS18B20 di lapangan, DHT22 di Wokwi) */}
      <Probe x={0.4} warnaBadan="#c8ced4" warnaTutup="#555" panjang={0.24} logam />
      {/* Ultrasonik HC-SR04 menghadap ke bawah */}
      <group position={[0.56, 1.11, 0]}>
        <mesh>
          <boxGeometry args={[0.1, 0.012, 0.05]} />
          <meshStandardMaterial color="#1d5fbf" />
        </mesh>
        {[-0.026, 0.026].map((x) => (
          <mesh key={x} position={[x, -0.016, 0]}>
            <cylinderGeometry args={[0.019, 0.019, 0.022, 18]} />
            <meshStandardMaterial color="#cfd3d8" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
      </group>
      <mesh ref={sinar} position={[0.56, 0.8, 0]}>
        <cylinderGeometry args={[0.03, 0.11, 1, 20, 1, true]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={ping} position={[0.56, 0.5, 0]} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.07, 0.085, 32]} />
        <meshBasicMaterial color="#c4b5fd" transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Label tampil={label} posisi={[0.25, 1.42, 0]} judul="Rak Probe Sensor" sub="pH · TDS · Suhu · Ultrasonik" />
      <Label tampil={label} posisi={[0.62, (1.1 + levelM(fw)) / 2, 0.08]} judul={`${fw.baca.distCm.toFixed(1)} cm`} sub="HC-SR04" kecil nada="ungu" />
      {xray && label && (
        <>
          <Label tampil posisi={[0.16, 0.36, 0]} judul="pH" sub={fw.baca.ph.toFixed(2)} kecil />
          <Label tampil posisi={[0.28, 0.3, 0]} judul="TDS" sub={`${fw.baca.tds.toFixed(0)} ppm`} kecil nada={fw.mosfet ? 'cyan' : undefined} />
          <Label tampil posisi={[0.4, 0.26, 0]} judul="Suhu" sub={`${fw.baca.temp.toFixed(1)} °C`} kecil />
        </>
      )}
    </group>
  );
}

// ---------------------------------------------------------------
// auto_feeder_hopper
function AutoFeeder({ fwRef, onPilih, label }) {
  const katup = useRef();
  const gembok = useRef();
  const kilatan = useRef();
  const pelet = useRef();
  const N = 48;
  const partikel = useMemo(() => Array.from({ length: N }, () => ({ hidup: 0, p: V(0, 0, 0), v: V(0, 0, 0) })), []);
  const keluar = useMemo(() => dunia([0.36, 1.1, 0], FEEDER.pos, FEEDER.rot), []);
  const arahDalam = useMemo(() => V(-Math.cos(FEED_T), 0, -Math.sin(FEED_T)), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const nol = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), []);
  const bagi = useRef(0);
  const blokTerakhir = useRef(-1);
  const waktuBlok = useRef(-9);

  useFrame(({ clock }, dt) => {
    const fw = fwRef.current;
    const t = clock.elapsedTime;
    const sudut = (fw.servoSudut * Math.PI) / 180;
    katup.current.rotation.z += (-sudut * 0.9 - katup.current.rotation.z) * Math.min(1, dt * 12);

    // Event FEED_BLOCKED → getar penolakan
    if (fw.event?.jenis === 'FEED_BLOCKED' && fw.event.id !== blokTerakhir.current) {
      blokTerakhir.current = fw.event.id;
      waktuBlok.current = t;
    }
    const umurBlok = t - waktuBlok.current;
    const getar = umurBlok < 0.9 ? Math.sin(umurBlok * 70) * 0.04 * (1 - umurBlok / 0.9) : 0;
    const g = gembok.current;
    const targetSkala = fw.feedLocked ? 1 : 0;
    const sk = THREE.MathUtils.lerp(g.scale.x, targetSkala, Math.min(1, dt * 8));
    g.scale.setScalar(Math.max(0.0001, sk));
    g.visible = sk > 0.02;
    g.position.set(getar, 2.0 + Math.sin(t * 2) * 0.03, 0);
    g.rotation.y = Math.sin(t * 0.8) * 0.4 + getar * 4;
    kilatan.current.visible = umurBlok < 0.9;
    kilatan.current.scale.setScalar(1 + umurBlok * 1.6);
    kilatan.current.material.opacity = Math.max(0, 0.7 * (1 - umurBlok / 0.9));

    // Pelet jatuh saat servo terbuka
    const h = levelM(fw);
    if (fw.servoBuka) bagi.current += dt * 60;
    while (bagi.current >= 1) {
      bagi.current -= 1;
      const p = partikel.find((x) => x.hidup <= 0);
      if (!p) break;
      p.hidup = 2.2;
      p.p.copy(keluar).add(V((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.04));
      p.v.copy(arahDalam).multiplyScalar(0.5 + Math.random() * 0.5).add(V((Math.random() - 0.5) * 0.3, 0.2, (Math.random() - 0.5) * 0.3));
    }
    partikel.forEach((p, i) => {
      if (p.hidup <= 0) { pelet.current.setMatrixAt(i, nol); return; }
      p.hidup -= dt;
      if (p.p.y > h) { p.v.y -= 9.8 * dt * 0.6; }
      else { p.v.multiplyScalar(0.9); p.v.y = -0.03; }
      p.p.addScaledVector(p.v, dt);
      if (p.p.y < 0.03) p.p.y = 0.03;
      const s = Math.min(1, p.hidup * 1.5);
      m.makeScale(s, s, s).setPosition(p.p);
      pelet.current.setMatrixAt(i, m);
    });
    pelet.current.instanceMatrix.needsUpdate = true;
  });

  const fw = fwRef.current;
  return (
    <>
      <group position={FEEDER.pos} rotation-y={FEEDER.rot} onClick={(e) => { e.stopPropagation(); onPilih('auto_feeder_hopper'); }}>
        {/* Braket */}
        <mesh position={[-0.05, 1.06, 0]}>
          <boxGeometry args={[0.18, 0.04, 0.12]} />
          <meshStandardMaterial color="#9aa3aa" metalness={0.6} roughness={0.35} />
        </mesh>
        {[-0.05, 0.05].map((z) => (
          <mesh key={z} position={[-0.09, 1.16, z]}>
            <boxGeometry args={[0.02, 0.22, 0.02]} />
            <meshStandardMaterial color="#9aa3aa" metalness={0.6} />
          </mesh>
        ))}
        {/* Corong stainless */}
        <mesh position={[-0.02, 1.6, 0]} castShadow>
          <cylinderGeometry args={[0.17, 0.17, 0.22, 28]} />
          <meshStandardMaterial color="#cfd6dc" metalness={0.9} roughness={0.22} />
        </mesh>
        <mesh position={[-0.02, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.17, 0.045, 0.2, 28]} />
          <meshStandardMaterial color="#c3cbd2" metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[-0.02, 1.715, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.02, 28]} />
          <meshStandardMaterial color="#9ea7ae" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Saluran keluar ke kolam */}
        <mesh position={[0.16, 1.2, 0]} rotation-z={-1.0}>
          <cylinderGeometry args={[0.035, 0.035, 0.42, 16, 1, true]} />
          <meshStandardMaterial color="#c3cbd2" metalness={0.85} roughness={0.25} side={THREE.DoubleSide} />
        </mesh>
        {/* Katup engsel (digerakkan servo) */}
        <group position={[0.34, 1.12, 0]}>
          <group ref={katup}>
            <mesh position={[0, -0.03, 0]}>
              <boxGeometry args={[0.012, 0.07, 0.075]} />
              <meshStandardMaterial color="#e26d2c" />
            </mesh>
          </group>
        </group>
        {/* Servo SG90 */}
        <mesh position={[-0.02, 1.3, 0.11]}>
          <boxGeometry args={[0.09, 0.05, 0.045]} />
          <meshStandardMaterial color="#2563eb" />
        </mesh>
        <mesh position={[0.02, 1.3, 0.136]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.009, 0.009, 0.01, 10]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
        {/* Ikon gembok merah */}
        <group ref={gembok} position={[0, 2.0, 0]}>
          <RoundedBox args={[0.18, 0.15, 0.07]} radius={0.02} position-y={-0.04}>
            <meshStandardMaterial color="#ef4444" emissive="#b91c1c" emissiveIntensity={0.7} roughness={0.35} />
          </RoundedBox>
          <mesh position-y={0.04}>
            <torusGeometry args={[0.055, 0.014, 10, 24, Math.PI]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.25} />
          </mesh>
          {[-0.055, 0.055].map((x) => (
            <mesh key={x} position={[x, 0.025, 0]}>
              <cylinderGeometry args={[0.014, 0.014, 0.03, 10]} />
              <meshStandardMaterial color="#d1d5db" metalness={0.8} />
            </mesh>
          ))}
          <mesh position={[0, -0.04, 0.036]}>
            <circleGeometry args={[0.018, 16]} />
            <meshBasicMaterial color="#450a0a" />
          </mesh>
        </group>
        <mesh ref={kilatan} position={[-0.02, 1.6, 0]} rotation-x={Math.PI / 2} visible={false}>
          <torusGeometry args={[0.24, 0.012, 8, 40]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.7} />
        </mesh>
        <Label tampil={label} posisi={[0, fw.feedLocked ? 2.3 : 1.95, 0]}
          judul="Auto Feeder" sub={fw.feedLocked ? 'TERKUNCI · servo diam' : `READY · porsi ${fw.feedPortion}%`} nada={fw.feedLocked ? 'merah' : 'hijau'} />
      </group>
      <instancedMesh ref={pelet} args={[null, null, N]} frustumCulled={false}>
        <sphereGeometry args={[0.013, 6, 6]} />
        <meshStandardMaterial color="#8b5a2b" roughness={0.8} />
      </instancedMesh>
    </>
  );
}

// ---------------------------------------------------------------
// piping_and_poc_tank: drain → IBC POC, inlet air bersih, dosing pH
const JALUR_DRAIN = garis([[0, 0.05, 0], [1.31, 0.05, -0.72], [1.85, 0.05, -1.02], [2.25, 0.1, -1.22], [2.3, 1.38, -1.27], [2.95, 1.38, -1.38], [3.02, 1.16, -1.4]]);
const JALUR_INLET = garis([[-3.05, 0.12, -1.35], [-2.2, 0.12, -1.2], [-1.75, 0.12, -1.1], [-1.75, 1.18, -1.1], [-1.03, 1.18, -0.75], [-0.96, 1.04, -0.7]]);
const titikTetes = (z) => [1.24, 1.03, z * 0.82];
const JALUR_UP = garis([[2.32, 1.08, 0.42], [2.0, 1.16, 0.42], [1.5, 1.14, 0.38], [...titikTetes(0.42)]]);
const JALUR_DOWN = garis([[2.32, 1.08, 0.8], [2.0, 1.16, 0.8], [1.45, 1.14, 0.7], [...titikTetes(0.8)]]);

function Botol({ pos, warna, judul, aktifFn, mlFn, label }) {
  const cairan = useRef();
  const ledPompa = useRef();
  useFrame(() => {
    const sisa = Math.max(0.05, 1 - mlFn() / 1000);
    cairan.current.scale.y = sisa;
    cairan.current.position.y = 0.73 + (0.26 * sisa) / 2;
    ledPompa.current.material.emissiveIntensity = aktifFn() ? 2.5 : 0.05;
  });
  return (
    <group>
      <mesh position={[pos[0], 0.86, pos[2]]}>
        <cylinderGeometry args={[0.085, 0.085, 0.28, 20]} />
        <meshStandardMaterial color="#f4f7f9" transparent opacity={0.35} roughness={0.1} depthWrite={false} />
      </mesh>
      <mesh ref={cairan} position={[pos[0], 0.86, pos[2]]}>
        <cylinderGeometry args={[0.078, 0.078, 0.26, 20]} />
        <meshStandardMaterial color={warna} transparent opacity={0.85} />
      </mesh>
      <mesh position={[pos[0], 1.03, pos[2]]}>
        <cylinderGeometry args={[0.04, 0.04, 0.06, 14]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* Pompa peristaltik */}
      <mesh position={[pos[0] + 0.17, 0.78, pos[2]]}>
        <boxGeometry args={[0.1, 0.11, 0.1]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[pos[0] + 0.222, 0.79, pos[2]]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.03, 0.03, 0.01, 18]} />
        <meshStandardMaterial color="#e5e7eb" />
      </mesh>
      <mesh ref={ledPompa} position={[pos[0] + 0.222, 0.83, pos[2] + 0.03]}>
        <sphereGeometry args={[0.009, 8, 8]} />
        <meshStandardMaterial color={warna} emissive={warna} emissiveIntensity={0.05} toneMapped={false} />
      </mesh>
      <Label tampil={label} posisi={[pos[0] + 0.05, 1.18, pos[2]]} judul={judul} kecil />
    </group>
  );
}

function Tetesan({ z, warna, aktifFn, fwRef }) {
  const ref = useRef([]);
  const kuat = useRef(0);
  const [x, y0, zz] = titikTetes(z);
  useFrame(({ clock }, dt) => {
    kuat.current += ((aktifFn() ? 1 : 0) - kuat.current) * Math.min(1, dt * 6);
    const h = levelM(fwRef.current);
    ref.current.forEach((m, j) => {
      if (!m) return;
      const u = (clock.elapsedTime * 1.4 + j / 4) % 1;
      m.position.set(x, y0 - u * (y0 - h), zz);
      m.visible = kuat.current > 0.05;
      m.scale.setScalar(kuat.current);
    });
  });
  return [0, 1, 2, 3].map((j) => (
    <mesh key={j} ref={(el) => { ref.current[j] = el; }} visible={false}>
      <sphereGeometry args={[0.018, 10, 10]} />
      <meshStandardMaterial color={warna} emissive={warna} emissiveIntensity={0.8} toneMapped={false} />
    </mesh>
  ));
}

function PipaDanPoc({ fwRef, onPilih, label }) {
  const isi = useRef();
  const pancuran = useRef();
  const percik = useRef();
  const ledDrain = useRef();
  const ledInlet = useRef();
  const kuatInlet = useRef(0);
  const ibcEdges = useMemo(() => {
    const b = new THREE.BoxGeometry(1.04, 1.04, 1.04, 3, 3, 3);
    const e = new THREE.EdgesGeometry(b);
    b.dispose();
    return e;
  }, []);
  useEffect(() => () => ibcEdges.dispose(), [ibcEdges]);
  const fw = fwRef.current;
  useFrame(({ clock }, dt) => {
    const f = fwRef.current;
    const r = Math.max(0.005, f.pocL / GEOM.kapasitasPocL);
    isi.current.scale.y = r * 0.94;
    isi.current.position.y = 0.17 + (r * 0.94) / 2;
    kuatInlet.current += ((f.out.inlet ? 1 : 0) - kuatInlet.current) * Math.min(1, dt * 6);
    const h = levelM(f);
    const tinggi = Math.max(0.01, 1.04 - h);
    pancuran.current.visible = kuatInlet.current > 0.03;
    pancuran.current.scale.set(kuatInlet.current, tinggi, kuatInlet.current);
    pancuran.current.position.y = h + tinggi / 2;
    percik.current.visible = pancuran.current.visible;
    percik.current.position.y = h + 0.01;
    percik.current.scale.setScalar(0.8 + 0.3 * Math.sin(clock.elapsedTime * 12));
    ledDrain.current.material.emissiveIntensity = f.out.drain ? 2.5 : 0.05;
    ledInlet.current.material.emissiveIntensity = f.out.inlet ? 2.5 : 0.05;
  });

  const pilih = (e) => { e.stopPropagation(); onPilih('piping_and_poc_tank'); };
  return (
    <group onClick={pilih}>
      {/* Bottom drain → pompa → IBC */}
      <Pipa kurva={JALUR_DRAIN} radius={0.05} opacity={0.45} />
      <Aliran kurva={JALUR_DRAIN} n={36} warna="#facc15" aktif={() => fwRef.current.out.drain} kecepatan={0.3} ukuran={0.034} />
      <group position={POMPA_DRAIN}>
        <mesh position-y={0.13} castShadow>
          <boxGeometry args={[0.26, 0.22, 0.2]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        <mesh ref={ledDrain} position={[0, 0.2, 0.105]}>
          <sphereGeometry args={[0.018, 10, 10]} />
          <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.05} toneMapped={false} />
        </mesh>
        <Label tampil={label} posisi={[0, 0.45, 0]} judul="Pompa Drain" sub="Relay GPIO26" kecil nada={fw.out.drain ? 'kuning' : undefined} />
      </group>
      {/* IBC tank limbah POC */}
      <group position={IBC}>
        <mesh position-y={0.06} castShadow receiveShadow>
          <boxGeometry args={[1.15, 0.12, 1.15]} />
          <meshStandardMaterial color="#3f3f46" />
        </mesh>
        <mesh position-y={0.66}>
          <boxGeometry args={[1.0, 1.0, 1.0]} />
          <meshStandardMaterial color="#f8fafc" transparent opacity={0.32} roughness={0.2} depthWrite={false} />
        </mesh>
        <mesh ref={isi} position-y={0.4}>
          <boxGeometry args={[0.96, 1, 0.96]} />
          <meshStandardMaterial color="#9a7b2f" transparent opacity={0.88} roughness={0.5} />
        </mesh>
        <lineSegments position-y={0.66} geometry={ibcEdges}>
          <lineBasicMaterial color="#9ca3af" />
        </lineSegments>
        {[-0.34, 0, 0.34].map((o) => (
          <group key={o}>
            <mesh position={[o, 0.66, 0.52]}><boxGeometry args={[0.02, 1.04, 0.02]} /><meshStandardMaterial color="#9ca3af" metalness={0.7} /></mesh>
            <mesh position={[0.52, 0.66, o]}><boxGeometry args={[0.02, 1.04, 0.02]} /><meshStandardMaterial color="#9ca3af" metalness={0.7} /></mesh>
            <mesh position={[0, 0.66 + o, 0.52]}><boxGeometry args={[1.04, 0.02, 0.02]} /><meshStandardMaterial color="#9ca3af" metalness={0.7} /></mesh>
            <mesh position={[0.52, 0.66 + o, 0]}><boxGeometry args={[0.02, 0.02, 1.04]} /><meshStandardMaterial color="#9ca3af" metalness={0.7} /></mesh>
          </group>
        ))}
        <mesh position-y={1.2}>
          <cylinderGeometry args={[0.12, 0.12, 0.05, 20]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>
        <Label tampil={label} posisi={[0, 1.55, 0]} judul="IBC Tank Limbah POC" sub={`${fw.pocL.toFixed(0)} / ${GEOM.kapasitasPocL} L`} nada={fw.out.drain ? 'kuning' : undefined} />
      </group>

      {/* Tandon + inlet air bersih */}
      <group position={TANDON}>
        <mesh position-y={0.6} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 1.2, 28]} />
          <meshStandardMaterial color="#1e6fb8" roughness={0.5} />
        </mesh>
        <mesh position-y={1.23}>
          <cylinderGeometry args={[0.2, 0.42, 0.08, 28]} />
          <meshStandardMaterial color="#1a5d99" />
        </mesh>
        <Label tampil={label} posisi={[0, 1.55, 0]} judul="Tandon Air Bersih" sub="sumber inlet" kecil />
      </group>
      <Pipa kurva={JALUR_INLET} radius={0.042} warna="#3b82f6" opacity={0.5} />
      <Aliran kurva={JALUR_INLET} n={30} warna="#60a5fa" aktif={() => fwRef.current.out.inlet} kecepatan={0.35} ukuran={0.03} />
      <group position={POMPA_INLET}>
        <mesh position-y={0.13} castShadow>
          <boxGeometry args={[0.24, 0.22, 0.2]} />
          <meshStandardMaterial color="#1e40af" />
        </mesh>
        <mesh ref={ledInlet} position={[0, 0.2, 0.105]}>
          <sphereGeometry args={[0.018, 10, 10]} />
          <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.05} toneMapped={false} />
        </mesh>
        <Label tampil={label} posisi={[0, 0.45, 0]} judul="Pompa Inlet" sub="Relay GPIO27" kecil nada={fw.out.inlet ? 'biru' : undefined} />
      </group>
      <mesh ref={pancuran} position={[-0.96, 0.6, -0.7]} visible={false}>
        <cylinderGeometry args={[0.03, 0.045, 1, 12, 1, true]} />
        <meshStandardMaterial color="#93c5fd" transparent opacity={0.65} emissive="#60a5fa" emissiveIntensity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={percik} position={[-0.96, 0.5, -0.7]} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.06, 0.13, 24]} />
        <meshBasicMaterial color="#dbeafe" transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Stasiun dosing pH-Up / pH-Down */}
      <mesh position={[DOSING.meja[0] + 0.05, 0.69, DOSING.meja[2]]} castShadow>
        <boxGeometry args={[0.55, 0.04, 0.75]} />
        <meshStandardMaterial color="#a16207" roughness={0.8} />
      </mesh>
      {[[-0.2, -0.32], [0.3, -0.32], [-0.2, 0.32], [0.3, 0.32]].map(([dx, dz]) => (
        <mesh key={`${dx}${dz}`} position={[DOSING.meja[0] + dx, 0.34, DOSING.meja[2] + dz]}>
          <boxGeometry args={[0.04, 0.68, 0.04]} />
          <meshStandardMaterial color="#854d0e" />
        </mesh>
      ))}
      <Botol pos={DOSING.up} warna="#22c55e" judul="pH-Up" aktifFn={() => fwRef.current.out.up} mlFn={() => fwRef.current.dosisMl.up} label={label} />
      <Botol pos={DOSING.down} warna="#a855f7" judul="pH-Down" aktifFn={() => fwRef.current.out.down} mlFn={() => fwRef.current.dosisMl.down} label={label} />
      <Pipa kurva={JALUR_UP} radius={0.008} warna="#86efac" opacity={0.85} segmen={40} />
      <Pipa kurva={JALUR_DOWN} radius={0.008} warna="#d8b4fe" opacity={0.85} segmen={40} />
      <Aliran kurva={JALUR_UP} n={10} warna="#22c55e" aktif={() => fwRef.current.out.up} kecepatan={0.6} ukuran={0.014} />
      <Aliran kurva={JALUR_DOWN} n={10} warna="#a855f7" aktif={() => fwRef.current.out.down} kecepatan={0.6} ukuran={0.014} />
      <Tetesan z={0.42} warna="#22c55e" aktifFn={() => fwRef.current.out.up} fwRef={fwRef} />
      <Tetesan z={0.8} warna="#a855f7" aktifFn={() => fwRef.current.out.down} fwRef={fwRef} />
      <Label tampil={label} posisi={[DOSING.meja[0], 1.42, DOSING.meja[2]]} judul="Dosing pH" sub="Relay GPIO32 / GPIO33"
        nada={fw.out.up ? 'hijau' : fw.out.down ? 'ungu' : undefined} />
    </group>
  );
}

// ---------------------------------------------------------------
// Mode X-Ray: kabel dari ESP32 di box panel ke tiap sensor/aktuator
const KABEL_XRAY = [
  { gpio: 34, nama: 'pH', warna: '#21a35b', arah: -1, ke: () => dunia([0.16, 1.16, 0], RAK.pos, RAK.rot) },
  { gpio: 35, nama: 'TDS', warna: '#f08a24', arah: -1, ke: () => dunia([0.28, 1.16, 0], RAK.pos, RAK.rot) },
  { gpio: 25, nama: 'MOSFET TDS', warna: '#19c3d6', arah: 1, ke: () => dunia([0.29, 1.09, 0.02], RAK.pos, RAK.rot) },
  { gpio: 4, nama: 'Suhu', warna: '#d4a017', arah: -1, ke: () => dunia([0.4, 1.16, 0], RAK.pos, RAK.rot) },
  { gpio: 5, nama: 'TRIG', warna: '#8b5cf6', arah: 1, ke: () => dunia([0.54, 1.12, 0], RAK.pos, RAK.rot) },
  { gpio: 18, nama: 'ECHO', warna: '#d63ca6', arah: -1, ke: () => dunia([0.58, 1.12, 0], RAK.pos, RAK.rot) },
  { gpio: 13, nama: 'Servo PWM', warna: '#f08a24', arah: 1, ke: () => dunia([-0.02, 1.3, 0.13], FEEDER.pos, FEEDER.rot) },
  { gpio: 26, nama: 'Relay Drain', warna: '#eab308', arah: 1, ke: () => V(POMPA_DRAIN[0], 0.25, POMPA_DRAIN[2]) },
  { gpio: 27, nama: 'Relay Inlet', warna: '#2f6fe0', arah: 1, ke: () => V(POMPA_INLET[0], 0.25, POMPA_INLET[2]) },
  { gpio: 32, nama: 'Relay pH-Up', warna: '#21a35b', arah: 1, ke: () => V(DOSING.up[0] + 0.17, 0.84, DOSING.up[2]) },
  { gpio: 33, nama: 'Relay pH-Down', warna: '#9333ea', arah: 1, ke: () => V(DOSING.down[0] + 0.17, 0.84, DOSING.down[2]) },
];

function WiringXray({ fwRef, label }) {
  const kabel = useMemo(() => KABEL_XRAY.map((k, i) => {
    const a = dunia([-0.1 + (i - 5) * 0.012, 1.05, 0.04], BOX.pos, BOX.rot);
    const b = k.ke();
    const jauh = a.distanceTo(b);
    return { ...k, titik: busur(a, b, 0.25 + jauh * 0.12 + (i % 4) * 0.05, 16), b };
  }), []);
  return (
    <group>
      {kabel.map((k) => (
        <group key={k.gpio}>
          <Kabel titik={k.titik} warna={k.warna} radius={0.01} arah={k.arah} aktif={() => fwRef.current.levelPin(k.gpio)} />
          <Label tampil={label} posisi={[k.b.x, k.b.y + 0.09, k.b.z]} judul={`GPIO${k.gpio}`} sub={k.nama} kecil nada="xray" />
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------
export default function SceneKolam({ fwRef, xray, label, oledTex, onFeed, onPilih, versi }) {
  useEffect(() => () => { document.body.style.cursor = ''; }, []);
  const fw = fwRef.current;
  return (
    <group>
      <Tanah />
      <Kolam fwRef={fwRef} xray={xray} onPilih={onPilih} />
      <BoxPanel fwRef={fwRef} xray={xray} oledTex={oledTex} onFeed={onFeed} onPilih={onPilih} label={label} />
      <RakSensor fwRef={fwRef} xray={xray} onPilih={onPilih} label={label} versi={versi} />
      <AutoFeeder fwRef={fwRef} onPilih={onPilih} label={label} />
      <PipaDanPoc fwRef={fwRef} onPilih={onPilih} label={label} />
      {/* Kabel konduit (selalu tampak) dari box ke rak sensor */}
      {!xray && (
        <Kabel titik={busur(dunia([0, 1.04, 0.0], BOX.pos, BOX.rot), dunia([-0.07, 0.6, 0], RAK.pos, RAK.rot), -0.35, 12)} warna="#30363b" radius={0.014} />
      )}
      {xray && <WiringXray fwRef={fwRef} label={label} />}
      <Label tampil={label} posisi={[0, DINDING + 0.35, -0.2]} judul="Kolam Bioflok Ø3 m"
        sub={`air ${fw.levelCm.toFixed(0)} cm · TDS ${fw.baca.tds.toFixed(0)} ppm`} nada={fw.baca.tds > 600 ? 'coklat' : undefined} />
    </group>
  );
}

export const KAMERA_KOLAM = {
  overview: { pos: [5.4, 4.1, 6.6], target: [0.2, 0.55, 0] },
  box: { pos: [-1.0, 1.65, 3.15], target: [-2.1, 1.3, 1.5] },
  sensor: { pos: [-0.1, 2.25, 2.55], target: [-0.85, 0.85, 0.75] },
  feeder: { pos: [1.7, 2.3, 3.5], target: [0.45, 1.4, 1.35] },
  poc: { pos: [5.8, 2.7, 2.2], target: [2.6, 0.75, -0.7] },
  dosing: { pos: [4.3, 1.9, 2.7], target: [2.1, 0.85, 0.55] },
};
