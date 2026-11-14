import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Reports from "@/components/Reports";

export const metadata = {
  title: "Laporan | RSP CPL USU",
};

export default async function LaporanPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <Reports currentUser={session} />;
}
