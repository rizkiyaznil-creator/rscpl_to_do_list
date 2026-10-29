import { getSession } from "@/lib/auth";
import { canInputPerforma } from "@/lib/constants";
import { todayKey } from "@/lib/logdate";
import { loadParams, loadRows } from "@/lib/perfServer";
import {
  GRANS,
  isValidPeriodKey,
  currentPeriodKey,
  shiftPeriod,
  makePeriod,
  aggregate,
  trend,
  monthlyByYear,
  MONTHS,
} from "@/lib/perfcalc";

export const dynamic = "force-dynamic";

// GET /api/performa?gran=month&period=2026-10
// Data Dashboard Performa RS (semua personel yang login boleh melihat).
export async function GET(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const gran = GRANS.includes(searchParams.get("gran")) ? searchParams.get("gran") : "month";
  const today = todayKey();
  let key = searchParams.get("period") || currentPeriodKey(gran, today);
  if (!isValidPeriodKey(gran, key)) {
    return Response.json({ error: "Periode tidak valid." }, { status: 400 });
  }

  const baseGran = gran === "multi" ? "year" : gran;
  const year = Number(key.slice(0, 4));
  // Muat data cukup untuk tren & perbandingan multi-tahun (maks. 5 tahun ke belakang).
  const [params, rows] = await Promise.all([loadParams(), loadRows(`${year - 5}-01-01`)]);

  const period = makePeriod(baseGran, key);
  const prevKey = shiftPeriod(baseGran, key, -1);
  const prevPeriod = makePeriod(baseGran, prevKey);

  // Triwulan/semester/tahun yang masih berjalan dibandingkan dengan rentang
  // bulan yang SAMA pada periode sebelumnya (mis. Jan–Okt 2026 vs Jan–Okt 2025),
  // agar perbandingan setara.
  const nowMonth = today.slice(0, 7);
  if (period.months?.length > 1 && period.months.includes(nowMonth)) {
    const elapsed = period.months.indexOf(nowMonth) + 1;
    const span = (ms) => {
      const a = MONTHS[Number(ms[0].slice(5, 7)) - 1];
      const b = MONTHS[Number(ms.at(-1).slice(5, 7)) - 1];
      return `${a}${ms.length > 1 ? `–${b}` : ""} ${ms[0].slice(0, 4)}`;
    };
    period.label = `${period.label} (berjalan s.d. ${MONTHS[Number(nowMonth.slice(5, 7)) - 1]})`;
    prevPeriod.months = prevPeriod.months.slice(0, elapsed);
    prevPeriod.label = `${span(prevPeriod.months)} (rentang yang sama)`;
  }

  const current = aggregate(params, rows, period);
  const previous = aggregate(params, rows, prevPeriod);

  // Tahun untuk perbandingan multi-tahun: tahun ini + hingga 2 (multi: 4) tahun sebelumnya yang berisi data.
  const back = gran === "multi" ? 4 : 2;
  const yearsWithData = new Set(rows.map((r) => Number(r.start.slice(0, 4))));
  const years = [];
  for (let y = year - back; y <= year; y++) if (y === year || yearsWithData.has(y)) years.push(y);

  const lastOf = (type) =>
    rows.filter((r) => r.type === type).reduce((m, r) => (r.start > m ? r.start : m), "") || null;

  return Response.json({
    gran,
    period: { key, label: period.label },
    previous: { key: prevKey, label: prevPeriod.label },
    params,
    current,
    previousValues: previous,
    trend: trend(params, rows, gran, key),
    multiYear: { years, values: monthlyByYear(params, rows, years) },
    lastWeek: lastOf("WEEK"),
    lastMonth: lastOf("MONTH"),
    canInput: canInputPerforma(session.role),
  });
}
