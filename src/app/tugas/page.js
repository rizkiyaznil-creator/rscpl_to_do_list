import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Board from "@/components/Board";

export const metadata = {
  title: "Tugas | RS CPL USU",
};

export default async function TugasPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <Board currentUser={session} />;
}
