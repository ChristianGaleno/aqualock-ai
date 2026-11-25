// =============================================================
// Scene3D.js — Digital twin 3D klaster AQUA-LOCK (three.js murni)
//
// Adegan dibaca LANGSUNG dari objek simulator setiap frame:
//   • tinggi air  ← volume kolam      • warna air ← kekeruhan & alga
//   • cincin status ← state FSM       • partikel  ← drain/inlet/pakan/dosing
//   • isi tangki POC, hujan, siang-malam ← jam simulasi
// Label HTML melayang diproyeksikan dari posisi 3D ke layar.
// =============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { tdsSebenarnya } from '../sim/engine.js';

const WARNA = {
  rumput: 0x9ec9ab, tanah: 0x6f8d9c, jalan: 0xe6f2f7, terpal: 0x0e75bb, rangka: 0x8ea7b8,
  airSehat: new THREE.Color(0x21979f), airKeruh: new THREE.Color(0x7d7a4b), airAlga: new THREE.Color(0x4eb060),
  pipa: 0x92aab8, limbah: 0x7a5630, airBersih: 0x00969b, pelet: 0x8a5a2b,
  baik: 0x10b981, serius: 0xf59e0b, kritis: 0xef4444, mati: 0x9aa0ab,
};

export const POSISI_KOLAM = [-6.6, -3.3, 0, 3.3].map((x) => new THREE.Vector3(x, 0, 0));
const POS_TANGKI = new THREE.Vector3(7.4, 0, 2.0);
const POS_GATEWAY = new THREE.Vector3(7.4, 0, -2.0);
const POS_TANDON = new THREE.Vector3(-9.2, 0, -2.3);
const Z_PIPA_DRAIN = 2.45;
const Z_PIPA_INLET = -2.1;
const R_KOLAM = 1.18;
const TINGGI_TERPAL = 0.78;
const TINGGI_AIR_PENUH = 0.48;

// Pandangan kamera bernama: [posisi kamera, titik tujuan]
export function pandangan(nama) {
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const m = /^(kolam|node|feeder)(\d)$/.exec(nama);
  if (m) {
    const p = POSISI_KOLAM[Number(m[2]) - 1];
    if (m[1] === 'kolam') return [v(p.x + 4.4, 5.0, 6.6), v(p.x, 0.4, 0.2)];
    if (m[1] === 'node') return [v(p.x + 3.6, 2.7, 5.0), v(p.x + 1.25, 0.7, 1.25)];
    return [v(p.x + 3.9, 5.6, -6.8), v(p.x - 0.5, 0.8, -0.35)];
  }
  switch (nama) {
    case 'gateway': return [v(12.2, 5.2, 3.6), v(POS_GATEWAY.x, 0.9, POS_GATEWAY.z)];
    case 'tangki': return [v(11.6, 4.4, 7.8), v(POS_TANGKI.x - 1.1, 0.5, POS_TANGKI.z)];
    case 'tandon': return [v(-5.0, 4.8, 3.2), v(POS_TANDON.x, 1.2, POS_TANDON.z)];
    case 'drain': return [v(0.3, 8.8, 15.2), v(0.2, 0.2, 1.4)];
    default: return [v(14.0, 17.5, 22.0), v(0.1, 0, 0.4)];
  }
}

function bahan(warna, opsi = {}) {
  return new THREE.MeshStandardMaterial({ color: warna, roughness: 0.85, metalness: 0.02, flatShading: true, ...opsi });
}

function bayang(obj) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return obj;
}

// Lintasan berupa polyline; posisi(t) untuk t 0..1
class Lintasan {
  constructor(titik) {
    this.titik = titik;
    this.panjang = [];
    let total = 0;
    for (let i = 1; i < titik.length; i++) { total += titik[i].distanceTo(titik[i - 1]); this.panjang.push(total); }
    this.total = total;
  }
  posisi(t, keluar) {
    const d = t * this.total;
    let i = this.panjang.findIndex((p) => p >= d);
    if (i < 0) i = this.panjang.length - 1;
    const awal = i === 0 ? 0 : this.panjang[i - 1];
    const f = (d - awal) / (this.panjang[i] - awal || 1);
    return keluar.lerpVectors(this.titik[i], this.titik[i + 1], f);
  }
}

