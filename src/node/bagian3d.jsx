// Komponen 3D bersama: kabel bersinyal halus (ortogonal / lengkung),
// konektor DuPont, aliran partikel, dan label Html.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Titik-titik busur kabel fleksibel dari a ke b dengan puncak setinggi `tinggi`
export function busur(a, b, tinggi = 0.3, n = 12) {
  const mid = a.clone().lerp(b, 0.5);
  mid.y = Math.max(a.y, b.y) + tinggi;
  const q = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
  return q.getPoints(n);
}

// Jalur ortogonal dengan sudut dibulatkan halus (fillet) — zero overshoot
export function jalurHalus(titik, radiusSudut = 0.07) {
  const bersih = [];
  for (const raw of titik) {
    const p = raw.isVector3 ? raw.clone() : V(...raw);
    if (!bersih.length || bersih[bersih.length - 1].distanceTo(p) > 0.004) bersih.push(p);
  }
  const cp = new THREE.CurvePath();
  if (bersih.length < 2) return cp;
  if (bersih.length === 2) {
    cp.add(new THREE.LineCurve3(bersih[0], bersih[1]));
    return cp;
  }

  let awal = bersih[0].clone();
  for (let i = 1; i < bersih.length - 1; i++) {
    const p = bersih[i];
    const sesudah = bersih[i + 1];
    const vMasuk = awal.clone().sub(p);
    const vKeluar = sesudah.clone().sub(p);
    const d1 = vMasuk.length();
    const d2 = vKeluar.length();
    if (d1 < 0.004 || d2 < 0.004) continue;
    const r = Math.min(radiusSudut, d1 * 0.44, d2 * 0.44);
    const a = p.clone().addScaledVector(vMasuk.normalize(), r);
    const b = p.clone().addScaledVector(vKeluar.normalize(), r);
    if (awal.distanceTo(a) > 0.002) cp.add(new THREE.LineCurve3(awal, a));
    cp.add(new THREE.QuadraticBezierCurve3(a, p.clone(), b));
    awal = b;
  }
  const akhir = bersih[bersih.length - 1];
  if (awal.distanceTo(akhir) > 0.002) cp.add(new THREE.LineCurve3(awal, akhir));
  return cp;
}

