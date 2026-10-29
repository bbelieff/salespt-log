/**
 * 제목행 위 시트 제목·요약 줄 건너뛰기(belie 2026-10-29). 값은 모두 가상.
 * 1행 「○○님 디비」, 2행 잔여 개수 요약, 3행 빈 줄, 4행 머리글 — 머리글부터 읽어 제목·요약이 업체로 들어가지 않는다.
 */
import { describe, expect, it } from "vitest";
import { analyzeImport, skipImportPreamble } from "@/app/(app)/db-sheet/_components/adaptive-import";

const HEAD = ["접수시간", "신용700", "국세체납", "연매출액", "사업장소재지", "사업자번호", "이름", "전화번호", "구분", "AS요청", "메모", "접수ID"];
const rows = [
  ["2026-10-28 19:42", "예", "정상", "2억~5억", "대구", "100-00-00001", "가상일", "010-0000-0001", "정규", "", "", "l:1"],
  ["2026-10-29 08:02", "예", "정상", "5천미만", "경남", "100-00-00002", "가상 교습소", "010-0000-0002", "정규", "", "", "l:2"],
];
const pad = (cells: string[]) => [...cells, ...Array(HEAD.length - cells.length).fill("")];

describe("db-sheet import preamble", () => {
  it("구글시트 CSV: 제목·요약 줄을 건너뛰고 4행 머리글로 읽는다", () => {
    const csv = [pad(["가상님 디비"]), pad(["전체잔여개수", "27건", "오늘 남은 개수", "3", "마지막 갱신", "10-29 18:03"]), pad([]), HEAD, ...rows].map((r) => r.join(",")).join("\n");
    const a = analyzeImport(csv);
    expect(a.header).toBe(true);
    expect(a.items).toHaveLength(2);
    expect(a.items[0]!.lead.owner).toBe("가상일");
    expect(a.items[0]!.lead.phone).toBe("010-0000-0001");
    expect(a.items[0]!.lead.date).toBe("2026-10-28");
    expect(a.items[1]!.lead.phone).toBe("010-0000-0002");
    expect(a.items.some((i) => i.raw.join(" ").includes("디비"))).toBe(false);
  });

  it("붙여넣기(탭): 제목 한 줄만 있어도 건너뛴다", () => {
    const tsv = ["가상님 디비", HEAD.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
    const a = analyzeImport(tsv);
    expect(a.header).toBe(true);
    expect(a.items.map((i) => i.lead.owner)).toEqual(["가상일", "가상 교습소"]);
  });

  it("머리글이 맨 위거나, 위 줄에 전화번호(고객)가 있으면 그대로 둔다", () => {
    const plain = [HEAD, ...rows].map((r) => r.join("\t")).join("\n");
    expect(skipImportPreamble(plain)).toBe(plain);
    const customerFirst = ["가상삼\t010-0000-0003", HEAD.join("\t")].join("\n");
    expect(skipImportPreamble(customerFirst)).toBe(customerFirst);
  });

  it("「첫 줄 · 고객 정보 포함」을 고르면 건너뛰지 않는다", () => {
    const tsv = ["가상님 디비", HEAD.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
    expect(analyzeImport(tsv, "no").items.length).toBeGreaterThanOrEqual(3);
  });
});
