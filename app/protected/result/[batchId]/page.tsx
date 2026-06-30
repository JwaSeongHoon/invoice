import { createClient } from "@/lib/supabase/server";
import { ResultDownload, type ResultValidation } from "@/components/result-download";
import { ecountCells, type EcountRowInput, type Cell } from "@/lib/export/build-ecount-xlsx";
import { REQUIRED_VALIDATIONS } from "@/lib/types/constants";

interface AllocRow {
  inventory_item_id: string;
  fx_rate: number | null;
  unit_price_krw: number | null;
  supply_amount: number | null;
  vat: number | null;
  bl_no: string | null;
  freight: number | null;
  fee: number | null;
  etc_amount: number | null;
}
interface InvRow {
  id: string;
  row_no: number;
  item_code: string;
  item_name: string;
  qty: number;
  unit_price_fx: number | null;
  currency_code: string;
  in_date: string | null;
}

export default async function ResultPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const supabase = await createClient();

  const [allocRes, invRes, logRes] = await Promise.all([
    supabase
      .from("allocation_result")
      .select(
        "inventory_item_id, fx_rate, unit_price_krw, supply_amount, vat, bl_no, freight, fee, etc_amount"
      )
      .eq("batch_id", batchId),
    supabase
      .from("inventory_item")
      .select("id, row_no, item_code, item_name, qty, unit_price_fx, currency_code, in_date")
      .eq("batch_id", batchId)
      .order("row_no", { ascending: true }),
    supabase.from("validation_log").select("type, passed").eq("batch_id", batchId),
  ]);

  const allocs = (allocRes.data ?? []) as AllocRow[];
  const invs = (invRes.data ?? []) as InvRow[];
  const allocByInv = new Map<string, AllocRow>(allocs.map((a) => [a.inventory_item_id, a]));

  // 입고 원본 순서(row_no)로 미리보기 행 조립 — 안분 결과가 있는 행만
  const rows: Record<string, Cell>[] = [];
  for (const inv of invs) {
    const alloc = allocByInv.get(inv.id);
    if (!alloc) continue;
    const input: EcountRowInput = {
      in_date: inv.in_date,
      item_code: inv.item_code,
      item_name: inv.item_name,
      qty: inv.qty,
      unit_price_fx: inv.unit_price_fx,
      currency_code: inv.currency_code,
      fx_rate: alloc.fx_rate,
      unit_price_krw: alloc.unit_price_krw,
      supply_amount: alloc.supply_amount,
      vat: alloc.vat,
      bl_no: alloc.bl_no,
      freight: alloc.freight,
      fee: alloc.fee,
      etc_amount: alloc.etc_amount,
    };
    rows.push(ecountCells(input));
  }

  const passedByType = new Map<string, boolean>();
  for (const l of logRes.data ?? []) passedByType.set(l.type, l.passed);
  const validations: ResultValidation[] = REQUIRED_VALIDATIONS.map((type) => ({
    type,
    passed: passedByType.get(type) === true,
  }));
  const allPassed = validations.every((v) => v.passed);

  return (
    <section className="flex w-full flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">결과 다운로드</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          이카운트 24컬럼 양식을 미리 보고, 검증 통과 시 xlsx와 검증 리포트를 다운로드하세요.
        </p>
      </div>
      <ResultDownload
        batchId={batchId}
        rows={rows}
        validations={validations}
        allPassed={allPassed}
      />
    </section>
  );
}
