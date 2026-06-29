import { defineConfig, devices } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

// .env.local 파일 로드
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

/**
 * Playwright 테스트 설정
 *
 * Next.js 앱의 E2E 테스트를 위한 설정입니다.
 * 관리자 기능 테스트에 최적화되어 있습니다.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // 테스트 파일 위치
  testDir: "./e2e",

  // 병렬 실행 설정
  fullyParallel: true,

  // CI에서 실패 시 재시도 안 함
  forbidOnly: !!process.env.CI,

  // 로컬에서 실패 시 1번 재시도
  retries: process.env.CI ? 2 : 1,

  // 병렬 워커 수
  workers: process.env.CI ? 1 : undefined,

  // 리포터 설정
  reporter: "html",

  // 공통 테스트 설정
  use: {
    // 기본 URL (로컬 개발 서버)
    baseURL: "http://localhost:3000",

    // 스크린샷 설정 (실패 시만)
    screenshot: "only-on-failure",

    // 비디오 설정 (실패 시만)
    video: "retain-on-failure",

    // 트레이스 설정 (실패 시만)
    trace: "on-first-retry",

    // 타임아웃 설정
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // 프로젝트별 설정 (브라우저)
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // 로컬 개발 서버 설정
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2분
  },
});
