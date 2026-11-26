<p align="center">
  <img src="public/logo-full.png" alt="AQUA-LOCK AI Logo" width="340" />
</p>

Conversation Log
# AQUA-LOCK AI — 3D Digital Twin & Simulator Dashboard (IDTC 2.0 AIoT)

Aplikasi web React + 3D Digital Twin untuk demo prototipe Fase 2 **AQUA-LOCK AI**:
pemantauan & kontrol **Kolam 3D**, **Skematik 3D Wokwi** interaktif (25 komponen & 58 koneksi kabel),
**Klaster 4 Kolam** dengan kolam kembar pembanding, **Mode Multi-Komoditas** (default **Udang**,
serta **Nila**, **Lele**, **Patin**), **Safety Interlock** 3 lapis, **FSM 3 status**,
model **XGBoost** risiko amonia bebas (NH3), kalibrasi terpandu, aliran **MQTT lokal**,
dan asisten remote control **Si Aqua Bot**.

---

## Menjalankan

Pastikan berada di direktori proyek yang berisi `package.json` (`aqualock-ai/`):

```bash
cd aqualock-ai
npm install
npm run dev        # buka http://localhost:5173
npm run build      # hasil: dist/index.html (1 file tunggal via vite-plugin-singlefile, bisa dibuka offline tanpa server)
npm run preview    # pratinjau hasil build produksi secara lokal
```

### Melatih ulang model XGBoost (opsional)

```bash
pip install xgboost scikit-learn pandas numpy
npm run dataset            # node ml/generate_dataset.mjs → menghasilkan ml/dataset.csv (120 hari sintetis)
npm run train              # python3 ml/train_xgboost.py → menghasilkan src/sim/xgb_model.js, ml/model_aqualock.json, ml/sampel_uji.csv
node ml/cek_model_js.mjs   # pastikan selisih prediksi JS vs Python ≈ 0 (dijalankan setelah npm run train)
```

> Catatan Windows: jika perintah `python3` tidak tersedia di PATH, jalankan `python ml/train_xgboost.py` secara langsung.

Untuk uji cepat dinamika fisika & FSM di terminal tanpa UI (opsional):

```bash
node ml/uji_dinamika.mjs [nama_skenario]   # contoh: pakanBerlebih, hujan, bloom, mpuHang
```

### Simulasi Wokwi (opsional)

Folder `wokwi/` berisi firmware C++ ESP32 (`sketch.ino`), rangkaian (`diagram.json`), dan daftar library (`libraries.txt`)
yang dapat dibuka di Wokwi Simulator. Logika firmware tersebut juga sudah diemulasikan langsung di browser pada tampilan
**Kolam 3D** dan **Skematik 3D Wokwi** lewat `src/node/firmware.js`.

---

## Tampilan & Fitur Utama

- **Kolam 3D** *(tampilan awal)*: Digital twin 1 kolam bundar Ø3 m berbasis React Three Fiber yang terhubung langsung ke emulator firmware ESP32 (`NodeFirmware`), lengkap dengan Box Panel IP65 (OLED SSD1306, tombol Manual Feed, LED LOCK, buzzer 1200 Hz), Rak Probe Sensor, Corong Auto Feeder + servo + partikel pelet, pompa drain/inlet, IBC Tank POC (1.000 L), stasiun dosing pH-Up/Down, slider sensor real-time, 6 preset uji state, serta mode **X-Ray Wiring ESP32**.
- **Skematik 3D Wokwi**: Visualisasi rangkaian 3D interaktif langsung dari `wokwi/diagram.json` (25 komponen, 58 jalur kabel jumper ortogonal, filter 4 subsistem, toggle kabel daya `3V3/5V/GND`, peta 16 GPIO live, Serial Monitor 115200 baud, dan penampil kode `wokwi/sketch.ino`).
- **Klaster 4 Kolam**: Digital twin 4 kolam bundar Ø3 m + Master Gateway (Arduino Uno Q) + Tangki POC + Tandon air bersih + kolam kembar pembanding (timer biasa tanpa interlock). Dilengkapi siklus siang–malam, hujan, timelapse 24 jam / 7 hari, tur 2 menit Si Aqua, 8 skenario uji juri, kalibrasi terpandu, dan panel kanan bagian 1–8.
- **Model AI & Arsitektur MQTT** *(menu Sistem di bilah atas)*: Tab **Model AI** untuk uji interaktif *"bagaimana jika…"*, kurva risiko vs pH, feature importance, dan confusion matrix; serta tab **Arsitektur & MQTT** untuk diagram 4 lapisan komunikasi dan inspeksi paket MQTT lokal secara real-time.
- **Mode Multi-Komoditas & Booting 30 Detik**: Pilihan profil **Udang (Utama)**, **Ikan Nila**, **Ikan Lele**, dan **Ikan Patin** di bilah atas. Pergantian mode memicu fase `BOOTING` selama 30 detik (keputusan pakan & transisi FSM ditahan sementara) dan menyediakan tombol **Skip Booting →**.
- **Si Aqua Bot**: Chatbot remote control di pojok kanan bawah untuk mengecek kondisi sensor/klaster, mengganti komoditas, *skip booting*, memberi pakan jarak jauh, mengubah parameter sensor/padat tebar, mengaktifkan X-Ray, memicu skenario/timelapse, dan mengosongkan tangki POC.

