/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bungkus konfigurasi Server Actions di dalam blok 'experimental'
  experimental: {
    serverActions: {
      // Naikkan batas ukuran body request.
      bodySizeLimit: '10mb',
    },
  }
};

export default nextConfig;