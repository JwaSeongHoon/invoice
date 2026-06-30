import { z } from "zod";

/**
 * 인증 폼 Zod 스키마 (단일 진실 공급원)
 *
 * 클라이언트(React Hook Form resolver)와 서버 검증에서 공용으로 사용한다.
 */

export const emailSchema = z
  .string()
  .min(1, "이메일을 입력해주세요")
  .email("올바른 이메일 형식이 아닙니다");

/** 로그인: 존재 여부만 검증(형식 검증은 Supabase에 위임) */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

/** 회원가입: 비밀번호 최소 6자(Supabase 기본 정책) + 확인 일치 */
export const signUpSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다"),
    repeatPassword: z.string().min(1, "비밀번호 확인을 입력해주세요"),
  })
  .refine((data) => data.password === data.repeatPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["repeatPassword"],
  });

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
