/**
 * Layer: repo — 어드민 **로스터 표시 전용** 사용자 목록 (users.ts 에서 분리, 500줄 cap).
 *
 * listDistinctUsers = listAllUsers 에 dedup 적용. 같은 사람(같은 시트 / 같은 이메일)의 여러 행을
 * 대표 1행으로 접는다(admin-roster-dup: 아레나 재참가·시트공유 별칭으로 1인 2행 표시).
 */
import type { User } from "@/types";
import { listAllUsers } from "./users";
import { distinctByPreferred } from "./user-priority";

/**
 * 표시(로스터) 전용 — dedup 된 사용자 목록. 정렬은 listAllUsers 보존.
 *
 * ⚠️ **행 단위 뮤테이션엔 쓰지 말 것** — approve/assign/install-formulas 등은 raw `listAllUsers`
 * 를 써야 타겟 행이 살아있다. dedup 하면 대표 아닌 행이 사라져 그 행을 못 건드린다.
 */
export async function listDistinctUsers(): Promise<User[]> {
  return distinctByPreferred(await listAllUsers());
}
