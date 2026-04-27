/**
 * Layer: service — 유스케이스. Repo 조합 + 도메인 규칙.
 * UI/Runtime(API Route) 에서 호출하는 유일한 진입점이 되어야 한다.
 *
 * PR 1 시점: 사용자 조회만 노출. 데이터 I/O 는 PR 2/3 에서
 *   `meetings.ts`, `payments.ts`, `sales.ts` repo 가 추가된 후 합류.
 */
import { findUserByEmail } from "@/repo/users";

export async function resolveUser(email: string) {
  return findUserByEmail(email);
}

export { summarize, type Stats } from "./gamification";
