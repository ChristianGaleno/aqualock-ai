// =============================================================
// SceneSkematik.jsx — Skematik 3D interaktif langsung dari
// wokwi/diagram.json (25 komponen & 58 koneksi kabel jumper).
// Seluruh kabel dirutekan ortogonal rapi melalui koridor bus
// dengan sudut melengkung halus (tanpa menyilang di atas IC).
// =============================================================
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { diagram, GRUP, INDUK, INFO, WARNA_KABEL } from './komponen.js';
import { Kabel, Label, V, kursor } from './bagian3d.jsx';

const SKALA = 0.0115;
const OX = 75;
const OZ = 60;

// Offset agar jangkar top-left Wokwi terpusat rapi pada model 3D
const OFFSET = {
  'board-esp32-devkit-c-v4': [45, 82],
  'board-ssd1306': [60, 30],
  'wokwi-potentiometer': [25, 25],
  'wokwi-led': [15, 22],
  'wokwi-resistor': [28, 10],
  'wokwi-dht22': [25, 35],
  'wokwi-hc-sr04': [45, 25],
  'wokwi-pushbutton': [25, 25],
  'wokwi-buzzer': [30, 30],
  'wokwi-servo': [45, 35],
  'wokwi-relay-module': [55, 25],
};

const BAWAH_SAFETY = new Set(['btn_manual_feed', 'buzzer_interlock', 'led_interlock_red', 'r_interlock']);

function pusatPart(p) {
  const [dx, dz] = OFFSET[p.type] || [20, 20];
  const dzKhusus = p.id.startsWith('led_') && p.left > 400 ? 30 : dz;
  // Beri koridor horizontal lega di bawah ESP32 untuk harness kabel relay
  const geserZ = BAWAH_SAFETY.has(p.id) ? 0.24 : 0;
  return [(p.left + dx - OX) * SKALA, 0, (p.top + dzKhusus - OZ) * SKALA + geserZ];
}

// Header 38 pin ESP32 DevKitC V4 (19 kiri, 19 kanan)
const PIN_KIRI = ['3V3', 'EN', 'VP', 'VN', '34', '35', '32', '33', '25', '26', '27', '14', '12', 'GND.1', '13', 'D2', 'D3', 'CMD', '5V'];
const PIN_KANAN = ['GND.2', '23', '22', 'TX0', 'RX0', '21', 'GND.3', '19', '18', '5', '17', '16', '4', '0', '2', '15', 'D1', 'D0', 'CLK'];

// Posisi lokal setiap pin relatif terhadap pusat komponen
function pinLokal(type, pin) {
  switch (type) {
    case 'board-esp32-devkit-c-v4': {
      const iL = PIN_KIRI.indexOf(pin);
      if (iL >= 0) return [-0.41, 0.16, -0.78 + iL * (1.56 / 18)];
      const iR = PIN_KANAN.indexOf(pin);
      if (iR >= 0) return [0.41, 0.16, -0.78 + iR * (1.56 / 18)];
      return [0, 0.16, 0];
    }
    case 'board-ssd1306': {
      const m = { GND: -0.225, VCC: -0.075, SCL: 0.075, SDA: 0.225 };
      return [m[pin] ?? 0, 0.13, 0.36];
    }
    case 'wokwi-potentiometer': {
      const m = { GND: -0.14, SIG: 0, VCC: 0.14 };
      return [m[pin] ?? 0, 0.11, 0.28];
    }
    case 'wokwi-led':
      return [pin === 'A' ? -0.055 : 0.055, 0.09, 0.12];
    case 'wokwi-resistor':
      return [pin === '1' ? -0.24 : 0.24, 0.1, 0];
    case 'wokwi-dht22': {
      const m = { VCC: -0.165, SDA: -0.055, NC: 0.055, GND: 0.165 };
      return [m[pin] ?? 0, 0.1, 0.36];
    }
    case 'wokwi-hc-sr04': {
      const m = { VCC: -0.18, TRIG: -0.06, ECHO: 0.06, GND: 0.18 };
      return [m[pin] ?? 0, 0.11, 0.27];
    }
    case 'wokwi-pushbutton': {
      const m = { '1.l': [-0.24, -0.11], '2.l': [-0.24, 0.11], '1.r': [0.24, -0.11], '2.r': [0.24, 0.11] };
      const [x, z] = m[pin] ?? [0, 0];
      return [x, 0.1, z];
    }
    case 'wokwi-buzzer':
      return [pin === '1' ? -0.11 : 0.11, 0.09, 0.25];
    case 'wokwi-servo': {
      const m = { GND: -0.1, 'V+': 0, PWM: 0.1 };
      return [-0.46, 0.14, m[pin] ?? 0];
    }
    case 'wokwi-relay-module': {
      const m = {
        VCC: [-0.52, -0.14], GND: [-0.52, 0], IN: [-0.52, 0.14],
        NO: [0.5, -0.14], COM: [0.5, 0], NC: [0.5, 0.14],
      };
      const [x, z] = m[pin] ?? [0, 0];
      return [x, 0.15, z];
    }
    default:
      return [0, 0.12, 0];
  }
}

const WARNA_LED = {
  cyan: '#22d3ee', red: '#ef4444', yellow: '#facc15', blue: '#0E75BB', green: '#10b981', purple: '#a855f7',
};

function ledAktif(id, fw) {
  switch (id) {
    case 'led_mosfet_tds': return fw.mosfet;
    case 'led_interlock_red': return fw.out.ledLock;
    case 'led_drain_poc': return fw.out.drain;
    case 'led_inlet_clean': return fw.out.inlet;
    case 'led_ph_up': return fw.out.up;
    case 'led_ph_down': return fw.out.down;
    default: return false;
  }
}

