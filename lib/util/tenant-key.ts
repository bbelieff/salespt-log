/**
 * 수강생(사업장) 고유 번호 — DB 의 `spreadsheet_id` 열에 저장되는 tenant 키 규칙.
 *
 * 배경(ADR-0038): DB 는 모든 기록을 `spreadsheet_id` 로 사람별로 나눈다. 지금까지 그 값은
 * 항상 구글 시트 ID 였지만, 시트 없이 수강생을 만들려면 시트가 아닌 고유 번호가 필요하다.
 * - 기존 시트 ID 는 그대로 **불투명한 고유 번호**로 계속 쓴다(재키잉 없음 = 데이터 이동 0).
 * - 새로 시트 없이 만드는 수강생은 `local:<uuid>` 를 받는다. `:` 는 구글 시트 ID 문자집합
 *   (A-Z a-z 0-9 - _)에 없어서 두 종류가 절대 섞이지 않는다.
 * - 빈 값("")은 tenant 키가 아니다 — 시트 없는 사람끼리 기록이 한 통에 섞인다(#798 보류 사유).
 *
 * 순수 유틸 — import 0. uuid 는 호출부가 넘긴다(테스트 결정성).
 */
export const SHEETLESS_TENANT_PREFIX = "local:";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 시트 없는 새 수강생의 고유 번호. uuid 는 crypto.randomUUID() 결과를 넘긴다. */
export function newSheetlessTenantKey(uuid: string): string {
  if (!UUID_RE.test(uuid)) throw new Error("tenant-key: uuid 형식이 아닙니다");
  return `${SHEETLESS_TENANT_PREFIX}${uuid.toLowerCase()}`;
}

/** 시트 없이 만든 고유 번호인가 (local:<uuid>). */
export function isSheetlessTenantKey(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(SHEETLESS_TENANT_PREFIX);
}

/** 실제 구글 시트가 연결된 고유 번호인가 — 시트 API 를 불러도 되는 유일한 조건. */
export function hasRealSheet(id: string | null | undefined): boolean {
  return typeof id === "string" && id.trim() !== "" && !isSheetlessTenantKey(id);
}

/** 기록을 나누는 키로 쓸 수 있는가 — 빈 값은 모든 시트 없는 사람을 한 통에 섞는다. */
export function isUsableTenantKey(id: string | null | undefined): boolean {
  return typeof id === "string" && id.trim() !== "";
}
