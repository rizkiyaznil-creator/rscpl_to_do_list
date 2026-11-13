import { getSession } from "@/lib/auth";
import { loadOrg, assignableUserIds } from "@/lib/logbook";
import { inviteMode, isSelectable } from "@/lib/taskAccess";

// GET /api/users/directory -> daftar personel aktif seluruh bidang untuk dipilih
// sebagai PIC/anggota tugas bersama, beserta cara masuknya bila diajak user ini:
// "direct" (langsung) atau "approval" (perlu persetujuan yang diajak).
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });

  const org = await loadOrg();
  const assignable = assignableUserIds(org, session.id, session.role);
  const users = org.users
    .filter((u) => isSelectable(org, u.id))
    .map((u) => {
      const p = u.positionId != null ? org.pos.get(u.positionId) : null;
      return {
        id: u.id,
        name: u.name,
        position: p ? { name: p.name, level: p.level, bidang: p.bidang } : null,
        mode: inviteMode(org, session, u.id, assignable),
      };
    })
    .sort((a, b) => (a.position?.bidang || "~").localeCompare(b.position?.bidang || "~") || a.name.localeCompare(b.name));
  return Response.json({ users });
}
