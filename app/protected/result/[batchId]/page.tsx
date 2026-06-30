export default async function ResultPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;

  return (
    <section className="flex w-full flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">결과 다운로드</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          배치 {batchId}의 이카운트 양식과 검증 리포트를 다운로드합니다. (구현 예정)
        </p>
      </div>
    </section>
  );
}
