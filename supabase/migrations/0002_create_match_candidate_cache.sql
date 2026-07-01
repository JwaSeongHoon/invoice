-- match_candidate — AI 의미 매칭 후보 캐시 ("확인요" 재로딩 시 LLM 재호출 방지)
-- 배경: item_match에는 확정(code/ai/manual) 배정만 저장되므로, 자동확정을 못 넘겨
--       review로 남은 신고의 AI 점수·근거는 영속되지 않았다. 그 결과 배치의 모든 신고가
--       review이면 item_match가 비어, 매칭 검토 화면을 열 때마다 LLM을 전량 재호출했다.
-- 설계: (batch_id, declaration_item_id, inventory_key)별 score·reason만 저장한다.
--       item_name·qty_sum·row_count·inventory_item_ids는 재로딩 시 입고 데이터로 재계산한다.
-- RLS: 하위 테이블 공통 원칙(batch_id → import_batch.user_id = auth.uid()).

create table if not exists public.match_candidate (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batch (id) on delete cascade,
  declaration_item_id uuid not null references public.declaration_item (id) on delete cascade,
  inventory_key text not null,
  score numeric not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (batch_id, declaration_item_id, inventory_key)
);
create index if not exists idx_match_candidate_batch_id on public.match_candidate (batch_id);
create index if not exists idx_match_candidate_declaration_item_id
  on public.match_candidate (declaration_item_id);

alter table public.match_candidate enable row level security;

-- 성능: auth.uid()는 (select auth.uid())로 감싸 행마다 재평가 방지(auth_rls_initplan).
create policy "match_candidate_all_own" on public.match_candidate
  for all to authenticated
  using (exists (select 1 from public.import_batch b where b.id = match_candidate.batch_id and b.user_id = (select auth.uid())))
  with check (exists (select 1 from public.import_batch b where b.id = match_candidate.batch_id and b.user_id = (select auth.uid())));
