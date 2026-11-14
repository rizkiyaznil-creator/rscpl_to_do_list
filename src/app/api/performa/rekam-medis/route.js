import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canInputPerforma } from "@/lib/constants";
import { cleanReport, saveRmReports } from "@/lib/rmServer";

export const dynamic = "force-dynamic";

const isYm = (s) => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

// GET /api/performa/rekam-medis?from=YYYY-MM&to=YYYY-MM
// Laporan Rekam Medis bulanan yang sudah diunggah (semua personel yang login).
export async function GET(request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!isYm(from) || !isYm(to) || to < from) return Response.json({ error: "Periode tidak valid." }, { status: 400 });
  const rows = await prisma.rmReport.findMany({
    where: { month: { gte: new Date(`${from}-01T00:00:00Z`), lte: new Date(`${to}-01T00:00:00Z`) } },
    orderBy: { month: "asc" },
    include: { uploadedBy: { select: { name: true } } },
  });
  return Response.json({
    canUpload: canInputPerforma(session.role),
    reports: rows.map((r) => ({
      month: r.month.toISOString().slice(0, 7),
      data: r.data,
      sourceFile: r.sourceFile,
      sourceModified: r.sourceModified,
      updatedAt: r.updatedAt,
      uploadedBy: r.uploadedBy?.name || null,
    })),
  });
}

// POST /api/performa/rekam-medis { reports: [...], force? } — Admin/Subadmin.
// `reports` = hasil baca file Excel RM di browser (lib/rmParse.js).
export async function POST(request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  if (!canInputPerforma(session.role)) {
    return Response.json({ error: "Hanya Admin / Subadmin Performa yang dapat mengunggah laporan RM." }, { status: 403 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const reports = (Array.isArray(body?.reports) ? body.reports : []).slice(0, 120).map(cleanReport).filter(Boolean);
  if (!reports.length) return Response.json({ error: "Tidak ada laporan bulanan yang dapat dibaca." }, { status: 400 });
  const result = await saveRmReports(reports, session.id, { force: body?.force === true });
  return Response.json({ ok: true, result });
}
