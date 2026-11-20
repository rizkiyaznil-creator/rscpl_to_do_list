import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { USER_STATUS } from "@/lib/constants";

export const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari (detik)
const RENEW_AFTER_SEC = 60 * 60 * 24; // token berumur > 1 hari diperbarui saat dipakai

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET belum diset / terlalu pendek. Salin .env.example menjadi .env dan isi JWT_SECRET.",
    );
  }
  return new TextEncoder().encode(secret);
}

// ----- Password -----

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

// ----- JWT -----

export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, getSecretKey());
  return payload;
}

// ----- Session (server-side, untuk Route Handler & Server Component) -----

// Buat sesi dari objek user lalu set cookie httpOnly.
export async function createSession(user) {
  const token = await signToken({
    sub: String(user.id),
    username: user.username,
    name: user.name,
    role: user.role,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

// Perpanjang sesi selama aplikasi dipakai (sliding session): token yang sudah
// berumur > 1 hari diganti token baru berlaku 7 hari lagi. Sebelum memperbarui,
// akun dicek ke database: nama/peran ikut diperbarui, dan akun yang sudah
// nonaktif/terhapus langsung dikeluarkan (cookie dihapus). Hanya untuk Route
// Handler (mengubah cookie); dipanggil dari /api/notifications yang dimuat di
// setiap halaman setelah login. Mengembalikan false bila sesi dicabut.
export async function renewSessionIfStale() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return true;
  let payload;
  try {
    payload = await verifyToken(token);
  } catch {
    return true; // token tidak valid ditangani getSession() pemanggil
  }
  const age = Math.floor(Date.now() / 1000) - (payload.iat || 0);
  if (age < RENEW_AFTER_SEC) return true;
  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    select: { id: true, username: true, name: true, role: true, status: true },
  });
  if (!user || user.status !== USER_STATUS.ACTIVE) {
    cookieStore.delete(SESSION_COOKIE);
    return false;
  }
  await createSession(user);
  return true;
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Kembalikan payload sesi yang sudah diverifikasi, atau null bila tidak valid.
export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = await verifyToken(token);
    return {
      id: Number(payload.sub),
      username: payload.username,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
