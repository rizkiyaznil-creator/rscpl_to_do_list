import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PerformaDashboard from "@/components/PerformaDashboard";

export const metadata = {
  title: "Performa RS | RSP CPL USU",
};

export default async function PerformaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <PerformaDashboard currentUser={session} />;
}
