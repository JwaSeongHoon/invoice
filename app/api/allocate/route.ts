import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/allocate — 외화단가 역산·부대비용 안분·원화 환산·검증 (F011, F013, F014)
export async function POST() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  return NextResponse.json({ error: "미구현" }, { status: 501 });
}
