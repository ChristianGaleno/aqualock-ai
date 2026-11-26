<p align="center">
  <img src="public/logo-full.png" alt="AQUA-LOCK AI Logo" width="340" />
</p>

Conversation Log
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
