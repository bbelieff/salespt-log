/**
 * 관리자 왼쪽 메뉴(admin-side-nav) 승인 대기 수 — 홈 카드와 같은 registry 캐시.
 * 읽기 실패는 0 으로 둔다(메뉴 숫자 때문에 관리자 화면이 막히지 않게).
 */
import { listPendingTrainees, listPendingTrainers } from "@/repo/users";

export async function getAdminPendingCounts(): Promise<{ trainees: number; trainers: number }> {
  const [trainees, trainers] = await Promise.all([
    listPendingTrainees().catch(() => []),
    listPendingTrainers().catch(() => []),
  ]);
  return { trainees: trainees.length, trainers: trainers.length };
}
