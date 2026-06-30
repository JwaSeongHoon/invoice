import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist 등 네이티브/대용량 서버 전용 패키지는 번들링 대신 외부 모듈로 처리
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  // pdfjs 워커는 동적 import라 트레이서가 못 잡아 서버리스 함수에서 누락된다.
  // ("Setting up fake worker failed: Cannot find module ...pdf.worker.mjs")
  // /api/ingest 함수 번들에 워커 파일을 명시적으로 포함시킨다.
  outputFileTracingIncludes: {
    "/api/ingest": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
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
