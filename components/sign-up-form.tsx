"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/utils/auth-errors";
import { signUpSchema, type SignUpFormData } from "@/lib/schemas/auth";
import { showSuccess, showError } from "@/lib/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

export function SignUpForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter();
  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", repeatPassword: "" },
  });

  const onSubmit = async (data: SignUpFormData) => {
    const supabase = createClient();

    try {
      const { data: result, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      // 이미 가입된 사용자인 경우 체크
      // Supabase는 보안상 이유로 이미 가입된 이메일로 signUp 시
      // user: null, session: null을 반환 (에러를 반환하지 않음)
      if (!result.user) {
        showError("이미 가입된 이메일 주소입니다. 로그인 페이지에서 로그인해주세요.");
        return;
      }

      // 회원가입 성공
      // - session이 있는 경우: 이메일 인증이 비활성화되어 즉시 로그인됨
      // - session이 없는 경우: 이메일 인증이 필요함 (인증 이메일 발송됨)
      showSuccess("회원가입이 완료되었습니다");
      router.push("/auth/sign-up-success");
    } catch (error: unknown) {
      showError(getAuthErrorMessage(error));
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">회원가입</CardTitle>
          <CardDescription>새 계정 만들기</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>이메일</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="example@email.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>비밀번호</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="repeatPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>비밀번호 확인</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "계정 생성 중..." : "회원가입"}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            이미 계정이 있으신가요?{" "}
            <Link href="/auth/login" className="underline underline-offset-4">
              로그인
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
