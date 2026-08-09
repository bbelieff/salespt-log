/**
 * 시트 읽기 렌더 옵션 일치 가드 (BBE-91 · 2026-08-09).
 *
 * 사고 형태: 레지스트리를 읽는 주체가 둘인데(앱 = `lib/repo/sheets-client.ts`,
 * 1회 백필 = `scripts/ops/backfill-registry.mjs`) 렌더 옵션이 달랐다. 백필이
 * `dateTimeRenderOption` 을 생략해 Sheets API 기본값 `SERIAL_NUMBER` 로 읽는 바람에,
 * 같은 날짜 셀이 출처에 따라 `"2026. 8. 7."`(앱 미러) / `46241`(백필) 로 갈린다.
 *
 * 왜 자동으로 안 잡혔나: 백필 스크립트의 자기 대조는 **행 수만** 본다. 값 형식은 안 본다.
 * 그래서 조용히 통과한 뒤 `REGISTRY_DB_READ=1` 을 켠 화면에서야 날짜가 깨진 채 드러난다.
 * 영향 컬럼 = `users.course_start_iso`·`users.graduation_iso`(BBE-57 의 D-day·주차·퍼널
 * 정본) · `cohorts.season_start_iso`(전광판 시즌 판정 정본).
 *
 * 그래서 "같아야 한다"를 문서가 아니라 테스트로 박는다 — 한쪽만 바꾸면 여기서 빨개진다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

/** `spreadsheets.values.get({...})` 호출부에서 렌더 옵션 2종을 뽑는다. */
function renderOptions(src: string, anchor: string) {
  const at = src.indexOf(anchor);
  expect(at, `앵커를 못 찾음: ${anchor}`).toBeGreaterThan(-1);
  const window = src.slice(at, at + 600);
  return {
    value: window.match(/valueRenderOption:\s*"([A-Z_]+)"/)?.[1] ?? null,
    dateTime: window.match(/dateTimeRenderOption:\s*"([A-Z_]+)"/)?.[1] ?? null,
  };
}

describe("레지스트리 시트 읽기 렌더 옵션", () => {
  const app = renderOptions(read("lib/repo/sheets-client.ts"), "export async function readRange");
  const backfill = renderOptions(
    read("scripts/ops/backfill-registry.mjs"),
    "async function readRange",
  );

  it("앱 경로가 두 옵션을 모두 명시한다 (API 기본값에 기대지 않는다)", () => {
    expect(app.value).toBe("UNFORMATTED_VALUE");
    expect(app.dateTime).toBe("FORMATTED_STRING");
  });

  it("백필이 dateTimeRenderOption 을 생략하지 않는다 — 생략 시 SERIAL_NUMBER 로 갈린다", () => {
    expect(
      backfill.dateTime,
      "scripts/ops/backfill-registry.mjs 의 readRange 에 dateTimeRenderOption 이 없다. " +
        '생략하면 Sheets API 기본값 SERIAL_NUMBER 라 날짜가 "2026. 8. 7." 대신 46241 로 적재된다. ' +
        'lib/repo/sheets-client.ts 와 같은 "FORMATTED_STRING" 을 명시하세요.',
    ).not.toBeNull();
  });

  it("백필과 앱이 같은 눈으로 시트를 본다 (두 옵션 모두 동일)", () => {
    expect(
      backfill,
      "백필과 앱의 렌더 옵션이 다르면 같은 셀이 출처에 따라 두 형식으로 DB 에 들어간다. " +
        "이중기록 미러(BBE-55)는 앱 경로, 1회 백필은 이 스크립트 — 둘이 같은 테이블을 채운다.",
    ).toEqual(app);
  });
});
