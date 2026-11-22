// Grafik tren (PRD F6) — satu grafik per besaran (tanpa sumbu ganda).
// Area berwarna di latar = periode kunci pakan (CLEANING / PH_RECOVERY).
import { memo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceArea,
} from 'recharts';
import { jamMenit, angka } from './format.js';

function segmenKunci(data) {
  const seg = [];
  let mulai = null, state = null;
  data.forEach((d, i) => {
    const kunci = d.state !== 'NORMAL';
    if (kunci && mulai === null) { mulai = d.t; state = d.state; }
    if ((!kunci || i === data.length - 1) && mulai !== null) {
      seg.push({ x1: mulai, x2: d.t, state });
      mulai = null;
    }
  });
  return seg;
}

function KontenTooltip({ active, payload, satuan, desimal }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="tooltip-grafik">
      <span>{jamMenit(d.t)}</span>
      <strong>{angka(payload[0].value, desimal)} {satuan}</strong>
      {d.state !== 'NORMAL' && <em>{d.state}</em>}
    </div>
  );
}

function TrendChart({ judul, data, kunci, satuan, desimal = 0, domain, ticks, batas = [], pita }) {
  const akhir = data.length ? data[data.length - 1][kunci] : null;
  const seg = segmenKunci(data);
  return (
    <figure className="grafik">
      <figcaption>
        <span>{judul}</span>
        <strong className="angka-mono">{angka(akhir, desimal)}<small> {satuan}</small></strong>
      </figcaption>
      <div className="grafik-area">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            {seg.map((s, i) => (
              <ReferenceArea key={i} x1={s.x1} x2={s.x2} ifOverflow="hidden"
                fill={s.state === 'CLEANING' ? 'var(--kritis)' : 'var(--serius)'} fillOpacity={0.1} strokeOpacity={0} />
            ))}
            {pita && <ReferenceArea y1={pita[0]} y2={pita[1]} fill="var(--baik)" fillOpacity={0.06} strokeOpacity={0} />}
            {batas.map((b) => (
              <ReferenceLine key={b.y} y={b.y} stroke={b.warna} strokeWidth={1}
                label={{ value: b.label, position: 'insideTopLeft', fill: 'var(--ink-3)', fontSize: 10 }} />
            ))}
            <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={jamMenit}
              tick={{ fontSize: 10, fill: 'var(--ink-3)' }} stroke="var(--grid)" tickCount={5} />
            <YAxis domain={domain} ticks={ticks} tick={{ fontSize: 10, fill: 'var(--ink-3)' }} stroke="var(--grid)" width={46}
              tickFormatter={(v) => angka(v, desimal > 1 ? 1 : desimal)} allowDataOverflow />
            <Tooltip content={<KontenTooltip satuan={satuan} desimal={desimal} />} cursor={{ stroke: 'var(--ink-3)', strokeWidth: 1 }} />
            <Line type="monotone" dataKey={kunci} stroke="var(--seri)" strokeWidth={2} dot={false}
              isAnimationActive={false} connectNulls={false} activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export default memo(TrendChart, (a, b) => a.data === b.data);
