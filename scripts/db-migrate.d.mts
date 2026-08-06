// db-migrate.mjs 의 테스트용 타입 선언. tsconfig 의 allowJs:false 때문에 필요
// (레포 전역에 allowJs 를 켜는 대신, 테스트가 import 하는 이 스크립트 하나만 타입을 선언한다).
export interface MigrationFile {
  version: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigrationRow {
  version: string;
  checksum: string;
}

export const MIGRATIONS_DIR: string;
export function loadMigrationFiles(dir?: string): Promise<MigrationFile[]>;
export function computePending(
  files: MigrationFile[],
  appliedRows: AppliedMigrationRow[],
): MigrationFile[];
