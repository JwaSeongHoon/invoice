import Link from "next/link";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: { icon: "size-6", text: "text-sm", gap: "gap-2" },
  md: { icon: "size-7", text: "text-base", gap: "gap-2.5" },
  lg: { icon: "size-10", text: "text-2xl", gap: "gap-3" },
} as const;

interface BrandLogoProps {
  /** 로고 크기 (기본 md) */
  size?: keyof typeof SIZE;
  /** 워드마크(텍스트) 표시 여부 (기본 true) */
  showWordmark?: boolean;
  /** 링크로 감쌀 경로 (지정 시 <Link>, 미지정 시 <span>) */
  href?: string;
  className?: string;
}

/**
 * GTS Global 스타일 브랜드 마크 — 다크 링 + 오렌지 포인트 원형 아이콘과 워드마크.
 * 오렌지는 currentColor가 아닌 고정 브랜드색이라 라이트/다크 양쪽에서 동일하게 노출된다.
 */
export function BrandLogo({ size = "md", showWordmark = true, href, className }: BrandLogoProps) {
  const s = SIZE[size];

  const inner = (
    <span className={cn("inline-flex items-center", s.gap, className)}>
      <svg viewBox="0 0 32 32" fill="none" className={cn(s.icon, "shrink-0")} aria-hidden>
        {/* 다크 링 (긴 호) — 라이트=블랙, 다크모드=화이트 */}
        <circle
          cx="16"
          cy="16"
          r="12"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="54 76"
          transform="rotate(-90 16 16)"
        />
        {/* 오렌지 포인트 호 */}
        <circle
          cx="16"
          cy="16"
          r="12"
          stroke="#FF541F"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="14 76"
          transform="rotate(62 16 16)"
        />
        {/* 중앙 오렌지 도트 */}
        <circle cx="16" cy="16" r="3.4" fill="#FF541F" />
      </svg>
      {showWordmark && (
        <span className={cn("font-heading font-bold tracking-tight", s.text)}>수입정산 매니저</span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center" aria-label="수입정산 매니저 홈">
        {inner}
      </Link>
    );
  }
  return inner;
}
