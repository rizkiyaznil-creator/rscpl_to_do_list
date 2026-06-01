import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import AdminPanel from "@/components/AdminPanel";

export const metadata = {
  title: "Kelola Personel | RS CPL USU",
};

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Halaman ini khusus admin.
  if (session.role !== ROLES.ADMIN) redirect("/dashboard");

  return <AdminPanel currentUser={session} />;
}
