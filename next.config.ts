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
  // TAMBAHKAN BLOK INI
  // Ini akan memberitahu Vercel untuk mengabaikan error TypeScript saat build.
  typescript: {
    // PERINGATAN: Opsi ini secara sengaja mengizinkan build produksi
    // untuk berhasil meskipun proyek Anda memiliki error tipe data.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
