// =============================================================
// komponen.js — Fungsi tiap komponen diagram.json Wokwi,
// dikelompokkan per subsistem untuk panel & tooltip 3D.
// =============================================================
import diagram from '../../wokwi/diagram.json';
import { PIN } from './firmware.js';

export { diagram };

export const GRUP = [
  { id: 'mcu', judul: 'Kontroler & Display', ikon: '◧', warna: '#0E75BB' },
  { id: 'sensor', judul: 'Sensor Kualitas Air', ikon: '◉', warna: '#00969B' },
  { id: 'safety', judul: 'Safety Interlock & Pakan', ikon: '⛨', warna: '#EF4444' },
  { id: 'aktuator', judul: 'Relay & Aktuator Air', ikon: '⇄', warna: '#21979F' },
];

// Objek adegan kolam yang menaungi tiap part (scene_objects → linked_wokwi_ids)
export const OBJEK_ADEGAN = {
  esp32_control_box: { nama: 'Box Panel IP65', ids: ['esp32_node', 'oled_status', 'btn_manual_feed', 'led_interlock_red', 'buzzer_interlock', 'r_interlock'], kamera: 'box' },
  sensor_probe_rack: { nama: 'Rak Probe Sensor', ids: ['sensor_ph', 'sensor_tds', 'led_mosfet_tds', 'r_mosfet_tds', 'sensor_temp_water', 'sensor_ultrasonic_level'], kamera: 'sensor' },
  auto_feeder_hopper: { nama: 'Corong Auto Feeder', ids: ['servo_autofeeder'], kamera: 'feeder' },
  piping_and_poc_tank: { nama: 'Pipa & Tangki POC', ids: ['relay_drain_poc', 'r_drain', 'led_drain_poc', 'relay_inlet_clean', 'r_inlet', 'led_inlet_clean', 'relay_dosing_ph_up', 'r_ph_up', 'led_ph_up', 'relay_dosing_ph_down', 'r_ph_down', 'led_ph_down'], kamera: 'poc' },
};

export function objekUntuk(idPart) {
  return Object.entries(OBJEK_ADEGAN).find(([, o]) => o.ids.includes(idPart))?.[0] ?? null;
}

