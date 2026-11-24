// Si Nila — maskot ikan nila merah pemandu tur & asisten AQUA-LOCK AI
export default function Maskot({ ukuran = 72, melambai = true, className = '' }) {
  return (
    <svg
      className={`maskot ${melambai ? 'melambai' : ''} ${className}`}
      width={ukuran}
      height={ukuran}
      viewBox="0 0 210 210"
      role="img"
      aria-label="Si Nila, maskot ikan nila merah dengan antena IoT"
    >
      <defs>
        <linearGradient id="nila-badan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff9563" />
          <stop offset="58%" stopColor="#ec5e37" />
          <stop offset="100%" stopColor="#d44527" />
        </linearGradient>
        <linearGradient id="nila-sirip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff7c4d" />
          <stop offset="100%" stopColor="#c93b21" />
        </linearGradient>
      </defs>

      {/* Antena IoT */}
      <line x1="104" y1="54" x2="104" y2="20" stroke="#0E75BB" strokeWidth="4" strokeLinecap="round" />
      <circle cx="104" cy="16" r="6.5" fill="#00969B" />
      <path d="M90 9 a18 18 0 0 1 28 0" stroke="#21979F" strokeWidth="3.2" fill="none" strokeLinecap="round" className="mk-sinyal" />
      <path d="M82 2 a28 28 0 0 1 44 0" stroke="#0E75BB" strokeWidth="3.2" fill="none" strokeLinecap="round" className="mk-sinyal mk-sinyal2" />

      {/* Sirip ekor kipas lebar khas ikan nila */}
      <path d="M150 132 q36 -28 46 -44 q-5 24 -2 44 q-3 22 4 40 q-18 -12 -48 -24 z" fill="url(#nila-sirip)" />
      <path d="M164 128 l24 -20 M166 136 l26 -2 M164 144 l24 16" stroke="#ffd4bd" strokeWidth="2.2" strokeLinecap="round" opacity="0.65" />

      {/* Sirip punggung berduri memanjang khas ikan nila */}
      <path
        d="M54 76 q10 -24 22 -14 q10 -20 22 -12 q12 -18 24 -8 q12 -14 24 -2 q10 -8 18 8 q-8 14 -24 20 q-44 6 -86 8 z"
        fill="url(#nila-sirip)"
      />

      {/* Sirip perut bawah */}
      <path d="M84 184 q16 18 34 10 q-6 -10 -12 -16 z" fill="#c93b21" />

      {/* Badan oval pipih ikan nila */}
      <ellipse cx="102" cy="126" rx="68" ry="62" fill="url(#nila-badan)" />

      {/* Belang halus khas ikan nila */}
      <g fill="#b93219" opacity="0.18">
        <ellipse cx="64" cy="112" rx="6" ry="30" />
        <ellipse cx="88" cy="108" rx="6.5" ry="34" />
        <ellipse cx="114" cy="108" rx="6.5" ry="34" />
        <ellipse cx="138" cy="114" rx="6" ry="28" />
      </g>

      {/* Perut cerah krem mutiara */}
      <ellipse cx="102" cy="152" rx="46" ry="31" fill="#fff3dc" />

      {/* Sirip dada kiri */}
      <path d="M40 134 q-24 6 -28 24 q18 2 34 -10 z" fill="url(#nila-sirip)" />
      {/* Sirip dada kanan melambai */}
      <g className="mk-sirip">
        <path d="M158 130 q28 -10 32 -32 q-16 4 -34 20 z" fill="url(#nila-sirip)" />
      </g>

      {/* Garis sisik kilau lembut */}
      <path d="M56 102 q8 6 16 0 M132 102 q8 6 16 0" stroke="#ffd8c2" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.55" />

      {/* Mata ramah */}
      <ellipse cx="78" cy="104" rx="15" ry="17" fill="#fff" />
      <ellipse cx="126" cy="104" rx="15" ry="17" fill="#fff" />
      <circle cx="81" cy="106" r="8" fill="#1b2a5e" />
      <circle cx="123" cy="106" r="8" fill="#1b2a5e" />
      <circle cx="84" cy="102" r="3" fill="#fff" />
      <circle cx="126" cy="102" r="3" fill="#fff" />

      {/* Pipi & senyum ceria */}
      <ellipse cx="62" cy="126" rx="8.5" ry="4.8" fill="#ffcdb2" opacity="0.8" />
      <ellipse cx="142" cy="126" rx="8.5" ry="4.8" fill="#ffcdb2" opacity="0.8" />
      <path d="M88 128 q14 13 28 0" stroke="#1b2a5e" strokeWidth="3.8" fill="#d94f64" strokeLinecap="round" />

      {/* Lambang gembok Safety Interlock di perut */}
      <rect x="91" y="151" width="22" height="17" rx="4" fill="#0E75BB" />
      <path d="M96 151 v-5 a6 6 0 0 1 12 0 v5" stroke="#00969B" strokeWidth="3.2" fill="none" />
      <circle cx="102" cy="159" r="2.8" fill="#fff3dc" />
    </svg>
  );
}
