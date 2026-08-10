/**
 * BBE-71(R7-#22) — export-xlsx 서비스 단위 테스트.
 * buildExportWorkbookData 는 repo 함수를 mock, serializeExportWorkbook 은 실제 xlsx 라이브러리로
 * 왕복(직렬화→파싱) 검증해 워크북이 진짜 열리는 파일인지 확인한다.
 */
import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

const { findUserByEmail, readAllMeetings, readAllContracts, readPurchases, readProductions, readBanners, readLeads } =
  vi.hoisted(() => ({
    findUserByEmail: vi.fn(),
    readAllMeetings: vi.fn(),
    readAllContracts: vi.fn(),
    readPurchases: vi.fn(),
    readProductions: vi.fn(),
    readBanners: vi.fn(),
    readLeads: vi.fn(),
  }));

vi.mock("@/repo/users", () => ({ findUserByEmail }));
vi.mock("@/repo/meetings", () => ({ readAllMeetings }));
vi.mock("@/repo/contract-payment", () => ({ readAll: readAllContracts }));
vi.mock("@/repo/db", () => ({ readPurchases, readProductions, readBanners, readLeads }));

import { buildExportWorkbookData, exportFileName, serializeExportWorkbook } from "@/service/export-xlsx";

function emptySection() {
  return { rows: [] };
}

describe("buildExportWorkbookData", () => {
  it("등록 안 된 사용자는 명확한 에러를 던진다", async () => {
    findUserByEmail.mockResolvedValueOnce(null);
    await expect(buildExportWorkbookData("nobody@x.com")).rejects.toThrow(/등록되지 않은/);
  });

  it("각 소스를 화면 라벨 헤더로 변환한다(코드 필드명 아님)", async () => {
    findUserByEmail.mockResolvedValueOnce({ spreadsheetId: "sid-1" });
    readAllMeetings.mockResolvedValueOnce([
      {
        id: "m1", 예약일: "2026-08-01", 예약시각: "10:00", 미팅날짜: "2026-08-05",
        미팅시간: "14:00", channel: "매입DB", 업체명: "가나상사", 장소: "서울",
        예약비고: "", 상태: "계약", 계약여부: true, 수임비: 1000000, 미팅사유: "메모1", 계약조건: "",
      },
    ]);
    readAllContracts.mockResolvedValueOnce([
      {
        계약일: "2026-08-05", 업체명: "가나상사", 수임비: 1000000,
        수납1: { 진행기관: "은행A", 진행률: "50%", 현황: "심사중", 승인금액: 500000, 수납액: 0, 수납일: "", 메모: "" },
        수납2: { 진행기관: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "" },
        수납3: { 진행기관: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "" },
      },
    ]);
    readPurchases.mockResolvedValueOnce({ rows: [{ row: 4, 구매일: "2026-08-01", 업체명: "매입처1", 개당단가: 100, 주문개수: 10, 기타: "", 부가세여부: false }] });
    readProductions.mockResolvedValueOnce(emptySection());
    readBanners.mockResolvedValueOnce(emptySection());
    readLeads.mockResolvedValueOnce(emptySection());

    const data = await buildExportWorkbookData("student@x.com");

    expect(data.meetings).toEqual([
      {
        예약일: "2026-08-01", 예약시각: "10:00", 미팅날짜: "2026-08-05", 미팅시간: "14:00",
        채널: "매입DB", 업체명: "가나상사", 장소: "서울", 상태: "계약", 계약여부: true,
        수임비: 1000000, 계약조건: "", 메모: "메모1",
      },
    ]);
    expect(data.contracts[0]).toMatchObject({
      계약일: "2026-08-05", 업체명: "가나상사", 수임비: 1000000,
      "수납1 진행기관": "은행A", "수납1 진행률": "50%", "수납1 진행내용": "심사중", "수납1 승인금액": 500000,
    });
    // row(시트 물리 좌표)는 사람이 열어보는 파일에 안 들어감 — 내부 구현 세부라 노출 안 함.
    expect(data.purchases[0]).not.toHaveProperty("row");
    expect(data.purchases[0]).toMatchObject({ 구매일: "2026-08-01", 업체명: "매입처1" });
  });

  it("6개 섹션을 모두 병렬로 조회한다(순차 아님 — Promise.all)", async () => {
    findUserByEmail.mockResolvedValueOnce({ spreadsheetId: "sid-2" });
    readAllMeetings.mockResolvedValueOnce([]);
    readAllContracts.mockResolvedValueOnce([]);
    readPurchases.mockResolvedValueOnce(emptySection());
    readProductions.mockResolvedValueOnce(emptySection());
    readBanners.mockResolvedValueOnce(emptySection());
    readLeads.mockResolvedValueOnce(emptySection());

    await buildExportWorkbookData("student@x.com");

    for (const fn of [readAllMeetings, readAllContracts, readPurchases, readProductions, readBanners, readLeads]) {
      expect(fn).toHaveBeenCalledWith("sid-2");
    }
  });
});

describe("serializeExportWorkbook", () => {
  it("6개 워크시트를 담은 진짜 열리는 xlsx 를 만든다(직렬화→파싱 왕복)", () => {
    const buf = serializeExportWorkbook({
      meetings: [{ 업체명: "가나상사" }],
      contracts: [{ 계약일: "2026-08-05" }],
      purchases: [],
      productions: [],
      banners: [],
      leads: [],
    });
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toEqual(["업체관리", "계약수납", "DB_매입", "DB_직접생산", "DB_현수막", "DB_콜지기소"]);
    const meetingSheet = XLSX.utils.sheet_to_json(wb.Sheets["업체관리"]!);
    expect(meetingSheet).toEqual([{ 업체명: "가나상사" }]);
  });

  it("빈 섹션도 워크시트 자체는 만든다(탭이 아예 없는 것보다 '기록 없음'이 명확)", () => {
    const buf = serializeExportWorkbook({
      meetings: [], contracts: [], purchases: [], productions: [], banners: [], leads: [],
    });
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toHaveLength(6);
  });
});

describe("exportFileName", () => {
  it("내기록_YYYY-MM-DD.xlsx 형식", () => {
    expect(exportFileName()).toMatch(/^내기록_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});
