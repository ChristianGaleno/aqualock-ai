// =============================================================
// Chatbot.jsx — Asisten Bot Si Aqua (maskot hybrid: muka lele
// berkumis, badan udang bersegmen, buntut ikan) untuk kontrol &
// monitoring kolam budidaya dari jarak jauh.
// =============================================================
import { useEffect, useRef, useState } from 'react';
import Maskot from '../twin/Maskot.jsx';
import { SARAN_KLASTER, SARAN_NODE, prosesPerintahBot } from './botEngine.js';

// Render teks ringan dengan bold (**teks**) dan baris baru
function TeksBot({ teks }) {
  return teks.split('\n').map((baris, i) => (
    <p key={i}>
      {baris.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((seg, j) => {
        if (seg.startsWith('**') && seg.endsWith('**')) return <strong key={j}>{seg.slice(2, -2)}</strong>;
        if (seg.startsWith('*') && seg.endsWith('*')) return <em key={j}>{seg.slice(1, -1)}</em>;
        return seg;
      })}
    </p>
  ));
}

export default function Chatbot({ ruang, adaAlert, ctx }) {
  const [buka, setBuka] = useState(false);
  const [input, setInput] = useState('');
  const [pesan, setPesan] = useState([
    {
      id: 1,
      dari: 'bot',
      teks: 'Halo pemilik! Aku **Si Aqua Bot** (maskot hybrid: muka lele berkumis, badan udang, buntut ikan). Mode default aktif: **Udang** 🦐. Ketik perintah apa saja — cek sensor, beri pakan aman, ganti mode komoditas (*"mode nila"*, *"mode lele"*, *"mode patin"*), *"skip booting"*, atau kuras ke tangki POC.',
      aksi: '● Terhubung ke ESP32 & Gateway',
    },
  ]);
  const akhirRef = useRef(null);
  const idRef = useRef(2);

  useEffect(() => {
    if (buka) akhirRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pesan, buka]);

  function kirim(teksKirim) {
    const isi = (teksKirim ?? input).trim();
    if (!isi) return;
    const idUser = idRef.current++;
    const hasil = prosesPerintahBot(isi, ctx);
    const idBot = idRef.current++;
    setPesan((lama) => [
      ...lama.slice(-30),
      { id: idUser, dari: 'user', teks: isi },
      { id: idBot, dari: 'bot', teks: hasil.teks, aksi: hasil.aksi, nada: hasil.nada },
    ]);
    if (teksKirim === undefined) setInput('');
  }

  function saatSubmit(e) {
    e.preventDefault();
    kirim();
  }

  const saran = ruang === 'klaster' ? SARAN_KLASTER : SARAN_NODE;

  return (
    <div className={`bot-wrap ${buka ? 'terbuka' : ''}`}>
      {buka && (
        <section className="bot-panel" aria-label="Chatbot Remote Control Si Aqua">
          <header className="bot-kepala">
            <div className="bot-profil">
              <Maskot ukuran={36} melambai={false} />
              <div>
                <strong>Si Aqua Bot · Mode {ctx?.profil?.nama || 'Udang'}</strong>
                <span><i className="bot-online" />Kontrol langsung dari luar</span>
              </div>
            </div>
            <button type="button" className="bot-tutup" onClick={() => setBuka(false)} aria-label="Tutup chatbot">✕</button>
          </header>

          <div className="bot-pesan" role="log" aria-live="polite">
            {pesan.map((m) => (
              <div key={m.id} className={`bot-gelembung ${m.dari}`}>
                <TeksBot teks={m.teks} />
                {m.aksi && <span className={`bot-aksi-pil ${m.nada || ''}`}>{m.aksi}</span>}
              </div>
            ))}
            <div ref={akhirRef} />
          </div>

          <div className="bot-saran" aria-label="Perintah cepat">
            {saran.map((s) => (
              <button key={s} type="button" onClick={() => kirim(s)}>{s}</button>
            ))}
          </div>

          <form className="bot-form" onSubmit={saatSubmit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Ketik: "mode lele", "skip booting", "cek status"...'
              aria-label="Ketik perintah untuk Si Aqua Bot"
            />
            <button type="submit" disabled={!input.trim()}>Kirim</button>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`bot-fab ${buka ? 'aktif' : ''}`}
        onClick={() => setBuka((v) => !v)}
        aria-expanded={buka}
        aria-label={buka ? 'Tutup Si Aqua Bot' : 'Buka Si Aqua Bot Remote Control'}
      >
        <Maskot ukuran={34} melambai={!buka} />
        <span>{buka ? 'Tutup Bot' : 'Si Aqua Bot'}</span>
        {adaAlert && !buka && <i className="bot-alert-dot" title="Ada peringatan Safety Interlock" />}
      </button>
    </div>
  );
}
