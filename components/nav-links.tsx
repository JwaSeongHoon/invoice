"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/protected", label: "홈", exact: true },
  { href: "/protected/upload", label: "새 정산 처리", exact: false },
];

/** 헤더 네비게이션 — 현재 경로와 일치하는 링크를 오렌지(브랜드) 포인트로 강조한다. */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-6 text-sm font-medium">
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "hover:text-foreground transition-colors",
              active ? "text-brand" : "text-muted-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
