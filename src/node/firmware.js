// =============================================================
// firmware.js — Emulator sketch.ino (ESP32 node AQUA-LOCK AI)
// Meniru loop() baris per baris: Sequential Reading → kompensasi
// suhu TDS → ultrasonik → FSM + Safety Interlock → tombol Feed →
// OLED + JSON telemetri. Mendukung profil komoditas dinamis &
// jeda booting 30 dtk yang menahan eksekusi keputusan pakan.
// =============================================================
import { KOMODITAS_DEFAULT, ambilProfilKomoditas } from '../sim/constants.js';

export const PIN = {
  PH: 34, TDS: 35, TDS_MOSFET: 25, TEMP_DHT: 4, TRIG: 5, ECHO: 18, SERVO: 13,
  BTN_FEED: 14, BUZZER: 19, LED_LOCK: 23, RELAY_DRAIN: 26, RELAY_INLET: 27,
  RELAY_PH_UP: 32, RELAY_PH_DOWN: 33, SDA: 21, SCL: 22,
};

export function buatAmbangNode(profil) {
  const A = profil.ambang;
  return {
    tds: A.TDS_MAX,
    phMin: A.PH_MIN,
    phMax: A.PH_MAX,
    levelAman: 45,
    suhuDingin: A.SUHU_DINGIN,
    tdsPorsi: A.TDS_PORSI ?? 450,
  };
}

// Ambang default (mengikuti komoditas utama: Udang)
export const AMBANG_NODE = buatAmbangNode(ambilProfilKomoditas(KOMODITAS_DEFAULT));

// Geometri kolam untuk model fisika (bukan bagian sketch)
export const GEOM = {
  tinggiSensorCm: 110, // HC-SR04 dipasang 110 cm di atas dasar kolam
  tinggiDindingCm: 100,
  luasM2: Math.PI * 1.5 * 1.5, // kolam Ø3 m → 1 cm = ±70,7 L
  kapasitasPocL: 1000, // IBC tank
  tdsAirBaru: 150,
};

export const WARNA_STATE = {
  NORMAL: '#10B981',
  CLEANING: '#EF4444',
  PH_RECOVERY: '#F59E0B',
  BOOTING: '#0E75BB',
};

