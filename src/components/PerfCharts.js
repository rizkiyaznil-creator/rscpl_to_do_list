"use client";

import { useRef, useEffect } from "react";

// Grafik SVG ringan untuk Performa RS (tanpa pustaka tambahan).
// - Batang <= 24px, ujung atas membulat 4px, tumbuh dari satu garis dasar.
// - Garis 2px, nilai hanya ditampilkan di titik terakhir; hover = tooltip.
// - >= 2 seri: legenda + label langsung di ujung garis.

// Urutan warna kategorikal tetap (tervalidasi untuk buta warna).
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
const GRID = "#e7e5e0";
const AXIS_TEXT = "#64748b";
const INK = "#0f172a";

function niceMax(v) {
  if (!v || v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function useFrame({ values, extra = [], width, height, fmtAxis }) {
  const nums = [...values, ...extra].filter((v) => Number.isFinite(v));
  const max = niceMax(Math.max(0, ...nums) * 1.08);
  const m = { l: 52, r: 56, t: 16, b: 28 };
  const ph = height - m.t - m.b;
  const y = (v) => m.t + ph - (v / max) * ph;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const grid = ticks.map((t) => (
    <g key={t}>
      <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
      <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={AXIS_TEXT}>
        {fmtAxis(t)}
      </text>
    </g>
  ));
  return { m, y, grid, pw: width - m.l - m.r };
}

export function BarChart({ labels, values, fmt, fmtAxis = fmt, height = 220, width = 600, highlightLast = true }) {
  const { m, y, grid, pw } = useFrame({ values, width, height, fmtAxis });
  const band = pw / Math.max(1, values.length);
  const bw = Math.min(24, band * 0.6);
  const lastIdx = values.reduce((li, v, i) => (Number.isFinite(v) ? i : li), -1);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" className="perf-chart">
      {grid}
      {values.map((v, i) => {
        const x = m.l + i * band + (band - bw) / 2;
        const lbl = (
          <text key={`l${i}`} x={x + bw / 2} y={height - 8} textAnchor="middle" fontSize="11" fill={AXIS_TEXT}>
            {labels[i]}
          </text>
        );
        if (!Number.isFinite(v) || v <= 0) return lbl;
        const y0 = y(0);
        const y1 = y(v);
        const r = Math.min(4, (y0 - y1) / 2);
        return (
          <g key={i}>
            <title>{`${labels[i]}: ${fmt(v)}`}</title>
            <rect x={m.l + i * band} y={m.t} width={band} height={y0 - m.t} fill="transparent" />
            <path
              d={`M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 + r} V${y0} Z`}
              fill={SERIES_COLORS[0]}
            />
            {highlightLast && i === lastIdx && (
              <text x={x + bw / 2} y={y1 - 6} textAnchor="middle" fontSize="11.5" fontWeight="700" fill={INK}>
                {fmt(v)}
              </text>
            )}
            {lbl}
          </g>
        );
      })}
    </svg>
  );
}

// series: [{ name, values, color? }]; band: { min, max, label }; target: { value, label }
export function LineChart({ labels, series, fmt, fmtAxis = fmt, band, target, height = 220, width = 600 }) {
  const all = series.flatMap((s) => s.values);
  const extra = [band?.max, band?.min, target?.value].filter((v) => Number.isFinite(v));
  const { m, y, grid, pw } = useFrame({ values: all, extra, width, height, fmtAxis });
  const step = labels.length > 1 ? pw / (labels.length - 1) : 0;
  const xAt = (i) => m.l + i * step;
  const multi = series.length > 1;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" className="perf-chart">
      {band && (
        <g>
          <rect
            x={m.l}
            width={pw}
            y={y(band.max ?? 0)}
            height={y(band.min ?? 0) - y(band.max ?? 0)}
            fill="#e8f1fb"
          />
          <text x={m.l + 6} y={y(band.max ?? 0) + 13} fontSize="10.5" fill="#475569">
            {band.label}
          </text>
        </g>
      )}
      {grid}
      {target && Number.isFinite(target.value) && (
        <g>
          <line x1={m.l} x2={m.l + pw} y1={y(target.value)} y2={y(target.value)} stroke="#475569" strokeWidth="1" />
          <text x={m.l + 6} y={y(target.value) - 5} fontSize="10.5" fill="#475569">
            {target.label}
          </text>
        </g>
      )}
      {labels.map((l, i) => (
        <text key={i} x={xAt(i)} y={height - 8} textAnchor="middle" fontSize="11" fill={AXIS_TEXT}>
          {l}
        </text>
      ))}
      {series.map((s, si) => {
        const color = s.color || SERIES_COLORS[si % SERIES_COLORS.length];
        // Putus garis di titik kosong.
        const segs = [];
        let cur = [];
        s.values.forEach((v, i) => {
          if (Number.isFinite(v)) cur.push(`${xAt(i)},${y(v)}`);
          else if (cur.length) {
            segs.push(cur);
            cur = [];
          }
        });
        if (cur.length) segs.push(cur);
        const lastIdx = s.values.reduce((li, v, i) => (Number.isFinite(v) ? i : li), -1);
        return (
          <g key={s.name}>
            {segs.map((pts, k) =>
              pts.length > 1 ? (
                <polyline key={k} points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
              ) : (
                <circle key={k} cx={pts[0].split(",")[0]} cy={pts[0].split(",")[1]} r="3" fill={color} />
              ),
            )}
            {s.values.map((v, i) =>
              Number.isFinite(v) ? (
                <g key={i}>
                  <title>{`${multi ? `${s.name} · ` : ""}${labels[i]}: ${fmt(v)}`}</title>
                  <circle cx={xAt(i)} cy={y(v)} r="11" fill="transparent" />
                  {i === lastIdx && <circle cx={xAt(i)} cy={y(v)} r="4.5" fill={color} stroke="#fff" strokeWidth="2" />}
                </g>
              ) : null,
            )}
            {lastIdx >= 0 &&
              (multi ? (
                <text x={xAt(lastIdx) + 9} y={y(s.values[lastIdx]) + 4} fontSize="11.5" fontWeight="700" fill={INK}>
                  {s.name}
                </text>
              ) : (
                <text x={xAt(lastIdx)} y={y(s.values[lastIdx]) - 10} textAnchor="middle" fontSize="11.5" fontWeight="700" fill={INK}>
                  {fmt(s.values[lastIdx])}
                </text>
              ))}
          </g>
        );
      })}
    </svg>
  );
}

export function Legend({ items }) {
  return (
    <div className="perf-legend">
      {items.map((it, i) => (
        <span key={it} style={{ "--c": SERIES_COLORS[i % SERIES_COLORS.length] }}>
          {it}
        </span>
      ))}
    </div>
  );
}

// Penanda status: selalu ikon + teks (tidak hanya warna).
export function StatusChip({ status, text }) {
  if (!status) return <span className="muted-sm">—</span>;
  const icon = { good: "✓", warn: "!", crit: "✕" }[status];
  return (
    <span className={`st st-${status}`}>
      <i>{icon}</i>
      {text}
    </span>
  );
}

// Pembungkus grafik yang bisa digeser di layar sempit; otomatis menggulir ke
// ujung kanan agar periode TERBARU langsung terlihat.
export function ChartScroll({ wide = false, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  });
  return (
    <div ref={ref} className={`chart-scroll${wide ? " wide" : ""}`}>
      {children}
    </div>
  );
}
