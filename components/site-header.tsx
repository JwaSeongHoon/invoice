import { AuthButton } from "@/components/auth-button";
import { BrandLogo } from "@/components/brand-logo";
import { NavLinks } from "@/components/nav-links";
import { ThemeSwitcher } from "@/components/theme-switcher";

/**
 * 공통 상단 헤더 — GTS Global 스타일.
 * 화이트(다크모드 시 다크) 배경 + 하단 보더 + sticky. 좌측 로고·네비, 우측 테마/계정.
 */
export function SiteHeader() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-5">
        <div className="flex items-center gap-8">
          <BrandLogo href="/protected" size="sm" />
          <div className="hidden sm:block">
            <NavLinks />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
