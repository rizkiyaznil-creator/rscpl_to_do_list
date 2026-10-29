import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "session";

// Subadmin Performa hanya boleh membuka menu Performa RS & Akun Saya, dan API
// yang dibutuhkan kedua halaman itu.
const SUBADMIN_PAGES = ["/performa", "/akun"];
const SUBADMIN_APIS = ["/api/auth/", "/api/performa", "/api/notifications"];

// Middleware berjalan di Edge runtime, jadi hanya pakai `jose` (bukan Prisma/bcrypt).
function getSecretKey() {
  return new TextEncoder().encode(process.env.JWT_SECRET || "");
}

// Payload sesi yang valid, atau null.
async function getPayload(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload;
  } catch {
    return null;
  }
}

// Cocok bila path sama persis atau berada di bawahnya ("/performa" -> "/performa/input").
const startsWithAny = (path, prefixes) =>
  prefixes.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`));

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const payload = await getPayload(request);
  const authed = Boolean(payload);
  const isSubadmin = payload?.role === "SUBADMIN";

  // API: autentikasi dicek oleh tiap route; di sini hanya pembatasan Subadmin.
  if (pathname.startsWith("/api/")) {
    if (isSubadmin && !startsWithAny(pathname, SUBADMIN_APIS)) {
      return NextResponse.json({ error: "Akses tidak diizinkan untuk Subadmin." }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Halaman publik (boleh diakses tanpa login): landing, login, daftar, lupa-password.
  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/daftar" ||
    pathname === "/lupa-password";

  // Belum login & halaman butuh proteksi -> arahkan ke /login
  if (!authed && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const home = isSubadmin ? "/performa" : "/dashboard";

  // Sudah login tapi membuka /login atau /daftar -> arahkan ke halaman utama
  // (halaman "/" tetap boleh dibuka meski sudah login)
  if (
    authed &&
    (pathname === "/login" ||
      pathname === "/daftar" ||
      pathname === "/lupa-password")
  ) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  // Subadmin membuka halaman di luar Performa RS / Akun Saya -> ke Performa RS.
  if (isSubadmin && pathname !== "/" && !startsWithAny(pathname, SUBADMIN_PAGES)) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

// Jalankan untuk semua halaman & API, kecuali aset statis dan file ber-ekstensi.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
