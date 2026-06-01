/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We hand-roll the project without ESLint config; don't fail builds on lint.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
