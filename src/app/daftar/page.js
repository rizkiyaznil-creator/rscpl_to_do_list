import Link from "next/link";
import RegisterForm from "@/components/RegisterForm";
import { hospital } from "@/lib/hospitalProfile";

export const metadata = {
  title: `Daftar | ${hospital.name}`,
};

export default function RegisterPage() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <img className="mark" src="/logo-rsusu.png" alt="Logo RS CPL USU" />
          <div>
            <h1>{hospital.name}</h1>
          </div>
        </div>
        <p className="login-sub">Daftar akun personel baru</p>
        <RegisterForm />
        <div className="login-hint">
          Akun baru harus <strong>diverifikasi admin</strong> dulu sebelum dapat
          digunakan untuk masuk.
        </div>
        <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
          Sudah punya akun?{" "}
          <Link href="/login" style={{ fontSize: 13 }}>
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
