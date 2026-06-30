export default async function AllocatePage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;

  return (
    <section className="flex w-full flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">안분·환율 결과</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          배치 {batchId}의 부대비용 안분과 환율 환산 결과입니다. (구현 예정)
        </p>
      </div>
    </section>
  );
}
