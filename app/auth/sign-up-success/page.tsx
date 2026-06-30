import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
  return (
    <AuthShell>
      <Card className="border-t-brand border-t-2">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">가입이 완료되었습니다</CardTitle>
          <CardDescription>이메일을 확인해 주세요</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            회원가입이 정상적으로 완료되었습니다. 로그인하기 전에 이메일로 전송된 인증 링크를 눌러
            계정을 확인해 주세요.
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