// Info fungsi tiap part. `nilai(fw)` → teks nilai langsung.
export const INFO = {
  esp32_node: {
    grup: 'mcu', nama: 'ESP32 DevKitC V4', peran: 'Otak node',
    fungsi: 'Menjalankan loop() tiap ±750 ms: Sequential Reading sensor, kompensasi suhu TDS, FSM 3 status, Safety Interlock pakan, lalu kirim JSON telemetri 115200 baud.',
    nilai: (fw) => `loop #${fw.loopKe} · ${fw.state}`,
  },
  oled_status: {
    grup: 'mcu', nama: 'OLED SSD1306 128×64', peran: 'Layar status (I²C 0x3C)',
    fungsi: 'Menampilkan state FSM, pH, suhu, TDS terkompensasi, dan status FEED (READY / LOCKED!) setiap akhir loop lewat SDA GPIO21 & SCL GPIO22.',
    nilai: (fw) => fw.oled[0],
  },
  sensor_ph: {
    grup: 'sensor', nama: 'Probe pH (potensiometer)', peran: 'ADC GPIO34',
    fungsi: 'analogRead(34) × 14/4095 → pH 0–14. Di luar 6,5–8,2 memicu PH_RECOVERY dan mengunci pakan.',
    nilai: (fw) => `pH ${fw.baca.ph.toFixed(2)}`,
  },
  sensor_tds: {
    grup: 'sensor', nama: 'Probe TDS (potensiometer)', peran: 'ADC GPIO35',
    fungsi: 'analogRead(35) × 1000/4095 → TDS mentah, lalu dikompensasi suhu: TDS / (1 + 0,02·(T−25)). Di atas 600 ppm memicu CLEANING.',
    nilai: (fw) => `${fw.baca.tdsRaw.toFixed(0)} → ${fw.baca.tds.toFixed(0)} ppm`,
  },
  led_mosfet_tds: {
    grup: 'sensor', nama: 'LED MOSFET TDS', peran: 'Output GPIO25',
    fungsi: 'Mewakili MOSFET yang menyalakan probe TDS hanya 150 ms per loop (Sequential Reading) agar arus probe TDS tidak mengganggu probe pH.',
    nilai: (fw) => (fw.mosfet ? 'ON · membaca TDS' : 'OFF'),
  },
  r_mosfet_tds: { grup: 'sensor', nama: 'Resistor 220 Ω', peran: 'Pembatas arus LED MOSFET', fungsi: 'Membatasi arus GPIO25 ke LED indikator MOSFET TDS.', nilai: () => '220 Ω' },
  sensor_temp_water: {
    grup: 'sensor', nama: 'Sensor suhu DHT22', peran: 'Data GPIO4',
    fungsi: 'dht.readTemperature() untuk kompensasi TDS dan porsi pakan (<24 °C → 50%). Jika gagal (NaN) dipakai 28 °C. Di kolam nyata diganti probe DS18B20.',
    nilai: (fw) => `${fw.baca.temp.toFixed(1)} °C`,
  },
  sensor_ultrasonic_level: {
    grup: 'sensor', nama: 'Ultrasonik HC-SR04', peran: 'TRIG GPIO5 · ECHO GPIO18',
    fungsi: 'Mengukur jarak sensor → permukaan air (pulseIn × 0,034 / 2). Saat CLEANING: kuras sampai jarak 45 cm, lalu isi air bersih.',
    nilai: (fw) => `${fw.baca.distCm.toFixed(1)} cm`,
  },
  btn_manual_feed: {
    grup: 'safety', nama: 'Tombol Manual Feed', peran: 'Input GPIO14 (INPUT_PULLUP)',
    fungsi: 'Dibaca LOW saat ditekan. Jika feedLocked → ditolak (buzzer + log FEED_BLOCKED). Jika aman → servo buka 90° selama 1,2 dtk (100%) atau 0,6 dtk (50%).',
    nilai: (fw) => (fw.tombolTertekan ? 'LOW · ditekan' : 'HIGH'),
  },
  buzzer_interlock: {
    grup: 'safety', nama: 'Buzzer Interlock', peran: 'Output GPIO19',
    fungsi: 'tone(19, 1200 Hz, 300 ms) sebagai alarm penolakan pakan saat Safety Interlock aktif.',
    nilai: (fw) => (fw.buzzer ? 'BUNYI 1200 Hz' : 'diam'),
  },
  led_interlock_red: {
    grup: 'safety', nama: 'LED LOCK merah', peran: 'Output GPIO23',
    fungsi: 'Menyala selama feedLocked = true (state CLEANING atau PH_RECOVERY).',
    nilai: (fw) => (fw.out.ledLock ? 'ON · terkunci' : 'OFF'),
  },
  r_interlock: { grup: 'safety', nama: 'Resistor 220 Ω', peran: 'Pembatas arus LED LOCK', fungsi: 'Membatasi arus GPIO23 ke LED LOCK.', nilai: () => '220 Ω' },
  servo_autofeeder: {
    grup: 'safety', nama: 'Servo Auto Feeder', peran: 'PWM GPIO13',
    fungsi: 'feeder.write(90) membuka katup corong pakan, feeder.write(0) menutup. Tidak pernah bergerak saat feedLocked.',
    nilai: (fw) => `${fw.servoSudut}°`,
  },
  relay_drain_poc: {
    grup: 'aktuator', nama: 'Relay Drain → POC', peran: 'IN GPIO26',
    fungsi: 'Membuka pompa/katup bottom drain: lumpur dasar dialirkan ke IBC tank limbah POC saat CLEANING dan jarak < 45 cm.',
    nilai: (fw) => (fw.out.drain ? 'ON · menguras' : 'OFF'),
  },
  relay_inlet_clean: {
    grup: 'aktuator', nama: 'Relay Inlet Air Bersih', peran: 'IN GPIO27',
    fungsi: 'Membuka pompa air bersih saat CLEANING dan jarak ≥ 45 cm (isi ulang & pengenceran TDS).',
    nilai: (fw) => (fw.out.inlet ? 'ON · mengisi' : 'OFF'),
  },
  relay_dosing_ph_up: {
    grup: 'aktuator', nama: 'Relay Dosing pH-Up', peran: 'IN GPIO32',
    fungsi: 'Pompa peristaltik larutan basa (kapur/NaHCO₃) saat pH < 6,5.',
    nilai: (fw) => (fw.out.up ? 'ON · dosing' : 'OFF'),
  },
  relay_dosing_ph_down: {
    grup: 'aktuator', nama: 'Relay Dosing pH-Down', peran: 'IN GPIO33',
    fungsi: 'Pompa peristaltik larutan asam saat pH > 8,2.',
    nilai: (fw) => (fw.out.down ? 'ON · dosing' : 'OFF'),
  },
  led_drain_poc: { grup: 'aktuator', nama: 'LED DRAIN POC', peran: 'Beban relay drain (NO)', fungsi: 'Indikator beban pompa drain: menyala saat kontak NO relay drain tertutup.', nilai: (fw) => (fw.out.drain ? 'ON' : 'OFF') },
  led_inlet_clean: { grup: 'aktuator', nama: 'LED INLET', peran: 'Beban relay inlet (NO)', fungsi: 'Indikator beban pompa inlet.', nilai: (fw) => (fw.out.inlet ? 'ON' : 'OFF') },
  led_ph_up: { grup: 'aktuator', nama: 'LED pH-UP', peran: 'Beban relay pH-Up (NO)', fungsi: 'Indikator pompa dosing pH-Up.', nilai: (fw) => (fw.out.up ? 'ON' : 'OFF') },
  led_ph_down: { grup: 'aktuator', nama: 'LED pH-DOWN', peran: 'Beban relay pH-Down (NO)', fungsi: 'Indikator pompa dosing pH-Down.', nilai: (fw) => (fw.out.down ? 'ON' : 'OFF') },
  r_drain: { grup: 'aktuator', nama: 'Resistor 220 Ω', peran: 'Seri LED drain', fungsi: 'Pembatas arus LED beban relay drain.', nilai: () => '220 Ω' },
  r_inlet: { grup: 'aktuator', nama: 'Resistor 220 Ω', peran: 'Seri LED inlet', fungsi: 'Pembatas arus LED beban relay inlet.', nilai: () => '220 Ω' },
  r_ph_up: { grup: 'aktuator', nama: 'Resistor 220 Ω', peran: 'Seri LED pH-Up', fungsi: 'Pembatas arus LED beban relay pH-Up.', nilai: () => '220 Ω' },
  r_ph_down: { grup: 'aktuator', nama: 'Resistor 220 Ω', peran: 'Seri LED pH-Down', fungsi: 'Pembatas arus LED beban relay pH-Down.', nilai: () => '220 Ω' },
};

