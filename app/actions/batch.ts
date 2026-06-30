"use server";

import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET } from "@/lib/types/constants";
import type { ImportBatch } from "@/lib/types/database";

/** 배치 원본 PDF의 서명 URL 발급 (비공개 버킷, 5분 유효) — OCR 저신뢰 원본 확인용 */
export async function getBatchPdfSignedUrl(batchId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("import_batch")
    .select("pdf_path")
    .eq("id", batchId)
    .single();
  if (!batch?.pdf_path) return null;
  const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(batch.pdf_path, 300);
  return data?.signedUrl ?? null;
}

/**
 * import_batch CRUD 골격 (Phase 1-A)
 *
 * ⚠️ 실제 파일 업로드·Storage 저장·PDF/xlsx 처리는 Task 005(/api/ingest)로 이관한다.
 * 여기서는 인증·RLS 동작 확인용 최소 골격만 제공한다.
 */

/** 본인 배치 목록 조회 (RLS로 user_id = auth.uid() 행만 반환) */
export async function listImportBatches(): Promise<ImportBatch[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("import_batch")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`배치 목록을 불러오지 못했습니다: ${error.message}`);
  }

  return (data ?? []) as ImportBatch[];
}

/** 빈 배치 생성 골격 (status: 'uploading'). 소유자는 RLS·기본값으로 강제. */
export async function createImportBatch(): Promise<ImportBatch> {
  const supabase = await createClient();

  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims) {
    throw new Error("인증이 필요합니다.");
  }

  const userId = claims.claims.sub as string;

  const { data, error } = await supabase
    .from("import_batch")
    .insert({ user_id: userId, status: "uploading" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`배치를 생성하지 못했습니다: ${error.message}`);
  }

  return data as ImportBatch;
}