---

## Struktur & Isi Tiap File

| File / Folder | Isi | Bab PRD / Peran |
|---|---|---|
| `src/App.jsx` | Shell utama: navigasi 3 tampilan 3D + 2 tab sistem, pengalih komoditas, overlay booting 30 dtk, loop klaster, tur, shortcut keyboard | F6 |
| `src/sim/constants.js` | Profil multi-komoditas (default Udang + Nila, Lele, Patin), durasi booting 30 dtk, batas aktuator, tangki POC, interval sistem | F2, F3, F4, Bab 7 & 9 |
| `src/sim/chemistry.js` | Rumus Emerson (fraksi NH3), pola suhu & pH harian, kalibrasi pH `pH = m·V + c`, kompensasi TDS `V/(1+0,02(T−25))`, regresi linear | Bab 6 |
| `src/sim/model.js` | Inference XGBoost murni JavaScript (`prediksiProba`: jumlah nilai daun float32 → sigmoid) | F2 |
| `src/sim/xgb_model.js` | Hasil ekspor 80 pohon keputusan XGBoost, `base_margin`, metrik evaluasi, dan gain feature importance | F2 |
| `src/sim/ai.js` | Ekstraksi 6 fitur, estimasi risiko NH3, porsi `100/50/0%`, prediksi pH +30 mnt, deteksi anomali tren & data datar, durasi dosing | F2, F5 |
| `src/sim/engine.js` | `Simulator`: fisika air, kolam kembar pembanding, Sequential Reading, FSM, Safety Interlock, booting 30 dtk, watchdog drain 180 dtk, tangki POC, MQTT, skenario | F1, F3, F4, Bab 9 |
| `src/node/firmware.js` | `NodeFirmware`: emulator baris-per-baris `wokwi/sketch.ino` di browser dengan adaptasi profil komoditas, mode booting, OLED & JSON serial | F1, F3, F4 |
| `src/node/NodeView.jsx` | Kanvas React Three Fiber + kontrol kamera/filter untuk mode **Kolam 3D** dan **Skematik 3D Wokwi** | F6 |
| `src/node/SceneKolam.jsx` | Adegan 3D kolam bundar tunggal (box panel IP65, rak sensor, feeder + pelet, IBC POC, dosing pH, mode X-Ray kabel GPIO) | F6 |
| `src/node/SceneSkematik.jsx` | Render skematik 3D langsung dari `wokwi/diagram.json` (25 komponen & 58 kabel jumper ortogonal dengan animasi pulsa sinyal) | F6 |
| `src/node/PanelNode.jsx` | Panel kanan mode Node 3D: 4 tab (*Kontrol & Uji*, *Aktuator & FSM*, *Komponen 3D*, *Serial & Kode*) + Mini OLED SSD1306 | F6 |
| `src/node/komponen.js`, `oled.js`, `bagian3d.jsx` | Metadata part & peta 16 GPIO dari `diagram.json`, tekstur kanvas OLED 128×64, serta primitif kabel/pipa/partikel 3D | F6 |
| `src/twin/Scene3D.js` | `TwinScene` (three.js): digital twin klaster 4 kolam, node, feeder, pipa drain/inlet, tangki POC, gateway, hujan, siang–malam | F6 |
| `src/twin/Panel.jsx` | Panel kanan klaster bagian 1–8 (ringkasan, sensor, AI, interlock, FSM, POC, skenario & dampak, kalibrasi) | F6 |
| `src/twin/konten.js` | Teks narasi bagian 1–8 & naskah tur 2 menit adaptif Si Aqua sesuai komoditas aktif | – |
| `src/twin/Maskot.jsx` | Maskot hybrid Si Aqua (muka lele berkumis + badan udang bersegmen + buntut ikan, SVG) | – |
| `src/ui/Chatbot.jsx`, `botEngine.js` | Widget & mesin NLP sederhana **Si Aqua Bot** untuk kendali dan pantau Node 3D maupun Klaster 4 Kolam | F6 |
| `src/ui/*` | Komponen dashboard: `PondCard`, `DetailKolam`, `Gateway`, `Charts`, `SidePanels`, `Logs`, `KalibrasiTab`, `ModelTab`, `ArsitekturTab`, `Icons`, `format` | F2–F6 |
| `ml/generate_dataset.mjs` | Generator dataset sintetis 120 hari dari `Simulator` untuk pelatihan model NH3 | Sprint 2 |
| `ml/train_xgboost.py` | Pelatihan + evaluasi split waktu 80/20 + ekspor ke `src/sim/xgb_model.js` dan `ml/model_aqualock.json` | Sprint 2 |
| `ml/cek_model_js.mjs`, `uji_dinamika.mjs` | Uji kecocokan prediksi JS vs Python dan uji dinamika simulator via CLI | Sprint 2 |
| `wokwi/sketch.ino`, `diagram.json`, `libraries.txt` | Firmware C++ ESP32 asli, skema wiring Wokwi (25 part, 58 koneksi), dan daftar library | F1, F3, F4 |

