import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist 등 네이티브/대용량 서버 전용 패키지는 번들링 대신 외부 모듈로 처리
  serverExternalPackages: ["pdfjs-dist"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "vhtvokvnkpqkyhguizfr.supabase.co",
      },
      {
        protocol: "https",
        hostname: "cdn.pixabay.com",
      },
    ],
  },
};

export default nextConfig;
