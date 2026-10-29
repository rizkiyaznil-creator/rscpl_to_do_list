import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canInputPerforma } from "@/lib/constants";
import PerformaInput from "@/components/PerformaInput";

export const metadata = {
  title: "Input Performa RS | RS CPL USU",
};

export default async function PerformaInputPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Hanya Admin & Subadmin yang boleh menginput data performa.
  if (!canInputPerforma(session.role)) redirect("/performa");
  return <PerformaInput currentUser={session} />;
}
