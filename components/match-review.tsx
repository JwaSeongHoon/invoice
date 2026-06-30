"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showSuccess, showError } from "@/lib/utils/toast";
import { getAuthErrorMessage } from "@/lib/utils/auth-errors";
import type { MatchReviewItem } from "@/lib/types/domain";

interface MatchResponse {
  items?: MatchReviewItem[];
  error?: string;
}

function StatusBadge({ status }: { status: MatchReviewItem["status"] }) {
  if (status === "match") {
    return <Badge className="border-transparent bg-green-600 text-white">일치</Badge>;
  }
  if (status === "mismatch") {
    return <Badge variant="destructive">불일치</Badge>;
  }
  return <Badge className="border-transparent bg-yellow-500 text-white">확인요</Badge>;
}

function methodLabel(method: MatchReviewItem["method"]): string {
  if (method === "code") return "코드 매칭";
  if (method === "ai") return "AI 매칭";
  if (method === "manual") return "수동 확정";
  return "";
}

export function MatchReview({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<MatchReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // React strict mode 중복 실행 방지
    started.current = true;

    (async () => {
      try {
        const res = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchId }),
        });
        const body = (await res.json()) as MatchResponse;
        if (!res.ok) {
          setError(body.error ?? "매칭에 실패했습니다.");
          return;
        }
        setItems(body.items ?? []);
      } catch {
        setError("매칭 처리 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [batchId]);

  async function confirmMatch(row: MatchReviewItem) {
    const key = selected[row.declaration_item_id];
    if (!key) {
      showError("확정할 입고 그룹을 선택하세요.");
      return;
    }
    const cand = row.candidates?.find((c) => c.inventory_key === key);
    setConfirming(row.declaration_item_id);
    try {
      const res = await fetch(`/api/match/${row.declaration_item_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory_key: key }),
      });
      const body = (await res.json()) as { error?: string; status?: MatchReviewItem["status"] };
      if (!res.ok) {
        showError(body.error ?? "매칭 확정에 실패했습니다.");
        return;
      }
      setItems((prev) =>
        prev.map((it) =>
          it.declaration_item_id === row.declaration_item_id
            ? {
                ...it,
                status: body.status ?? "match",
                method: "manual",
                item_name: cand?.item_name ?? it.item_name,
                inv_qty: cand?.qty_sum ?? it.inv_qty,
                inv_count: cand?.row_count ?? it.inv_count,
                candidates: undefined,
              }
            : it
        )
      );
      showSuccess("매칭을 확정했습니다.");
    } catch (err) {
      showError(getAuthErrorMessage(err));
    } finally {
      setConfirming(null);
    }
  }

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        매칭 결과를 불러오는 중입니다...
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-destructive/40 bg-destructive/10 flex flex-col gap-3 rounded-md border p-4">
        <p className="text-destructive text-sm font-medium">{error}</p>
        <Button asChild variant="outline" size="sm" className="self-start">
          <a href={`/protected/process/${batchId}`}>처리 페이지로 이동</a>
        </Button>
      </div>
    );
  }

  const hasReview = items.some((i) => i.status === "review");

  return (
    <Card>
      <CardHeader>
        <CardTitle>매칭 결과 ({items.length}개 모델)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>영문 모델</TableHead>
              <TableHead>한글 품목명</TableHead>
              <TableHead className="text-right">신고수량</TableHead>
              <TableHead className="text-right">입고수량</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>확정</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => {
              const isReview = row.status === "review";
              const koreanName =
                row.item_name && row.inv_count > 1
                  ? `${row.item_name} 외 ${row.inv_count - 1}건`
                  : (row.item_name ?? "—");
              return (
                <TableRow
                  key={row.declaration_item_id}
                  className={isReview ? "bg-yellow-500/10" : undefined}
                >
                  <TableCell className="font-medium">{row.model ?? "—"}</TableCell>
                  <TableCell>{koreanName}</TableCell>
                  <TableCell className="text-right">{row.decl_qty ?? "—"}</TableCell>
                  <TableCell className="text-right">{row.inv_qty ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    {isReview ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={selected[row.declaration_item_id]}
                          onValueChange={(v) =>
                            setSelected((prev) => ({ ...prev, [row.declaration_item_id]: v }))
                          }
                        >
                          <SelectTrigger size="sm" className="min-w-[200px]">
                            <SelectValue placeholder="입고 그룹 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {(row.candidates ?? []).map((c) => (
                              <SelectItem key={c.inventory_key} value={c.inventory_key}>
                                {c.item_name} ({c.qty_sum}개
                                {c.score > 0 ? `, ${Math.round(c.score * 100)}%` : ""})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={
                            confirming === row.declaration_item_id ||
                            !selected[row.declaration_item_id]
                          }
                          onClick={() => confirmMatch(row)}
                        >
                          {confirming === row.declaration_item_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "확정"
                          )}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {methodLabel(row.method)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            {hasReview
              ? "확인요 항목을 모두 확정해야 결과를 생성할 수 있습니다."
              : "모든 모델이 확정되었습니다."}
          </p>
          <Button
            disabled={hasReview}
            onClick={() => router.push(`/protected/allocate/${batchId}`)}
          >
            결과 생성
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
