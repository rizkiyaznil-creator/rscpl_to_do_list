import { hospital } from "@/lib/hospitalProfile";

// Web App Manifest -> membuat aplikasi bisa "di-install" / ditambah ke layar
// utama (Android & iOS) dan tampil layar penuh seperti aplikasi.
export default function manifest() {
  return {
    name: `${hospital.name} — Manajemen Tugas`,
    short_name: hospital.name,
    description:
      "Aplikasi manajemen tugas (to-do list) personel " + hospital.fullName,
    start_url: "/login",
    display: "standalone",
    background_color: "#0e7490",
    theme_color: "#0e7490",
    lang: "id",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
