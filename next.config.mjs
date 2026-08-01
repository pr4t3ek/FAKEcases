/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Lint runs as its own step (`pnpm lint`, eslint.config.mjs), so a build
    // doesn't pay for it twice or fail on a style rule.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
