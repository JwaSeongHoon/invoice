import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listImportBatches } from "@/app/actions/batch";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BatchStatus } from "@/lib/types/enums";

/** 배치 상태 → 한국어 라벨·배지 색상 */
const STATUS_LABEL: Record<
  BatchStatus,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  uploading: { label: "업로드 중", variant: "secondary" },
  processing: { label: "처리 중", variant: "secondary" },
  matching: { label: "매칭 중", variant: "secondary" },
  done: { label: "완료", variant: "default" },
  error: { label: "오류", variant: "destructive" },
};

export default async function ProtectedPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const batches = await listImportBatches();

  return (
    <div className="flex w-full flex-1 flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">배치 목록</h1>
          <p className="text-muted-foreground mt-1 text-sm">처리된 수입정산 배치 목록입니다.</p>
        </div>
        <Button asChild>
          <Link href="/protected/upload">새 정산 처리</Link>
        </Button>
      </div>

      {batches.length === 0 ? (
        <EmptyState
          title="아직 처리된 배치가 없습니다"
          description="수입신고필증과 입고현황 파일을 업로드하여 첫 정산을 시작하세요."
          action={
            <Button asChild>
              <Link href="/protected/upload">새 정산 처리</Link>
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>생성일</TableHead>
              <TableHead>B/L번호</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => {
              const status = STATUS_LABEL[batch.status as BatchStatus];
              return (
                <TableRow key={batch.id}>
                  <TableCell>{new Date(batch.created_at).toLocaleDateString("ko-KR")}</TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/protected/process/${batch.id}`}>열기</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
