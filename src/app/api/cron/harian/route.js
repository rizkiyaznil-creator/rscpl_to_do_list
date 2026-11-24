import { GET as reminders } from "../reminders/route";
import { GET as jadwalOperasi } from "../jadwal-operasi/route";
import { GET as kerjasama } from "../kerjasama/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/harian — SATU-SATUNYA jadwal Vercel Cron (vercel.json), 07.00 WIB.
// Menjalankan kedua tugas harian berurutan dalam satu pemanggilan agar database
// (Neon, ditagih per jam menyala) cukup bangun sekali per hari:
//   1. email pengingat tenggat tugas   (/api/cron/reminders)
//   2. tarik laporan Jadwal Operasi    (/api/cron/jadwal-operasi)
//   3. email alarm kerjasama           (/api/cron/kerjasama)
// Kegagalan satu tugas tidak menghentikan tugas lainnya. Kedua route lama tetap
// bisa dipanggil terpisah (mis. manual). Proteksi CRON_SECRET diperiksa oleh
// masing-masing route (header Authorization diteruskan apa adanya).
export async function GET(request) {
  const jobs = { reminders, jadwalOperasi, kerjasama };
  const result = {};
  let status = 200;
  for (const [name, run] of Object.entries(jobs)) {
    try {
      const res = await run(request);
      result[name] = await res.json().catch(() => null);
      if (res.status === 401) return Response.json({ error: "Tidak diizinkan." }, { status: 401 });
      if (!res.ok) status = 500;
    } catch (e) {
      result[name] = { ok: false, error: e?.message || String(e) };
      status = 500;
    }
  }
  return Response.json(result, { status });
}
