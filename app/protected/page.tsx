import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">배치 목록</h1>
        <p className="text-muted-foreground mt-1 text-sm">처리된 수입정산 배치 목록입니다.</p>
      </div>
      <p className="text-muted-foreground text-sm">아직 처리된 배치가 없습니다.</p>
    </div>
  );
}
