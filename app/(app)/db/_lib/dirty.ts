/**
 * DB생산 폼 미저장(dirty) 판정 — **자동(formula) 필드 제외**, 사용자 입력 필드만 비교.
 *
 * 배경(2026-07-20 유실 사고): RowCard 가 formula 포함 computed 스냅샷을 기준선으로 잡아,
 * 수식/자동값이 mount 정착·refetch 로 흔들릴 때마다 **상시 거짓 dirty** → 이동마다 이탈 가드 모달
 * 반복 + discard 가 잘못된 기준선으로 되돌려 데이터 유실 체감. 판정을 **서버 기준값(blank) vs
 * 현재 입력(draft)** 의 non-formula 필드 비교로 바꿔 거짓양성 0.
 */
import type { FieldDef } from "./channels";

function norm(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "boolean") return v ? "1" : "0";
  return String(v);
}

/** 사용자가 입력 필드를 실제로 바꿨는가. formula(자동 계산) 필드는 판정에서 제외. */
export function rowFormDirty(
  fields: readonly FieldDef[],
  base: Record<string, unknown>,
  current: Record<string, unknown>,
): boolean {
  return fields.some(
    (f) => !f.formula && norm(base[f.key]) !== norm(current[f.key]),
  );
}
