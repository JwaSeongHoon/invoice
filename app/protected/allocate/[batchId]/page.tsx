import { AllocationResult } from "@/components/allocation-result";

export default async function AllocatePage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;

  return (
    <section className="flex w-full flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">안분·환율 결과</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          부대비용 안분과 입고일 기준 환율 환산 결과를 확인하고, 필요 시 환율을 수동으로 조정하세요.
        </p>
      </div>
      <AllocationResult batchId={batchId} />
    </section>
  );
}
