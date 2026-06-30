import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Page({ searchParams }: { searchParams: Promise<{ error: string }> }) {
  const params = await searchParams;

  return (
    <AuthShell>
      <Card className="border-t-destructive border-t-2">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">문제가 발생했습니다</CardTitle>
        </CardHeader>
        <CardContent>
          {params?.error ? (
            <p className="text-muted-foreground text-sm">오류 코드: {params.error}</p>
          ) : (
            <p className="text-muted-foreground text-sm">알 수 없는 오류가 발생했습니다.</p>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