function relayAktif(id, fw) {
  switch (id) {
    case 'relay_drain_poc': return fw.out.drain;
    case 'relay_inlet_clean': return fw.out.inlet;
    case 'relay_dosing_ph_up': return fw.out.up;
    case 'relay_dosing_ph_down': return fw.out.down;
    default: return false;
  }
}

function kabelAktif(a, b, fw) {
  const [pA, pinA] = a.split(':');
  const [pB, pinB] = b.split(':');
  if (['3V3', '5V', 'GND.1', 'GND.2', 'GND', 'VCC', 'V+', 'COM'].includes(pinA) ||
      ['3V3', '5V', 'GND.1', 'GND.2', 'GND', 'VCC', 'V+', 'COM'].includes(pinB)) {
    return false;
  }
  if (pA === 'esp32_node' && /^\d+$/.test(pinA)) return fw.levelPin(Number(pinA));
  if (pB === 'esp32_node' && /^\d+$/.test(pinB)) return fw.levelPin(Number(pinB));
  const gabung = `${a} ${b}`;
  if (gabung.includes('mosfet')) return fw.mosfet;
  if (gabung.includes('interlock')) return fw.out.ledLock;
  if (gabung.includes('drain')) return fw.out.drain;
  if (gabung.includes('inlet')) return fw.out.inlet;
  if (gabung.includes('ph_up')) return fw.out.up;
  if (gabung.includes('ph_down')) return fw.out.down;
  return false;
}

function adalahDaya(a, b) {
  const pa = a.split(':')[1], pb = b.split(':')[1];
  return ['3V3', '5V', 'GND.1', 'GND.2', 'GND', 'VCC', 'V+', 'COM'].includes(pa) ||
         ['3V3', '5V', 'GND.1', 'GND.2', 'GND', 'VCC', 'V+', 'COM'].includes(pb);
}

// ---------- Meja kerja ESD, rel bus daya & zona kelompok subsistem ----------
const ZONA = [
  { id: 'mcu', kunci: 'mcu', judul: 'KONTROLER & DISPLAY', x: -0.35, z: -0.68, w: 1.72, d: 4.1, warna: '#0E75BB' },
  { id: 'sensor', kunci: 'sensor', judul: 'SENSOR KUALITAS AIR', x: -3.02, z: 0.25, w: 2.28, d: 5.5, warna: '#00969B' },
  { id: 'safety', kunci: 'safety', judul: 'SAFETY INTERLOCK', x: -0.82, z: 2.58, w: 3.1, d: 1.48, warna: '#EF4444' },
  { id: 'safety', kunci: 'servo', judul: 'AUTO FEEDER SERVO', x: 2.1, z: -2.18, w: 1.62, d: 1.12, warna: '#EF4444' },
  { id: 'aktuator', kunci: 'aktuator', judul: 'RELAY & AKTUATOR AIR', x: 3.16, z: 0.75, w: 3.05, d: 4.35, warna: '#21979F' },
];

function MejaKerja({ filterGrup, onPilihGrup, label }) {
  return (
    <group>
      {/* Matras ESD biru laut gelap selaras tema #0E75BB / #21979F */}
      <RoundedBox args={[11.4, 0.08, 7.9]} radius={0.05} position={[0.18, -0.04, 0.34]} receiveShadow>
        <meshStandardMaterial color="#0b1a28" roughness={0.82} metalness={0.05} />
      </RoundedBox>
      <gridHelper args={[10.8, 28, '#173852', '#10263a']} position={[0.18, 0.004, 0.34]} />

      {/* Garis jalur bus daya 5V (bawah) & GND (atas/kanan) halus di atas matras */}
      <mesh position={[1.2, 0.007, 3.45]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[7.4, 0.06]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.18} />
      </mesh>
      <mesh position={[2.45, 0.007, -2.92]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[4.6, 0.06]} />
        <meshBasicMaterial color="#64748b" transparent opacity={0.22} />
      </mesh>

      {/* Zona pengelompokan subsistem */}
      {ZONA.map((z) => {
        const aktif = !filterGrup || filterGrup === z.id;
        return (
          <group key={z.kunci} position={[z.x, 0.008, z.z]}>
            <mesh rotation-x={-Math.PI / 2} onClick={(e) => { e.stopPropagation(); onPilihGrup(filterGrup === z.id ? null : z.id); }} {...kursor}>
              <planeGeometry args={[z.w, z.d]} />
              <meshBasicMaterial color={z.warna} transparent opacity={aktif ? 0.13 : 0.03} depthWrite={false} />
            </mesh>
            {[
              [0, z.d / 2, z.w, 0.022],
              [0, -z.d / 2, z.w, 0.022],
              [z.w / 2, 0, 0.022, z.d],
              [-z.w / 2, 0, 0.022, z.d],
            ].map(([bx, bz, bw, bd], i) => (
              <mesh key={i} position={[bx, 0.003, bz]} rotation-x={-Math.PI / 2}>
                <planeGeometry args={[bw, bd]} />
                <meshBasicMaterial color={z.warna} transparent opacity={aktif ? 0.7 : 0.18} />
              </mesh>
            ))}
            <Label tampil={label} posisi={[0, 0.04, -z.d / 2 - 0.16]} judul={z.judul} kecil nada={aktif ? 'zona' : undefined} />
          </group>
        );
      })}
    </group>
  );
}

