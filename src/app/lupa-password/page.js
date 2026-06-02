import Link from "next/link";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";
import { hospital } from "@/lib/hospitalProfile";

export const metadata = {
  title: `Lupa Password | ${hospital.name}`,
};

export default function LupaPasswordPage() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <img className="mark" src="/logo-rsusu.png" alt="Logo RS CPL USU" />
          <div>
            <h1>{hospital.name}</h1>
          </div>
        </div>
        <p className="login-sub">Lupa password</p>
        <ForgotPasswordForm />
        <div className="login-hint">
          Masukkan username Anda. Permintaan akan dikirim ke admin, lalu admin akan
          memberi Anda password baru. Setelah masuk, segera ganti password di menu
          <strong> Akun Saya</strong>.
        </div>
        <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
          <Link href="/login" style={{ fontSize: 13 }}>
            ← Kembali ke halaman masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
