import Link from "next/link";
import LoginForm from "@/components/LoginForm";
import { hospital } from "@/lib/hospitalProfile";

export const metadata = {
  title: `Masuk | ${hospital.name}`,
};

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <div className="mark">✚</div>
          <div>
            <h1>{hospital.name}</h1>
          </div>
        </div>
        <p className="login-sub">Manajemen tugas personel rumah sakit</p>
        <LoginForm />
        {process.env.NODE_ENV !== "production" && (
          <div className="login-hint">
            <strong>Akun demo:</strong>
            <br />
            Admin → <code>admin</code> / <code>admin123</code>
            <br />
            Personel → <code>dr.andi</code> / <code>password123</code>
          </div>
        )}
        <p style={{ textAlign: "center", marginTop: 16, marginBottom: 6 }}>
          Belum punya akun?{" "}
          <Link href="/daftar" style={{ fontSize: 13 }}>
            Daftar di sini
          </Link>
        </p>
        <p style={{ textAlign: "center", marginTop: 0, marginBottom: 0 }}>
          <Link href="/" style={{ fontSize: 13 }}>
            ← Kembali ke profil RS
          </Link>
        </p>
      </div>
    </div>
  );
}