// ---------- Model 3D masing-masing komponen Wokwi ----------
function CincinSorot({ aktif, ukuran = [0.6, 0.6] }) {
  if (!aktif) return null;
  return (
    <mesh position-y={0.015} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[ukuran[0], ukuran[1]]} />
      <meshBasicMaterial color="#00969B" transparent opacity={0.32} depthWrite={false} />
    </mesh>
  );
}

function Esp32Board({ dipilih, onPilih, label }) {
  return (
    <group onClick={onPilih} {...kursor}>
      <CincinSorot aktif={dipilih} ukuran={[1.18, 2.08]} />
      <RoundedBox args={[0.98, 0.06, 1.88]} radius={0.015} position-y={0.05} castShadow receiveShadow>
        <meshStandardMaterial color="#162231" roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[0.62, 0.1, 0.72]} radius={0.01} position={[0, 0.13, -0.44]} castShadow>
        <meshStandardMaterial color="#d2d9e2" metalness={0.85} roughness={0.26} />
      </RoundedBox>
      <mesh position={[0, 0.085, -0.86]}>
        <boxGeometry args={[0.52, 0.015, 0.12]} />
        <meshStandardMaterial color="#d4a017" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.11, 0.91]}>
        <boxGeometry args={[0.26, 0.08, 0.16]} />
        <meshStandardMaterial color="#b8c0c8" metalness={0.85} roughness={0.25} />
      </mesh>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.11, 0.75]}>
          <boxGeometry args={[0.1, 0.05, 0.08]} />
          <meshStandardMaterial color="#d6dbe0" />
        </mesh>
      ))}
      <mesh position={[0.16, 0.095, 0.52]}>
        <boxGeometry args={[0.04, 0.02, 0.04]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      {PIN_KIRI.map((p, i) => (
        <mesh key={`L${p}`} position={[-0.41, 0.12, -0.78 + i * (1.56 / 18)]}>
          <boxGeometry args={[0.045, 0.09, 0.045]} />
          <meshStandardMaterial color="#eab308" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}
      {PIN_KANAN.map((p, i) => (
        <mesh key={`R${p}`} position={[0.41, 0.12, -0.78 + i * (1.56 / 18)]}>
          <boxGeometry args={[0.045, 0.09, 0.045]} />
          <meshStandardMaterial color="#eab308" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}
      <Label tampil={label} posisi={[0, 0.34, 0]} judul="ESP32 DevKitC V4" sub="16 GPIO aktif" />
    </group>
  );
}

function OledModule({ oledTex, dipilih, onPilih, label }) {
  return (
    <group onClick={onPilih} {...kursor}>
      <CincinSorot aktif={dipilih} ukuran={[1.3, 0.98]} />
      <RoundedBox args={[1.14, 0.06, 0.84]} radius={0.015} position-y={0.05} castShadow>
        <meshStandardMaterial color="#0E75BB" roughness={0.45} />
      </RoundedBox>
      <mesh position={[0, 0.1, -0.05]} castShadow>
        <boxGeometry args={[1.0, 0.04, 0.56]} />
        <meshStandardMaterial color="#090e16" roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.123, -0.05]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.92, 0.46]} />
        <meshBasicMaterial map={oledTex} toneMapped={false} />
      </mesh>
      {[-0.225, -0.075, 0.075, 0.225].map((x) => (
        <mesh key={x} position={[x, 0.11, 0.36]}>
          <boxGeometry args={[0.045, 0.09, 0.045]} />
          <meshStandardMaterial color="#eab308" metalness={0.85} />
        </mesh>
      ))}
      <Label tampil={label} posisi={[0, 0.28, -0.52]} judul="OLED SSD1306" sub="I²C 0x3C · GPIO21/22" kecil />
    </group>
  );
}

