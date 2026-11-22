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
  rumput: 0xb7cc8a, tanah: 0xa07c55, jalan: 0xeadfca, terpal: 0x2f63b3, rangka: 0x8b93a1,
  airSehat: new THREE.Color(0x3a9fb0), airKeruh: new THREE.Color(0x7d7a4b), airAlga: new THREE.Color(0x58b04a),
  pipa: 0x9aa3ae, limbah: 0x7a5630, airBersih: 0x6cc7e8, pelet: 0x8a5a2b,
  baik: 0x1f9d55, serius: 0xe0892f, kritis: 0xd63b3b, mati: 0x9aa0ab,
};

export const POSISI_KOLAM = [-8.4, -4.2, 0, 4.2].map((x) => new THREE.Vector3(x, 0, 0));
const POS_TANGKI = new THREE.Vector3(9.3, 0, 2.6);
const POS_GATEWAY = new THREE.Vector3(9.3, 0, -2.6);
const POS_TANDON = new THREE.Vector3(-11.4, 0, -3.0);
const Z_PIPA_DRAIN = 3.2;
const Z_PIPA_INLET = -2.7;
const R_KOLAM = 1.5;
const TINGGI_TERPAL = 1.0;
const TINGGI_AIR_PENUH = 0.6;

// Pandangan kamera bernama: [posisi kamera, titik tujuan]
export function pandangan(nama) {
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const m = /^(kolam|node|feeder)(\d)$/.exec(nama);
  if (m) {
    const p = POSISI_KOLAM[Number(m[2]) - 1];
    if (m[1] === 'kolam') return [v(p.x + 5.5, 6.2, 8.2), v(p.x, 0.5, 0.3)];
    if (m[1] === 'node') return [v(p.x + 4.6, 3.4, 6.2), v(p.x + 1.6, 0.9, 1.6)];
    return [v(p.x + 4.8, 7.0, -8.5), v(p.x - 0.6, 1.0, -0.4)];
  }
  switch (nama) {
    case 'gateway': return [v(15.5, 6.5, 4.5), v(POS_GATEWAY.x, 1.2, POS_GATEWAY.z)];
    case 'tangki': return [v(14.5, 5.5, 10), v(POS_TANGKI.x - 1.5, 0.6, POS_TANGKI.z)];
    case 'tandon': return [v(-6, 6, 4), v(POS_TANDON.x, 1.5, POS_TANDON.z)];
    case 'drain': return [v(0.5, 11, 19), v(0.3, 0.2, 1.8)];
    default: return [v(16.3, 20, 25.6), v(0.3, 0, 0.6)];
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
    this.scene.background = new THREE.Color(0xf6efe2);
    this.scene.fog = new THREE.Fog(0xf6efe2, 38, 70);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    const [pos, tuju] = pandangan('overview');
    this.camera.position.copy(pos);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(tuju);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
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
    const tanah = new THREE.Mesh(new THREE.BoxGeometry(26, 0.8, 14.5), [sisi, sisi, atas, sisi, sisi, sisi]);
    tanah.position.y = -0.4;
    tanah.receiveShadow = true;
    g.add(tanah);
    const jalan = new THREE.Mesh(new THREE.BoxGeometry(20, 0.04, 1.1), bahan(WARNA.jalan));
    jalan.position.set(-1.5, 0.02, 2.15);
    jalan.receiveShadow = true;
    const jalan2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 8.5), bahan(WARNA.jalan));
    jalan2.position.set(7.3, 0.02, 0);
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
    const bibir = new THREE.Mesh(new THREE.TorusGeometry(R_KOLAM, 0.045, 6, 48), bahan(WARNA.rangka, { metalness: 0.4 }));
    bibir.rotation.x = Math.PI / 2;
    bibir.position.y = TINGGI_TERPAL;
    g.add(terpal, dasar, bibir);
    for (let a = 0; a < 8; a++) {
      const tiang = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, TINGGI_TERPAL, 5), bahan(WARNA.rangka, { metalness: 0.4 }));
      tiang.position.set(Math.cos((a / 8) * Math.PI * 2) * (R_KOLAM + 0.04), TINGGI_TERPAL / 2, Math.sin((a / 8) * Math.PI * 2) * (R_KOLAM + 0.04));
      g.add(tiang);
    }
    // badan air (diskalakan sesuai volume)
    const air = new THREE.Mesh(new THREE.CylinderGeometry(R_KOLAM - 0.04, R_KOLAM - 0.04, 1, 40),
      new THREE.MeshStandardMaterial({ color: WARNA.airSehat.clone(), transparent: true, opacity: 0.86, roughness: 0.15, metalness: 0.1 }));
    air.position.y = TINGGI_AIR_PENUH / 2;
    air.scale.y = TINGGI_AIR_PENUH;
    air.receiveShadow = true;
    g.add(air);
    // cincin status di tanah
    const cincin = new THREE.Mesh(new THREE.RingGeometry(R_KOLAM + 0.15, R_KOLAM + 0.42, 48),
      new THREE.MeshBasicMaterial({ color: WARNA.baik, transparent: true, opacity: 0.75 }));
    cincin.rotation.x = -Math.PI / 2;
    cincin.position.y = 0.05;
    g.add(cincin);
    // ikan lele
    const ikan = [];
    const geoIkan = new THREE.CapsuleGeometry(0.045, 0.22, 3, 6);
    geoIkan.rotateZ(Math.PI / 2);
    for (let f = 0; f < 7; f++) {
      const m = new THREE.Mesh(geoIkan, bahan(0x4d5262));
      m.userData = { r: 0.35 + Math.random() * 0.8, w: 0.25 + Math.random() * 0.35, f: Math.random() * 6.28, d: Math.random() * 0.25 };
      g.add(m);
      ikan.push(m);
    }
    // auto-feeder: tiang + lengan + hopper
    const feeder = new THREE.Group();
    feeder.position.set(-1.25, 0, -1.25);
    const tiangF = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7, 6), bahan(0x6d737d, { metalness: 0.5 }));
    tiangF.position.y = 0.85;
    const lengan = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), bahan(0x6d737d));
    lengan.position.set(0.4, 1.65, 0.4);
    lengan.rotation.y = -Math.PI / 4;
    const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.08, 0.4, 10), bahan(0xf1e6cf));
    hopper.position.set(0.7, 1.82, 0.7);
    const tutup = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.05, 10), bahan(0xe26d2c));
    tutup.position.set(0.7, 2.04, 0.7);
    const gembok = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.06), new THREE.MeshStandardMaterial({ color: WARNA.kritis, emissive: WARNA.kritis, emissiveIntensity: 0.6 }));
    gembok.position.set(0.7, 1.6, 0.92);
    feeder.add(tiangF, lengan, hopper, tutup, gembok);
    g.add(feeder);
    // node ESP32 + botol dosing
    const node = new THREE.Group();
    node.position.set(1.65, 0, 1.6);
    const tiangN = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), bahan(0x6d737d));
    tiangN.position.y = 0.6;
    const kotak = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.18), bahan(0xf7f4ee));
    kotak.position.y = 1.2;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: WARNA.baik, emissive: WARNA.baik, emissiveIntensity: 1.2 }));
    led.position.set(0.12, 1.26, 0.1);
    const antena = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 4), bahan(0x333844));
    antena.position.set(-0.14, 1.52, 0);
    const kabel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 4), bahan(0x2b2f3a));
    kabel.position.set(-0.55, 0.8, -0.45);
    kabel.rotation.z = 0.7;
    const botolUp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 10), bahan(0x3d7fd9));
    botolUp.position.set(0.32, 0.15, 0.05);
    const botolDown = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 10), bahan(0xd6553b));
    botolDown.position.set(0.55, 0.15, -0.12);
    node.add(tiangN, kotak, led, antena, kabel, botolUp, botolDown);
    g.add(node);
    bayang(g);
    air.castShadow = false;
    cincin.castShadow = false;
    g.userData.idKolam = i + 1;
    this.scene.add(g);

    // partikel: pelet pakan & tetes dosing
    const pelet = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 5, 4), bahan(WARNA.pelet), 24);
    pelet.frustumCulled = false;
    pelet.visible = false;
    g.add(pelet);
    const tetes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 6, 5), bahan(0x3d7fd9, { roughness: 0.3 }), 8);
    tetes.frustumCulled = false;
    tetes.visible = false;
    g.add(tetes);
    return { g, air, cincin, ikan, led, gembok, pelet, tetes, mulaiPakan: -10, mulaiTetes: -10, pakanLama: 0 };
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
    const yD = 0.1;
    ruas(new THREE.Vector3(POSISI_KOLAM[0].x, yD, Z_PIPA_DRAIN), new THREE.Vector3(POS_TANGKI.x - 0.75, yD, Z_PIPA_DRAIN), 0.09);
    const yI = 1.15;
    ruas(new THREE.Vector3(POS_TANDON.x, yI, Z_PIPA_INLET), new THREE.Vector3(POSISI_KOLAM[3].x, yI, Z_PIPA_INLET), 0.05);
    this.aliranDrain = [];
    this.aliranInlet = [];
    POSISI_KOLAM.forEach((p) => {
      ruas(new THREE.Vector3(p.x, yD, R_KOLAM - 0.2), new THREE.Vector3(p.x, yD, Z_PIPA_DRAIN), 0.08);
      const katup = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.22), bahan(0x2f3a52));
      katup.position.set(p.x, 0.16, 2.45);
      katup.castShadow = true;
      this.scene.add(katup);
      ruas(new THREE.Vector3(p.x, yI, Z_PIPA_INLET), new THREE.Vector3(p.x, yI, -R_KOLAM + 0.1), 0.05);
      ruas(new THREE.Vector3(p.x, yI, -R_KOLAM + 0.1), new THREE.Vector3(p.x, yI - 0.1, -R_KOLAM + 0.35), 0.05);
      this.aliranDrain.push(new Aliran(this.scene, new Lintasan([
        new THREE.Vector3(p.x, 0.12, 0), new THREE.Vector3(p.x, yD + 0.02, Z_PIPA_DRAIN),
        new THREE.Vector3(POS_TANGKI.x - 0.8, yD + 0.02, Z_PIPA_DRAIN), new THREE.Vector3(POS_TANGKI.x - 0.5, 1.2, POS_TANGKI.z + 0.3),
      ]), WARNA.limbah, 22, 0.08));
      this.aliranInlet.push(new Aliran(this.scene, new Lintasan([
        new THREE.Vector3(POS_TANDON.x, yI, Z_PIPA_INLET), new THREE.Vector3(p.x, yI, Z_PIPA_INLET),
        new THREE.Vector3(p.x, yI, -R_KOLAM + 0.35), new THREE.Vector3(p.x, 0.5, -R_KOLAM + 0.5),
      ]), WARNA.airBersih, 22, 0.06));
    });
  }

  bangunTangki() {
    const g = new THREE.Group();
    g.position.copy(POS_TANGKI);
    const palet = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.14, 1.2), bahan(0xb98a55));
    palet.position.y = 0.07;
    const sisi = 1.2, tinggi = 1.1;
    const badan = new THREE.Mesh(new THREE.BoxGeometry(sisi, tinggi, 1.05),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, roughness: 0.3 }));
    badan.position.y = 0.14 + tinggi / 2;
    const kandang = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(sisi + 0.04, tinggi + 0.04, 1.09, 3, 3, 3)),
      new THREE.LineBasicMaterial({ color: 0x8b93a1 }));
    kandang.position.copy(badan.position);
    const isi = new THREE.Mesh(new THREE.BoxGeometry(sisi - 0.08, 1, 0.97), bahan(WARNA.limbah, { flatShading: false }));
    isi.position.y = 0.16;
    g.add(palet, badan, kandang, isi);
    bayang(g);
    badan.castShadow = false;
    this.tangkiIsi = isi;
    this.tangkiTinggi = tinggi - 0.06;
    this.scene.add(g);
  }

  bangunGateway() {
    const g = new THREE.Group();
    g.position.copy(POS_GATEWAY);
    const dinding = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.7, 2.0), bahan(0xf3ead9));
    dinding.position.y = 0.85;
    const atap = new THREE.Mesh(new THREE.ConeGeometry(1.95, 0.9, 4), bahan(0x1b2a5e));
    atap.rotation.y = Math.PI / 4;
    atap.position.y = 2.15;
    const pintu = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.05, 0.04), bahan(0x6b4a2f));
    pintu.position.set(-0.6, 0.53, 1.01);
    const layar = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.42), new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0x2a78d6, emissiveIntensity: 0.9 }));
    layar.position.set(0.5, 1.05, 1.011);
    const tiang = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.4, 5), bahan(0x50586a));
    tiang.position.set(0.8, 2.9, -0.4);
    g.add(dinding, atap, pintu, layar, tiang);
    bayang(g);
    this.layarGateway = layar;
    this.cincinWifi = [0, 1, 2].map((i) => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.25 + i * 0.22, 0.025, 4, 24, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0x1f8fa6, transparent: true, opacity: 0 }));
      r.position.set(0.8, 3.6, -0.4);
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
      const kaki = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), bahan(0x6d737d));
      kaki.position.set(i % 2 ? 0.55 : -0.55, 0.7, i < 2 ? 0.55 : -0.55);
      g.add(kaki);
    }
    const alas = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.4), bahan(0x6d737d));
    alas.position.y = 1.4;
    const tabung = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.3, 20), bahan(0x2c6fd1, { flatShading: false }));
    tabung.position.y = 2.1;
    const tutup = new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.3, 20), bahan(0x2c6fd1, { flatShading: false }));
    tutup.position.y = 2.9;
    g.add(alas, tabung, tutup);
    bayang(g);
    this.scene.add(g);
  }

  bangunPohon() {
    const titik = [[-12.2, 5.6], [-9.5, 6.1], [-3.5, 6.3], [3.5, 6.2], [12.2, 5.8], [12.1, -6.0], [5.8, -6.2], [-1.6, -6.3], [-7.5, -6.0], [-12.3, 0.8]];
    const daun = [bahan(0x6f9a4a), bahan(0x82ac57), bahan(0x5d8a43)];
    titik.forEach(([x, z], i) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const batang = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.8, 5), bahan(0x7a5a3a));
      batang.position.y = 0.4;
      const tajuk = new THREE.Mesh(new THREE.IcosahedronGeometry(0.65 + (i % 3) * 0.15, 0), daun[i % 3]);
      tajuk.position.y = 1.2 + (i % 2) * 0.2;
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
      [1, 'Ringkasan klaster', new THREE.Vector3(-2.1, 2.8, -1.2)],
      [2, 'Sensor Node ESP32', new THREE.Vector3(POSISI_KOLAM[0].x + 1.65, 1.95, 1.6)],
      [3, 'AI di Master Gateway', new THREE.Vector3(POS_GATEWAY.x, 3.9, POS_GATEWAY.z + 0.2)],
      [4, 'Auto-feeder + kunci', new THREE.Vector3(POSISI_KOLAM[1].x - 0.55, 2.55, -0.55)],
      [5, 'Katup drain & inlet', new THREE.Vector3(POSISI_KOLAM[2].x, 0.75, 2.45)],
      [6, 'Tangki POC', new THREE.Vector3(POS_TANGKI.x, 2.1, POS_TANGKI.z)],
      [8, 'Probe pH & TDS', new THREE.Vector3(POSISI_KOLAM[3].x + 1.0, 1.4, 1.2)],
    ];
    this.labelTitik = titik.map(([no, teks, pos]) => this.tambahLabel(pos, 'lbl-titik',
      `<span class="lbl-no">${no}</span>${teks}`, { tombol: true, onClick: () => this.cb.saatBagian?.(no) }));

    this.labelKolam = this.sim.kolam.map((k, i) => this.tambahLabel(
      new THREE.Vector3(POSISI_KOLAM[i].x, 1.55, POSISI_KOLAM[i].z), 'lbl-kolam', '', { tombol: true, selalu: true, onClick: () => this.cb.saatPilihKolam?.(k.id) }));

    this.labelGateway = this.tambahLabel(new THREE.Vector3(POS_GATEWAY.x, 5.0, POS_GATEWAY.z), 'lbl-gelembung', '');
    this.labelTangki = this.tambahLabel(new THREE.Vector3(POS_TANGKI.x, 3.0, POS_TANGKI.z), 'lbl-gelembung kecil', '');
    this.labelTandon = this.tambahLabel(new THREE.Vector3(POS_TANDON.x, 3.6, POS_TANDON.z), 'lbl-gelembung kecil', '<b>Tandon air bersih</b><span>inlet ke 4 kolam</span>');
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
      const e = tw.t >= 1 ? 1 : tw.t < 0.5 ? 2 * tw.t * tw.t : 1 - (-2 * tw.t + 2) ** 2 / 2;
      this.camera.position.lerpVectors(tw.dari, tw.ke, e);
      this.controls.target.lerpVectors(tw.tDari, tw.tKe, e);
      if (tw.t >= 1) this.tween = null;
    }
    this.controls.update();

    // Siang–malam dari jam simulasi
    const jam = sim.jam;
    const sudut = ((jam - 6) / 12) * Math.PI;              // 06.00 terbit, 18.00 terbenam
    const tinggiMatahari = Math.sin(sudut);
    const siang = THREE.MathUtils.clamp(tinggiMatahari * 1.6 + 0.15, 0, 1);
    this.matahari.position.set(Math.cos(sudut) * 20, Math.max(2, tinggiMatahari * 22), 10);
    this.matahari.intensity = 0.25 + 2.0 * siang;
    this.hemi.intensity = 0.45 + 0.75 * siang;
    const hujan = sim.kolam[0].air.hujan;
    const langit = new THREE.Color(0x29365f).lerp(new THREE.Color(0xf6efe2), siang).lerp(new THREE.Color(0xc9ced6), Math.min(0.6, hujan * 0.8));
    this.scene.background.copy(langit);
    this.scene.fog.color.copy(langit);
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

    const _m = new THREE.Matrix4();
    sim.kolam.forEach((k, i) => {
      const v = this.kolam[i];
      const level = (k.air.volumeL / k.V0) * TINGGI_AIR_PENUH;
      v.air.scale.y = Math.max(0.05, level);
      v.air.position.y = level / 2 + 0.02;
      const keruh = THREE.MathUtils.clamp((tdsSebenarnya(k) - 380) / 320, 0, 1);
      v.air.material.color.copy(WARNA.airSehat).lerp(WARNA.airKeruh, keruh).lerp(WARNA.airAlga, Math.min(1, k.air.bloom * 0.9));

      let warna = WARNA.baik;
      if (!k.online || hang) warna = WARNA.mati;
      else if (k.fsm.state === 'CLEANING') warna = WARNA.kritis;
      else if (k.fsm.state === 'PH_RECOVERY') warna = WARNA.serius;
      v.cincin.material.color.setHex(warna);
      const kunci = sim.terkunci(k);
      v.cincin.material.opacity = kunci ? 0.55 + 0.35 * Math.sin(t * 4) : 0.7;
      v.cincin.scale.setScalar(k.id === this.idPilih ? 1.04 : 1);
      v.gembok.visible = kunci;
      v.led.material.emissive.setHex(k.online ? WARNA.baik : WARNA.kritis);
      v.led.material.emissiveIntensity = k.online ? 0.6 + 0.8 * (Math.sin(t * 6 + i) > 0.7 ? 1 : 0) : 1.2;

      v.ikan.forEach((f) => {
        const u = f.userData;
        u.f += dt * u.w * (kunci ? 0.6 : 1);
        f.position.set(Math.cos(u.f) * u.r, Math.max(0.1, level - 0.08 - u.d), Math.sin(u.f) * u.r);
        f.rotation.y = -u.f;
      });

      // Pelet jatuh saat pakan benar-benar diberikan
      if (k.stat.pakanDiberiKg > v.pakanLama + 1e-6) { v.mulaiPakan = t; }
      v.pakanLama = k.stat.pakanDiberiKg;
      const umurP = t - v.mulaiPakan;
      v.pelet.visible = umurP < 1.6;
      if (v.pelet.visible) {
        for (let j = 0; j < 24; j++) {
          const f = (umurP * 1.3 + j / 24) % 1;
          _m.makeTranslation(-0.55 + Math.sin(j * 2.1) * 0.25, 1.75 - f * (1.75 - level), -0.55 + Math.cos(j * 1.7) * 0.25);
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
          _m.makeTranslation(1.25 - f * 0.35, 1.1 - f * (1.1 - level), 1.2 - f * 0.35);
          v.tetes.setMatrixAt(j, _m);
        }
        v.tetes.instanceMatrix.needsUpdate = true;
      }
      this.aliranDrain[i].perbarui(dt, k.akt.drain);
      this.aliranInlet[i].perbarui(dt, k.akt.inlet);
    });

    const isi = Math.min(1, sim.tangki.isiL / sim.tangki.kapasitasL);
    this.tangkiIsi.scale.y = Math.max(0.01, isi * this.tangkiTinggi);
    this.tangkiIsi.position.y = 0.16 + (isi * this.tangkiTinggi) / 2;

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
