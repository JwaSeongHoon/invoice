/**
 * 토스트 알림 유틸리티
 *
 * sonner 라이브러리의 toast 함수를 래핑하여 일관된 토스트 메시지를 제공합니다.
 */

import { toast } from "sonner";

/**
 * 성공 토스트 메시지 표시
 *
 * @param message - 표시할 메시지
 *
 * @example
 * showSuccess("이벤트가 생성되었습니다!")
 */
export function showSuccess(message: string): void {
  toast.success(message);
}

/**
 * 에러 토스트 메시지 표시
 *
 * @param message - 표시할 에러 메시지
 *
 * @example
 * showError("이벤트 생성에 실패했습니다.")
 */
export function showError(message: string): void {
  toast.error(message);
}

/**
 * 정보 토스트 메시지 표시
 *
 * @param message - 표시할 정보 메시지
 *
 * @example
 * showInfo("이벤트가 곧 시작됩니다.")
 */
export function showInfo(message: string): void {
  toast.info(message);
}
