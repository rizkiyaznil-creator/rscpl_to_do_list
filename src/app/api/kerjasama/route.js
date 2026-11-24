import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  getKsAccess,
  loadKsList,
  parseKsInput,
  dbData,
  toDate,
  notifyVerifiers,
  todayKey,
  KS_INCLUDE,
  serializeKs,
  ksDenied,
  ksUnauth,
} from "@/lib/kerjasamaServer";
import { mitraNames } from "@/lib/kerjasama";


// GET /api/kerjasama -> { access, today, items }
export async function GET() {
  const session = await getSession();
  if (!session) return ksUnauth();
  const { access } = await getKsAccess(session);
  if (!access.view) return ksDenied();
  const items = await loadKsList(access);
  return Response.json({ access, today: todayKey(), me: session.id, items });
}

// POST /api/kerjasama  body: { data, mitra, perpanjanganDariId? }
// Admin/Manajer/Koordinator -> langsung FINAL; Staf -> MENUNGGU verifikasi.
export async function POST(request) {
  const session = await getSession();
  if (!session) return ksUnauth();
  const { org, access } = await getKsAccess(session);
  if (!access.input) return ksDenied();
  const body = await request.json().catch(() => null);
  const parsed = parseKsInput(body, { lengkap: true });
  if (parsed.error) return Response.json({ error: parsed.error }, { status: 400 });

  let perpanjanganDariId = null;
  if (body?.perpanjanganDariId) {
    const src = await prisma.kerjasama.findUnique({
      where: { id: Number(body.perpanjanganDariId) },
      select: { id: true, status: true, perpanjangan: { select: { id: true } } },
    });
    if (!src || src.status !== "FINAL") return Response.json({ error: "Kerjasama yang diperpanjang tidak ditemukan." }, { status: 400 });
    if (src.perpanjangan) return Response.json({ error: "Kerjasama ini sudah memiliki perpanjangan." }, { status: 400 });
    perpanjanganDariId = src.id;
  }

  const final = access.verify;
  const now = new Date();
  const created = await prisma.kerjasama.create({
    data: {
      ...dbData(parsed.data),
      wajibEvalSejak: toDate(todayKey()),
      status: final ? "FINAL" : "MENUNGGU",
      createdById: session.id,
      ...(final && { verifiedById: session.id, verifiedAt: now }),
      perpanjanganDariId,
      mitra: { create: parsed.mitra },
    },
    include: KS_INCLUDE,
  });
  if (!final) {
    await notifyVerifiers(org, session.id, `${session.name} menginput kerjasama baru (${mitraNames(created)}) — menunggu verifikasi`, created.id);
  }
  return Response.json({ ok: true, item: serializeKs(created) }, { status: 201 });
}
