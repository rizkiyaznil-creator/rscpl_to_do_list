import { prisma } from "@/lib/prisma";
import { getSession, hashPassword } from "@/lib/auth";
import { ROLES, isValidRole } from "@/lib/constants";

const publicSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  department: true,
  createdAt: true,
  _count: { select: { ownedTasks: true } },
};

// GET /api/users -> daftar personel (untuk dropdown penugasan & pengelompokan papan).
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: publicSelect,
  });

  return Response.json({ users });
}

// POST /api/users -> buat akun personel baru (khusus ADMIN).
export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }
  if (session.role !== ROLES.ADMIN) {
    return Response.json(
      { error: "Hanya admin yang dapat menambah akun personel." },
      { status: 403 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const username = (body?.username || "").trim().toLowerCase();
  const name = (body?.name || "").trim();
  const password = body?.password || "";
  const department = (body?.department || "").trim() || null;
  const role = isValidRole(body?.role) ? body.role : ROLES.STAFF;

  if (!username || !name || !password) {
    return Response.json(
      { error: "Username, nama, dan password wajib diisi." },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return Response.json(
      { error: "Password minimal 6 karakter." },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return Response.json(
      { error: "Username sudah dipakai." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { username, name, passwordHash, department, role },
    select: publicSelect,
  });

  return Response.json({ user }, { status: 201 });
}
