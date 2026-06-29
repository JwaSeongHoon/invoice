/**
 * Supabase Auth 에러 메시지를 한국어로 변환하는 유틸리티
 */

/**
 * Supabase Auth 에러 메시지를 한국어로 변환
 * @param error - 영어 에러 메시지
 * @returns 한국어로 변환된 에러 메시지
 */
export function translateAuthError(error: string): string {
  // 정확한 매칭을 위한 에러 맵
  const exactErrorMap: Record<string, string> = {
    "User already registered": "이미 가입된 이메일 주소입니다",
    "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않습니다",
    "Email not confirmed": "이메일 인증이 완료되지 않았습니다",
    "Password should be at least 6 characters": "비밀번호는 최소 6자 이상이어야 합니다",
    "Signups not allowed for this instance": "현재 회원가입이 허용되지 않습니다",
    "Email rate limit exceeded": "이메일 전송 횟수를 초과했습니다. 잠시 후 다시 시도해주세요",
    "Invalid email": "올바른 이메일 주소를 입력해주세요",
    "Password is too weak": "비밀번호가 너무 약합니다. 더 강력한 비밀번호를 사용해주세요",
    "Unable to validate email address: invalid format": "이메일 주소 형식이 올바르지 않습니다",
    "Email link is invalid or has expired": "이메일 링크가 유효하지 않거나 만료되었습니다",
    "Token has expired or is invalid": "토큰이 만료되었거나 유효하지 않습니다",
    "New password should be different from the old password":
      "새 비밀번호는 이전 비밀번호와 달라야 합니다",
    "Password is too short": "비밀번호가 너무 짧습니다",
    "Password is too long": "비밀번호가 너무 깁니다",
    "Signup requires a valid password": "유효한 비밀번호를 입력해주세요",
  };

  // 정확한 매칭 먼저 시도
  if (exactErrorMap[error]) {
    return exactErrorMap[error];
  }

  // 부분 매칭 (대소문자 무시)
  const lowerError = error.toLowerCase();
  const partialMatches: Array<[string, string]> = [
    ["already registered", "이미 가입된 이메일 주소입니다"],
    ["invalid login", "이메일 또는 비밀번호가 올바르지 않습니다"],
    ["invalid credentials", "이메일 또는 비밀번호가 올바르지 않습니다"],
    ["email not confirmed", "이메일 인증이 완료되지 않았습니다"],
    ["not confirmed", "인증이 완료되지 않았습니다"],
    ["rate limit", "요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요"],
    ["too many requests", "너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요"],
    ["invalid email", "올바른 이메일 주소를 입력해주세요"],
    ["invalid format", "형식이 올바르지 않습니다"],
    ["password", "비밀번호"],
    ["expired", "만료되었습니다"],
    ["invalid", "유효하지 않습니다"],
    ["network", "네트워크 오류가 발생했습니다"],
    ["timeout", "요청 시간이 초과되었습니다"],
  ];

  for (const [keyword, translation] of partialMatches) {
    if (lowerError.includes(keyword)) {
      return translation;
    }
  }

  // 매핑되지 않은 에러는 원본 반환
  return error;
}

/**
 * Supabase Auth 에러 객체에서 메시지를 추출하고 한국어로 변환
 * @param error - Error 객체 또는 문자열
 * @returns 한국어로 변환된 에러 메시지
 */
export function getAuthErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return translateAuthError(error);
  }

  if (error instanceof Error) {
    return translateAuthError(error.message);
  }

  return "오류가 발생했습니다";
}
