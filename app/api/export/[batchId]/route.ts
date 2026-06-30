import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/export/[batchId] — 이카운트 24컬럼 xlsx 생성 + 검증 리포트 (F015, F016)
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  return NextResponse.json({ error: "미구현" }, { status: 501 });
}
