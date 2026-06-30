import { MatchReview } from "@/components/match-review";

export default async function MatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;

  return (
    <section className="flex w-full flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">매칭 검토</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          영문 신고필증과 한글 입고현황의 품목 매칭 결과를 검토하고, 확인요 항목을 확정하세요.
        </p>
      </div>
      <MatchReview batchId={batchId} />
    </section>
  );
}
