// Diagram arsitektur Distributed Cluster (Hub & Node) dengan status langsung
import { AliranMqtt } from './Logs.jsx';
import { infoState } from './format.js';

const LAPISAN = [
  ['Hardware', 'Sensor & aktuator ↔ ESP32 / STM32', '1-Wire, I2C, ADC (ADS1115 16-bit), PWM, GPIO', 'Akuisisi presisi, servo & relay, MOSFET pemutus TDS, OLED'],
  ['Network', 'ESP32 node ↔ Arduino Uno Q', 'Wi-Fi AP lokal + MQTT (JSON, QoS 1, LWT)', 'Data multi-kolam & perintah dua arah tanpa internet; LWT mendeteksi node mati'],
  ['Internal bus', 'MPU Linux ↔ MCU STM32', 'IPC / Serial Bridge (RPC)', 'Keputusan AI disinkronkan ke lock fisik, OLED, buzzer'],
  ['Application', 'Uno Q ↔ HP/Tablet', 'HTTP REST + WebSocket', 'Dashboard lokal, grafik real-time, pakan manual, kalibrasi'],
];

const TOPIK = [
  ['aqualock/kolam{n}/sensor', 'node → master', 'pH, TDS, suhu, level tiap 30 dtk'],
  ['aqualock/kolam{n}/cmd', 'master → node', 'state, feed_lock, drain, inlet, dosis, servo'],
  ['aqualock/kolam{n}/ai', 'master → dashboard', 'risiko NH3, porsi, prediksi pH'],
  ['aqualock/kolam{n}/event', 'node → master', 'penolakan tombol, watchdog'],
  ['aqualock/kolam{n}/status', 'broker (LWT, retain)', 'online / offline otomatis'],
];

function Kotak({ x, y, w, h, judul, baris = [], kelas = '' }) {
  return (
    <g className={`ars-kotak ${kelas}`}>
      <rect x={x} y={y} width={w} height={h} rx="8" />
      <text x={x + 12} y={y + 22} className="ars-judul">{judul}</text>
      {baris.map((b, i) => <text key={i} x={x + 12} y={y + 42 + i * 17} className="ars-teks">{b}</text>)}
    </g>
  );
}

function Chip({ x, y, w, teks }) {
  return (
    <g className="ars-chip">
      <rect x={x} y={y} width={w} height="24" rx="5" />
      <text x={x + w / 2} y={y + 16} textAnchor="middle">{teks}</text>
    </g>
  );
}

