"use client";

import { addDays, formatWeekRange, todayKey, weekStartKey } from "@/lib/logdate";

// Navigasi antar minggu (Senin–Minggu). Tidak bisa maju melewati minggu ini.
export default function LogWeekNav({ week, setWeek }) {
  const current = weekStartKey(todayKey());
  return (
    <div className="week-nav">
      <button className="btn btn-sm" onClick={() => setWeek(addDays(week, -7))}>
        ‹ Minggu lalu
      </button>
      <div className="week-label">
        <b>{formatWeekRange(week)}</b>
        {week !== current && (
          <button className="btn btn-sm btn-ghost" onClick={() => setWeek(current)}>
            Ke minggu ini
          </button>
        )}
      </div>
      <button
        className="btn btn-sm"
        onClick={() => setWeek(addDays(week, 7))}
        disabled={week >= current}
      >
        Minggu depan ›
      </button>
    </div>
  );
}