// Sekumpulan partikel yang mengalir di sepanjang lintasan
class Aliran {
  constructor(induk, lintasan, warna, jumlah = 18, ukuran = 0.07) {
    this.lintasan = lintasan;
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(ukuran, 6, 5), bahan(warna, { roughness: 0.4 }), jumlah);
    this.fase = Array.from({ length: jumlah }, (_, i) => i / jumlah);
    this.aktif = 0;
    this.mesh.frustumCulled = false;
    induk.add(this.mesh);
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
  }
  perbarui(dt, nyala) {
    this.aktif += ((nyala ? 1 : 0) - this.aktif) * Math.min(1, dt * 4);
    const skala = this.aktif;
    this.fase.forEach((f, i) => {
      this.fase[i] = (f + dt * 0.35) % 1;
      this.lintasan.posisi(this.fase[i], this._p);
      this._m.makeScale(skala, skala, skala).setPosition(this._p);
      this.mesh.setMatrixAt(i, this._m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = skala > 0.02;
  }
}

export class TwinScene {
  constructor(wadah, wadahLabel, sim, panggilan) {
    this.wadah = wadah;
    this.wadahLabel = wadahLabel;
    this.sim = sim;
    this.cb = panggilan;
    this.labelTampil = true;
    this.idPilih = 1;
    this.label = [];
    this.tween = null;
    this.jamUi = 0;
    this.pakanTerakhir = [];

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    wadah.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe8f3f8);
    this.scene.fog = new THREE.Fog(0xe8f3f8, 38, 70);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    const [pos, tuju] = pandangan('overview');
    this.camera.position.copy(pos);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(tuju);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.rotateSpeed = 0.78;
    this.controls.zoomSpeed = 0.85;
    this.controls.maxPolarAngle = 1.32;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 70;

    this.bangunCahaya();
    this.bangunTanah();
    this.kolam = POSISI_KOLAM.map((p, i) => this.bangunKolam(p, i));
    this.bangunPipa();
    this.bangunTangki();
    this.bangunGateway();
    this.bangunTandon();
    this.bangunPohon();
    this.bangunHujan();
    this.bangunLabel();

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this._klik = (e) => this.saatKlik(e);
    this._gerak = (e) => this.saatGerak(e);
    this.renderer.domElement.addEventListener('click', this._klik);
    this.renderer.domElement.addEventListener('pointermove', this._gerak);

    this.ro = new ResizeObserver(() => this.ukurUlang());
    this.ro.observe(wadah);
    this.ukurUlang();
    this.jam = new THREE.Clock();
    this._m = new THREE.Matrix4();
    this._langit = new THREE.Color();
    this._cMalam = new THREE.Color(0x0c243b);
    this._cSiang = new THREE.Color(0xe8f3f8);
    this._cHujan = new THREE.Color(0xb8cbd8);
    this._cTarget = new THREE.Color();
    this._loop = () => { this.frame(); this.raf = requestAnimationFrame(this._loop); };
    this.raf = requestAnimationFrame(this._loop);
  }

  // ---------------- Pembangunan adegan ----------------
  bangunCahaya() {
    this.hemi = new THREE.HemisphereLight(0xfff6e5, 0x8a7a5a, 1.1);
    this.scene.add(this.hemi);
    this.matahari = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.matahari.castShadow = true;
    this.matahari.shadow.mapSize.set(2048, 2048);
    const c = this.matahari.shadow.camera;
    c.left = -16; c.right = 16; c.top = 12; c.bottom = -12; c.near = 1; c.far = 80;
    this.matahari.shadow.bias = -0.0006;
    this.scene.add(this.matahari, this.matahari.target);
  }

  bangunTanah() {
    const g = new THREE.Group();
    const sisi = bahan(WARNA.tanah);
    const atas = bahan(WARNA.rumput);
    const tanah = new THREE.Mesh(new THREE.BoxGeometry(21.5, 0.65, 11.8), [sisi, sisi, atas, sisi, sisi, sisi]);
    tanah.position.y = -0.325;
    tanah.receiveShadow = true;
    g.add(tanah);
    const jalan = new THREE.Mesh(new THREE.BoxGeometry(16, 0.035, 0.85), bahan(WARNA.jalan));
    jalan.position.set(-1.2, 0.018, 1.72);
    jalan.receiveShadow = true;
    const jalan2 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.035, 6.8), bahan(WARNA.jalan));
    jalan2.position.set(5.8, 0.018, 0);
    jalan2.receiveShadow = true;
    g.add(jalan, jalan2);
    this.scene.add(g);
  }

  bangunKolam(p, i) {
    const g = new THREE.Group();
    g.position.copy(p);
    const terpal = new THREE.Mesh(new THREE.CylinderGeometry(R_KOLAM, R_KOLAM, TINGGI_TERPAL, 40, 1, true),
      bahan(WARNA.terpal, { side: THREE.DoubleSide, flatShading: false, roughness: 0.6 }));
    terpal.position.y = TINGGI_TERPAL / 2;
    const dasar = new THREE.Mesh(new THREE.CircleGeometry(R_KOLAM, 40), bahan(0x1f3f73));
    dasar.rotation.x = -Math.PI / 2;
    dasar.position.y = 0.03;
    const bibir = new THREE.Mesh(new THREE.TorusGeometry(R_KOLAM, 0.035, 6, 48), bahan(WARNA.rangka, { metalness: 0.4 }));
    bibir.rotation.x = Math.PI / 2;
    bibir.position.y = TINGGI_TERPAL;
    g.add(terpal, dasar, bibir);
    for (let a = 0; a < 8; a++) {
      const tiang = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, TINGGI_TERPAL, 5), bahan(WARNA.rangka, { metalness: 0.4 }));
      tiang.position.set(Math.cos((a / 8) * Math.PI * 2) * (R_KOLAM + 0.03), TINGGI_TERPAL / 2, Math.sin((a / 8) * Math.PI * 2) * (R_KOLAM + 0.03));
      g.add(tiang);
    }
    // badan air (diskalakan sesuai volume)
    const air = new THREE.Mesh(new THREE.CylinderGeometry(R_KOLAM - 0.03, R_KOLAM - 0.03, 1, 40),
      new THREE.MeshStandardMaterial({ color: WARNA.airSehat.clone(), transparent: true, opacity: 0.86, roughness: 0.15, metalness: 0.1 }));
    air.position.y = TINGGI_AIR_PENUH / 2;
    air.scale.y = TINGGI_AIR_PENUH;
    air.receiveShadow = true;
    g.add(air);
    // cincin status di tanah (lebih ramping)
    const cincin = new THREE.Mesh(new THREE.RingGeometry(R_KOLAM + 0.08, R_KOLAM + 0.22, 48),
      new THREE.MeshBasicMaterial({ color: WARNA.baik, transparent: true, opacity: 0.72 }));
    cincin.rotation.x = -Math.PI / 2;
    cincin.position.y = 0.04;
    g.add(cincin);
    // udang (karapas + ruas melengkung + kipas ekor + sungut, menghadap +Z)
    const udang = [];
    const geoKarapas = new THREE.SphereGeometry(0.034, 8, 6);
    geoKarapas.scale(0.75, 0.72, 1.45);
    const geoRuas = new THREE.SphereGeometry(0.028, 7, 5);
    geoRuas.scale(0.65, 0.65, 1.25);
    const geoEkorUdang = new THREE.ConeGeometry(0.028, 0.055, 5);
    geoEkorUdang.rotateX(-Math.PI / 2 + 0.25);
    geoEkorUdang.scale(1.3, 0.25, 1);
    const geoSungut = new THREE.CylinderGeometry(0.0022, 0.001, 0.095, 4);
    const warnaUdang = [0xf28458, 0xf79e78, 0xe26c42];
    for (let f = 0; f < 8; f++) {
      const m = new THREE.Group();
      const badan = new THREE.Group();
      const karapas = new THREE.Mesh(geoKarapas, bahan(warnaUdang[f % 3], { flatShading: false, roughness: 0.42 }));
      karapas.position.set(0, 0.004, 0.032);
      const ruas = new THREE.Mesh(geoRuas, bahan(0xe87348, { flatShading: false, roughness: 0.44 }));
      ruas.position.set(0, -0.002, -0.022);
      const sungutKiri = new THREE.Mesh(geoSungut, bahan(0xffceb8));
      sungutKiri.position.set(-0.014, 0.01, 0.088);
      sungutKiri.rotation.set(Math.PI / 2 - 0.15, 0, 0.22);
      const sungutKanan = new THREE.Mesh(geoSungut, bahan(0xffceb8));
      sungutKanan.position.set(0.014, 0.01, 0.088);
      sungutKanan.rotation.set(Math.PI / 2 - 0.15, 0, -0.22);
      badan.add(karapas, ruas, sungutKiri, sungutKanan);
      const ekor = new THREE.Mesh(geoEkorUdang, bahan(0xc93e22));
      ekor.position.set(0, -0.012, -0.068);
      m.add(badan, ekor);
      m.userData = { r: 0.26 + Math.random() * 0.65, w: 0.22 + Math.random() * 0.3, f: Math.random() * 6.28, d: 0.08 + Math.random() * 0.24 };
      g.add(m);
      udang.push(m);
    }
    // auto-feeder: lebih ringkas
    const feeder = new THREE.Group();
    feeder.position.set(-0.98, 0, -0.98);
    const tiangF = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 1.32, 6), bahan(0x6d737d, { metalness: 0.5 }));
    tiangF.position.y = 0.66;
    const lengan = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.045, 0.045), bahan(0x6d737d));
    lengan.position.set(0.32, 1.28, 0.32);
    lengan.rotation.y = -Math.PI / 4;
    const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.06, 0.3, 10), bahan(0xf1e6cf));
    hopper.position.set(0.55, 1.42, 0.55);
    const tutup = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.04, 10), bahan(0x00969b));
    tutup.position.set(0.55, 1.59, 0.55);
    const gembok = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.095, 0.048), new THREE.MeshStandardMaterial({ color: WARNA.kritis, emissive: WARNA.kritis, emissiveIntensity: 0.6 }));
    gembok.position.set(0.55, 1.25, 0.72);
    feeder.add(tiangF, lengan, hopper, tutup, gembok);
    g.add(feeder);
    // node ESP32 + botol dosing (lebih ringkas)
    const node = new THREE.Group();
    node.position.set(1.28, 0, 1.24);
    const tiangN = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.92, 6), bahan(0x6d737d));
    tiangN.position.y = 0.46;
    const kotak = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.14), bahan(0xf7f4ee));
    kotak.position.y = 0.92;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), new THREE.MeshStandardMaterial({ color: WARNA.baik, emissive: WARNA.baik, emissiveIntensity: 1.2 }));
    led.position.set(0.09, 0.97, 0.08);
    const antena = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.26, 4), bahan(0x333844));
    antena.position.set(-0.1, 1.16, 0);
    const kabel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.78, 4), bahan(0x2b2f3a));
    kabel.position.set(-0.42, 0.62, -0.35);
    kabel.rotation.z = 0.7;
    const botolUp = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.23, 10), bahan(0x3d7fd9));
    botolUp.position.set(0.24, 0.115, 0.04);
    const botolDown = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.23, 10), bahan(0xd6553b));
    botolDown.position.set(0.42, 0.115, -0.09);
    node.add(tiangN, kotak, led, antena, kabel, botolUp, botolDown);
    g.add(node);
    bayang(g);
    air.castShadow = false;
    cincin.castShadow = false;
    g.userData.idKolam = i + 1;
    this.scene.add(g);

    // partikel: pelet pakan & tetes dosing
    const pelet = new THREE.InstancedMesh(new THREE.SphereGeometry(0.026, 5, 4), bahan(WARNA.pelet), 24);
    pelet.frustumCulled = false;
    pelet.visible = false;
    g.add(pelet);
    const tetes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 5), bahan(0x3d7fd9, { roughness: 0.3 }), 8);
    tetes.frustumCulled = false;
    tetes.visible = false;
    g.add(tetes);
    return { g, air, cincin, udang, led, gembok, pelet, tetes, mulaiPakan: -10, mulaiTetes: -10, pakanLama: 0 };
  }

  bangunPipa() {
    const bahanPipa = bahan(WARNA.pipa, { metalness: 0.3, roughness: 0.5 });
    const ruas = (a, b, r = 0.07) => {
      const d = b.clone().sub(a);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), bahanPipa);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      m.castShadow = true;
      this.scene.add(m);
    };
    const yD = 0.08;
    ruas(new THREE.Vector3(POSISI_KOLAM[0].x, yD, Z_PIPA_DRAIN), new THREE.Vector3(POS_TANGKI.x - 0.55, yD, Z_PIPA_DRAIN), 0.068);
    const yI = 0.9;
    ruas(new THREE.Vector3(POS_TANDON.x, yI, Z_PIPA_INLET), new THREE.Vector3(POSISI_KOLAM[3].x, yI, Z_PIPA_INLET), 0.04);
    this.aliranDrain = [];
    this.aliranInlet = [];
    POSISI_KOLAM.forEach((p) => {
      ruas(new THREE.Vector3(p.x, yD, R_KOLAM - 0.15), new THREE.Vector3(p.x, yD, Z_PIPA_DRAIN), 0.06);
      const katup = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.16), bahan(0x2f3a52));
      katup.position.set(p.x, 0.12, 1.9);
      katup.castShadow = true;
      this.scene.add(katup);
      ruas(new THREE.Vector3(p.x, yI, Z_PIPA_INLET), new THREE.Vector3(p.x, yI, -R_KOLAM + 0.08), 0.038);
      ruas(new THREE.Vector3(p.x, yI, -R_KOLAM + 0.08), new THREE.Vector3(p.x, yI - 0.08, -R_KOLAM + 0.28), 0.038);
      this.aliranDrain.push(new Aliran(this.scene, new Lintasan([
        new THREE.Vector3(p.x, 0.09, 0), new THREE.Vector3(p.x, yD + 0.02, Z_PIPA_DRAIN),
        new THREE.Vector3(POS_TANGKI.x - 0.6, yD + 0.02, Z_PIPA_DRAIN), new THREE.Vector3(POS_TANGKI.x - 0.35, 0.92, POS_TANGKI.z + 0.22),
      ]), WARNA.limbah, 20, 0.06));
      this.aliranInlet.push(new Aliran(this.scene, new Lintasan([
        new THREE.Vector3(POS_TANDON.x, yI, Z_PIPA_INLET), new THREE.Vector3(p.x, yI, Z_PIPA_INLET),
        new THREE.Vector3(p.x, yI, -R_KOLAM + 0.28), new THREE.Vector3(p.x, 0.4, -R_KOLAM + 0.4),
      ]), WARNA.airBersih, 20, 0.048));
    });
  }

  bangunTangki() {
    const g = new THREE.Group();
    g.position.copy(POS_TANGKI);
    const palet = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.1, 0.92), bahan(0xb98a55));
    palet.position.y = 0.05;
    const sisi = 0.92, tinggi = 0.85;
    const badan = new THREE.Mesh(new THREE.BoxGeometry(sisi, tinggi, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, roughness: 0.3 }));
    badan.position.y = 0.1 + tinggi / 2;
    const kandang = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(sisi + 0.03, tinggi + 0.03, 0.83, 3, 3, 3)),
      new THREE.LineBasicMaterial({ color: 0x8b93a1 }));
    kandang.position.copy(badan.position);
    const isi = new THREE.Mesh(new THREE.BoxGeometry(sisi - 0.06, 1, 0.74), bahan(WARNA.limbah, { flatShading: false }));
    isi.position.y = 0.12;
    g.add(palet, badan, kandang, isi);
    bayang(g);
    badan.castShadow = false;
    this.tangkiIsi = isi;
    this.tangkiTinggi = tinggi - 0.05;
    this.scene.add(g);
  }

  bangunGateway() {
    const g = new THREE.Group();
    g.position.copy(POS_GATEWAY);
    const dinding = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 1.5), bahan(0xf0f7fb));
    dinding.position.y = 0.65;
    const atap = new THREE.Mesh(new THREE.ConeGeometry(1.48, 0.68, 4), bahan(0x0e75bb));
    atap.rotation.y = Math.PI / 4;
    atap.position.y = 1.64;
    const pintu = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.8, 0.03), bahan(0x21979f));
    pintu.position.set(-0.45, 0.4, 0.76);
    const layar = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.32), new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0x00969b, emissiveIntensity: 0.9 }));
    layar.position.set(0.38, 0.8, 0.761);
    const tiang = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.05, 5), bahan(0x50586a));
    tiang.position.set(0.6, 2.2, -0.3);
    g.add(dinding, atap, pintu, layar, tiang);
    bayang(g);
    this.layarGateway = layar;
    this.cincinWifi = [0, 1, 2].map((i) => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.18 + i * 0.16, 0.02, 4, 24, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0x00969b, transparent: true, opacity: 0 }));
      r.position.set(0.6, 2.75, -0.3);
      g.add(r);
      return r;
    });
    this.mqttLama = 0;
    this.denyutWifi = 0;
    this.scene.add(g);
  }

  bangunTandon() {
    const g = new THREE.Group();
    g.position.copy(POS_TANDON);
    for (let i = 0; i < 4; i++) {
      const kaki = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.08, 0.06), bahan(0x6d737d));
      kaki.position.set(i % 2 ? 0.42 : -0.42, 0.54, i < 2 ? 0.42 : -0.42);
      g.add(kaki);
    }
    const alas = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.06, 1.08), bahan(0x6d737d));
    alas.position.y = 1.08;
    const tabung = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.0, 20), bahan(0x0e75bb, { flatShading: false }));
    tabung.position.y = 1.62;
    const tutup = new THREE.Mesh(new THREE.ConeGeometry(0.51, 0.22, 20), bahan(0x21979f, { flatShading: false }));
    tutup.position.y = 2.23;
    g.add(alas, tabung, tutup);
    bayang(g);
    this.scene.add(g);
  }

  bangunPohon() {
    const titik = [[-9.8, 4.5], [-7.5, 4.9], [-2.8, 5.0], [2.8, 4.9], [9.8, 4.6], [9.6, -4.8], [4.6, -4.9], [-1.3, -5.0], [-6.0, -4.8], [-9.9, 0.7]];
    const daun = [bahan(0x6f9a4a), bahan(0x82ac57), bahan(0x5d8a43)];
    titik.forEach(([x, z], i) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const batang = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.58, 5), bahan(0x7a5a3a));
      batang.position.y = 0.29;
      const tajuk = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + (i % 3) * 0.1, 0), daun[i % 3]);
      tajuk.position.y = 0.85 + (i % 2) * 0.12;
      g.add(batang, tajuk);
      g.rotation.y = i;
      this.scene.add(bayang(g));
    });
  }

  bangunHujan() {
    const n = 900;
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 28, y = Math.random() * 14, z = (Math.random() - 0.5) * 17;
      pos.set([x, y, z, x - 0.05, y - 0.45, z + 0.02], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.hujan = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x8fb4d9, transparent: true, opacity: 0 }));
    this.hujan.frustumCulled = false;
    this.scene.add(this.hujan);
  }

  // ---------------- Label HTML ----------------
  tambahLabel(posisi, kelas, html, opsi = {}) {
    const el = document.createElement(opsi.tombol ? 'button' : 'div');
    el.className = `lbl ${kelas}`;
    el.innerHTML = html;
    if (opsi.onClick) el.addEventListener('click', (e) => { e.stopPropagation(); opsi.onClick(); });
    this.wadahLabel.appendChild(el);
    const l = { el, posisi, selalu: !!opsi.selalu, perbarui: opsi.perbarui };
    this.label.push(l);
    return l;
  }

  bangunLabel() {
    const titik = [
      [1, 'Ringkasan klaster', new THREE.Vector3(-1.65, 2.2, -0.95)],
      [2, 'Sensor Node ESP32', new THREE.Vector3(POSISI_KOLAM[0].x + 1.28, 1.5, 1.24)],
      [3, 'AI di Master Gateway', new THREE.Vector3(POS_GATEWAY.x, 3.0, POS_GATEWAY.z + 0.15)],
      [4, 'Auto-feeder + kunci', new THREE.Vector3(POSISI_KOLAM[1].x - 0.43, 1.95, -0.43)],
      [5, 'Katup drain & inlet', new THREE.Vector3(POSISI_KOLAM[2].x, 0.58, 1.9)],
      [6, 'Tangki POC', new THREE.Vector3(POS_TANGKI.x, 1.6, POS_TANGKI.z)],
      [8, 'Probe pH & TDS', new THREE.Vector3(POSISI_KOLAM[3].x + 0.8, 1.1, 0.95)],
    ];
    this.labelTitik = titik.map(([no, teks, pos]) => this.tambahLabel(pos, 'lbl-titik',
      `<span class="lbl-no">${no}</span>${teks}`, { tombol: true, onClick: () => this.cb.saatBagian?.(no) }));

    this.labelKolam = this.sim.kolam.map((k, i) => this.tambahLabel(
      new THREE.Vector3(POSISI_KOLAM[i].x, 1.22, POSISI_KOLAM[i].z), 'lbl-kolam', '', { tombol: true, selalu: true, onClick: () => this.cb.saatPilihKolam?.(k.id) }));

    this.labelGateway = this.tambahLabel(new THREE.Vector3(POS_GATEWAY.x, 3.8, POS_GATEWAY.z), 'lbl-gelembung', '');
    this.labelTangki = this.tambahLabel(new THREE.Vector3(POS_TANGKI.x, 2.3, POS_TANGKI.z), 'lbl-gelembung kecil', '');
    this.labelTandon = this.tambahLabel(new THREE.Vector3(POS_TANDON.x, 2.75, POS_TANDON.z), 'lbl-gelembung kecil', '<b>Tandon air bersih</b><span>inlet ke 4 kolam</span>');
  }

  perbaruiIsiLabel() {
    const sim = this.sim;
    const hang = sim.t < sim.master.hangSampai;
    sim.kolam.forEach((k, i) => {
      let nada = 'baik', st = 'NORMAL';
      if (!k.online) { nada = 'mati'; st = 'OFFLINE'; }
      else if (hang) { nada = 'mati'; st = 'MPU HANG'; }
      else if (k.fsm.state === 'CLEANING') { nada = 'kritis'; st = k.fsm.sub === 'DITUNDA' ? 'KURAS DITUNDA' : 'CLEANING'; }
      else if (k.fsm.state === 'PH_RECOVERY') { nada = 'serius'; st = 'PH RECOVERY'; }
      const kunci = sim.terkunci(k);
      const el = this.labelKolam[i].el;
      el.className = `lbl lbl-kolam nada-${nada} ${k.id === this.idPilih ? 'pilih' : ''}`;
      // Baris data hanya untuk kolam terpilih agar label tidak saling tumpuk
      el.innerHTML = `<span class="lbl-kepala"><b>K${k.id}</b><i>${st}</i></span>`
        + (k.id === this.idPilih
          ? `<span class="lbl-data">pH ${k.online ? k.ukur.ph.toFixed(2).replace('.', ',') : '–'} · TDS ${k.online ? Math.round(k.ukur.tds) : '–'} · ${kunci ? 'pakan dikunci' : k.ai.porsi.faktor === 1 ? 'pakan 100%' : 'pakan 50%'}</span>`
          : '');
    });
    const online = sim.kolam.filter((k) => k.online).length;
    this.labelGateway.el.innerHTML = `<b>${hang ? 'Master Gateway · MPU reboot' : 'Master Gateway · Uno Q'}</b><span>${(sim.totalMqtt || 0).toLocaleString('id-ID')} paket MQTT diterima · ${online}/4 node</span>`;
    const persen = Math.round((sim.tangki.isiL / sim.tangki.kapasitasL) * 100);
    this.labelTangki.el.innerHTML = `<b>Tangki POC · ${persen}%</b><span>${Math.round(sim.tangki.isiL)} / ${sim.tangki.kapasitasL} L</span>`;
    this.labelTangki.el.classList.toggle('peringatan', persen >= 90);
  }

  posisikanLabel() {
    const w = this.lebar, h = this.tinggi;
    const v = new THREE.Vector3();
    for (const l of this.label) {
      v.copy(l.posisi).project(this.camera);
      const tampak = v.z < 1 && (this.labelTampil || l.selalu) && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
      l.el.style.display = tampak ? '' : 'none';
      if (!tampak) continue;
      l.el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
    }
  }

  // ---------------- Interaksi ----------------
  saatKlik(e) {
    const id = this.kolamDiTitik(e);
    if (id) this.cb.saatPilihKolam?.(id);
  }
  saatGerak(e) {
    this.renderer.domElement.style.cursor = this.kolamDiTitik(e) ? 'pointer' : 'grab';
  }
  kolamDiTitik(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObjects(this.kolam.map((k) => k.g), true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.idKolam) o = o.parent;
    return o ? o.userData.idKolam : null;
  }

  // Pandangan menyeluruh dijauhkan otomatis pada layar sempit/tinggi
  pandanganSesuai(nama) {
    const [pos, tuju] = pandangan(nama);
    if (nama === 'overview' || nama === 'drain') {
      const f = THREE.MathUtils.clamp(1.45 / (this.camera.aspect || 1.45), 1, 2.2);
      pos.sub(tuju).multiplyScalar(f).add(tuju);
    }
    return [pos, tuju];
  }

  fokus(nama, durasi = 1.4) {
    const [pos, tuju] = this.pandanganSesuai(nama);
    this.tween = { dari: this.camera.position.clone(), ke: pos, tDari: this.controls.target.clone(), tKe: tuju, t: 0, d: durasi };
  }

  pilihKolam(id) { this.idPilih = id; this.perbaruiIsiLabel(); }
  aturLabel(tampil) { this.labelTampil = tampil; }
  aturSim(sim) {
    this.sim = sim;
    this.kolam.forEach((k) => { k.pakanLama = 0; });
    this.mqttLama = 0;
  }

  ukurUlang() {
    const r = this.wadah.getBoundingClientRect();
    this.lebar = Math.max(1, r.width);
    this.tinggi = Math.max(1, r.height);
    this.renderer.setSize(this.lebar, this.tinggi);
    this.camera.aspect = this.lebar / this.tinggi;
    // layar sempit: mundurkan kamera agar seluruh klaster terlihat
    this.camera.fov = this.camera.aspect < 1 ? 40 : 30;
    this.camera.updateProjectionMatrix();
    if (!this.sudahPosisi && this.lebar > 10) {
      this.sudahPosisi = true;
      const [pos, tuju] = this.pandanganSesuai('overview');
      this.camera.position.copy(pos);
      this.controls.target.copy(tuju);
    }
  }

  // ---------------- Loop per frame ----------------
  frame() {
    const dt = Math.min(0.05, this.jam.getDelta());
    const t = this.jam.elapsedTime;
    const sim = this.sim;

    if (this.tween) {
      const tw = this.tween;
      tw.t += dt / tw.d;
      const e = tw.t >= 1 ? 1 : tw.t < 0.5 ? 4 * tw.t * tw.t * tw.t : 1 - (-2 * tw.t + 2) ** 3 / 2;
      this.camera.position.lerpVectors(tw.dari, tw.ke, e);
      this.controls.target.lerpVectors(tw.tDari, tw.tKe, e);
      if (tw.t >= 1) this.tween = null;
    }
    this.controls.update();

    // Siang–malam dari jam simulasi (warna selaras tema biru-teal, zero alokasi per frame)
    const jam = sim.jam;
    const sudut = ((jam - 6) / 12) * Math.PI;
    const tinggiMatahari = Math.sin(sudut);
    const siang = THREE.MathUtils.clamp(tinggiMatahari * 1.6 + 0.15, 0, 1);
    this.matahari.position.set(Math.cos(sudut) * 20, Math.max(2, tinggiMatahari * 22), 10);
    this.matahari.intensity = 0.25 + 2.0 * siang;
    this.hemi.intensity = 0.45 + 0.75 * siang;
    const hujan = sim.kolam[0].air.hujan;
    this._langit.copy(this._cMalam).lerp(this._cSiang, siang).lerp(this._cHujan, Math.min(0.6, hujan * 0.8));
    this.scene.background.copy(this._langit);
    this.scene.fog.color.copy(this._langit);
    this.hujan.material.opacity = Math.min(0.75, hujan * 1.1);
    this.hujan.visible = hujan > 0.04;
    if (this.hujan.visible) {
      this.hujan.position.y -= dt * 14;
      if (this.hujan.position.y < -7) this.hujan.position.y += 7;
    }

    // Wi-Fi gateway berdenyut saat paket MQTT masuk
    const totalMqtt = sim.totalMqtt || 0;
    if (totalMqtt !== this.mqttLama) { this.mqttLama = totalMqtt; this.denyutWifi = 1; }
    this.denyutWifi = Math.max(0, this.denyutWifi - dt * 1.5);
    const hang = sim.t < sim.master.hangSampai;
    this.cincinWifi.forEach((c, i) => { c.material.opacity = hang ? 0.1 : Math.max(0, this.denyutWifi - i * 0.2) * 0.9; });
    this.layarGateway.material.emissiveIntensity = hang ? 0.1 + 0.3 * (Math.sin(t * 8) > 0 ? 1 : 0) : 0.9;

    const _m = this._m;
    const damp = 1 - Math.exp(-6 * dt);
    sim.kolam.forEach((k, i) => {
      const v = this.kolam[i];
      const levelTarget = Math.max(0.05, (k.air.volumeL / k.V0) * TINGGI_AIR_PENUH);
      const level = v.air.scale.y + (levelTarget - v.air.scale.y) * damp;
      v.air.scale.y = level;
      v.air.position.y = level / 2 + 0.02;
      const keruh = THREE.MathUtils.clamp((tdsSebenarnya(k) - 380) / 320, 0, 1);
      this._cTarget.copy(WARNA.airSehat).lerp(WARNA.airKeruh, keruh).lerp(WARNA.airAlga, Math.min(1, k.air.bloom * 0.9));
      v.air.material.color.lerp(this._cTarget, damp);

      let warna = WARNA.baik;
      if (!k.online || hang) warna = WARNA.mati;
      else if (k.fsm.state === 'CLEANING') warna = WARNA.kritis;
      else if (k.fsm.state === 'PH_RECOVERY') warna = WARNA.serius;
      this._cTarget.setHex(warna);
      v.cincin.material.color.lerp(this._cTarget, damp);
      const kunci = sim.terkunci(k);
      v.cincin.material.opacity = kunci ? 0.55 + 0.35 * Math.sin(t * 4) : 0.7;
      v.cincin.scale.setScalar(k.id === this.idPilih ? 1.04 : 1);
      v.gembok.visible = kunci;
      v.led.material.emissive.setHex(k.online ? WARNA.baik : WARNA.kritis);
      v.led.material.emissiveIntensity = k.online ? 0.6 + 0.8 * (Math.sin(t * 6 + i) > 0.7 ? 1 : 0) : 1.2;

      v.udang.forEach((f, idx) => {
        const u = f.userData;
        u.f += dt * u.w * (kunci ? 0.6 : 1);
        f.position.set(Math.cos(u.f) * u.r, Math.max(0.06, level - 0.12 - u.d), Math.sin(u.f) * u.r);
        f.rotation.y = -u.f;
        if (f.children[1]) f.children[1].rotation.x = Math.sin(t * 8 + idx) * 0.3;
      });

      // Pelet jatuh saat pakan benar-benar diberikan
      if (k.stat.pakanDiberiKg > v.pakanLama + 1e-6) { v.mulaiPakan = t; }
      v.pakanLama = k.stat.pakanDiberiKg;
      const umurP = t - v.mulaiPakan;
      v.pelet.visible = umurP < 1.6;
      if (v.pelet.visible) {
        for (let j = 0; j < 24; j++) {
          const f = (umurP * 1.3 + j / 24) % 1;
          _m.makeTranslation(-0.43 + Math.sin(j * 2.1) * 0.2, 1.38 - f * (1.38 - level), -0.43 + Math.cos(j * 1.7) * 0.2);
          v.pelet.setMatrixAt(j, _m);
        }
        v.pelet.instanceMatrix.needsUpdate = true;
      }
      // Tetes dosing pH-Up (biru) / pH-Down (merah)
      const dosing = k.fsm.sub === 'DOSING' && k.fsm.dosis;
      if (dosing) { v.mulaiTetes = t; v.tetes.material.color.setHex(k.fsm.dosis.arah === 'UP' ? 0x3d7fd9 : 0xd6553b); }
      const umurT = t - v.mulaiTetes;
      v.tetes.visible = umurT < 1.8;
      if (v.tetes.visible) {
        for (let j = 0; j < 8; j++) {
          const f = (umurT * 1.6 + j / 8) % 1;
          _m.makeTranslation(0.95 - f * 0.28, 0.85 - f * (0.85 - level), 0.92 - f * 0.28);
          v.tetes.setMatrixAt(j, _m);
        }
        v.tetes.instanceMatrix.needsUpdate = true;
      }
      this.aliranDrain[i].perbarui(dt, k.akt.drain);
      this.aliranInlet[i].perbarui(dt, k.akt.inlet);
    });

    const isi = Math.min(1, sim.tangki.isiL / sim.tangki.kapasitasL);
    this.tangkiIsi.scale.y = Math.max(0.01, isi * this.tangkiTinggi);
    this.tangkiIsi.position.y = 0.12 + (isi * this.tangkiTinggi) / 2;

    this.jamUi += dt;
    if (this.jamUi > 0.25) { this.jamUi = 0; this.perbaruiIsiLabel(); }
    this.renderer.render(this.scene, this.camera);
    this.posisikanLabel();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.domElement.removeEventListener('click', this._klik);
    this.renderer.domElement.removeEventListener('pointermove', this._gerak);
    this.label.forEach((l) => l.el.remove());
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
