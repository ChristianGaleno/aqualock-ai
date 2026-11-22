// Ikon garis sederhana (SVG), mengikuti warna teks di sekitarnya
const Svg = ({ children, size = 16, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
);

export const IkonKunci = (p) => (
  <Svg {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>
);
export const IkonBuka = (p) => (
  <Svg {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></Svg>
);
export const IkonCek = (p) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></Svg>);
export const IkonSeru = (p) => (<Svg {...p}><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17h.01" /></Svg>);
export const IkonStop = (p) => (<Svg {...p}><path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z" /><path d="M12 8v5M12 16h.01" /></Svg>);
export const IkonOff = (p) => (<Svg {...p}><path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01" /><path d="M3 3l18 18" /></Svg>);
export const IkonWifi = (p) => (<Svg {...p}><path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01" /></Svg>);
export const IkonPlay = (p) => (<Svg {...p}><path d="M7 4v16l13-8z" fill="currentColor" /></Svg>);
export const IkonPause = (p) => (<Svg {...p}><path d="M7 4v16M17 4v16" /></Svg>);
export const IkonReset = (p) => (<Svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></Svg>);
export const IkonSuara = (p) => (<Svg {...p}><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16 9a4 4 0 0 1 0 6" /></Svg>);
export const IkonBisu = (p) => (<Svg {...p}><path d="M4 9v6h4l5 4V5L8 9z" /><path d="m17 9 4 6M21 9l-4 6" /></Svg>);

export function IkonState({ nada, size = 14 }) {
  if (nada === 'baik') return <IkonCek size={size} />;
  if (nada === 'serius') return <IkonSeru size={size} />;
  if (nada === 'kritis') return <IkonStop size={size} />;
  return <IkonOff size={size} />;
}
