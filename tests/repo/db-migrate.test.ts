/**
 * db-migrate.mjs 러너의 핵심 결정 로직(computePending) 단위 테스트 — DB 연결 없이 검증(BBE-54).
 * 실제 DATABASE_URL 이 없는 환경(로컬·CI)에서도 "무엇이 대기 중인지·체크섬 불일치를 잡아내는지"를
 * 확인할 수 있다. 러너 본체(run())는 top-level 부작용이 없어(main-module 가드) 이 import 만으로는
 * DB 에 연결하지 않는다.
 */
import { describe, expect, it } from "vitest";
import { computePending, loadMigrationFiles, MIGRATIONS_DIR } from "../../scripts/db-migrate.mjs";

describe("computePending — 마이그레이션 대기열 계산(순수 함수)", () => {
  const files = [
    { version: "0001_a.sql", sql: "create table a();", checksum: "sha-a" },
    { version: "0002_b.sql", sql: "create table b();", checksum: "sha-b" },
  ];

  it("적용 이력이 없으면 전부 대기 중", () => {
    expect(computePending(files, [])).toEqual(files);
  });

  it("일부만 적용됐으면 나머지만 대기 중", () => {
    const pending = computePending(files, [{ version: "0001_a.sql", checksum: "sha-a" }]);
    expect(pending).toEqual([files[1]]);
  });

  it("전부 적용됐으면 대기 없음", () => {
    const pending = computePending(files, [
      { version: "0001_a.sql", checksum: "sha-a" },
      { version: "0002_b.sql", checksum: "sha-b" },
    ]);
    expect(pending).toEqual([]);
  });

  it("이미 적용된 파일의 체크섬이 안 맞으면 throw(사후 수정 감지)", () => {
    expect(() =>
      computePending(files, [{ version: "0001_a.sql", checksum: "sha-DIFFERENT" }]),
    ).toThrow(/체크섬 불일치/);
  });
});

describe("loadMigrationFiles — 실제 마이그레이션 디렉토리 실측", () => {
  it("0001_users_cohorts.sql 이 존재하고 이름순으로 로드된다", async () => {
    const files = await loadMigrationFiles(MIGRATIONS_DIR);
    expect(files.length).toBeGreaterThanOrEqual(1);
    const first = files[0]!;
    expect(first.version).toBe("0001_users_cohorts.sql");
    expect(first.sql).toContain("create table if not exists users");
    expect(first.sql).toContain("create table if not exists cohorts");
    // 파일 목록이 정렬돼 있는지(버전 번호 순서 보장)
    const sorted = [...files.map((f) => f.version)].sort();
    expect(files.map((f) => f.version)).toEqual(sorted);
  });

  it("존재하지 않는 디렉토리는 빈 배열(첫 실행 전 상태 안전)", async () => {
    const files = await loadMigrationFiles("/no/such/dir/at/all");
    expect(files).toEqual([]);
  });
});
