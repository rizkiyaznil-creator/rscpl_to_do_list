import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import PositionManager from "@/components/PositionManager";

export const metadata = {
  title: "Kelola Jabatan | RS CPL USU",
};

export default async function JabatanPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Halaman ini khusus admin.
  if (session.role !== ROLES.ADMIN) redirect("/dashboard");

  return <PositionManager currentUser={session} />;
}
