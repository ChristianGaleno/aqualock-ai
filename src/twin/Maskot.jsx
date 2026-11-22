// Si Kumis — maskot ikan lele pemandu tur AQUA-LOCK (desain orisinal tim)
export default function Maskot({ ukuran = 120, melambai = true, className = '' }) {
  return (
    <svg className={`maskot ${melambai ? 'melambai' : ''} ${className}`} width={ukuran} height={ukuran} viewBox="0 0 200 210" role="img" aria-label="Si Kumis, maskot ikan lele dengan antena IoT">
      <defs>
        <linearGradient id="mk-badan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7c86a8" />
          <stop offset="1" stopColor="#56607f" />
        </linearGradient>
      </defs>
      {/* ekor */}
      <path d="M140 170 q38 -6 46 -34 q-22 6 -30 0 q6 -20 -6 -30 q-6 26 -24 40 z" fill="#4b5472" />
      {/* sirip punggung */}
      <path d="M70 62 q30 -34 64 -4 q-10 2 -16 8 q-14 -10 -28 -6 q-10 -2 -20 2 z" fill="#4b5472" />
      {/* antena IoT */}
      <line x1="100" y1="48" x2="100" y2="18" stroke="#1b2a5e" strokeWidth="4" strokeLinecap="round" />
      <circle cx="100" cy="14" r="7" fill="#e26d2c" />
      <path d="M86 6 a18 18 0 0 1 28 0" stroke="#1f8fa6" strokeWidth="3.5" fill="none" strokeLinecap="round" className="mk-sinyal" />
      <path d="M78 -1 a28 28 0 0 1 44 0" stroke="#1f8fa6" strokeWidth="3.5" fill="none" strokeLinecap="round" className="mk-sinyal mk-sinyal2" />
      {/* badan */}
      <ellipse cx="100" cy="122" rx="66" ry="72" fill="url(#mk-badan)" />
      <ellipse cx="100" cy="150" rx="42" ry="38" fill="#efe6d4" />
      {/* sirip dada */}
      <path d="M38 132 q-26 4 -30 24 q16 -2 34 -10 z" fill="#4b5472" />
      <g className="mk-sirip">
        <path d="M162 128 q30 -12 32 -36 q-18 4 -36 22 z" fill="#4b5472" />
      </g>
      {/* mata */}
      <ellipse cx="76" cy="100" rx="17" ry="19" fill="#fff" />
      <ellipse cx="124" cy="100" rx="17" ry="19" fill="#fff" />
      <circle cx="79" cy="103" r="9" fill="#1b2a5e" />
      <circle cx="121" cy="103" r="9" fill="#1b2a5e" />
      <circle cx="82" cy="99" r="3.2" fill="#fff" />
      <circle cx="124" cy="99" r="3.2" fill="#fff" />
      {/* pipi & mulut */}
      <ellipse cx="62" cy="126" rx="9" ry="5" fill="#f2a08a" opacity="0.7" />
      <ellipse cx="138" cy="126" rx="9" ry="5" fill="#f2a08a" opacity="0.7" />
      <path d="M82 128 q18 16 36 0" stroke="#1b2a5e" strokeWidth="4" fill="#c8566b" strokeLinecap="round" />
      {/* kumis lele */}
      <g stroke="#2b3148" strokeWidth="3.2" fill="none" strokeLinecap="round">
        <path d="M84 124 q-30 -6 -58 -22 q-8 -4 -12 2" />
        <path d="M84 130 q-30 10 -52 30" />
        <path d="M116 124 q30 -6 58 -22 q8 -4 12 2" />
        <path d="M116 130 q30 10 52 30" />
      </g>
      {/* tanda di perut: gembok kecil */}
      <rect x="88" y="150" width="24" height="18" rx="4" fill="#1b2a5e" />
      <path d="M93 150 v-5 a7 7 0 0 1 14 0 v5" stroke="#1b2a5e" strokeWidth="3.5" fill="none" />
      <circle cx="100" cy="158" r="3" fill="#efe6d4" />
    </svg>
  );
}
