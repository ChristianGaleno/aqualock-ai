// Si Aqua — Maskot hybrid AQUA-LOCK AI:
// kepala/wajah lele berkumis + badan udang bersegmen + buntut/ekor ikan
export default function Maskot({ ukuran = 72, melambai = true, className = '' }) {
  return (
    <svg
      className={`maskot ${melambai ? 'melambai' : ''} ${className}`}
      width={ukuran}
      height={ukuran}
      viewBox="0 0 210 210"
      role="img"
      aria-label="Si Aqua, maskot hybrid AQUA-LOCK AI berkepala lele berkumis, berbadan udang bersegmen, dan berbuntut ikan"
    >
      <defs>
        {/* Gradasi kepala lele (abu-biru slate khas lele) */}
        <linearGradient id="hyb-lele" x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%" stopColor="#5e87a3" />
          <stop offset="56%" stopColor="#355a75" />
          <stop offset="100%" stopColor="#213b52" />
        </linearGradient>
        {/* Gradasi badan udang bersegmen (oranye-coral cerah) */}
        <linearGradient id="hyb-udang" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#ffa575" />
          <stop offset="58%" stopColor="#f1653c" />
          <stop offset="100%" stopColor="#d44324" />
        </linearGradient>
        <linearGradient id="hyb-udang2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff8e5c" />
          <stop offset="100%" stopColor="#c93c1f" />
        </linearGradient>
        {/* Gradasi buntut/ekor ikan bercabang (biru-teal cerah) */}
        <linearGradient id="hyb-ekor-ikan" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#28c7cc" />
          <stop offset="55%" stopColor="#0E75BB" />
          <stop offset="100%" stopColor="#1b3a6b" />
        </linearGradient>
      </defs>

      {/* Antena IoT di puncak kepala lele */}
      <line x1="80" y1="68" x2="80" y2="24" stroke="#0E75BB" strokeWidth="4" strokeLinecap="round" />
      <circle cx="80" cy="20" r="6.2" fill="#00969B" />
      <path d="M66 13 a18 18 0 0 1 28 0" stroke="#21979F" strokeWidth="3.2" fill="none" strokeLinecap="round" className="mk-sinyal" />
      <path d="M58 6 a28 28 0 0 1 44 0" stroke="#0E75BB" strokeWidth="3.2" fill="none" strokeLinecap="round" className="mk-sinyal mk-sinyal2" />

      {/* ===== 3. BUNTUT / EKOR IKAN BERCABANG (kanan belakang) ===== */}
      <g>
        <path
          d="M150 144 Q176 116 200 108 Q188 136 180 150 Q190 164 198 190 Q172 180 148 158 Z"
          fill="url(#hyb-ekor-ikan)"
          stroke="#0b558a"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* Tulang sirip ekor ikan */}
        <path
          d="M158 148 L188 122 M162 151 L176 150 M158 154 L186 178"
          stroke="#cbf7f9"
          strokeWidth="2.1"
          strokeLinecap="round"
          opacity="0.72"
        />
      </g>

      {/* ===== 2. BADAN UDANG BERSEGMEN MELENGKUNG (tengah) ===== */}
      {/* Kaki renang (pleopod) udang di bawah ruas perut */}
      <g stroke="#d44324" strokeWidth="4.2" fill="none" strokeLinecap="round">
        <path d="M108 164 q4 15 12 20" />
        <path d="M122 162 q6 14 14 18" />
        <path d="M136 158 q7 12 13 15" />
      </g>

      {/* Ruas 3 (paling belakang, menyambung ke buntut ikan) */}
      <ellipse cx="150" cy="148" rx="15.5" ry="20" transform="rotate(44 150 148)" fill="url(#hyb-udang2)" stroke="#b83419" strokeWidth="2" />
      {/* Ruas 2 (tengah) */}
      <ellipse cx="139" cy="133" rx="22" ry="28" transform="rotate(26 139 133)" fill="url(#hyb-udang)" stroke="#b83419" strokeWidth="2" />
      {/* Ruas 1 (pangkal badan udang di belakang kepala lele) */}
      <ellipse cx="122" cy="120" rx="28" ry="36" transform="rotate(10 122 120)" fill="url(#hyb-udang2)" stroke="#b83419" strokeWidth="2" />

      {/* Kilau karapas pada ruas-ruas udang */}
      <path d="M125 94 q12 8 16 20 M142 114 q9 8 12 18" stroke="#ffd8c2" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* Capit / kaki udang kanan yang melambai */}
      <g className="mk-sirip">
        <path
          d="M126 134 q22 -12 30 -30 q-4 -6 -10 -4 q-4 6 -8 8 q-2 -6 -8 -4 q-6 12 -12 18 z"
          fill="url(#hyb-udang)"
          stroke="#b83419"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </g>

      {/* ===== 1. KEPALA / WAJAH LELE BERKUMIS (depan kiri-tengah) ===== */}
      {/* Sirip dada kecil kiri */}
      <path d="M36 132 q-18 8 -20 22 q14 2 26 -9 z" fill="#2b4d66" />

      {/* Kumis lele kanan (melengkung ke atas-samping & bawah) */}
      <path d="M120 112 C142 98, 158 84, 162 64" stroke="#223c52" strokeWidth="4.2" fill="none" strokeLinecap="round" />
      <path d="M120 122 C142 124, 154 134, 152 146" stroke="#355a75" strokeWidth="3.1" fill="none" strokeLinecap="round" />

      {/* Kumis lele kiri (4 pasang kumis lele yang ekspresif) */}
      <path d="M36 112 C14 102, 4 86, 10 66" stroke="#223c52" strokeWidth="4.2" fill="none" strokeLinecap="round" />
      <path d="M38 122 C16 126, 8 136, 12 148" stroke="#355a75" strokeWidth="3.1" fill="none" strokeLinecap="round" />
      <path d="M44 130 C28 140, 22 152, 28 162" stroke="#476e8a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M114 130 C130 140, 136 150, 132 160" stroke="#476e8a" strokeWidth="2.4" fill="none" strokeLinecap="round" />

      {/* Bentuk kepala lele membulat lebar */}
      <ellipse cx="80" cy="115" rx="49" ry="44" fill="url(#hyb-lele)" />

      {/* Kilau halus dahi lele */}
      <path d="M52 84 q28 -12 56 -2" stroke="#9ac0d9" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.55" />

      {/* Dagu & dada cerah krem-biru */}
      <ellipse cx="80" cy="138" rx="34" ry="21" fill="#edf6fa" />

      {/* Mata ramah */}
      <ellipse cx="62" cy="103" rx="13" ry="14.5" fill="#fff" />
      <ellipse cx="98" cy="103" rx="13" ry="14.5" fill="#fff" />
      <circle cx="65" cy="105" r="7.2" fill="#14233f" />
      <circle cx="95" cy="105" r="7.2" fill="#14233f" />
      <circle cx="67.5" cy="101.5" r="2.6" fill="#fff" />
      <circle cx="97.5" cy="101.5" r="2.6" fill="#fff" />

      {/* Pipi merona & senyum lebar khas lele ramah */}
      <ellipse cx="46" cy="121" rx="7.2" ry="4.2" fill="#ffbfa8" opacity="0.78" />
      <ellipse cx="114" cy="121" rx="7.2" ry="4.2" fill="#ffbfa8" opacity="0.78" />
      <path d="M64 122 q16 12 32 0" stroke="#14233f" strokeWidth="3.5" fill="#d94f64" strokeLinecap="round" />

      {/* Lambang gembok Safety Interlock di dada */}
      <rect x="70" y="137" width="20" height="16" rx="4" fill="#0E75BB" />
      <path d="M74.5 137 v-4.5 a5.5 5.5 0 0 1 11 0 v4.5" stroke="#00969B" strokeWidth="3" fill="none" />
      <circle cx="80" cy="144.8" r="2.6" fill="#edf6fa" />
    </svg>
  );
}
