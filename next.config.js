/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  eslint: {
    // Skip ESLint during production builds
    ignoreDuringBuilds: true,
  },
};