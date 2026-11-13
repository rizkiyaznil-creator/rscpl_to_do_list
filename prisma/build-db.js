// Langkah database saat build Vercel: sinkron skema (prisma db push) + seed
// idempoten. HANYA dijalankan pada build Production (atau di luar Vercel).
// Build Preview memakai database yang sama, jadi bila ikut menjalankan
// db push bersamaan dengan build Production keduanya bisa bentrok
// (mis. "relation ... already exists") dan deploy gagal.
const { execSync } = require("child_process");

const env = process.env.VERCEL_ENV; // "production" | "preview" | "development" | undefined
if (env && env !== "production") {
  console.log(`[build-db] VERCEL_ENV=${env} — lewati db push & seed (hanya Production).`);
  process.exit(0);
}

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
run("npx prisma db push --skip-generate");
run("node prisma/seed-positions.js");
run("node prisma/create-admin.js");
