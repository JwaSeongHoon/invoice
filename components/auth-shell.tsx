import { BrandLogo } from "@/components/brand-logo";

/** 인증 화면 공통 셸 — 중앙 정렬 + 상단 브랜드 로고. (인증 페이지는 헤더가 없는 영역) */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-8 p-6 md:p-10">
      <BrandLogo size="lg" href="/" />
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