const LAJU = { drainCmS: 1.5, inletCmS: 1.5, dosingPhS: 0.05, dosingMlS: 4 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// analogRead() 12-bit: nilai potensiometer dibulatkan ke langkah ADC
const adc = (v, skala) => Math.round((clamp(v, 0, skala) / skala) * 4095) * (skala / 4095);

export function levelAirCm(distCm) { return clamp(GEOM.tinggiSensorCm - distCm, 0, GEOM.tinggiDindingCm); }

export class NodeFirmware {
  constructor(komoditasId = KOMODITAS_DEFAULT) {
    this.komoditas = ambilProfilKomoditas(komoditasId);
    this.ambang = buatAmbangNode(this.komoditas);
    this.reset();
  }

  reset() {
    const pr = this.komoditas.presetNormal;
    const tdsKomp = pr.tdsRaw / (1.0 + 0.02 * (pr.temp - 25.0));
    this.t = 0;
    this.input = { ...pr };
    this.fisika = true;
    this.booting = null;
    this.state = 'NORMAL';
    this.feedLocked = false;
    this.feedPortion = 100;
    this.baca = { ph: pr.ph, tdsRaw: pr.tdsRaw, tds: tdsKomp, temp: pr.temp, distCm: pr.distCm };
    this.out = { drain: false, inlet: false, up: false, down: false, ledLock: false };
    this.mosfetSampai = 0;
    this.buzzerSampai = 0;
    this.servoMulai = -9;
    this.servoSampai = -9;
    this.pingMulai = -9;
    this.i2cSampai = 0;
    this.tombolDitekan = false;
    this.tombolVisualSampai = 0;
    this.loopBerikut = 0.05;
    this.loopKe = 0;
    this.serial = [];
    this.nSerial = 0;
    this.event = null;
    this.nEvent = 0;
    this.oled = ['AQUA-LOCK AI | BOOT', '', '', ''];
    this.pocL = 0;
    this.dosisMl = { up: 0, down: 0 };
    this.stat = { feedOk: 0, feedBlok: 0, kurasL: 0 };
    this.riwayat = [];
  }

  mulaiBooting(targetId, totalDtk = 30) {
    const target = ambilProfilKomoditas(targetId);
    this.booting = { targetId: target.id, targetNama: target.nama, sisaDtk: totalDtk, totalDtk };
    this.state = 'BOOTING';
    this.feedLocked = true;
    this.feedPortion = 0;
    this.out = { drain: false, inlet: false, up: false, down: false, ledLock: true };
    this.oled = [
      'AQUA-LOCK | BOOTING',
      `Mode: ${target.nama.toUpperCase()}`,
      `Muat patokan ${Math.ceil(totalDtk)}s`,
      'FEED: DITAHAN (0%)',
    ];
    this.tulisSerial(`{"event":"PROFILE_BOOT_START","target":"${target.id}","wait_s":${totalDtk}}`, 'blok');
  }

  perbaruiBooting(sisaDtk) {
    if (!this.booting) return;
    const s = Math.max(0, sisaDtk);
    this.booting = { ...this.booting, sisaDtk: s };
    this.oled = [
      'AQUA-LOCK | BOOTING',
      `Mode: ${this.booting.targetNama.toUpperCase()}`,
      `Muat patokan ${Math.ceil(s)}s`,
      'FEED: DITAHAN (0%)',
    ];
  }

  terapkanKomoditas(targetId, dilewati = false) {
    const profil = ambilProfilKomoditas(targetId);
    this.komoditas = profil;
    this.ambang = buatAmbangNode(profil);
    this.booting = null;
    this.tulisSerial(
      `{"event":"PROFILE_ACTIVE","commodity":"${profil.id}","ph":"${this.ambang.phMin}-${this.ambang.phMax}","tds_max":${this.ambang.tds},"temp_cold":${this.ambang.suhuDingin},"skipped":${dilewati}}`,
      'ok',
    );
    this.jalankanLoop();
  }

  // ---------- Sinyal turunan (dibaca adegan 3D) ----------
  get mosfet() { return this.t < this.mosfetSampai; }
  get buzzer() { return this.t < this.buzzerSampai; }
  get servoBuka() { return this.t >= this.servoMulai && this.t < this.servoSampai; }
  get servoSudut() { return this.servoBuka ? 90 : 0; }
  get tombolTertekan() { return this.tombolDitekan || this.t < this.tombolVisualSampai; }
  get levelCm() { return levelAirCm(this.input.distCm); }

  // Level logika tiap GPIO (untuk animasi kabel)
  levelPin(pin) {
    switch (pin) {
      case PIN.TDS_MOSFET: return this.mosfet;
      case PIN.LED_LOCK: return this.out.ledLock;
      case PIN.RELAY_DRAIN: return this.out.drain;
      case PIN.RELAY_INLET: return this.out.inlet;
      case PIN.RELAY_PH_UP: return this.out.up;
      case PIN.RELAY_PH_DOWN: return this.out.down;
      case PIN.BUZZER: return this.buzzer;
      case PIN.SERVO: return this.servoBuka;
      case PIN.BTN_FEED: return this.tombolTertekan;
      case PIN.TRIG: case PIN.ECHO: return this.t - this.pingMulai < 0.12;
      case PIN.SDA: case PIN.SCL: return this.t < this.i2cSampai;
      case PIN.TDS: return this.mosfet;
      case PIN.PH: return this.t >= this.mosfetSampai && this.t < this.mosfetSampai + 0.1;
      case PIN.TEMP_DHT: return this.t >= this.mosfetSampai + 0.05 && this.t < this.mosfetSampai + 0.15;
      default: return false;
    }
  }

  tekanFeed() {
    this.tombolDitekan = true; // ditahan sampai digitalRead() di loop berikutnya
    this.tombolVisualSampai = this.t + 0.25;
  }

  kosongkanPoc() { this.pocL = 0; }

  maju(dt) {
    let sisa = Math.min(dt, 2);
    while (sisa > 1e-6) {
      const h = Math.min(0.05, sisa);
      sisa -= h;
      if (this.fisika) this.fisikaAir(h);
      this.t += h;
      if (this.t >= this.loopBerikut) this.jalankanLoop();
    }
  }

  // Respons air terhadap aktuator (model sederhana untuk digital twin)
  fisikaAir(h) {
    const inp = this.input;
    if (this.out.drain) {
      const dh = LAJU.drainCmS * h;
      if (levelAirCm(inp.distCm) > 5) {
        inp.distCm = clamp(inp.distCm + dh, 10, 105);
        const liter = dh * GEOM.luasM2 * 10;
        this.pocL = Math.min(GEOM.kapasitasPocL, this.pocL + liter);
        this.stat.kurasL += liter;
      }
    }
    if (this.out.inlet) {
      const dh = LAJU.inletCmS * h;
      const lv = Math.max(1, levelAirCm(inp.distCm));
      inp.tdsRaw = (inp.tdsRaw * lv + GEOM.tdsAirBaru * dh) / (lv + dh);
      inp.distCm = clamp(inp.distCm - dh, 10, 105);
    }
    if (this.out.up) { inp.ph = clamp(inp.ph + LAJU.dosingPhS * h, 0, 14); this.dosisMl.up += LAJU.dosingMlS * h; }
    if (this.out.down) { inp.ph = clamp(inp.ph - LAJU.dosingPhS * h, 0, 14); this.dosisMl.down += LAJU.dosingMlS * h; }
  }

  tulisSerial(teks, jenis = 'data') {
    this.nSerial += 1;
    this.serial.push({ id: this.nSerial, t: this.t, teks, jenis });
    if (this.serial.length > 60) this.serial.shift();
  }

  jalankanLoop() {
    const t0 = this.t;
    const inp = this.input;
    this.loopKe += 1;

    // 1. Sequential Reading: MOSFET TDS ON 150 ms → baca TDS → OFF → jeda 100 ms → baca pH
    this.mosfetSampai = t0 + 0.15;
    const tdsRaw = adc(inp.tdsRaw, 1000);
    const ph = adc(inp.ph, 14);
    let temp = Math.round(inp.temp * 10) / 10;
    if (Number.isNaN(temp)) temp = 28.0;
    const tds = tdsRaw / (1.0 + 0.02 * (temp - 25.0));

    // 2. Ultrasonik
    this.pingMulai = t0 + 0.25;
    const distCm = inp.distCm;

    // 3. FSM + Safety Interlock (ditahan penuh selama booting patokan baru)
    const A = this.ambang;
    let drainOn = false, inletOn = false, upOn = false, downOn = false;
    if (this.booting) {
      this.state = 'BOOTING';
      this.feedLocked = true;
      this.feedPortion = 0;
    } else if (tds > A.tds) {
      this.state = 'CLEANING';
      this.feedLocked = true;
      this.feedPortion = 0;
      drainOn = distCm < A.levelAman;
      inletOn = distCm >= A.levelAman;
    } else if (ph < A.phMin || ph > A.phMax) {
      this.state = 'PH_RECOVERY';
      this.feedLocked = true;
      this.feedPortion = 0;
      upOn = ph < A.phMin;
      downOn = ph > A.phMax;
    } else {
      this.state = 'NORMAL';
      this.feedLocked = false;
      this.feedPortion = temp < A.suhuDingin || tds > A.tdsPorsi ? 50 : 100;
    }
    this.out = { drain: drainOn, inlet: inletOn, up: upOn, down: downOn, ledLock: this.feedLocked };
    this.baca = { ph, tdsRaw, tds, temp, distCm };

    // 4. Tombol Manual Feed + Hard Safety Interlock
    let tunda = 0.25;
    if (this.tombolDitekan) {
      this.tombolDitekan = false;
      const tTombol = t0 + 0.25;
      if (this.feedLocked) {
        this.buzzerSampai = tTombol + 0.3; // tone(PIN_BUZZER, 1200, 300)
        this.stat.feedBlok += 1;
        this.tulisSerial(`{"event":"FEED_BLOCKED","state":"${this.state}"}`, 'blok');
        this.nEvent += 1;
        this.event = { id: this.nEvent, jenis: 'FEED_BLOCKED', state: this.state, t: t0 };
      } else {
        const dur = this.feedPortion === 100 ? 1.2 : 0.6;
        this.servoMulai = tTombol;
        this.servoSampai = tTombol + dur; // feeder.write(90) … delay … feeder.write(0)
        tunda += dur;
        this.stat.feedOk += 1;
        this.tulisSerial(`{"event":"FEED_OK","portion":${this.feedPortion}}`, 'ok');
        this.nEvent += 1;
        this.event = { id: this.nEvent, jenis: 'FEED_OK', portion: this.feedPortion, t: t0 };
      }
      tunda += 0.3;
    }

    // 5. OLED + JSON telemetri
    this.oled = this.booting
      ? [
        'AQUA-LOCK | BOOTING',
        `Mode: ${this.booting.targetNama.toUpperCase()}`,
        `Muat patokan ${Math.ceil(this.booting.sisaDtk)}s`,
        'FEED: DITAHAN (0%)',
      ]
      : [
        `${this.komoditas.nama.toUpperCase()} | ${this.state}`,
        `pH: ${ph.toFixed(2)} | T: ${temp.toFixed(1)}C`,
        `TDS: ${tds.toFixed(0)} ppm`,
        `FEED: ${this.feedLocked ? 'LOCKED!' : 'READY'} (${this.feedPortion}%)`,
      ];
    this.i2cSampai = t0 + tunda + 0.06;
    const b = (v) => (v ? 1 : 0);
    this.tulisSerial(
      `{"mode":"${this.komoditas.id}","ph":${ph.toFixed(2)},"tds":${tds.toFixed(1)},"temp":${temp.toFixed(1)},"level_cm":${distCm.toFixed(1)},"state":"${this.state}","feed_lock":${this.feedLocked},"feed_portion":${this.feedPortion},"drain":${b(drainOn)},"inlet":${b(inletOn)},"ph_up":${b(upOn)},"ph_down":${b(downOn)}}`,
    );
    this.riwayat.push({ t: t0, ph, tds, state: this.state });
    if (this.riwayat.length > 90) this.riwayat.shift();

    this.loopBerikut = t0 + tunda + 0.5; // delay(500)
  }
}

// Baris OLED setelah word-wrap ala Adafruit_GFX (21 karakter × 8 baris)
export function barisOled(baris) {
  const hasil = [];
  for (const b of baris) {
    if (!b.length) { hasil.push(''); continue; }
    for (let i = 0; i < b.length; i += 21) hasil.push(b.slice(i, i + 21));
  }
  return hasil.slice(0, 8);
}
