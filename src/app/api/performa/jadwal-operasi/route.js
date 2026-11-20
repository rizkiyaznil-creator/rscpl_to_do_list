import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canInputPerforma } from "@/lib/constants";
import { todayKey, toKey } from "@/lib/logdate";
import { isConfigured, syncMonths, monthsBetween, defaultMonths } from "@/lib/jadwalOk";

export const dynamic = "force-dynamic";

const isYm = (s) => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

// GET /api/performa/jadwal-operasi?from=YYYY-MM&to=YYYY-MM
// Laporan bulanan Kamar Operasi (IBP) yang sudah ditarik dari aplikasi Jadwal
// Operasi. Semua personel yang login boleh melihat (sama seperti Performa RS).
export async function GET(request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sesi login Anda telah berakhir. Silakan login ulang." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!isYm(from) || !isYm(to) || to < from) {
    return Response.json({ error: "Periode tidak valid." }, { status: 400 });
  }
  const reports = await prisma.okReport.findMany({
    where: { month: { gte: new Date(`${from}-01T00:00:00Z`), lte: new Date(`${to}-01T00:00:00Z`) } },
    orderBy: { month: "asc" },
  });
  return Response.json({
    configured: isConfigured(),
    canSync: canInputPerforma(session.role),
    reports: reports.map((r) => ({ month: toKey(r.month).slice(0, 7), final: r.final, fetchedAt: r.fetchedAt, data: r.data })),
  });
}

// POST /api/performa/jadwal-operasi { from?, to? } -> tarik sekarang (Admin/Subadmin).
// Tanpa periode: bulan lalu & bulan berjalan.
export async function POST(request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sesi login Anda telah berakhir. Silakan login ulang." }, { status: 401 });
  if (!canInputPerforma(session.role)) {
    return Response.json({ error: "Hanya Admin / Subadmin Performa yang dapat menarik data." }, { status: 403 });
  }
  if (!isConfigured()) {
    return Response.json(
      { error: "Integrasi Jadwal Operasi belum diatur (JADWAL_OK_URL & JADWAL_OK_TOKEN)." },
      { status: 503 },
    );
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    /* tanpa body -> bawaan */
  }
  const cur = todayKey().slice(0, 7);
  let months = defaultMonths();
  if (isYm(body?.from)) {
    const to = isYm(body?.to) && body.to < cur ? body.to : cur;
    months = monthsBetween(body.from, to);
  }
  months = months.filter((m) => m <= cur);
  const result = await syncMonths(months);
  return Response.json(result, { status: result.ok.length ? 200 : 502 });
}