const kunciTitik = (t) => t.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`).join('|');

// Kabel 3D dengan transisi nyala halus & pulsa cahaya mengalir sepanjang lintasan
export function Kabel({
  titik, warna, aktif, arah = 1, radius = 0.011,
  redup = false, sorot = false, ortogonal = false, dupont = false,
}) {
  const kunci = kunciTitik(titik);
  const { kurva, geo, ujungA, ujungB } = useMemo(() => {
    const k = ortogonal ? jalurHalus(titik, 0.068) : new THREE.CatmullRomCurve3(titik, false, 'centripetal');
    const seg = ortogonal ? Math.max(40, titik.length * 10) : Math.max(28, titik.length * 6);
    const g = new THREE.TubeGeometry(k, seg, radius, 8, false);
    return { kurva: k, geo: g, ujungA: titik[0], ujungB: titik[titik.length - 1] };
  }, [kunci, radius, ortogonal]);
  useEffect(() => () => geo.dispose(), [geo]);

  const mat = useRef();
  const pulsa1 = useRef();
  const pulsa2 = useRef();
  const glowRef = useRef(0.05);

  useFrame(({ clock }, dt) => {
    const on = aktif ? aktif() : false;
    const t = clock.elapsedTime;
    const targetGlow = on ? 0.85 + 0.35 * Math.sin(t * 10) : sorot ? 0.55 : 0.04;
    glowRef.current += (targetGlow - glowRef.current) * (1 - Math.exp(-12 * dt));
    if (mat.current) mat.current.emissiveIntensity = glowRef.current;

    if (pulsa1.current) {
      pulsa1.current.visible = on;
      if (on && kurva.curves?.length !== 0) {
        const u1 = (t * 0.78) % 1;
        kurva.getPointAt(arah > 0 ? u1 : 1 - u1, pulsa1.current.position);
      }
    }
    if (pulsa2.current) {
      pulsa2.current.visible = on;
      if (on && kurva.curves?.length !== 0) {
        const u2 = (t * 0.78 + 0.5) % 1;
        kurva.getPointAt(arah > 0 ? u2 : 1 - u2, pulsa2.current.position);
      }
    }
  });

  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial
          ref={mat}
          color={warna}
          emissive={warna}
          emissiveIntensity={0.04}
          roughness={0.38}
          metalness={0.08}
          transparent={redup}
          opacity={redup ? 0.2 : 1}
        />
      </mesh>
      {dupont && !redup && (
        <>
          <mesh position={[ujungA.x, ujungA.y + 0.02, ujungA.z]}>
            <boxGeometry args={[0.036, 0.055, 0.036]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </mesh>
          <mesh position={[ujungB.x, ujungB.y + 0.02, ujungB.z]}>
            <boxGeometry args={[0.036, 0.055, 0.036]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} />
          </mesh>
        </>
      )}
      <mesh ref={pulsa1} visible={false}>
        <sphereGeometry args={[radius * 2.1, 10, 10]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh ref={pulsa2} visible={false}>
        <sphereGeometry args={[radius * 1.7, 10, 10]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} toneMapped={false} />
      </mesh>
    </group>
  );
}

// Partikel mengalir halus sepanjang kurva (aliran air di pipa)
export function Aliran({ kurva, n = 28, warna, aktif, kecepatan = 0.35, ukuran = 0.035 }) {
  const ref = useRef();
  const kuat = useRef(0);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const u0 = useRef(0);
  useFrame((_, dt) => {
    const on = aktif();
    kuat.current += ((on ? 1 : 0) - kuat.current) * (1 - Math.exp(-6 * dt));
    if (!ref.current) return;
    ref.current.visible = kuat.current > 0.02;
    if (!ref.current.visible) return;
    u0.current = (u0.current + dt * kecepatan) % 1;
    for (let i = 0; i < n; i++) {
      const u = (u0.current + i / n) % 1;
      kurva.getPointAt(u, p);
      const sk = kuat.current * (0.78 + 0.22 * Math.sin(i * 1.7));
      s.setScalar(sk);
      m.compose(p, q, s);
      ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, n]} frustumCulled={false}>
      <sphereGeometry args={[ukuran, 8, 8]} />
      <meshStandardMaterial color={warna} emissive={warna} emissiveIntensity={0.9} toneMapped={false} />
    </instancedMesh>
  );
}

export function Pipa({ kurva, radius = 0.05, warna = '#cfd6dc', opacity = 0.5, segmen = 80 }) {
  const geo = useMemo(() => new THREE.TubeGeometry(kurva, segmen, radius, 12, false), [kurva, radius, segmen]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial color={warna} roughness={0.35} metalness={0.05} transparent opacity={opacity} depthWrite={opacity > 0.9} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function jalur(titik, tensi = 0.05) {
  return new THREE.CatmullRomCurve3(titik.map((t) => (t.isVector3 ? t : V(...t))), false, 'catmullrom', tensi);
}

// Jalur pipa bersiku dengan sudut lembut
export function garis(titik) {
  return jalurHalus(titik, 0.09);
}

// Posisi lokal sebuah grup (posisi + rotasi Y) → koordinat dunia
export function dunia(lokal, pos, rotY) {
  const [lx, ly, lz] = lokal;
  const c = Math.cos(rotY), s = Math.sin(rotY);
  return V(pos[0] + lx * c + lz * s, pos[1] + ly, pos[2] - lx * s + lz * c);
}

export function Label({ posisi, judul, sub, nada, tampil = true, kecil = false, onClick }) {
  if (!tampil) return null;
  return (
    <Html position={posisi} center zIndexRange={[8, 0]} style={{ pointerEvents: onClick ? 'auto' : 'none' }}>
      <div className={`nd-tag ${kecil ? 'kecil' : ''} ${nada ? `nada-${nada}` : ''}`} onClick={onClick}>
        <b>{judul}</b>{sub && <span>{sub}</span>}
      </div>
    </Html>
  );
}

// Kursor tangan untuk objek yang bisa diklik
export const kursor = {
  onPointerOver: (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; },
  onPointerOut: () => { document.body.style.cursor = ''; },
};
