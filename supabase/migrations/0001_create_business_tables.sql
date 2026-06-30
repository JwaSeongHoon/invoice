-- 수입정산 매니저 — 업무 8개 테이블 + RLS + 인덱스
-- 단일 진실 공급원: docs/PRD.md 8장. (적용: Task 003)
-- RLS 원칙: import_batch는 user_id=auth.uid(), 하위 테이블은 batch_id→import_batch.user_id.
--           fx_rate_cache만 공용 읽기.

-- ============================================================
-- 1. import_batch (정산 처리 배치)
-- ============================================================
create table if not exists public.import_batch (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'uploading'
    check (status in ('uploading', 'processing', 'matching', 'done', 'error')),
  pdf_path text,
  xlsx_path text,
  created_at timestamptz not null default now()
);
create index if not exists idx_import_batch_user_id on public.import_batch (user_id);

-- ============================================================
-- 2. settlement (수입정산서 파싱 결과)
-- ============================================================
create table if not exists public.settlement (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batch (id) on delete cascade,
  bl_no text,
  duty_rate numeric,
  freight_subtotal numeric,
  customs_fee numeric,
  customs_vat numeric,
  duty_amount numeric,
  raw_json jsonb
);
create index if not exists idx_settlement_batch_id on public.settlement (batch_id);

-- ============================================================
-- 3. declaration_item (신고필증 OCR 라인 아이템)
-- ============================================================
create table if not exists public.declaration_item (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batch (id) on delete cascade,
  page_index integer not null,
  declaration_no text,
  bl_no text,
  model text,
  qty_35 numeric,
  unit_price_usd numeric,
  amount_usd numeric,
  qty_41_total numeric,
  fx_rate_65 numeric,
  confidence numeric
);
create index if not exists idx_declaration_item_batch_id on public.declaration_item (batch_id);

-- ============================================================
-- 4. inventory_item (입고현황 xlsx 행)
-- ============================================================
create table if not exists public.inventory_item (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batch (id) on delete cascade,
  row_no integer not null,
  item_code text not null,
  item_name text not null,
  qty numeric not null,
  unit_price_fx numeric,
  currency_code text not null,
  in_date date
);
create index if not exists idx_inventory_item_batch_id on public.inventory_item (batch_id);

-- ============================================================
-- 5. item_match (매칭 결과)
-- ============================================================
create table if not exists public.item_match (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batch (id) on delete cascade,
  declaration_item_id uuid references public.declaration_item (id) on delete cascade,
  inventory_item_id uuid references public.inventory_item (id) on delete cascade,
  method text not null check (method in ('code', 'ai', 'manual')),
  score numeric,
  status text not null check (status in ('match', 'mismatch', 'review')),
  confirmed_by uuid references auth.users (id)
);
create index if not exists idx_item_match_batch_id on public.item_match (batch_id);
create index if not exists idx_item_match_declaration_item_id on public.item_match (declaration_item_id);
create index if not exists idx_item_match_inventory_item_id on public.item_match (inventory_item_id);

