// =============================================================
// botEngine.js — Otak Asisten Chatbot Remote Control AQUA-LOCK AI
// Memahami perintah bahasa Indonesia pemilik yang sedang di luar
// dan langsung mengeksekusi pengaturan pada Digital Twin 3D (Node)
// maupun Klaster 4 Kolam secara real-time.
// =============================================================

const angkaDalam = (teks, pola) => {
  const m = teks.match(pola);
  if (!m) return null;
  const v = Number(m[1].replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

const nomorKolam = (teks, bawaan = 1) => {
  const m = teks.match(/kolam\s*(\d)/i) || teks.match(/\bk(\d)\b/i);
  if (!m) return bawaan;
  const id = Number(m[1]);
  return id >= 1 && id <= 4 ? id : bawaan;
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));


export const SARAN_NODE = [
  'Cek status kolam',
  'Mode lele',
  'Mode udang',
  'Skip booting',
  'Beri pakan sekarang',
  'Kuras kolam ke POC',
  'Normalisasi kolam',
  'Buka X-Ray wiring',
];

export const SARAN_KLASTER = [
  'Cek status 4 kolam',
  'Mode nila',
  'Mode udang',
  'Skip booting',
  'Beri pakan kolam 1',
  'Set tebar 2200 ekor',
  'Kosongkan tangki POC',
  'Timelapse 24 jam',
];

export function prosesPerintahBot(masukan, ctx) {
  const asli = masukan.trim();
  const q = asli.toLowerCase();
  const { ruang, node, klaster, aksiUi, profil, booting, gantiKomoditas, skipBooting } = ctx;
  const modeNode = ruang !== 'klaster';
  const namaKom = profil?.nama || 'Udang';
  const ambang = profil?.ambang || { PH_MIN: 7.0, PH_MAX: 8.5, TDS_MAX: 600, SUHU_DINGIN: 26 };

  // -------- 0. Ganti Mode Komoditas & Skip Booting --------
  if (/(skip|lewati|percepat).*(boot|booting|tunggu|muat)/.test(q) || q === 'skip') {
    if (!booting) {
      return { teks: `Saat ini tidak ada proses booting. Mode **${namaKom}** sudah aktif.`, aksi: null };
    }
    skipBooting?.();
    return {
      teks: '⚡ **Booting dilewati (Skip Booting)!** Patokan komoditas baru langsung aktif sekarang dan keputusan pakan kembali siap.',
      aksi: '✓ Skip Booting → Aktif',
      nada: 'ok',
    };
  }
  const mKom = q.match(/(?:mode|ganti|pilih|ubah|pakai|komoditas)\s*(?:ke\s*)?(udang|nila|lele|patin)\b/)
    || q.match(/^(udang|nila|lele|patin)$/);
  if (mKom && gantiKomoditas) {
    const id = mKom[1];
    if (!booting && profil?.id === id) {
      return { teks: `Mode **${namaKom}** sudah aktif sekarang.`, aksi: `ℹ Mode ${namaKom}` };
    }
    gantiKomoditas(id);
    const label = id.charAt(0).toUpperCase() + id.slice(1);
    return {
      teks: `🔄 Memulai **booting patokan mode ${label} (30 detik)**… Selama booting, keputusan pakan & aktuator ditahan sementara. Ketik **"skip booting"** atau klik tombol **Skip Booting** di layar untuk langsung mengaktifkannya.`,
      aksi: `⏳ Booting ${label} (30 dtk)`,
      nada: 'blok',
    };
  }

  // -------- 1. Bantuan / Menu --------
  if (/^(help|bantuan|menu|perintah|bisa apa|halo|hai|hi|pagi|siang|sore|malam)\b/.test(q) && q.length < 35) {
    return {
      teks: modeNode
        ? `Halo! Aku **Si Aqua Bot** (maskot hybrid: muka lele berkumis, badan udang, buntut ikan). Mode aktif: **${namaKom}** ${profil?.ikon || ''}.\n• "mode udang" / "mode nila" / "mode lele" / "mode patin" / "skip booting"\n• "cek status kolam" / "mode pergi" / "beri pakan sekarang"\n• "set pH 6.2" / "set TDS 750" / "set suhu 23" / "normalisasi"\n• "kuras kolam ke POC" / "kosongkan tangki POC" / "buka X-Ray"`
        : `Halo! Aku **Si Aqua Bot** (maskot hybrid: muka lele berkumis, badan udang, buntut ikan). Mode aktif: **${namaKom}** ${profil?.ikon || ''}.\n• "mode udang" / "mode nila" / "mode lele" / "mode patin" / "skip booting"\n• "cek status 4 kolam" / "cek kolam 2" / "mode pergi"\n• "beri pakan kolam 1" / "set tebar 2200" / "set pakan 3%"\n• "kosongkan tangki POC" / "simulasi hujan" / "timelapse 24 jam"`,
      aksi: null,
    };
  }

  // -------- 2. Navigasi ruang / modal --------
  if (/(buka|lihat|tampilkan|pindah).*(skematik|wokwi|wiring 3d)/.test(q)) {
    aksiUi.setLembar(null);
    aksiUi.setRuang('skematik');
    return { teks: 'Tampilan dipindahkan ke **Skematik 3D Wokwi** (25 komponen & 58 kabel jumper hidup).', aksi: '✓ Tampilan → Skematik 3D Wokwi' };
  }
  if (/(buka|lihat|tampilkan|pindah).*(klaster|4 kolam|empat kolam)/.test(q)) {
    aksiUi.setLembar(null);
    aksiUi.setRuang('klaster');
    return { teks: `Tampilan dipindahkan ke **Klaster 4 Kolam** (mode **${namaKom}**).`, aksi: '✓ Tampilan → Klaster 4 Kolam' };
  }
  if (/(buka|lihat|tampilkan|pindah).*(kolam 3d|digital twin)/.test(q)) {
    aksiUi.setLembar(null);
    aksiUi.setRuang('kolam');
    return { teks: 'Tampilan dipindahkan ke **Digital Twin Kolam 3D**.', aksi: '✓ Tampilan → Kolam 3D' };
  }
  if (/(buka|lihat).*(model ai|xgboost)/.test(q)) {
    aksiUi.setLembar('model');
    return { teks: 'Panel **Model AI (XGBoost Risiko Amonia)** dibuka.', aksi: '✓ Buka Model AI' };
  }
  if (/(buka|lihat).*(arsitektur|mqtt)/.test(q)) {
    aksiUi.setLembar('arsitektur');
    return { teks: 'Panel **Arsitektur & MQTT** dibuka.', aksi: '✓ Buka Arsitektur & MQTT' };
  }
  if (/x-?ray/.test(q)) {
    const mati = /(mati|tutup|off|nonaktif)/.test(q);
    if (!modeNode) aksiUi.setRuang('kolam');
    node?.setXray(!mati);
    return {
      teks: mati ? 'Mode X-Ray wiring ESP32 dimatikan.' : 'Mode **X-Ray Wiring ESP32** diaktifkan — kabel GPIO ke semua sensor & relay kini terlihat menembus box panel.',
      aksi: mati ? '✓ X-Ray → OFF' : '✓ X-Ray → ON',
    };
  }

  // -------- 3. Mode Pemilik di Luar / Auto-Guard --------
  if (/(keluar|di luar|mode pergi|pergi|tinggal|jaga otomatis|pantau|auto guard|amanin|mode aman)/.test(q)) {
    if (modeNode && node) {
      node.setFisika(true);
      const st = node.status();
      const peringatanPoc = st.pocL > 800 ? ' ⚠️ Tangki POC hampir penuh (>80%), sebaiknya kosongkan dulu.' : '';
      return {
        teks: `**Mode Jaga Otomatis aktif!** Kamu bisa tenang di luar:\n• Fisika & kontrol otomatis ESP32: **AKTIF**\n• State saat ini: **${st.state}** (${st.feedLocked ? 'Safety Interlock MENGUNCI pakan' : `pakan siap ${st.feedPortion}%`})\n• pH **${st.ph.toFixed(2)}** · TDS **${st.tds.toFixed(0)} ppm** · Suhu **${st.temp.toFixed(1)} °C** · POC **${st.pocL.toFixed(0)}/1000 L**.${peringatanPoc}`,
        aksi: '✓ Mode Jaga Otomatis → AKTIF',
      };
    }
    klaster.setJalan(true);
    const r = klaster.ringkasan();
    const peringatan = r.terkunci > 0 ? `Ada ${r.terkunci} kolam sedang dikunci otomatis oleh Safety Interlock.` : `Semua 4 kolam ${namaKom.toLowerCase()} dalam kondisi aman.`;
    return {
      teks: `**Mode Jaga Otomatis Klaster aktif!** Simulasi & pengawas AI tetap berjalan saat kamu di luar:\n• ${peringatan}\n• Risiko NH₃ tertinggi: **${r.risikoMaks.toFixed(2)}** (Kolam ${r.kolamRisiko})\n• Tangki POC: **${Math.round(r.pocIsi)} / ${r.pocKap} L** (${r.pocPersen}%).`,
      aksi: '✓ Auto-Guard Klaster → AKTIF',
    };
  }

  // -------- 4. Kosongkan / Ganti Tangki POC --------
  if (/(kosong|panen|bersihkan|buang).*(poc|tangki|limbah)/.test(q)) {
    if (modeNode && node) {
      const sebelum = node.status().pocL;
      node.kosongkanPoc();
      return {
        teks: `Tangki IBC Limbah POC berhasil dikosongkan dari **${sebelum.toFixed(0)} L → 0 L**. Siap menampung hasil kuras berikutnya!`,
        aksi: '✓ Tangki POC → 0 L',
      };
    }
    const sebelum = klaster.ringkasan().pocIsi;
    klaster.kosongkanTangki();
    return {
      teks: `Tangki POC klaster berhasil dikosongkan dari **${Math.round(sebelum)} L → 0 L** (siap dipanen sebagai pupuk cair).`,
      aksi: '✓ Tangki POC Klaster → 0 L',
    };
  }
  if (/drum\s*200|tangki\s*200/.test(q)) {
    klaster.gantiTangki('drum200');
    return { teks: 'Kapasitas tangki POC klaster diubah ke **Drum 200 L**.', aksi: '✓ Tangki POC → Drum 200 L' };
  }
  if (/ibc\s*1000|tangki\s*1000/.test(q)) {
    klaster.gantiTangki('ibc1000');
    return { teks: 'Kapasitas tangki POC klaster diubah ke **IBC Tank 1.000 L**.', aksi: '✓ Tangki POC → IBC 1.000 L' };
  }

  // -------- 5. Beri Pakan / Manual Feed Jarak Jauh --------
  if (/(kasih makan|beri pakan|pakan manual|trigger feed|\bfeed\b|tebar pakan)/.test(q) && !/rasio|harian|%/.test(q)) {
    if (booting) {
      return {
        teks: `⏳ **Keputusan pakan DITAHAN sementara!** Sistem sedang booting patokan mode baru (**sisa ${Math.ceil(booting.sisaDtk)} dtk**). Tunggu hingga selesai atau ketik *"skip booting"*.`,
        aksi: `⏳ Ditahan · Booting ${Math.ceil(booting.sisaDtk)}s`,
        nada: 'blok',
      };
    }
    if (modeNode && node) {
      const ev = node.tekanFeed();
      if (ev?.jenis === 'FEED_BLOCKED') {
        return {
          teks: `🔒 **Pakan DITOLAK oleh Safety Interlock!**\nState saat ini **${ev.state}**. Servo tetap dikunci di 0° dan buzzer 1200 Hz berbunyi agar sisa pakan tidak menumpuk di dasar dan ${namaKom.toLowerCase()} tidak keracunan amonia. Ketik *"normalisasi kolam"* atau tunggu recovery selesai.`,
          aksi: `🔒 FEED_BLOCKED (${ev.state})`,
          nada: 'blok',
        };
      }
      return {
        teks: `✅ **Pakan berhasil diberikan dari jarak jauh!**\nServo membuka katup 90° dengan porsi **${ev?.portion ?? 100}%** (${(ev?.portion ?? 100) === 100 ? '1,2 detik' : '0,6 detik'}) untuk ${namaKom.toLowerCase()} tanpa overfeeding.`,
        aksi: `✓ FEED_OK (Porsi ${ev?.portion ?? 100}%)`,
        nada: 'ok',
      };
    }
    const id = nomorKolam(q, klaster.idPilih);
    const h = klaster.beriPakan(id);
    if (!h.diterima) {
      return {
        teks: `🔒 **Pakan Kolam ${id} DITOLAK oleh Safety Interlock!**\nAlasan: ${h.alasan || 'kualitas air belum aman'}. Servo tetap terkunci (latensi ${h.latensiMs} ms).`,
        aksi: `🔒 Kolam ${id} Ditolak`,
        nada: 'blok',
      };
    }
    return {
      teks: `✅ **Pakan Kolam ${id} berhasil ditebar dari jarak jauh!** Porsi aktif sesuai rekomendasi AI.`,
      aksi: `✓ Kolam ${id} Diberi Pakan`,
      nada: 'ok',
    };
  }

  // -------- 6. Pengaturan Klaster: Jumlah Tebar & Rasio Pakan --------
  if (/(set|atur|ubah|ganti).*(udang|nila|lele|patin|ikan|ekor|padat|tebar)/.test(q) || /\b(\d{3,4})\s*ekor\b/.test(q)) {
    const n = angkaDalam(q, /(\d{3,4})/);
    if (n !== null) {
      const val = Math.round(clamp(n, 1000, 3000) / 100) * 100;
      klaster.aturIkan(val);
      return {
        teks: `Padat tebar ${namaKom.toLowerCase()} (asumsi simulasi) di klaster diatur ke **${val.toLocaleString('id-ID')} ekor/kolam**. Perhitungan biomassa dan risiko amonia langsung menyesuaikan.`,
        aksi: `✓ ${namaKom} → ${val.toLocaleString('id-ID')} ekor/kolam`,
      };
    }
  }
  if (/(rasio|pakan harian|persen|biomassa)/.test(q) || /(set|atur|ubah).*(pakan)\s*(\d)/.test(q)) {
    const p = angkaDalam(q, /(\d+(?:[.,]\d+)?)\s*%?/);
    if (p !== null && p >= 1 && p <= 6) {
      const val = Math.round(clamp(p, 1.5, 4.0) * 10) / 10;
      klaster.aturRasio(val);
      return {
        teks: `Rasio pakan harian diatur ke **${val.toFixed(1)}% biomassa**.`,
        aksi: `✓ Pakan harian → ${val.toFixed(1)}%`,
      };
    }
  }

  // -------- 7. Pengaturan Parameter Sensor & Aktuator (Node 3D) --------
  const valPh = angkaDalam(q, /ph\s*(?:ke|jadi|=|:|\s)?\s*(\d+(?:[.,]\d+)?)/);
  if (valPh !== null && /ph/.test(q)) {
    const v = clamp(valPh, 4.0, 10.0);
    if (!modeNode) aksiUi.setRuang('kolam');
    // Jika user eksplisit minta dosing saat TDS masih tinggi, normalkan TDS agar PH_RECOVERY aktif
    const st = (/dosing|ph.?up|ph.?down/.test(q) && (node?.status().tds ?? 0) > 600)
      ? node?.terapkanPreset({ ph: v, tdsRaw: 380, temp: 28, distCm: 30 })
      : node?.setParam('ph', v);
    const ket = st?.state === 'CLEANING'
      ? `Catatan: TDS masih > ${ambang.TDS_MAX} ppm sehingga state tetap CLEANING.`
      : v < ambang.PH_MIN ? 'Relay **pH-Up** aktif meneteskan larutan basa & pakan dikunci.'
      : v > ambang.PH_MAX ? 'Relay **pH-Down** aktif meneteskan larutan asam & pakan dikunci.'
      : `pH berada di rentang aman simulasi ${namaKom} (${ambang.PH_MIN}–${ambang.PH_MAX}).`;
    return {
      teks: `pH kolam diatur ke **${v.toFixed(2)}**. State FSM: **${st?.state ?? 'NORMAL'}**. ${ket}`,
      aksi: `✓ pH → ${v.toFixed(2)} (${st?.state ?? ''})`,
    };
  }
  const valTds = angkaDalam(q, /tds\s*(?:ke|jadi|=|:|\s)?\s*(\d+(?:[.,]\d+)?)/);
  if (valTds !== null && /tds/.test(q)) {
    const v = clamp(valTds, 100, 900);
    if (!modeNode) aksiUi.setRuang('kolam');
    const st = node?.setParam('tdsRaw', v);
    return {
      teks: `TDS mentah diatur ke **${v.toFixed(0)} ppm** (terkompensasi suhu: **${st?.tds.toFixed(0)} ppm**). State FSM: **${st?.state}**.`,
      aksi: `✓ TDS → ${st?.tds.toFixed(0)} ppm (${st?.state})`,
    };
  }
  const valSuhu = angkaDalam(q, /(?:suhu|temp|temperatur)\s*(?:ke|jadi|=|:|\s)?\s*(\d+(?:[.,]\d+)?)/);
  if (valSuhu !== null && /(suhu|temp|derajat)/.test(q)) {
    const v = clamp(valSuhu, 20, 34);
    if (!modeNode) aksiUi.setRuang('kolam');
    const st = node?.setParam('temp', v);
    return {
      teks: `Suhu air diatur ke **${v.toFixed(1)} °C**. ${v < ambang.SUHU_DINGIN ? `Karena < ${ambang.SUHU_DINGIN} °C (ambang simulasi ${namaKom}), metabolisme melambat sehingga porsi pakan otomatis diturunkan ke **50%**.` : `Suhu berada pada rentang optimal simulasi untuk ${namaKom.toLowerCase()}.`}`,
      aksi: `✓ Suhu → ${v.toFixed(1)} °C · Porsi ${st?.feedPortion}%`,
    };
  }
  const valJarak = angkaDalam(q, /(?:jarak|ultrasonik|hc-sr04)\s*(?:ke|jadi|=|:|\s)?\s*(\d+(?:[.,]\d+)?)/);
  if (valJarak !== null) {
    const v = clamp(valJarak, 15, 75);
    if (!modeNode) aksiUi.setRuang('kolam');
    const st = node?.setParam('distCm', v);
    return {
      teks: `Jarak sensor HC-SR04 diatur ke **${v.toFixed(0)} cm** (kedalaman air **${st?.levelCm.toFixed(0)} cm**).`,
      aksi: `✓ Jarak HC-SR04 → ${v.toFixed(0)} cm`,
    };
  }
  const valLevel = angkaDalam(q, /(?:level|tinggi|kedalaman)\s*air\s*(?:ke|jadi|=|:|\s)?\s*(\d+(?:[.,]\d+)?)/);
  if (valLevel !== null) {
    const dist = clamp(110 - valLevel, 15, 75);
    if (!modeNode) aksiUi.setRuang('kolam');
    const st = node?.setParam('distCm', dist);
    return {
      teks: `Tinggi air diatur ke **${st?.levelCm.toFixed(0)} cm** (jarak HC-SR04: **${dist.toFixed(0)} cm**).`,
      aksi: `✓ Level air → ${st?.levelCm.toFixed(0)} cm`,
    };
  }

  // -------- 8. Perintah Cepat Aktuator / State --------
  if (/(kuras|cleaning|drain|bersihkan kolam|buang lumpur)/.test(q)) {
    if (modeNode && node) {
      const pr = profil?.presetNormal || { ph: 7.7, temp: 28.5 };
      node.terapkanPreset({ ph: pr.ph, tdsRaw: ambang.TDS_MAX + 180, temp: pr.temp, distCm: 25 });
      return {
        teks: `State **CLEANING** diaktifkan (patokan ${namaKom}: TDS > ${ambang.TDS_MAX} ppm)! **Relay Drain (GPIO26)** menyala — lumpur dasar dialirkan ke IBC Tank Limbah POC sampai jarak air 45 cm, dan **Safety Interlock** mengunci pakan.`,
        aksi: '✓ CLEANING · Relay Drain ON',
        nada: 'blok',
      };
    }
    const id = nomorKolam(q, klaster.idPilih);
    klaster.skenario('pakanBerlebih', id);
    klaster.pilihKolam(id);
    return {
      teks: `Skenario kuras/TDS tinggi dipicu pada **Kolam ${id}**. Katup bottom drain akan mengalirkan lumpur ke tangki POC dan pakan dikunci otomatis.`,
      aksi: `✓ Kuras dipicu di Kolam ${id}`,
    };
  }
  if (/(isi air|inlet|tambah air|refill)/.test(q)) {
    if (!modeNode) aksiUi.setRuang('kolam');
    const pr = profil?.presetNormal || { ph: 7.7, temp: 28.5 };
    node?.terapkanPreset({ ph: pr.ph, tdsRaw: ambang.TDS_MAX + 150, temp: pr.temp, distCm: 52 });
    return {
      teks: 'Mode pengisian ulang (**Relay Inlet GPIO27**) diaktifkan! Air bersih dari tandon masuk untuk mengencerkan TDS kolam.',
      aksi: '✓ CLEANING · Relay Inlet ON',
    };
  }
  if (/(naikkan ph|ph.?up|dosing basa|air asam)/.test(q)) {
    if (!modeNode) aksiUi.setRuang('kolam');
    const phAsam = +(ambang.PH_MIN - 0.8).toFixed(1);
    node?.terapkanPreset({ ph: phAsam, tdsRaw: 380, temp: 28, distCm: 30 });
    return {
      teks: `State **PH_RECOVERY (pH-Up)** aktif! pH disetel ke **${phAsam.toFixed(2)}** (di bawah batas ${ambang.PH_MIN}), **Relay pH-Up (GPIO32)** meneteskan larutan basa, dan pakan dikunci.`,
      aksi: '✓ PH_RECOVERY · Relay pH-Up ON',
    };
  }
  if (/(turunkan ph|ph.?down|dosing asam|air basa)/.test(q)) {
    if (!modeNode) aksiUi.setRuang('kolam');
    const phBasa = +(ambang.PH_MAX + 0.6).toFixed(1);
    node?.terapkanPreset({ ph: phBasa, tdsRaw: 380, temp: 28, distCm: 30 });
    return {
      teks: `State **PH_RECOVERY (pH-Down)** aktif! pH disetel ke **${phBasa.toFixed(2)}** (di atas batas ${ambang.PH_MAX}), **Relay pH-Down (GPIO33)** meneteskan larutan asam, dan pakan dikunci.`,
      aksi: '✓ PH_RECOVERY · Relay pH-Down ON',
    };
  }
  if (/(normalisasi|normal|pulihkan|stabil|optimal)/.test(q)) {
    if (modeNode && node) {
      const pr = profil?.presetNormal || { ph: 7.7, tdsRaw: 380, temp: 28.5, distCm: 30 };
      node.terapkanPreset({ ...pr });
      return {
        teks: `Kolam dinormalisasi ke kondisi optimal simulasi **${namaKom}** (**pH ${pr.ph.toFixed(2)} · TDS ${pr.tdsRaw} ppm · Suhu ${pr.temp} °C · Air 80 cm**). State **NORMAL**, kunci pakan terbuka (100%).`,
        aksi: `✓ State → NORMAL (${namaKom})`,
        nada: 'ok',
      };
    }
    klaster.reset();
    return {
      teks: 'Klaster 4 kolam di-reset ke kondisi awal yang stabil dan normal.',
      aksi: '✓ Klaster → Normal',
      nada: 'ok',
    };
  }

  // -------- 9. Mode Fisika Otomatis / Tahan Nilai --------
  if (/(tahan nilai|matikan fisika|fisika off)/.test(q)) {
    node?.setFisika(false);
    return { teks: 'Mode **Tahan Nilai** aktif — nilai sensor tidak berubah otomatis sehingga animasi aktuator bisa diamati terus.', aksi: '✓ Fisika Air → Tahan Nilai' };
  }
  if (/(nyalakan fisika|fisika otomatis|fisika on)/.test(q)) {
    node?.setFisika(true);
    return { teks: 'Mode **Fisika Air Otomatis** diaktifkan kembali.', aksi: '✓ Fisika Air → Otomatis' };
  }

  // -------- 10. Kontrol Simulasi & Skenario Klaster --------
  if (/timelapse/.test(q)) {
    const tujuhHari = /7\s*hari|seminggu|168/.test(q);
    if (modeNode) aksiUi.setRuang('klaster');
    klaster.timelapse(tujuhHari ? 168 : 24);
    return {
      teks: `**Timelapse ${tujuhHari ? '7 hari' : '24 jam'}** dimulai di Klaster 4 Kolam.`,
      aksi: `✓ Timelapse ${tujuhHari ? '7 hari' : '24 jam'}`,
    };
  }
  if (/(jeda|pause|hentikan simulasi|stop)/.test(q)) {
    klaster.setJalan(false);
    return { teks: 'Simulasi Klaster 4 Kolam dijeda.', aksi: '✓ Simulasi → Dijeda' };
  }
  if (/(lanjut|jalankan|resume|play)/.test(q)) {
    klaster.setJalan(true);
    return { teks: 'Simulasi Klaster 4 Kolam dijalankan kembali.', aksi: '✓ Simulasi → Berjalan' };
  }
  if (/hujan/.test(q)) {
    if (modeNode) aksiUi.setRuang('klaster');
    klaster.skenario('hujan', 1);
    return { teks: 'Skenario **Hujan Deras** dipicu di Klaster 4 Kolam — perhatikan penurunan pH dan respons dosing pH-Up otomatis.', aksi: '✓ Skenario → Hujan Deras' };
  }
  if (/alga|bloom/.test(q)) {
    const id = nomorKolam(q, klaster.idPilih);
    if (modeNode) aksiUi.setRuang('klaster');
    klaster.pilihKolam(id);
    klaster.skenario('alga', id);
    return { teks: `Skenario **Ledakan Alga** dipicu di **Kolam ${id}** (pH naik siang hari → AI memicu pH-Down).`, aksi: `✓ Ledakan Alga → Kolam ${id}` };
  }
  if (/hang|reboot|gateway/.test(q)) {
    if (modeNode) aksiUi.setRuang('klaster');
    klaster.skenario('mpuHang', 1);
    return { teks: 'Uji **MPU Linux Reboot** dipicu — STM32 tetap memegang kunci Safety Interlock secara mandiri.', aksi: '✓ Uji Failsafe → MPU Hang' };
  }
  if (/fokus\s*kolam\s*(\d)/.test(q)) {
    const id = nomorKolam(q, 1);
    if (modeNode) aksiUi.setRuang('klaster');
    klaster.fokusKolam(id);
    return { teks: `Kamera diarahkan ke **Kolam ${id}**.`, aksi: `✓ Fokus → Kolam ${id}` };
  }
  if (/reset|ulang/.test(q)) {
    if (modeNode && node) {
      node.reset();
      return { teks: 'Node ESP32 & kolam 3D berhasil di-reset ke kondisi awal.', aksi: '✓ Reset Node 3D' };
    }
    klaster.reset();
    return { teks: 'Simulasi Klaster 4 Kolam di-reset ke Hari 1.', aksi: '✓ Reset Klaster' };
  }

  // -------- 11. Cek Status / Laporan Telemetri --------
  if (/(status|cek|laporan|kondisi|gimana|berapa|info|ph|tds|suhu|poc|aman)/.test(q)) {
    const mintaKolam = /kolam\s*[1-4]|\bk[1-4]\b/.test(q);
    if (modeNode && node && !mintaKolam) {
      const s = node.status();
      const rel = [s.drain && 'Drain POC', s.inlet && 'Inlet', s.up && 'pH-Up', s.down && 'pH-Down'].filter(Boolean);
      return {
        teks: `📊 **Laporan Real-Time Kolam 3D:**\n• State FSM: **${s.state}** · Safety Lock: **${s.feedLocked ? 'LOCKED (0%)' : `READY (${s.feedPortion}%)`}**\n• pH: **${s.ph.toFixed(2)}** · TDS: **${s.tds.toFixed(0)} ppm** · Suhu: **${s.temp.toFixed(1)} °C**\n• Level air: **${s.levelCm.toFixed(0)} cm** (HC-SR04 ${s.distCm.toFixed(1)} cm)\n• Tangki POC: **${s.pocL.toFixed(0)} / 1000 L**\n• Relay aktif: **${rel.length ? rel.join(', ') : 'Tidak ada (semua siaga)'}**`,
        aksi: `ℹ ${s.state} · pH ${s.ph.toFixed(2)} · TDS ${s.tds.toFixed(0)}`,
      };
    }
    if (mintaKolam) {
      const id = nomorKolam(q, klaster.idPilih);
      const k = klaster.detailKolam(id);
      return {
        teks: `📊 **Status Kolam ${id} (Klaster):**\n• State: **${k.state}** · Kunci pakan: **${k.terkunci ? 'TERKUNCI' : `Boleh makan (${k.porsi}%)`}**\n• pH: **${k.ph.toFixed(2)}** · TDS: **${Math.round(k.tds)} ppm** · Suhu: **${k.suhu.toFixed(1)} °C**\n• Risiko NH₃ (XGBoost): **${k.risiko.toFixed(2)}**`,
        aksi: `ℹ Kolam ${id} · ${k.state}`,
      };
    }
    const r = klaster.ringkasan();
    const baris = r.daftar.map((d) => `• K${d.id}: **${d.state}** (pH ${d.ph.toFixed(2)}, TDS ${Math.round(d.tds)}, ${d.terkunci ? '🔒' : '✅'})`).join('\n');
    return {
      teks: `📊 **Laporan Klaster 4 Kolam (Hari ${r.hari} · ${r.jam}):**\n${baris}\n• Tangki POC: **${Math.round(r.pocIsi)} / ${r.pocKap} L (${r.pocPersen}%)**`,
      aksi: `ℹ ${r.aman}/4 Aman · POC ${r.pocPersen}%`,
    };
  }

  // Fallback ramah
  return {
    teks: `Maaf, aku belum menangkap perintah *"${asli}"*. Coba tulis misalnya:\n• **"cek status kolam"**\n• **"beri pakan sekarang"** atau **"beri pakan kolam 2"**\n• **"set pH 5.8"**, **"set TDS 750"**, atau **"kuras kolam ke POC"**\n• **"mode pergi"** atau **"kosongkan tangki POC"**`,
    aksi: null,
  };
}
