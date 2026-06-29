"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * 사용자 로그아웃 Server Action
 *
 * Supabase Auth를 사용하여 현재 사용자를 로그아웃하고
 * 로그인 페이지로 리다이렉트합니다.
 */
export async function signOut() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("로그아웃 중 오류 발생:", error);
    throw error;
  }

  redirect("/auth/login");
}