-- ============================================================
-- 6. allocation_result (안분·환산 결과 = 이카운트 행)
-- ============================================================
create table if not exists public.allocation_result (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batch (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_item (id) on delete cascade,
  bl_no text,
  unit_price_fx_adjusted numeric,
  unit_price_krw numeric,
  supply_amount numeric,
  vat numeric,
  fx_rate numeric,
  freight numeric,
  fee numeric,
  etc_amount numeric,
  alloc_basis text check (alloc_basis in ('decl', 'inventory'))
);
create index if not exists idx_allocation_result_batch_id on public.allocation_result (batch_id);
create index if not exists idx_allocation_result_inventory_item_id on public.allocation_result (inventory_item_id);

-- ============================================================
-- 7. fx_rate_cache (환율 캐시 — 공용 읽기)
-- ============================================================
create table if not exists public.fx_rate_cache (
  id uuid primary key default gen_random_uuid(),
  quote_date date not null,
  currency text not null,
  rate numeric not null,
  source text not null check (source in ('hana', 'smbs', 'manual')),
  fetched_at timestamptz not null default now(),
  unique (quote_date, currency)
);

-- ============================================================
-- 8. validation_log (검증 결과 로그)
-- ============================================================
create table if not exists public.validation_log (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batch (id) on delete cascade,
  type text not null
    check (type in ('qty3541', 'unitprice', 'alloc_freight', 'alloc_fee', 'alloc_etc')),
  passed boolean not null,
  expected numeric,
  actual numeric,
  message text,
  created_at timestamptz not null default now()
);
create index if not exists idx_validation_log_batch_id on public.validation_log (batch_id);

-- ============================================================
-- RLS 활성화
-- ============================================================
alter table public.import_batch enable row level security;
alter table public.settlement enable row level security;
alter table public.declaration_item enable row level security;
alter table public.inventory_item enable row level security;
alter table public.item_match enable row level security;
alter table public.allocation_result enable row level security;
alter table public.fx_rate_cache enable row level security;
alter table public.validation_log enable row level security;

-- ============================================================
-- RLS 정책: import_batch (user_id = auth.uid())
-- 성능: auth.uid()는 (select auth.uid())로 감싸 행마다 재평가 방지(auth_rls_initplan).
-- ============================================================
create policy "import_batch_select_own" on public.import_batch
  for select to authenticated using (user_id = (select auth.uid()));
create policy "import_batch_insert_own" on public.import_batch
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "import_batch_update_own" on public.import_batch
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "import_batch_delete_own" on public.import_batch
  for delete to authenticated using (user_id = (select auth.uid()));

-- ============================================================
-- RLS 정책: 하위 테이블 (batch_id → import_batch.user_id = auth.uid())
-- ============================================================
create policy "settlement_all_own" on public.settlement
  for all to authenticated
  using (exists (select 1 from public.import_batch b where b.id = settlement.batch_id and b.user_id = (select auth.uid())))
  with check (exists (select 1 from public.import_batch b where b.id = settlement.batch_id and b.user_id = (select auth.uid())));

create policy "declaration_item_all_own" on public.declaration_item
  for all to authenticated
  using (exists (select 1 from public.import_batch b where b.id = declaration_item.batch_id and b.user_id = (select auth.uid())))
  with check (exists (select 1 from public.import_batch b where b.id = declaration_item.batch_id and b.user_id = (select auth.uid())));

create policy "inventory_item_all_own" on public.inventory_item
  for all to authenticated
  using (exists (select 1 from public.import_batch b where b.id = inventory_item.batch_id and b.user_id = (select auth.uid())))
  with check (exists (select 1 from public.import_batch b where b.id = inventory_item.batch_id and b.user_id = (select auth.uid())));

create policy "item_match_all_own" on public.item_match
  for all to authenticated
  using (exists (select 1 from public.import_batch b where b.id = item_match.batch_id and b.user_id = (select auth.uid())))
  with check (exists (select 1 from public.import_batch b where b.id = item_match.batch_id and b.user_id = (select auth.uid())));

create policy "allocation_result_all_own" on public.allocation_result
  for all to authenticated
  using (exists (select 1 from public.import_batch b where b.id = allocation_result.batch_id and b.user_id = (select auth.uid())))
  with check (exists (select 1 from public.import_batch b where b.id = allocation_result.batch_id and b.user_id = (select auth.uid())));

create policy "validation_log_all_own" on public.validation_log
  for all to authenticated
  using (exists (select 1 from public.import_batch b where b.id = validation_log.batch_id and b.user_id = (select auth.uid())))
  with check (exists (select 1 from public.import_batch b where b.id = validation_log.batch_id and b.user_id = (select auth.uid())));

-- ============================================================
-- RLS 정책: fx_rate_cache (공용 읽기, 쓰기는 인증 사용자)
-- ============================================================
create policy "fx_rate_cache_select_all" on public.fx_rate_cache
  for select using (true);
create policy "fx_rate_cache_insert_auth" on public.fx_rate_cache
  for insert to authenticated with check ((select auth.uid()) is not null);
create policy "fx_rate_cache_update_auth" on public.fx_rate_cache
  for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

-- ============================================================
-- Storage: import-files 비공개 버킷 + 사용자별 접근 정책
-- 저장 경로 규약: {auth.uid()}/{batchId}/{filename}
-- ============================================================
insert into storage.buckets (id, name, public)
values ('import-files', 'import-files', false)
on conflict (id) do nothing;

create policy "import_files_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'import-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "import_files_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'import-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "import_files_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'import-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'import-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "import_files_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'import-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
