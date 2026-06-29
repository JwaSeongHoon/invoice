export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/**
 * Supabase 데이터베이스 타입 정의 (스타터 기본 스텁)
 *
 * 실제 테이블을 만든 뒤에는 아래 명령으로 이 파일을 자동 생성하세요:
 *   npm run db:types        (원격 프로젝트, SUPABASE_PROJECT_ID 환경 변수 필요)
 *   npm run db:types:local  (로컬 Supabase)
 */
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
