import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canInputPerforma } from "@/lib/constants";
import { keyToDate } from "@/lib/logdate";
import {
  loadParams,
  normalizeStart,
  validatePeriod,
  savePeriod,
  isFuturePeriod,
} from "@/lib/perfServer";

async function requireInput() {
  const session = await getSession();
  if (!session) return { res: Response.json({ error: "Tidak terautentikasi." }, { status: 401 }) };
  if (!canInputPerforma(session.role)) {
    return { res: Response.json({ error: "Hanya Admin/Subadmin yang dapat menginput data performa." }, { status: 403 }) };
  }
  return { session };
}

function readPeriod(type, start) {
  if (type !== "WEEK" && type !== "MONTH") return { error: "Jenis periode tidak valid." };
  const s = normalizeStart(type, start);
  if (!s) return { error: "Periode tidak valid." };
  return { start: s };
}

// GET /api/performa/input?type=WEEK|MONTH&start=YYYY-MM-DD|YYYY-MM
// Parameter aktif untuk jenis periode tsb + nilai yang sudah tersimpan.
export async function GET(request) {
  const { res } = await requireInput();
  if (res) return res;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const p = readPeriod(type, searchParams.get("start"));
  if (p.error) return Response.json({ error: p.error }, { status: 400 });

  const [params, vals] = await Promise.all([
    loadParams(),
    prisma.perfValue.findMany({
      where: { periodType: type, periodStart: keyToDate(p.start) },
      include: { param: { select: { code: true } }, updatedBy: { select: { name: true } } },
    }),
  ]);

  const values = {};
  let last = null;
  for (const v of vals) {
    values[v.param.code] = { value: v.value, num: v.num, den: v.den };
    if (!last || v.updatedAt > last.updatedAt) last = v;
  }
  return Response.json({
    type,
    start: p.start,
    params: params.filter((x) => x.freq === type),
    values,
    lastSaved: last ? { at: last.updatedAt, by: last.updatedBy?.name || null } : null,
  });
}

// PUT /api/performa/input { type, start, values: { [code]: { value?, num?, den? } } }
// Menyimpan isian satu periode. Field yang dikosongkan menghapus data lama.
export async function PUT(request) {
  const { session, res } = await requireInput();
  if (res) return res;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const p = readPeriod(body?.type, body?.start);
  if (p.error) return Response.json({ error: p.error }, { status: 400 });
  if (isFuturePeriod(body.type, p.start)) {
    return Response.json({ error: "Periode belum berjalan — tidak bisa diisi." }, { status: 400 });
  }

  const params = await loadParams();
  const { rows, errors } = validatePeriod(params, body.type, body.values || {});
  if (errors.length) return Response.json({ error: errors[0], errors }, { status: 400 });

  await savePeriod(body.type, p.start, rows, session.id);
  return Response.json({ ok: true, start: p.start, saved: rows.filter((r) => !r.clear).length });
}