---

## Shortcut saat Demo

- **Global**: `Esc` menutup modal (**Model AI** / **Arsitektur & MQTT**), menghentikan tur, atau menutup layar intro.
- **Khusus mode Klaster 4 Kolam**:
  `T` mulai/hentikan tur 2 menit · `Enter` tutup layar intro · `L` timelapse 24 jam · `H` bersihkan/tampilkan label & KPI · `Spasi` jeda/lanjut simulasi · `1`–`8` buka panel bagian 1–8 · `←` / `→` langkah tur sebelumnya/berikutnya.

---

## Alur Data 

### A. Arsitektur Klaster 4 Kolam (`src/sim/engine.js`)

1. **ESP32 Node** membaca sensor secara berurutan (*Sequential Reading*): MOSFET TDS ON → stabil → baca TDS → MOSFET OFF → jeda isolasi → baca pH → baca suhu DS18B20 (`bacaSensor`).
2. Tiap 30 detik waktu simulasi, node mem-publish JSON ke topik `aqualock/kolam{n}/sensor` (MQTT lokal QoS 1).
3. **MPU Linux** (Arduino Uno Q) menghitung 6 fitur → inferensi XGBoost → probabilitas risiko NH3 → keputusan porsi `100% / 50% / 0%` + prediksi tren pH (`evaluasiAI`), lalu mem-publish ke `aqualock/kolam{n}/ai`.
4. **FSM** memutuskan status (`langkahFsm`): `NORMAL` / `CLEANING` / `PH_RECOVERY` dengan **debounce 2 evaluasi** berturut-turut (dan ditahan saat mode `BOOTING` 30 dtk).
5. Perintah dikirim ke `aqualock/kolam{n}/cmd`; status `feed_lock` disimpan redundan di **MPU**, **STM32**, dan **ESP32**. Topik `aqualock/kolam{n}/status` (LWT retain) dan `aqualock/system/profile` menjaga sinkronisasi status node & profil komoditas.
6. Tombol **Manual Feed** saat terkunci → ditolak (`< 200 ms`), servo diam, buzzer bunyi, event dipublish ke `aqualock/kolam{n}/event` (`tekanPakanManual`).
7. **Watchdog & Failsafe**: Watchdog ESP32 menutup katup drain otomatis setelah `180 dtk`; jika MPU Linux reboot/hang (`> 60 dtk` tanpa heartbeat), ESP32 mengaktifkan kunci pakan lokal dan STM32 tetap memegang interlock tombol fisik.

### B. Emulasi Node Tunggal & Wokwi (`src/node/firmware.js` & `wokwi/sketch.ino`)

