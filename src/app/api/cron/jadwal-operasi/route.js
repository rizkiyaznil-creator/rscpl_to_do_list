import { isConfigured, syncMonths, defaultMonths } from "@/lib/jadwalOk";

export const dynamic = "force-dynamic";

// GET /api/cron/jadwal-operasi — dipanggil tiap hari lewat /api/cron/harian (vercel.json):
// menarik laporan bulan lalu (final) & bulan berjalan (sementara) dari aplikasi
// Jadwal Operasi ke Performa RS.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Tidak diizinkan." }, { status: 401 });
  }
  if (!isConfigured()) return Response.json({ ok: false, skipped: "Integrasi Jadwal Operasi belum diatur." });
  return Response.json({ ok: true, ...(await syncMonths(defaultMonths())) });
}
