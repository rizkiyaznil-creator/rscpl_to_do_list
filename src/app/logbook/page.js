import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LogbookPage from "@/components/LogbookPage";

export const metadata = {
  title: "Logbook | RS CPL USU",
};

export default async function Logbook() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <LogbookPage currentUser={session} />;
}
