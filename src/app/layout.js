import "./globals.css";
import { hospital } from "@/lib/hospitalProfile";

export const metadata = {
  title: `${hospital.name} | Manajemen Tugas Rumah Sakit`,
  description:
    "Aplikasi manajemen tugas (to-do list) untuk personel rumah sakit dengan pelacakan progress.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
