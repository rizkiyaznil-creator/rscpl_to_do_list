import { sendKsDigest } from "@/lib/kerjasamaServer";

export const dynamic = "force-dynamic";

// GET /api/cron/kerjasama — dipanggil tiap hari lewat /api/cron/harian (vercel.json):
// email alarm kerjasama baru ke Manajer & Koordinator Kerja Sama (CC Wadir pembina).
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Tidak diizinkan." }, { status: 401 });
  }
  return Response.json(await sendKsDigest());
}
