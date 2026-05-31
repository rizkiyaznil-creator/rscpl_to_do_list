import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "session";

// Middleware berjalan di Edge runtime, jadi hanya pakai `jose` (bukan Prisma/bcrypt).
function getSecretKey() {
  return new TextEncoder().encode(process.env.JWT_SECRET || "");
}

async function isAuthenticated(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const authed = await isAuthenticated(request);

  // Halaman publik (boleh diakses tanpa login): landing & login.
  const isPublic = pathname === "/" || pathname === "/login";

  // Belum login & halaman butuh proteksi -> arahkan ke /login
  if (!authed && !isPublic) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  // Sudah login tapi membuka /login -> arahkan ke dashboard
  // (halaman "/" tetap boleh dibuka meski sudah login)
  if (authed && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// Lindungi semua halaman kecuali: API (cek sendiri), aset statis, dan file ber-ekstensi.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
