// Log kejadian sistem & aliran pesan MQTT (JSON) antar node, master, dashboard
import { useState } from 'react';
import { labelWaktu, jamMenit } from './format.js';

const LEVEL = {
  info: { label: 'Info', kelas: 'lv-info' },
  aman: { label: 'Aman', kelas: 'lv-baik' },
  peringatan: { label: 'Waspada', kelas: 'lv-peringatan' },
  kritis: { label: 'Kritis', kelas: 'lv-kritis' },
  tolak: { label: 'Ditolak', kelas: 'lv-kritis' },
};

export function LogKejadian({ sim, idPilih }) {
  const [hanyaPilih, setHanyaPilih] = useState(false);
  const daftar = sim.log.filter((l) => !hanyaPilih || l.kolam === idPilih || l.kolam === null).slice(0, 60);
  return (
    <section className="kartu log">
      <div className="blok-kepala">
        <h4>Log kejadian</h4>
        <label className="saklar">
          <input type="checkbox" checked={hanyaPilih} onChange={(e) => setHanyaPilih(e.target.checked)} />
          Hanya Kolam {idPilih}
        </label>
      </div>
      <ol className="log-daftar">
        {daftar.map((l) => (
          <li key={l.id}>
            <time>{jamMenit(l.t)}</time>
            <span className={`lv ${LEVEL[l.level].kelas}`}>{LEVEL[l.level].label}</span>
            <span className="log-teks">{l.kolam ? <b>K{l.kolam} </b> : null}{l.teks}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function AliranMqtt({ sim, jumlah = 14 }) {
  const [filter, setFilter] = useState('semua');
  const daftar = sim.mqtt.filter((m) => filter === 'semua' || m.topik.endsWith(filter)).slice(0, jumlah);
  return (
    <section className="kartu mqtt">
      <div className="blok-kepala">
        <h4>Aliran MQTT lokal</h4>
        <select aria-label="Filter topik" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="semua">Semua topik</option>
          <option value="/sensor">…/sensor</option>
          <option value="/ai">…/ai</option>
          <option value="/cmd">…/cmd</option>
          <option value="/event">…/event</option>
          <option value="/status">…/status (LWT)</option>
        </select>
      </div>
      <ol className="mqtt-daftar">
        {daftar.map((m) => (
          <li key={m.id}>
            <div className="mqtt-meta">
              <time title={labelWaktu(m.t)}>{jamMenit(m.t)}</time>
              <code className="topik">{m.topik}</code>
              <span className="arah">{m.arah} · QoS {m.qos}{m.retain ? ' · retain' : ''}</span>
            </div>
            <code className="payload">{typeof m.payload === 'string' ? m.payload : JSON.stringify(m.payload)}</code>
          </li>
        ))}
      </ol>
    </section>
  );
}