// Komponen utama yang tampil di daftar (resistor & LED beban digabung ke induknya)
export const ANAK = {
  sensor_tds: ['led_mosfet_tds', 'r_mosfet_tds'],
  led_interlock_red: ['r_interlock'],
  relay_drain_poc: ['r_drain', 'led_drain_poc'],
  relay_inlet_clean: ['r_inlet', 'led_inlet_clean'],
  relay_dosing_ph_up: ['r_ph_up', 'led_ph_up'],
  relay_dosing_ph_down: ['r_ph_down', 'led_ph_down'],
};
const SEMUA_ANAK = new Set(Object.values(ANAK).flat());
export const INDUK = Object.fromEntries(Object.entries(ANAK).flatMap(([i, a]) => a.map((x) => [x, i])));

export function daftarPerGrup() {
  return GRUP.map((g) => ({
    ...g,
    item: diagram.parts.filter((p) => INFO[p.id]?.grup === g.id && !SEMUA_ANAK.has(p.id)).map((p) => p.id),
  }));
}

// Koneksi yang menyentuh part tertentu → "SIG → ESP32 34"
export function koneksiPart(id) {
  return diagram.connections
    .filter(([a, b]) => a.startsWith(`${id}:`) || b.startsWith(`${id}:`))
    .map(([a, b, warna]) => {
      const [sini, sana] = a.startsWith(`${id}:`) ? [a, b] : [b, a];
      return { pin: sini.split(':')[1], ke: sana, warna };
    });
}

