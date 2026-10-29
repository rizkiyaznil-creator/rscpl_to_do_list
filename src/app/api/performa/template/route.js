import { getSession } from "@/lib/auth";
import { canInputPerforma } from "@/lib/constants";
import { loadParams } from "@/lib/perfServer";
import { buildTemplate } from "@/lib/perfExcel";

// GET /api/performa/template -> unduh template Excel standar (Admin/Subadmin).
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }
  if (!canInputPerforma(session.role)) {
    return Response.json({ error: "Hanya Admin/Subadmin." }, { status: 403 });
  }
  const buf = await buildTemplate(await loadParams());
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-performa-rs-cpl-usu.xlsx"',
    },
  });
}
