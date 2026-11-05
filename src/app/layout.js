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

// PWA: daftarkan service worker & tangkap event install sedini mungkin
// (bisa muncul sebelum halaman selesai dimuat). Lihat components/InstallApp.js.
const PWA_SCRIPT = `
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  window.__installPrompt = e;
  window.dispatchEvent(new Event("installprompt-ready"));
});
window.addEventListener("appinstalled", function () { window.__installPrompt = null; });
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}`;

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <script dangerouslySetInnerHTML={{ __html: PWA_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
