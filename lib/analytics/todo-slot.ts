/**
 * 기록(Todo·History)이 몇 번째 진행건(수납1~3)의 것인가 — 정본 한 곳.
 *
 * 2026-10-23 belie: 진행 1·2 가 같은 기관이면 기록이 두 진행건에 모두 붙었다(기관 이름으로만 연결).
 * 새 기록은 진행건 번호(slot)를 저장하고, 번호 없는 옛 기록은 기관 이름으로 추정한다 —
 * 그 기관을 쓰는 진행건이 하나면 거기, 여럿이면 첫 진행건에 「진행건 확인 필요」로 한 번만 보인다.
 * 운영 데이터는 고치지 않는다(읽을 때 판단).
 */
import type { ContractPayment, Todo } from "@/types";
import { normalizeInstitution } from "@/util/institution-match";
import { slotsOf, type SlotNo } from "./contract-slots";

export type TodoSlot = { slot: SlotNo | null; ambiguous: boolean };

export function todoSlotOf(
  cp: Pick<ContractPayment, "수납1" | "수납2" | "수납3">,
  todo: Pick<Todo, "institutionRef"> & { slot?: Todo["slot"] },
): TodoSlot {
  if (todo.slot) return { slot: todo.slot, ambiguous: false };
  const institution = normalizeInstitution(todo.institutionRef);
  const matches = slotsOf(cp).filter(([, s]) => normalizeInstitution(s.진행기관) === institution).map(([n]) => n);
  if (matches.length === 0) return { slot: null, ambiguous: false };
  return { slot: matches[0]!, ambiguous: matches.length > 1 };
}