function Potensiometer({ part, fwRef, dipilih, onPilih, label }) {
  const kenop = useRef();
  const sudutRef = useRef(0);
  const adalahPh = part.id === 'sensor_ph';
  useFrame((_, dt) => {
    const fw = fwRef.current;
    const rasio = adalahPh ? fw.input.ph / 14 : fw.input.tdsRaw / 1000;
    const target = (0.5 - rasio) * Math.PI * 1.5;
    sudutRef.current += (target - sudutRef.current) * (1 - Math.exp(-10 * dt));
    kenop.current.rotation.y = sudutRef.current;
  });
  const fw = fwRef.current;
  return (
    <group onClick={onPilih} {...kursor}>
      <CincinSorot aktif={dipilih} ukuran={[0.72, 0.76]} />
      <mesh position-y={0.08} castShadow>
        <cylinderGeometry args={[0.25, 0.27, 0.12, 24]} />
        <meshStandardMaterial color="#0E75BB" roughness={0.42} />
      </mesh>
      <group ref={kenop} position-y={0.2}>
        <mesh castShadow>
          <cylinderGeometry args={[0.14, 0.16, 0.15, 20]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.32} />
        </mesh>
        <mesh position={[0, 0.08, -0.07]}>
          <boxGeometry args={[0.03, 0.02, 0.11]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      </group>
      {[-0.14, 0, 0.14].map((x) => (
        <mesh key={x} position={[x, 0.06, 0.28]}>
          <boxGeometry args={[0.035, 0.09, 0.035]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} />
        </mesh>
      ))}
      <Label tampil={label} posisi={[0, 0.42, -0.18]} judul={part.attrs?.label || part.id}
        sub={adalahPh ? `pH ${fw.baca.ph.toFixed(2)} · GPIO34` : `${fw.baca.tds.toFixed(0)} ppm · GPIO35`} kecil />
    </group>
  );
}

function LedPart({ part, fwRef, dipilih, onPilih, label }) {
  const kubah = useRef();
  const glow = useRef(0.06);
  const warna = WARNA_LED[part.attrs?.color] || '#ef4444';
  useFrame((_, dt) => {
    const target = ledAktif(part.id, fwRef.current) ? 3.0 : 0.06;
    glow.current += (target - glow.current) * (1 - Math.exp(-14 * dt));
    kubah.current.material.emissiveIntensity = glow.current;
  });
  const on = ledAktif(part.id, fwRef.current);
  return (
    <group onClick={onPilih} {...kursor}>
      <CincinSorot aktif={dipilih} ukuran={[0.38, 0.38]} />
      {[-0.055, 0.055].map((x) => (
        <mesh key={x} position={[x, 0.05, 0.12]}>
          <cylinderGeometry args={[0.012, 0.012, 0.1, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>
      ))}
      <mesh position-y={0.11}>
        <cylinderGeometry args={[0.12, 0.12, 0.04, 18]} />
        <meshStandardMaterial color={warna} roughness={0.3} />
      </mesh>
      <mesh ref={kubah} position-y={0.21} castShadow>
        <capsuleGeometry args={[0.095, 0.08, 8, 18]} />
        <meshStandardMaterial color={warna} emissive={warna} emissiveIntensity={0.06} roughness={0.2} toneMapped={false} />
      </mesh>
      <Label tampil={label} posisi={[0, 0.42, 0]} judul={part.attrs?.label || part.id}
        sub={on ? 'ON' : undefined} kecil nada={on ? 'aktif' : undefined} />
    </group>
  );
}

function ResistorPart({ dipilih, onPilih }) {
  return (
    <group onClick={onPilih} {...kursor}>
      <CincinSorot aktif={dipilih} ukuran={[0.62, 0.24]} />
      <mesh position-y={0.1} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.012, 0.012, 0.5, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
      </mesh>
      <mesh position-y={0.1} rotation-z={Math.PI / 2} castShadow>
        <capsuleGeometry args={[0.055, 0.2, 6, 12]} />
        <meshStandardMaterial color="#d6b48a" roughness={0.5} />
      </mesh>
      {[[-0.08, '#dc2626'], [-0.03, '#dc2626'], [0.02, '#78350f'], [0.08, '#eab308']].map(([x, c], i) => (
        <mesh key={i} position={[x, 0.1, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.058, 0.058, 0.022, 12]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}

function Dht22Part({ fwRef, dipilih, onPilih, label }) {
  const fw = fwRef.current;
  return (
    <group onClick={onPilih} {...kursor}>
      <CincinSorot aktif={dipilih} ukuran={[0.72, 0.88]} />
      <RoundedBox args={[0.52, 0.2, 0.62]} radius={0.02} position-y={0.13} castShadow>
        <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
      </RoundedBox>
      {[-0.12, 0, 0.12].map((z) => (
        <mesh key={z} position={[0, 0.235, z - 0.04]}>
          <boxGeometry args={[0.36, 0.01, 0.045]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      ))}
      {[-0.165, -0.055, 0.055, 0.165].map((x) => (
        <mesh key={x} position={[x, 0.06, 0.36]}>
          <boxGeometry args={[0.03, 0.09, 0.03]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} />
        </mesh>
      ))}
      <Label tampil={label} posisi={[0, 0.4, -0.1]} judul="DHT22 Suhu" sub={`${fw.baca.temp.toFixed(1)} °C · GPIO4`} kecil />
    </group>
  );
}

function HcSr04Part({ fwRef, dipilih, onPilih, label }) {
  const gelombang = useRef();
  useFrame(() => {
    const fw = fwRef.current;
    const u = (fw.t - fw.pingMulai) / 0.35;
    gelombang.current.visible = u >= 0 && u < 1;
    gelombang.current.position.y = 0.25 + u * 0.45;
    gelombang.current.scale.setScalar(0.5 + u * 1.4);
    gelombang.current.material.opacity = Math.max(0, 1 - u) * 0.8;
  });
  const fw = fwRef.current;
  return (
    <group onClick={onPilih} {...kursor}>
      <CincinSorot aktif={dipilih} ukuran={[1.08, 0.68]} />
      <RoundedBox args={[0.96, 0.06, 0.48]} radius={0.015} position-y={0.05} castShadow>
        <meshStandardMaterial color="#0E75BB" roughness={0.42} />
      </RoundedBox>
      {[-0.25, 0.25].map((x) => (
        <group key={x} position={[x, 0.18, -0.02]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.17, 0.17, 0.2, 24]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position-y={0.102} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.14, 24]} />
            <meshStandardMaterial color="#334155" roughness={0.8} />
          </mesh>
        </group>
      ))}
      <mesh ref={gelombang} position={[-0.25, 0.35, -0.02]} rotation-x={Math.PI / 2} visible={false}>
        <torusGeometry args={[0.14, 0.012, 8, 24]} />
        <meshBasicMaterial color="#21979F" transparent opacity={0.8} />
      </mesh>
      {[-0.18, -0.06, 0.06, 0.18].map((x) => (
        <mesh key={x} position={[x, 0.06, 0.27]}>
          <boxGeometry args={[0.03, 0.09, 0.03]} />
          <meshStandardMaterial color="#eab308" metalness={0.85} />
        </mesh>
      ))}
      <Label tampil={label} posisi={[0, 0.45, -0.1]} judul="HC-SR04 Level" sub={`${fw.baca.distCm.toFixed(1)} cm · GPIO5/18`} kecil />
    </group>
  );
}

function TombolFeedPart({ fwRef, dipilih, onFeed, onPilih, label }) {
  const tutup = useRef();
  const yRef = useRef(0.23);
  useFrame((_, dt) => {
    const target = fwRef.current.tombolTertekan ? 0.17 : 0.23;
    yRef.current += (target - yRef.current) * (1 - Math.exp(-18 * dt));
    tutup.current.position.y = yRef.current;
  });
  return (
    <group onClick={onPilih} {...kursor}>
      <CincinSorot aktif={dipilih} ukuran={[0.64, 0.64]} />
      <RoundedBox args={[0.42, 0.14, 0.42]} radius={0.02} position-y={0.09} castShadow>
        <meshStandardMaterial color="#1f2937" roughness={0.5} />
      </RoundedBox>
      <mesh ref={tutup} position-y={0.23} castShadow onClick={(e) => { e.stopPropagation(); onFeed(); }}>
        <cylinderGeometry args={[0.15, 0.16, 0.12, 24]} />
        <meshStandardMaterial color="#dc2626" emissive="#991b1b" emissiveIntensity={0.35} roughness={0.3} />
      </mesh>
      {[[-0.24, -0.11], [-0.24, 0.11], [0.24, -0.11], [0.24, 0.11]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.06, z]}>
          <boxGeometry args={[0.06, 0.06, 0.03]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} />
        </mesh>
      ))}
      <Label tampil={label} posisi={[0, 0.44, 0]} judul="Klik: FEED" sub="GPIO14 · INPUT_PULLUP" kecil nada="merah" />
    </group>
  );
}

function BuzzerPart({ fwRef, dipilih, onPilih, label }) {
  const ring = useRef([]);
  useFrame(({ clock }) => {
    const on = fwRef.current.buzzer;
    ring.current.forEach((r, i) => {
      if (!r) return;
      r.visible = on;
      const u = (clock.elapsedTime * 2.5 + i / 3) % 1;
      r.position.y = 0.28 + u * 0.4;
      r.scale.setScalar(0.5 + u * 1.4);
      r.material.opacity = (1 - u) * 0.8;
    });
  });
  return (
    <group onClick={onPilih} {...kursor}>
      <CincinSorot aktif={dipilih} ukuran={[0.64, 0.64]} />
      <mesh position-y={0.14} castShadow>
        <cylinderGeometry args={[0.23, 0.23, 0.24, 28]} />
        <meshStandardMaterial color="#171717" roughness={0.4} />
      </mesh>
      <mesh position-y={0.265} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.04, 0.09, 20]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.6} />
      </mesh>
      {[-0.11, 0.11].map((x) => (
        <mesh key={x} position={[x, 0.05, 0.25]}>
          <cylinderGeometry args={[0.015, 0.015, 0.09, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => { ring.current[i] = el; }} rotation-x={Math.PI / 2} visible={false}>
          <torusGeometry args={[0.18, 0.012, 8, 24]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.8} />
        </mesh>
      ))}
      <Label tampil={label} posisi={[0, 0.44, 0]} judul="Buzzer 1200 Hz" sub="GPIO19" kecil />
    </group>
  );
}

function ServoPart({ fwRef, dipilih, onPilih, label }) {
  const tanduk = useRef();
  useFrame((_, dt) => {
    const target = (-fwRef.current.servoSudut * Math.PI) / 180;
    tanduk.current.rotation.y += (target - tanduk.current.rotation.y) * (1 - Math.exp(-10 * dt));
  });
  const fw = fwRef.current;
  return (
    <group onClick={onPilih} {...kursor}>
      <CincinSorot aktif={dipilih} ukuran={[1.1, 0.72]} />
      <RoundedBox args={[0.78, 0.28, 0.44]} radius={0.02} position-y={0.16} castShadow>
        <meshStandardMaterial color="#0E75BB" roughness={0.38} />
      </RoundedBox>
      <mesh position={[0.2, 0.34, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.08, 20]} />
        <meshStandardMaterial color="#0a5a92" />
      </mesh>
      <group ref={tanduk} position={[0.2, 0.4, 0]}>
        <mesh>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 16]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        <mesh position={[0.18, 0, 0]}>
          <boxGeometry args={[0.36, 0.03, 0.08]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      </group>
      {[-0.1, 0, 0.1].map((z, i) => (
        <mesh key={z} position={[-0.46, 0.1, z]}>
          <boxGeometry args={[0.14, 0.04, 0.04]} />
          <meshStandardMaterial color={['#78350f', '#dc2626', '#f97316'][i]} />
        </mesh>
      ))}
      <Label tampil={label} posisi={[0.05, 0.6, -0.12]} judul="Servo Auto Feeder" sub={`${fw.servoSudut}° · GPIO13`} kecil nada={fw.servoBuka ? 'hijau' : undefined} />
    </group>
  );
}

const INFO_RELAY = {
  relay_drain_poc: { nama: 'Relay Drain POC', gpio: 26, warna: '#facc15' },
  relay_inlet_clean: { nama: 'Relay Inlet', gpio: 27, warna: '#0E75BB' },
  relay_dosing_ph_up: { nama: 'Relay pH-Up', gpio: 32, warna: '#10b981' },
  relay_dosing_ph_down: { nama: 'Relay pH-Down', gpio: 33, warna: '#a855f7' },
};

function RelayPart({ part, fwRef, dipilih, onPilih, label }) {
  const led = useRef();
  const glow = useRef(0.06);
  const meta = INFO_RELAY[part.id] || { nama: part.id, gpio: '', warna: '#22c55e' };
  useFrame((_, dt) => {
    const target = relayAktif(part.id, fwRef.current) ? 3.0 : 0.06;
    glow.current += (target - glow.current) * (1 - Math.exp(-14 * dt));
    led.current.material.emissiveIntensity = glow.current;
  });
  const on = relayAktif(part.id, fwRef.current);
  return (
    <group onClick={onPilih} {...kursor}>
      <CincinSorot aktif={dipilih} ukuran={[1.22, 0.78]} />
      <RoundedBox args={[1.04, 0.05, 0.64]} radius={0.015} position-y={0.04} castShadow>
        <meshStandardMaterial color="#0f4c5c" roughness={0.48} />
      </RoundedBox>
      <RoundedBox args={[0.42, 0.26, 0.34]} radius={0.015} position={[-0.02, 0.19, 0]} castShadow>
        <meshStandardMaterial color="#0E75BB" roughness={0.34} />
      </RoundedBox>
      <mesh position={[0.42, 0.15, 0]}>
        <boxGeometry args={[0.16, 0.18, 0.44]} />
        <meshStandardMaterial color="#00969B" roughness={0.42} />
      </mesh>
      {[-0.14, 0, 0.14].map((z) => (
        <mesh key={z} position={[0.42, 0.245, z]}>
          <cylinderGeometry args={[0.032, 0.032, 0.02, 12]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.85} />
        </mesh>
      ))}
      {[-0.14, 0, 0.14].map((z) => (
        <mesh key={z} position={[-0.52, 0.1, z]}>
          <boxGeometry args={[0.08, 0.04, 0.04]} />
          <meshStandardMaterial color="#eab308" metalness={0.85} />
        </mesh>
      ))}
      <mesh ref={led} position={[-0.36, 0.09, -0.22]}>
        <sphereGeometry args={[0.032, 10, 10]} />
        <meshStandardMaterial color={meta.warna} emissive={meta.warna} emissiveIntensity={0.06} toneMapped={false} />
      </mesh>
      <Label tampil={label} posisi={[-0.02, 0.44, 0]} judul={meta.nama} sub={`GPIO${meta.gpio}${on ? ' · ON' : ''}`} kecil nada={on ? 'aktif' : undefined} />
    </group>
  );
}

// ---------- Perutean Ortogonal Rapi 58 Kabel Jumper ----------
// Setiap kabel berjalan di jalur koridor paralel (kiri, kanan, atas, bawah)
// dengan ketinggian berlapis: GND (0.06), Daya (0.095), Sinyal (0.15–0.21).
function buatJalurRapi(pA, pB, a, b) {
  const [idA, pinA] = a.split(':');
  const [idB, pinB] = b.split(':');

  // Helper: susun titik XZ pada ketinggian lapisan y, lalu turun ke pin awal & akhir
  const bangun = (y, titikXZ) => [
    pA,
    V(pA.x, y, pA.z),
    ...titikXZ.map(([x, z]) => V(x, y, z)),
    V(pB.x, y, pB.z),
    pB,
  ];

  // --- 1. OLED I2C & Daya (Koridor Atas) ---
  if (idA === 'oled_status') {
    if (pinA === 'VCC') return bangun(0.095, [[pA.x, -1.46], [-0.96, -1.46], [-0.96, pB.z]]);
    if (pinA === 'GND') return bangun(0.062, [[pA.x, -1.56], [0.28, -1.56], [0.28, pB.z]]);
    if (pinA === 'SCL') return bangun(0.165, [[pA.x, -1.36], [0.36, -1.36], [0.36, pB.z]]);
    if (pinA === 'SDA') return bangun(0.185, [[pA.x, -1.26], [0.44, -1.26], [0.44, pB.z]]);
  }

  // --- 2. Sensor Kiri: pH, TDS, MOSFET, DHT22, HC-SR04 ---
  if (idA === 'sensor_ph') {
    if (pinA === 'SIG') return bangun(0.175, [[pA.x, pA.z + 0.14], [-1.36, pA.z + 0.14], [-1.36, pB.z]]);
    if (pinA === 'VCC') return bangun(0.095, [[pA.x, pA.z + 0.22], [-1.58, pA.z + 0.22], [-1.58, pB.z]]);
    if (pinA === 'GND') return bangun(0.062, [[pA.x, pA.z + 0.28], [-1.84, pA.z + 0.28], [-1.84, pB.z]]);
  }
  if (idA === 'sensor_tds') {
    if (pinA === 'SIG') return bangun(0.175, [[pA.x, pA.z + 0.12], [-1.28, pA.z + 0.12], [-1.28, pB.z]]);
    if (pinA === 'VCC') return bangun(0.095, [[pA.x, pA.z + 0.20], [-1.58, pA.z + 0.20], [-1.58, pB.z]]);
    if (pinA === 'GND') return bangun(0.062, [[pA.x, pA.z + 0.27], [-1.84, pA.z + 0.27], [-1.84, pB.z]]);
  }
  if (idA === 'esp32_node' && idB === 'r_mosfet_tds') {
    return bangun(0.165, [[-1.46, pA.z], [-1.46, pB.z]]);
  }
  if (idA === 'r_mosfet_tds' && idB === 'led_mosfet_tds') {
    return bangun(0.165, [[pA.x - 0.1, pA.z], [pA.x - 0.1, pB.z + 0.14], [pB.x, pB.z + 0.14]]);
  }
  if (idA === 'led_mosfet_tds' && pinA === 'C') {
    return bangun(0.062, [[pA.x, pA.z + 0.1], [-1.84, pA.z + 0.1], [-1.84, pB.z]]);
  }
  if (idA === 'sensor_temp_water') {
    if (pinA === 'SDA') return bangun(0.185, [[pA.x, 1.32], [0.54, 1.32], [0.54, pB.z]]);
    if (pinA === 'VCC') return bangun(0.095, [[pA.x, pA.z + 0.22], [-1.58, pA.z + 0.22], [-1.58, pB.z]]);
    if (pinA === 'GND') return bangun(0.062, [[pA.x, pA.z + 0.15], [-1.84, pA.z + 0.15], [-1.84, pB.z]]);
  }
  if (idA === 'sensor_ultrasonic_level') {
    if (pinA === 'TRIG') return bangun(0.175, [[pA.x, pA.z + 0.14], [-1.72, pA.z + 0.14], [-1.72, 1.40], [0.62, 1.40], [0.62, pB.z]]);
    if (pinA === 'ECHO') return bangun(0.195, [[pA.x, pA.z + 0.22], [-1.64, pA.z + 0.22], [-1.64, 1.48], [0.70, 1.48], [0.70, pB.z]]);
    if (pinA === 'VCC') return bangun(0.095, [[pA.x, 3.45], [-1.36, 3.45], [-1.36, pB.z]]);
    if (pinA === 'GND') return bangun(0.062, [[pA.x, pA.z + 0.30], [-1.84, pA.z + 0.30], [-1.84, pB.z]]);
  }

  // --- 3. Baris Safety Interlock (Bawah) ---
  if (idA === 'btn_manual_feed') {
    if (pinA === '1.l') return bangun(0.175, [[-1.22, pA.z], [-1.22, pB.z]]);
    if (pinA === '2.l') return bangun(0.062, [[-1.30, pA.z], [-1.30, pB.z]]);
  }
  if (idA === 'buzzer_interlock') {
    if (pinA === '1') return bangun(0.185, [[pA.x, pA.z + 0.12], [0.78, pA.z + 0.12], [0.78, pB.z]]);
    if (pinA === '2') return bangun(0.062, [[pA.x, pA.z + 0.18], [0.86, pA.z + 0.18], [0.86, -1.56], [0.28, -1.56], [0.28, pB.z]]);
  }
  if (idA === 'esp32_node' && idB === 'r_interlock') {
    return bangun(0.165, [[0.92, pA.z], [0.92, 1.56], [-1.42, 1.56], [-1.42, pB.z]]);
  }
  if (idA === 'r_interlock' && idB === 'led_interlock_red') {
    return bangun(0.165, [[pA.x - 0.1, pA.z], [pA.x - 0.1, pB.z + 0.16], [pB.x, pB.z + 0.16]]);
  }
  if (idA === 'led_interlock_red' && pinA === 'C') {
    return bangun(0.062, [[pA.x, pA.z + 0.10], [-1.84, pA.z + 0.10], [-1.84, pB.z]]);
  }

  // --- 4. Servo Auto Feeder (Kanan Atas) ---
  if (idA === 'servo_autofeeder') {
    if (pinA === 'PWM') return bangun(0.195, [[0.98, pA.z], [0.98, 1.64], [-1.14, 1.64], [-1.14, pB.z]]);
    if (pinA === 'V+') return bangun(0.095, [[1.48, pA.z], [1.48, 3.45], [-1.36, 3.45], [-1.36, pB.z]]);
    if (pinA === 'GND') return bangun(0.062, [[1.38, pA.z], [1.38, -1.56], [0.28, -1.56], [0.28, pB.z]]);
  }

  // --- 5. 4 Kanal Relay, Resistor 220 Ω, dan LED Beban ---
  const urutanRelay = ['relay_drain_poc', 'relay_inlet_clean', 'relay_dosing_ph_up', 'relay_dosing_ph_down'];
  const idxR = urutanRelay.indexOf(idA);
  if (idxR >= 0) {
    // Harness pita 4 kabel sinyal IN (kuning, biru, hijau, ungu) rapi paralel
    if (pinA === 'IN') {
      const xKanan = 1.06 + idxR * 0.075;
      const zBawah = 1.72 + idxR * 0.072;
      const xKiri = -1.06 + idxR * 0.06;
      return bangun(0.17 + idxR * 0.01, [[xKanan, pA.z], [xKanan, zBawah], [xKiri, zBawah], [xKiri, pB.z]]);
    }
    if (pinA === 'VCC') return bangun(0.095, [[1.48, pA.z], [1.48, 3.45], [-1.36, 3.45], [-1.36, pB.z]]);
    if (pinA === 'GND') return bangun(0.062, [[1.38, pA.z], [1.38, -1.56], [0.28, -1.56], [0.28, pB.z]]);
    if (pinA === 'COM') return bangun(0.095, [[3.02, pA.z], [3.02, 3.45], [-1.36, 3.45], [-1.36, pB.z]]);
    if (pinA === 'NO') return bangun(0.165, [[pA.x + 0.14, pA.z], [pA.x + 0.14, pB.z]]);
  }

  // Resistor beban → LED beban (lurus sejajar horizontal)
  if (idA.startsWith('r_') && idB.startsWith('led_')) {
    return bangun(0.165, [[pB.x, pA.z]]);
  }

  // LED beban Katoda → Rel GND luar kanan → Rel atas → ESP32 GND.2
  if (idA.startsWith('led_') && pinA === 'C') {
    return bangun(0.062, [[pA.x, pA.z + 0.08], [4.62, pA.z + 0.08], [4.62, -2.92], [0.28, -2.92], [0.28, pB.z]]);
  }

  // Fallback ortogonal bersih
  return bangun(0.16, [[pA.x, (pA.z + pB.z) / 2], [pB.x, (pA.z + pB.z) / 2]]);
}

// ---------------------------------------------------------------
export default function SceneSkematik({ fwRef, oledTex, dipilih, filterGrup, tampilDaya, label, onPilihPart, onPilihGrup, onFeed }) {
  useEffect(() => () => { document.body.style.cursor = ''; }, []);

  const petaPart = useMemo(() => {
    const m = {};
    for (const p of diagram.parts) m[p.id] = { part: p, pos: pusatPart(p) };
    return m;
  }, []);

  const kabelSemua = useMemo(() => diagram.connections.map(([a, b, warna], idx) => {
    const [idA, pinA] = a.split(':');
    const [idB, pinB] = b.split(':');
    const infoA = petaPart[idA], infoB = petaPart[idB];
    if (!infoA || !infoB) return null;
    const lA = pinLokal(infoA.part.type, pinA);
    const lB = pinLokal(infoB.part.type, pinB);
    const pA = V(infoA.pos[0] + lA[0], lA[1], infoA.pos[2] + lA[2]);
    const pB = V(infoB.pos[0] + lB[0], lB[1], infoB.pos[2] + lB[2]);
    const daya = adalahDaya(a, b);
    return {
      kunci: `${idx}-${a}-${b}`,
      a, b, idA, idB, daya,
      warna: WARNA_KABEL[warna] || warna || '#94a3b8',
      titik: buatJalurRapi(pA, pB, a, b),
      arah: idA === 'esp32_node' ? 1 : -1,
    };
  }).filter(Boolean), [petaPart]);

  const sorotId = dipilih ? (INDUK[dipilih] || dipilih) : null;
  const cocokSorot = (id) => sorotId && (id === sorotId || INDUK[id] === sorotId);

  return (
    <group>
      <MejaKerja filterGrup={filterGrup} onPilihGrup={onPilihGrup} label={label} />

      {diagram.parts.map((part) => {
        const pos = petaPart[part.id].pos;
        const grupPart = INFO[part.id]?.grup;
        const kenaFilter = !filterGrup || filterGrup === grupPart || part.id === 'esp32_node';
        const isDipilih = cocokSorot(part.id);
        const pilih = (e) => { e.stopPropagation(); onPilihPart(part.id); };
        const props = { part, fwRef, oledTex, dipilih: isDipilih, onPilih: pilih, onFeed, label: label && kenaFilter };
        let isi = null;
        switch (part.type) {
          case 'board-esp32-devkit-c-v4': isi = <Esp32Board {...props} />; break;
          case 'board-ssd1306': isi = <OledModule {...props} />; break;
          case 'wokwi-potentiometer': isi = <Potensiometer {...props} />; break;
          case 'wokwi-led': isi = <LedPart {...props} />; break;
          case 'wokwi-resistor': isi = <ResistorPart {...props} />; break;
          case 'wokwi-dht22': isi = <Dht22Part {...props} />; break;
          case 'wokwi-hc-sr04': isi = <HcSr04Part {...props} />; break;
          case 'wokwi-pushbutton': isi = <TombolFeedPart {...props} />; break;
          case 'wokwi-buzzer': isi = <BuzzerPart {...props} />; break;
          case 'wokwi-servo': isi = <ServoPart {...props} />; break;
          case 'wokwi-relay-module': isi = <RelayPart {...props} />; break;
          default: break;
        }
        return <group key={part.id} position={pos} scale={kenaFilter ? 1 : 0.96}>{isi}</group>;
      })}

      {kabelSemua.map((k) => {
        if (k.daya && !tampilDaya) return null;
        const menyentuhDipilih = cocokSorot(k.idA) || cocokSorot(k.idB);
        const grupA = INFO[k.idA]?.grup;
        const grupB = INFO[k.idB]?.grup;
        const kenaGrup = !filterGrup || grupA === filterGrup || grupB === filterGrup;
        const redup = (sorotId && !menyentuhDipilih) || !kenaGrup || (k.daya && !menyentuhDipilih);
        return (
          <Kabel
            key={k.kunci}
            titik={k.titik}
            warna={k.warna}
            radius={menyentuhDipilih ? 0.0145 : k.daya ? 0.0075 : 0.011}
            arah={k.arah}
            redup={redup}
            sorot={menyentuhDipilih}
            ortogonal
            dupont={!k.daya || menyentuhDipilih}
            aktif={() => kabelAktif(k.a, k.b, fwRef.current)}
          />
        );
      })}
    </group>
  );
}

export const KAMERA_SKEMATIK = {
  overview: { pos: [0.25, 6.4, 6.9], target: [0.18, 0.08, 0.35] },
  atas: { pos: [0.18, 9.2, 0.9], target: [0.18, 0, 0.35] },
  mcu: { pos: [-0.35, 3.2, 2.3], target: [-0.35, 0.1, -0.45] },
  sensor: { pos: [-3.1, 3.7, 3.4], target: [-2.9, 0.1, 0.35] },
  safety: { pos: [-0.6, 2.8, 5.1], target: [-0.7, 0.15, 2.45] },
  aktuator: { pos: [3.4, 3.9, 3.9], target: [3.1, 0.15, 0.7] },
};

export const WARNA_GRUP = Object.fromEntries(GRUP.map((g) => [g.id, g.warna]));
