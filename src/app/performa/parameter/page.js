import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import PerformaParams from "@/components/PerformaParams";

export const metadata = {
  title: "Parameter Performa RS | RS CPL USU",
};

export default async function PerformaParamPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Halaman ini khusus admin.
  if (session.role !== ROLES.ADMIN) redirect("/performa");
  return <PerformaParams currentUser={session} />;
}
