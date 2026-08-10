/**
 * Layer: service — BBE-71 "내 기록 다운로드" xlsx 조립 (R7-#22, ADR-0030 §3).
 *
 * 시트 은퇴 후에도 학생이 자기 기록을 파일로 가져갈 수 있게 하는 export. 설계 근거는
 * docs/plans/active/export-xlsx-csv.md. MVP 스코프(2026-08-10) = 3개 워크시트만
 * (업체관리·계약수납·DB관리) — 영업관리 재계산·대시보드 요약은 후속(같은 문서 §4).
 *
 * 데이터 소스 = 기존 repo 함수 그대로(readAllMeetings·contract-payment.readAll·db 4채널
 * read) — 전부 시트에서 읽는 함수라 파일럿·비파일럿 구분 없이 오늘 기준 모든 사용자에게
 * 동일하게 동작한다(설계문서 §2 "데이터 소스" 참고, DB-only 전제가 깨진 것에 대한 정정).
 */
import * as XLSX from "xlsx";
import { findUserByEmail } from "@/repo/users";
import { readAllMeetings } from "@/repo/meetings";
import { readAll as readAllContracts } from "@/repo/contract-payment";
import {
  readPurchases,
  readProductions,
  readBanners,
  readLeads,
} from "@/repo/db";
import type { Meeting, ContractPayment, PaymentSlot } from "@/types";

/** 화면 라벨 기준 헤더(코드 필드명 아님 — 사람이 열어보는 용도, 설계문서 §3). */
const MEETING_HEADERS: [keyof Meeting, string][] = [
  ["예약일", "예약일"],
  ["예약시각", "예약시각"],
  ["미팅날짜", "미팅날짜"],
  ["미팅시간", "미팅시간"],
  ["channel", "채널"],
  ["업체명", "업체명"],
  ["장소", "장소"],
  ["상태", "상태"],
  ["계약여부", "계약여부"],
  ["수임비", "수임비"],
  ["계약조건", "계약조건"],
  ["미팅사유", "메모"],
];

function meetingRow(m: Meeting): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [field, label] of MEETING_HEADERS) row[label] = m[field] ?? "";
  return row;
}

const SLOT_FIELDS: [keyof PaymentSlot, string][] = [
  ["진행기관", "진행기관"],
  ["진행률", "진행률"],
  ["현황", "진행내용"],
  ["승인금액", "승인금액"],
  ["수납액", "수납액"],
  ["수납일", "수납일"],
];

function contractRow(c: ContractPayment): Record<string, unknown> {
  const row: Record<string, unknown> = {
    계약일: c.계약일,
    업체명: c.업체명,
    수임비: c.수임비,
  };
  const slots: [string, PaymentSlot][] = [
    ["수납1", c.수납1],
    ["수납2", c.수납2],
    ["수납3", c.수납3],
  ];
  for (const [prefix, slot] of slots) {
    for (const [field, label] of SLOT_FIELDS) row[`${prefix} ${label}`] = slot[field] ?? "";
  }
  return row;
}

export interface ExportWorkbookData {
  meetings: Record<string, unknown>[];
  contracts: Record<string, unknown>[];
  purchases: Record<string, unknown>[];
  productions: Record<string, unknown>[];
  banners: Record<string, unknown>[];
  leads: Record<string, unknown>[];
}

/** 로그인한 사용자 1명의 기록 전체(MVP 스코프)를 워크시트별 행 배열로 조립. */
export async function buildExportWorkbookData(email: string): Promise<ExportWorkbookData> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[export-xlsx] 등록되지 않은 사용자: ${email}`);
  const sid = user.spreadsheetId;

  const [meetings, contracts, purchases, productions, banners, leads] = await Promise.all([
    readAllMeetings(sid),
    readAllContracts(sid),
    readPurchases(sid),
    readProductions(sid),
    readBanners(sid),
    readLeads(sid),
  ]);

  return {
    meetings: meetings.map(meetingRow),
    contracts: contracts.map(contractRow),
    purchases: purchases.rows.map(({ row: _row, ...rest }) => rest),
    productions: productions.rows.map(({ row: _row, ...rest }) => rest),
    banners: banners.rows.map(({ row: _row, ...rest }) => rest),
    leads: leads.rows.map(({ row: _row, ...rest }) => rest),
  };
}

/** ExportWorkbookData → xlsx Buffer(멀티시트 워크북). 순수 직렬화 — I/O 없음. */
export function serializeExportWorkbook(data: ExportWorkbookData): Buffer {
  const wb = XLSX.utils.book_new();
  const addSheet = (name: string, rows: Record<string, unknown>[]) => {
    // 빈 배열이면 SheetJS 가 컬럼 없는 시트를 만든다 — 최소 헤더 행이라도 남긴다(빈 탭도
    // "기록 없음"이 보이는 게 아무 워크시트도 안 보이는 것보다 사용자에게 명확).
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  addSheet("업체관리", data.meetings);
  addSheet("계약수납", data.contracts);
  addSheet("DB_매입", data.purchases);
  addSheet("DB_직접생산", data.productions);
  addSheet("DB_현수막", data.banners);
  addSheet("DB_콜지기소", data.leads);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** 파일명 — "내기록_YYYY-MM-DD.xlsx" (KST). */
export function exportFileName(): string {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  return `내기록_${today}.xlsx`;
}
