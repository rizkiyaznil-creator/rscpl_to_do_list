import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Board from "@/components/Board";

export const metadata = {
  title: "Dashboard | RSCPL To-Do",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <Board currentUser={session} />;
}
