/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['i.ytimg.com', 'lh3.googleusercontent.com'],
  },
};

module.exports = nextConfig;