export default function ArsitekturTab({ sim }) {
  const hang = sim.t < sim.master.hangSampai;
  const yNode = [24, 134, 244, 354];
  return (
    <div className="tab-isi">
      <div className="baris-atas">
        <div>
          <h2>Arsitektur Distributed Cluster</h2>
          <p className="catatan">1 Master Gateway mengelola 4 Sensor Node. Semua inferensi, database, dan dashboard berjalan lokal: biaya cloud Rp 0/bulan.</p>
        </div>
      </div>
      <section className="kartu">
        <div className="ars-wrap">
          <svg viewBox="0 0 1000 536" className="ars" role="img" aria-label="Diagram arsitektur AQUA-LOCK AI: empat node ESP32 terhubung lewat MQTT ke Arduino Uno Q, yang terhubung ke HP pembudidaya">
            {sim.kolam.map((k, i) => {
              const info = infoState(k, sim);
              const y = yNode[i];
              const kelasLink = !k.online ? 'link-putus' : hang ? 'link-diam' : 'link-aktif';
              return (
                <g key={k.id}>
                  <path d={`M 250 ${y + 45} C 330 ${y + 45}, 340 ${150 + i * 40}, 430 ${150 + i * 40}`} className={`ars-link ${kelasLink}`} />
                  <Kotak x={20} y={y} w={230} h={92} judul={`ESP32 · ${k.nama}`}
                    baris={['pH-4502C · TDS+MOSFET · DS18B20', 'JSN-SR04T · ADS1115', 'Servo · 2 solenoid · 2 pompa']}
                    kelas={`nada-${info.nada}`} />
                  <circle cx={234} cy={y + 16} r="6" className={`ars-titik titik-${info.nada}`} />
                </g>
              );
            })}
            <text x={262} y={16} className="ars-label">Wi-Fi AP lokal · MQTT JSON · QoS 1 · LWT</text>

            <g className="ars-master">
              <rect x={430} y={24} width={340} height={430} rx="12" />
              <text x={446} y={50} className="ars-judul">Master Gateway · Arduino Uno Q 4GB</text>
            </g>
            <Kotak x={446} y={64} w={308} h={200} judul="MPU Dragonwing · Linux Debian" kelas={hang ? 'nada-mati' : ''} />
            <Chip x={462} y={100} w={136} teks="Mosquitto broker" />
            <Chip x={606} y={100} w={136} teks={`XGBoost · ${hang ? 'HANG' : 'aktif'}`} />
            <Chip x={462} y={132} w={136} teks="SQLite log" />
            <Chip x={606} y={132} w={136} teks="FastAPI + WebSocket" />
            <Chip x={462} y={164} w={280} teks="Dashboard React · FSM · kalibrasi" />
            <text x={462} y={214} className="ars-teks">Inferensi AI tiap 30 dtk per kolam</text>
            <text x={462} y={232} className="ars-teks">Prediksi tren pH & durasi dosing</text>
            <path d="M 600 264 L 600 300" className={`ars-link ${hang ? 'link-diam' : 'link-aktif'}`} />
            <text x={610} y={287} className="ars-label">IPC / Serial Bridge</text>
            <Kotak x={446} y={300} w={308} h={140} judul="MCU STM32U585 · real-time" />
            <Chip x={462} y={336} w={136} teks="OLED 1,3 inci" />
            <Chip x={606} y={336} w={136} teks="Tombol Manual Feed" />
            <Chip x={462} y={368} w={136} teks="Buzzer alarm" />
            <Chip x={606} y={368} w={136} teks="feed_lock fisik" />
            <text x={462} y={420} className="ars-teks">Tetap jalan saat Linux hang/reboot</text>

            <path d="M 770 160 L 820 160" className={`ars-link ${hang ? 'link-diam' : 'link-aktif'}`} />
            <Kotak x={820} y={100} w={160} h={120} judul="HP / Tablet" baris={['Pak Hendra & Kang Dedi', 'HTTP REST', 'WebSocket real-time']} />

            <Kotak x={20} y={464} w={410} h={60} judul={`Tangki POC bersama · ${sim.tangki.nama}`}
              baris={[`Isi ${Math.round(sim.tangki.isiL)} L · dari bottom drain tiap kolam`]} />
            {yNode.map((y, i) => <path key={i} d={`M 20 ${y + 70} H 8`} className="ars-pipa" />)}
            <path d={`M 8 ${yNode[0] + 70} V 494 H 20`} className="ars-pipa" />
          </svg>
        </div>
        <p className="catatan">Garis bergerak = pesan MQTT mengalir. Garis abu di kiri = pipa bottom drain ke tangki POC. Garis putus merah = node offline (LWT). Abu-abu = MPU sedang hang, STM32 tetap memegang kunci pakan. Diagram ini bisa dipakai sebagai Gambar 2 di proposal.</p>
      </section>
      <div className="dua-kolom">
        <section className="kartu">
          <div className="blok-kepala"><h4>Lapisan komunikasi</h4></div>
          <div className="tabel-wrap">
            <table className="tabel">
              <thead><tr><th scope="col">Lapisan</th><th scope="col">Jalur</th><th scope="col">Protokol</th><th scope="col">Tujuan</th></tr></thead>
              <tbody>{LAPISAN.map((l) => <tr key={l[0]}>{l.map((c, i) => (i === 0 ? <th scope="row" key={i}>{c}</th> : <td key={i}>{c}</td>))}</tr>)}</tbody>
            </table>
          </div>
          <div className="blok-kepala"><h4>Topik MQTT</h4></div>
          <div className="tabel-wrap">
            <table className="tabel">
              <tbody>{TOPIK.map((t) => <tr key={t[0]}><th scope="row"><code>{t[0]}</code></th><td>{t[1]}</td><td>{t[2]}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <AliranMqtt sim={sim} jumlah={18} />
      </div>
    </div>
  );
}
