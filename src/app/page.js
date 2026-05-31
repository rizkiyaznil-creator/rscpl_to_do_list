import { redirect } from "next/navigation";

// Halaman root: arahkan ke dashboard (middleware akan mengalihkan ke /login bila belum masuk).
export default function Home() {
  redirect("/dashboard");
}
