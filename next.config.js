/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ Required for Firebase App Hosting (server runtime)
  output: 'standalone',

  images: {
    // ✅ Remove unoptimized for App Hosting (you can keep remotePatterns)
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
    ],
  },
};

module.exports = nextConfig;