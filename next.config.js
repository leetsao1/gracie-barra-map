/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["graciebarra.com"],
  },
  transpilePackages: ["mapbox-gl"],
};

module.exports = nextConfig;
