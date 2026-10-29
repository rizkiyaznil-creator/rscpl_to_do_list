import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

export const metadata = {
  title: "Dashboard | RS CPL USU",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <Dashboard currentUser={session} />;
}