// Peta pin ESP32 yang dipakai sketch
export const PETA_PIN = [
  { gpio: PIN.PH, mode: 'ADC in', ke: 'sensor_ph:SIG', fungsi: 'analogRead pH ×14/4095', grup: 'sensor' },
  { gpio: PIN.TDS, mode: 'ADC in', ke: 'sensor_tds:SIG', fungsi: 'analogRead TDS ×1000/4095', grup: 'sensor' },
  { gpio: PIN.TDS_MOSFET, mode: 'OUT', ke: 'r_mosfet_tds → LED', fungsi: 'MOSFET TDS 150 ms/loop', grup: 'sensor' },
  { gpio: PIN.TEMP_DHT, mode: '1-wire', ke: 'sensor_temp_water:SDA', fungsi: 'DHT22 readTemperature()', grup: 'sensor' },
  { gpio: PIN.TRIG, mode: 'OUT', ke: 'HC-SR04 TRIG', fungsi: 'Pulsa 10 µs', grup: 'sensor' },
  { gpio: PIN.ECHO, mode: 'IN', ke: 'HC-SR04 ECHO', fungsi: 'pulseIn → jarak cm', grup: 'sensor' },
  { gpio: PIN.SDA, mode: 'I²C', ke: 'oled_status:SDA', fungsi: 'Data OLED 0x3C', grup: 'mcu' },
  { gpio: PIN.SCL, mode: 'I²C', ke: 'oled_status:SCL', fungsi: 'Clock OLED', grup: 'mcu' },
  { gpio: PIN.BTN_FEED, mode: 'IN_PULLUP', ke: 'btn_manual_feed:1.l', fungsi: 'LOW = Feed ditekan', grup: 'safety' },
  { gpio: PIN.BUZZER, mode: 'OUT', ke: 'buzzer_interlock:1', fungsi: 'tone 1200 Hz 300 ms', grup: 'safety' },
  { gpio: PIN.LED_LOCK, mode: 'OUT', ke: 'r_interlock → LED LOCK', fungsi: 'HIGH = feedLocked', grup: 'safety' },
  { gpio: PIN.SERVO, mode: 'PWM', ke: 'servo_autofeeder:PWM', fungsi: 'write(90) buka / write(0) tutup', grup: 'safety' },
  { gpio: PIN.RELAY_DRAIN, mode: 'OUT', ke: 'relay_drain_poc:IN', fungsi: 'Kuras → tangki POC', grup: 'aktuator' },
  { gpio: PIN.RELAY_INLET, mode: 'OUT', ke: 'relay_inlet_clean:IN', fungsi: 'Isi air bersih', grup: 'aktuator' },
  { gpio: PIN.RELAY_PH_UP, mode: 'OUT', ke: 'relay_dosing_ph_up:IN', fungsi: 'Dosing pH-Up', grup: 'aktuator' },
  { gpio: PIN.RELAY_PH_DOWN, mode: 'OUT', ke: 'relay_dosing_ph_down:IN', fungsi: 'Dosing pH-Down', grup: 'aktuator' },
];

export const WARNA_KABEL = {
  red: '#e0393e', black: '#2b2b2b', cyan: '#19c3d6', blue: '#2f6fe0', green: '#21a35b', orange: '#f08a24',
  gold: '#d4a017', violet: '#8b5cf6', magenta: '#d63ca6', purple: '#9333ea', yellow: '#eab308',
};
