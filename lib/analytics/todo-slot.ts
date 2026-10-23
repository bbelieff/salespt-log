/**
 * 기록(Todo·History)이 몇 번째 진행건(수납1~3)의 것인가 — 정본 한 곳.
 *
 * 2026-10-23 belie: 진행 1·2 가 같은 기관이면 기록이 두 진행건에 모두 붙었다(기관 이름으로만 연결).
 * 새 기록은 진행건 번호(slot)를 저장하고, 번호 없는 옛 기록은 기관 이름으로 추정한다 —
 * 그 기관을 쓰는 진행건이 하나면 거기, 여럿이면 첫 진행건에 「진행건 확인 필요」로 한 번만 보인다.
 *
 * 2026-10-23 후속(챙길 일에서 안 사라지는 할 일): 진행기관 칸을 나중에 고치면(「소진공 혁신」→「소진공」)
 * 옛 기록의 기관 이름이 어느 진행건과도 같지 않아 **실무/수납 어디에도 안 보였다.** 대시보드는 계약으로
 * 묶어 계속 「밀린 할 일」로 띄우는데 실무/수납에서는 찾을 수도, 완료할 수도 없었다.
 * 그래서 맞는 진행건이 없는 옛 기록도 한 진행건에 「진행건 확인 필요」로 보이게 한다 —
 * 기관 이름이 진행건 기관으로 시작하면(「소진공 신취」→「소진공」 진행건) 그 진행건, 아니면 첫 진행건.
 * 확정이 아니므로 ambiguous=true — 대시보드·업무 현황은 이 추정으로 진행건 상태를 바꾸지 않는다.
 * 운영 데이터는 고치지 않는다(읽을 때 판단).
 */
import type { ContractPayment, Todo } from "@/types";
import { normalizeInstitution } from "@/util/institution-match";
import { slotHasData, slotsOf, type SlotNo } from "./contract-slots";

/** shared = 같은 기관 진행건이 여럿 · unmatched = 기관 이름이 어느 진행건과도 같지 않음. */
export type TodoSlotUncertainty = "shared" | "unmatched";
export type TodoSlot = { slot: SlotNo | null; ambiguous: boolean; reason?: TodoSlotUncertainty };

/** 「소진공 신취」는 「소진공」 진행건으로 — 단어 경계(공백)까지 같을 때만. 「소진공사」는 아니다. */
function startsWithInstitution(record: string, slotInstitution: string): boolean {
  return slotInstitution !== "" && record.startsWith(`${slotInstitution} `);
}

export function todoSlotOf(
  cp: Pick<ContractPayment, "수납1" | "수납2" | "수납3">,
  todo: Pick<Todo, "institutionRef"> & { slot?: Todo["slot"] },
): TodoSlot {
  if (todo.slot) return { slot: todo.slot, ambiguous: false };
  const institution = normalizeInstitution(todo.institutionRef);
  const slots = slotsOf(cp);
  const matches = slots.filter(([, s]) => normalizeInstitution(s.진행기관) === institution).map(([n]) => n);
  if (matches.length === 1) return { slot: matches[0]!, ambiguous: false };
  if (matches.length > 1) return { slot: matches[0]!, ambiguous: true, reason: "shared" };
  const prefixed = slots.find(([, s]) => startsWithInstitution(institution, normalizeInstitution(s.진행기관)));
  const fallback = prefixed ?? slots.find(([, s]) => slotHasData(s)) ?? slots[0]!;
  return { slot: fallback[0], ambiguous: true, reason: "unmatched" };
}
