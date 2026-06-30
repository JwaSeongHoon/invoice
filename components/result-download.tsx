"use client";

import { Download, FileText, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
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
import { ECOUNT_COLUMNS } from "@/lib/types/constants";
import type { ValidationType } from "@/lib/types/enums";

type Cell = string | number;
type Category = "input" | "auto" | "reverse" | "confirm";

/** ECOUNT_COLUMNS 컬럼별 색상 카테고리 (영업팀 입력/자동 기입/역산 보정/자동 확정) */
function categoryOf(key: string, isAuto: boolean): Category {
  if (key === "unit_price") return "reverse"; // 단가 = 역산 보정 외화단가 × 환율
  if (key === "remark") return "confirm"; // 적요 = 자동 확정된 BL번호
  return isAuto ? "auto" : "input";
}

const CATEGORY_STYLE: Record<Category, string> = {
  input: "bg-muted/40",
  auto: "bg-green-50 dark:bg-green-950/30",
  reverse: "bg-blue-50 dark:bg-blue-950/30",
  confirm: "bg-amber-50 dark:bg-amber-950/30",
};

const CATEGORY_LABEL: Record<Category, string> = {
  input: "영업팀 입력",
  auto: "자동 기입",
  reverse: "역산 보정",
  confirm: "자동 확정",
};

const VALIDATION_LABEL: Record<ValidationType, string> = {
  qty3541: "수량(㉟=㊶)",
  unitprice: "단가 역산",
  alloc_freight: "운반비 안분",
  alloc_fee: "수수료 안분",
  alloc_etc: "기타 안분",
};

export interface ResultValidation {
  type: ValidationType;
  passed: boolean;
}

export interface ResultDownloadProps {
  batchId: string;
  rows: Record<string, Cell>[];
  validations: ResultValidation[];
  allPassed: boolean;
}

export function ResultDownload({ batchId, rows, validations, allPassed }: ResultDownloadProps) {
  const columns = ECOUNT_COLUMNS.map((c) => ({
    key: c.key,
    label: c.label,
    category: categoryOf(c.key, c.isAuto),
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* 검증 요약 + 다운로드 */}
      <Card>
        <CardHeader>
          <CardTitle>검증 요약 및 다운로드</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {validations.map((v) => (
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
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {allPassed ? (
              <Button asChild>
                <a href={`/api/export/${batchId}`} download>
                  <Download className="mr-1 h-4 w-4" />
                  이카운트 양식 다운로드
                </a>
              </Button>
            ) : (
              <Button disabled>
                <Download className="mr-1 h-4 w-4" />
                이카운트 양식 다운로드
              </Button>
            )}
            <Button asChild variant="outline">
              <a href={`/api/export/${batchId}?type=report`} download>
                <FileText className="mr-1 h-4 w-4" />
                검증 리포트 다운로드
              </a>
            </Button>
            <Button asChild variant="ghost" className="ml-auto">
              <a href="/protected">
                <ArrowLeft className="mr-1 h-4 w-4" />
                배치 목록으로
              </a>
            </Button>
          </div>

          {!allPassed && (
            <p className="text-destructive text-sm">
              검증 3종(㉟=㊶·단가 역산·안분 합계)을 모두 통과해야 이카운트 양식을 다운로드할 수
              있습니다. 검증 리포트에서 불일치 항목을 확인하세요.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 24컬럼 미리보기 */}
      <Card>
        <CardHeader>
          <CardTitle>이카운트 24컬럼 미리보기 ({rows.length}행)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* 색상 범례 */}
          <div className="flex flex-wrap gap-3 text-xs">
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => (
              <span key={cat} className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 rounded-sm border ${CATEGORY_STYLE[cat]}`} />
                {CATEGORY_LABEL[cat]}
              </span>
            ))}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col.key} className={`${CATEGORY_STYLE[col.category]} text-xs`}>
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={idx}>
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={`${CATEGORY_STYLE[col.category]} text-xs whitespace-nowrap`}
                      >
                        {row[col.key] === "" || row[col.key] === undefined
                          ? ""
                          : String(row[col.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
