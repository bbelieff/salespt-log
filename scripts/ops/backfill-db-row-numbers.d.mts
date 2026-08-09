// backfill-db-row-numbers.mjs 의 테스트용 타입 선언. tsconfig 의 allowJs:false 때문에 필요
// (db-migrate.d.mts 와 같은 관례 — 테스트가 import 하는 이 스크립트 하나만 타입을 선언한다).
export function resolveDatabaseUrl(): string;
export function legacyRowNumber(rowKey: string): number | null;
export function hasRowNumber(payload: unknown): boolean;
export function pendingRowNumber(rowKey: string, payload: unknown): number | null;