- Setiap loop: `GPIO25` menyalakan MOSFET TDS `150 ms` → baca ADC TDS `GPIO35` → matikan MOSFET + jeda `100 ms` → baca ADC pH `GPIO34` & suhu `GPIO4` → kompensasi TDS `2%/°C` → ukur level ultrasonik HC-SR04 (`GPIO5/18`) → evaluasi FSM & Hard Safety Interlock (`GPIO14` tombol, `GPIO19` buzzer 1200 Hz, `GPIO23` LED LOCK, `GPIO13` servo feeder, `GPIO26/27/32/33` relay aktuator) → update OLED SSD1306 (`0x3C`, `GPIO21/22`) dan cetak telemetri JSON `115200 baud`.
- Catatan: pada `wokwi/sketch.ino` statis digunakan ambang standar (`TDS > 600 ppm`, `pH 6,5–8,2`, `suhu < 24 °C`) dengan sensor DHT22 & potensiometer simulasi Wokwi; pada `src/node/firmware.js` di web, ambang tersebut mengikuti profil komoditas yang dipilih di dashboard (default **Udang**).

---

## Hasil Model (Data Uji 20% Hari Terakhir)

Lihat tab **Model AI** atau `src/sim/xgb_model.js` (`metrik` & `kepentingan`). Pada versi model saat ini (80 pohon, `max_depth = 3`, latih `110.592` baris, uji `27.648` baris dengan `794` kasus NH3 > 0,05 mg/L):

- **F1-score**: `0,887` (target PRD ≥ 0,88)
- **Precision**: `0,925` · **Recall**: `0,853` · **Accuracy**: `0,994`
- **Confusion matrix**: `[[26799, 55], [117, 677]]`
- **Feature importance (gain)**: `ph` (`69,0%`), `tds` (`11,7%`), `suhu` (`7,6%`), `jam` (`6,6%`), `pakan_6j` (`4,3%`), `ph_delta` (`0,8%`)

---

## Penyesuaian Dibanding PRD v1.0

- **Fitur ke-6 `pakan_6j`**: total pakan 6 jam terakhir (% biomassa) dari log servo (Business Case §4 menyebut *"riwayat pakan"*, tetapi F2 hanya menulis 5 fitur). Menaikkan F1 validasi.
- **Tindakan berdasarkan penyebab**: ketika risiko NH3 ≥ `RISIKO_LOCK` (`0,70` untuk Udang/Nila, `0,75` Lele, `0,68` Patin) disertai pH tinggi (`> 8,1` pada Udang, `> 7,8` pada Nila, `> 7,7` pada Lele/Patin) → masuk `PH_RECOVERY` (turunkan pH) terlebih dulu, bukan kuras. Fraksi NH3 bebas sangat bergantung pH, sehingga kuras 15% kurang efektif bila pemicunya lonjakan pH (mis. ledakan alga).
- **Histeresis pH**: keluar `PH_RECOVERY` hanya saat pH masuk zona aman dalam (`7,2–8,3` pada Udang; `6,7–8,0` pada Nila; `6,7–7,8` pada Lele/Patin) agar status tidak bolak-balik.
- **Tangki POC**: default **IBC Tank 1.000 L** (opsi **Drum HDPE 200 L** tersedia di panel tangki). Kolam Ø3 m tinggi air 60 cm (≈ 4.241 L) sekali kuras 15% ≈ 636 L, sehingga drum 200 L hanya menampung ±⅓ volume sekali kuras; kuras ditunda jika ruang tangki `< 50 L`.
- **Dashboard & 3D Twin**: dibangun dengan React + Three.js / React Three Fiber (PRD menyebut Streamlit), ditambah mode multi-komoditas (default Udang), booting patokan 30 dtk, Skematik 3D Wokwi, dan Si Aqua Bot.

---

## Asumsi Simulasi

- Parameter biologis & fisika air pada `src/sim/engine.js` dan `src/sim/constants.js` — antara lain laju ekskresi TAN (`28 g/kg` pakan dicerna & `20 g/kg` lumpur terurai), laju penyerapan bioflok/nitrifikasi (`1,0/jam`), dekomposisi lumpur (`0,05/jam`), pemekatan bottom drain (`3,5×`), efek pompa dosing (`±0,12 pH/detik`, homogenisasi 10 menit), padat tebar/bobot/rasio pakan tiap komoditas (default Udang: `2.000 ekor × 45 g`, `3,2%` biomassa), serta penurunan nafsu makan biota — merupakan **asumsi simulasi**.
- Label bahaya `NH3 > 0,05 mg/L` (`> 0,06 mg/L` pada profil Lele) serta ambang batas pH/TDS/suhu per komoditas juga merupakan keputusan simulasi tim.
- Seluruh parameter dan model XGBoost wajib dikalibrasi ulang serta divalidasi dengan uji kit amonia dan data lapangan di kolam mitra sebelum digunakan pada budidaya nyata.
