import "./globals.css";
import { hospital } from "@/lib/hospitalProfile";

export const metadata = {
  title: `${hospital.name} | Manajemen Tugas Rumah Sakit`,
  description:
    "Aplikasi manajemen tugas (to-do list) untuk personel rumah sakit dengan pelacakan progress.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: hospital.name,
    statusBarStyle: "default",
  },
  other: {
    // Legacy iOS: pastikan mode layar penuh (standalone) di versi lama.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  themeColor: "#0e7490",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
