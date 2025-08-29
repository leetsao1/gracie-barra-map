/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'graciebarra.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  transpilePackages: ["mapbox-gl"],
};

module.exports = nextConfig;
