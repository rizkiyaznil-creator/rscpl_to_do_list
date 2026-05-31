import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Reports from "@/components/Reports";

export const metadata = {
  title: "Laporan | RSCPL To-Do",
};

export default async function LaporanPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <Reports currentUser={session} />;
}
