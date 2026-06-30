import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProcessStatus } from "@/components/process-status";

export default async function ProcessPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return (
    <section className="flex w-full flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">처리 진행</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          신고필증 OCR과 수량 검증을 진행합니다. 완료되면 매칭 검토로 이동합니다.
        </p>
      </div>
      <ProcessStatus batchId={batchId} />
    </section>
  );
}
