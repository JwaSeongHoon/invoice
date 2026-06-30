import { BrandLogo } from "@/components/brand-logo";

/**
 * 공통 하단 푸터 — GTS Global 다크 푸터 무드.
 * 다크 배경 + 브랜드 마크 + 저작권. (테마 토글은 헤더로 이동)
 */
export function SiteFooter() {
  return (
    <footer className="bg-foreground text-background mt-20 w-full">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <BrandLogo size="sm" />
        <p className="text-background/60 text-xs">
          ⓒ {new Date().getFullYear()} 수입정산 매니저. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
