import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AccountPanel from "@/components/AccountPanel";

export const metadata = {
  title: "Akun Saya | RSP CPL USU",
};

export default async function AkunPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Ambil data terkini (departemen, jumlah tugas) untuk ditampilkan.
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      department: true,
      createdAt: true,
      _count: { select: { ownedTasks: true } },
    },
  });

  if (!user) redirect("/login");

  // createdAt diserialisasi ke string agar aman dikirim ke Client Component.
  const profile = { ...user, createdAt: user.createdAt.toISOString() };

  return <AccountPanel currentUser={session} profile={profile} />;
}
