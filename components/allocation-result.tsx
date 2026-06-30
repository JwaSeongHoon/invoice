"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { showSuccess, showError } from "@/lib/utils/toast";
import { getAuthErrorMessage } from "@/lib/utils/auth-errors";
import type {
  AllocateResponse,
  AllocationRow,
  FxSourceSummary,
  ValidationSummary,
} from "@/lib/types/domain";

const FX_SOURCE_LABEL: Record<FxSourceSummary["source"], string> = {
  hana: "하나은행",
  smbs: "서울외환",
  manual: "수동 입력",
};

const VALIDATION_LABEL: Record<ValidationSummary["type"], string> = {
  qty3541: "수량(㉟=㊶)",
  unitprice: "단가 역산",
  alloc_freight: "운반비 안분",
  alloc_fee: "수수료 안분",
  alloc_etc: "기타 안분",
};

/** 원화 정수 표기 */
function won(value: number): string {
  return Math.round(value).toLocaleString("ko-KR");
}

function fxKey(fx: FxSourceSummary): string {
  return `${fx.quote_date}|${fx.currency}`;
}

export function AllocationResult({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [data, setData] = useState<AllocateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState<string | null>(null);
  const started = useRef(false);

  async function loadAllocations(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch("/api/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      const body = (await res.json()) as AllocateResponse & { error?: string };
      if (!res.ok) {
        setError(body.error ?? "안분 계산에 실패했습니다.");
        return;
      }
      setError(null);
      setData(body);
    } catch {
      setError("안분 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (started.current) return; // React strict mode 중복 실행 방지
    started.current = true;
    void loadAllocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  async function applyManualRate(fx: FxSourceSummary): Promise<void> {
    const key = fxKey(fx);
    const raw = manualInputs[key];
    const rate = Number(raw);
    if (!raw || !Number.isFinite(rate) || rate <= 0) {
      showError("수동 환율은 0보다 큰 숫자여야 합니다.");
      return;
    }
    setApplying(key);
    try {
      const res = await fetch("/api/fx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: fx.quote_date, currency: fx.currency, manualRate: rate }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        showError(body.error ?? "수동 환율 적용에 실패했습니다.");
        return;
      }
      showSuccess("수동 환율을 적용했습니다. 재계산합니다.");
      setManualInputs((prev) => ({ ...prev, [key]: "" }));
      await loadAllocations();
    } catch (err) {
      showError(getAuthErrorMessage(err));
    } finally {
      setApplying(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        안분·환율 결과를 계산하는 중입니다...
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-destructive/40 bg-destructive/10 flex flex-col gap-3 rounded-md border p-4">
        <p className="text-destructive text-sm font-medium">{error}</p>
        <Button asChild variant="outline" size="sm" className="self-start">
          <a href={`/protected/match/${batchId}`}>매칭 검토로 이동</a>
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const allPassed = data.validations.every((v) => v.passed);

  return (
    <div className="flex flex-col gap-4">
      {/* 환율 출처 + 수동 오버라이드 */}
      <Card>
        <CardHeader>
          <CardTitle>적용 환율</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data.fxSources.map((fx) => {
            const key = fxKey(fx);
            return (
              <div key={key} className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">
                  {fx.currency} · {fx.quote_date}
                </span>
                <Badge variant={fx.source === "manual" ? "default" : "secondary"}>
                  {FX_SOURCE_LABEL[fx.source]}
                </Badge>
                <span className="text-sm">{fx.rate.toLocaleString("ko-KR")} 원</span>
                <div className="ml-auto flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="수동 환율"
                    className="h-8 w-32"
                    value={manualInputs[key] ?? ""}
                    onChange={(e) =>
                      setManualInputs((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={applying === key}
                    onClick={() => applyManualRate(fx)}
                  >
                    {applying === key ? <Loader2 className="h-4 w-4 animate-spin" /> : "적용"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 검증 배지 */}
      <Card>
        <CardHeader>
          <CardTitle>검증 결과</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {data.validations.map((v) => (
            <Badge
              key={v.type}
              className={
                v.passed
                  ? "border-transparent bg-green-600 text-white"
                  : "border-transparent bg-red-600 text-white"
              }
            >
              {v.passed ? (
                <CheckCircle2 className="mr-1 h-3 w-3" />
              ) : (
                <XCircle className="mr-1 h-3 w-3" />
              )}
              {VALIDATION_LABEL[v.type]} {v.passed ? "통과" : "불일치"}
            </Badge>
          ))}
        </CardContent>
      </Card>

      {/* 안분 결과 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>품목별 안분·환산 ({data.rows.length}건)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>품목명</TableHead>
                  <TableHead className="text-right">수량</TableHead>
                  <TableHead className="text-right">환율</TableHead>
                  <TableHead className="text-right">단가(원)</TableHead>
                  <TableHead className="text-right">공급가액</TableHead>
                  <TableHead className="text-right">부가세</TableHead>
                  <TableHead className="text-right">운반비</TableHead>
                  <TableHead className="text-right">수수료</TableHead>
                  <TableHead className="text-right">기타</TableHead>
                  <TableHead>기준</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row: AllocationRow) => (
                  <TableRow key={row.inventory_item_id}>
                    <TableCell className="font-medium">{row.item_name}</TableCell>
                    <TableCell className="text-right">{row.qty.toLocaleString("ko-KR")}</TableCell>
                    <TableCell className="text-right">
                      {row.fx_rate.toLocaleString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right">{won(row.unit_price_krw)}</TableCell>
                    <TableCell className="text-right">{won(row.supply_amount)}</TableCell>
                    <TableCell className="text-right">{won(row.vat)}</TableCell>
                    <TableCell className="text-right">{won(row.freight)}</TableCell>
                    <TableCell className="text-right">{won(row.fee)}</TableCell>
                    <TableCell className="text-right">{won(row.etc_amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {row.alloc_basis === "decl" ? "신고수량" : "입고수량"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              {allPassed
                ? "검증 3종이 모두 통과했습니다. 결과를 다운로드할 수 있습니다."
                : "검증 불일치 항목이 있어 다운로드가 제한될 수 있습니다."}
            </p>
            <Button onClick={() => router.push(`/protected/result/${batchId}`)}>
              다운로드
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
