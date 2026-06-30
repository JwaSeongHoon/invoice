import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/fx — 환율 조회 (캐시→하나은행→서울외환→수동 오버라이드) (F012)
export async function POST() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  return NextResponse.json({ error: "미구현" }, { status: 501 });
}
