/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["dl.airtable.com"],
  },
  transpilePackages: ["mapbox-gl"],
};

module.exports = nextConfig;
