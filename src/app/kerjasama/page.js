import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import KerjasamaPage from "@/components/kerjasama/KerjasamaPage";

export const metadata = {
  title: "Kerjasama | RSP CPL USU",
};

export default async function Kerjasama({ searchParams }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = (await searchParams) || {};
  return <KerjasamaPage currentUser={session} initialId={Number(sp.id) || null} initialFilter={sp.filter || null} />;
}
