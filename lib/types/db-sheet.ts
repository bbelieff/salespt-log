/** DB sheet import source remains separate from verified contact/company data. */
import { z } from "zod";
import { Channel } from "./channel";
import { CompanyInfo, type MeetingState } from "./meeting";
export const DbSheetDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, "Invalid date");
const text = z.string().max(20000).default("");
export const DbSheetResult = z.enum(["미컨택", "부재", "단순거절", "재통화", "컨택진행", "상담 후 거절", "AS예정"]);
/** 선택지 순서 그대로의 컨택 결과 목록 — 화면 선택지·검증이 같이 쓴다. */
export const DB_SHEET_RESULTS = DbSheetResult.options;
/** 실적(STEP 2 컨택진행)으로 세는 결과 — 서버 집계·화면 라벨·상태 필터가 이 하나를 쓴다. */
export const DB_SHEET_QUALIFIED_RESULTS = ["컨택진행", "상담 후 거절"] as const;
export function isQualifiedDbSheetContact(result: string): boolean { return (DB_SHEET_QUALIFIED_RESULTS as readonly string[]).includes(result); }
/** 표시용 최초상담일: 실적 집계(컨택진행·상담 후 거절)와 별도 기준. */
export function recordsDbSheetFirstContact(result: string): boolean { return ["단순거절", "재통화", "컨택진행", "상담 후 거절"].includes(result); }
/**
 * 컨택 기록 뒤 최초상담일. 이미 있는 날짜는 보존하고, 비어 있으면 네 결과에서 그 컨택일로 채운다.
 * 빈 「직접 입력」(firstManual=true·first="")은 잠금으로 보지 않는다 — 표 칸을 눌렀다 떼기만 해도
 * 빈 값이 직접 입력으로 저장돼 자동 기록이 영영 멈추던 문제(2026-10-23)를 막는다.
 */
export function nextDbSheetFirstContact(first: string, result: string, date: string): string { return first || (recordsDbSheetFirstContact(result) ? date : ""); }
/** 화면에 보이는 컨택결과 이름 — 저장값(enum)은 그대로 두고 이름만 바꾼다(2026-10-23 belie). */
const DB_SHEET_RESULT_LABELS: Readonly<Record<string, string>> = { 컨택진행: "미팅예약", "상담 후 거절": "컨택 후 거절", AS예정: "AS신청" };
export function dbSheetResultLabel(result: string): string { return DB_SHEET_RESULT_LABELS[result] ?? result; }
/** 현재상태 중 컨택결과로 자동 계산하는 값. 미팅·계약 단계는 미팅/계약 기록이 정한다. */
export const DB_SHEET_CONTACT_STAGES = ["미컨택", "DB컨택중", "상담 중", "장기관리", "진행종료"] as const;
/**
 * 사용자가 직접 정하는 현재상태(2026-10-23 belie): 장기관리(가벼운 거절·나중에 다시) · 진행종료(다시 연락 안 함) ·
 * DB컨택중(장기관리·진행종료에서 되돌림). 새 컨택결과를 기록하면 풀리고, 미팅이 연결되면 미팅 단계가 우선한다.
 */
export const DbSheetManualStage = z.enum(["장기관리", "진행종료", "DB컨택중"]);
export type DbSheetManualStage = z.infer<typeof DbSheetManualStage>;
/** 오늘 챙길 일·다시 연락 대상에서 빠지는 현재상태. */
export function isDbSheetParkedStage(stage: string): boolean { return stage === "장기관리" || stage === "진행종료"; }
/**
 * 미팅이 없는 DB 의 현재상태: AS신청 → 진행종료 · 실적 상담 이력 → 상담 중 ·
 * 단순거절/재통화 → DB컨택중 · 그 외 미컨택. 미팅 연결 행이나 다른 단계 이름은 그대로 둔다.
 */
export function dbSheetContactStage(lead: { meetingId?: string | null; stage: string; result: string; hasQualifiedContact?: boolean; manualStage?: DbSheetManualStage }): string {
  if (lead.meetingId || (lead.stage && !(DB_SHEET_CONTACT_STAGES as readonly string[]).includes(lead.stage))) return lead.stage;
  if (lead.manualStage) return lead.manualStage;
  if (lead.result === "AS예정") return "진행종료";
  if (lead.hasQualifiedContact) return "상담 중";
  if (lead.result === "단순거절" || lead.result === "재통화") return "DB컨택중";
  return "미컨택";
}
/** 부재는 다음 연락일이 비어 있으면 내일로 잡는다. 이미 정한 날짜는 바꾸지 않는다. */
/** 다음 연락일을 컨택한 날 다음날로 자동으로 잡는 결과(부재 2026-10-23 · 재통화 2026-10-25 belie). */
export const DB_SHEET_AUTO_NEXT_RESULTS: readonly string[] = ["부재", "재통화"];
export function autoDbSheetNextContact(result: string, next: string, tomorrow: string): string { return DB_SHEET_AUTO_NEXT_RESULTS.includes(result) && !next ? tomorrow : next; }
/**
 * 예전 기록 보정(읽을 때만, 2026-10-25 belie): 규칙이 생기기 전에 기록된 업체도 같은 모습으로 보이게.
 * · 최초상담일이 비었으면(결과와 상관없이) → 상담으로 치는 첫 컨택(단순거절·재통화·컨택진행·상담 후 거절)의 날짜.
 *   컨택 기록에서 고른 날이라 부재·미컨택 날은 들어가지 않는다(2026-10-25 김재원 더골드·서해수산·유한스크린골프 실측).
 * · 부재인데 다음 연락일이 비었으면 → 마지막 부재(컨택일·부재 기록 중 늦은 날) 다음날
 * 최초상담일이 비어 있으면 「직접 입력」 표시(firstManual)가 있어도 채운다 — 빈 직접 입력은 표 칸을 눌렀다 떼기만 한 옛 저장이라
 * 잠금이 아니다(nextDbSheetFirstContact 와 같은 기준, 2026-10-25 belie 「최초상담일이 안 적혀」). 부재의 빈 다음 연락일은 전부 채운다.
 * 컨택 기록이 없으면 그대로 둔다.
 */
export function backfillDbSheetDates<T extends { result: string; first: string; next: string; firstManual?: boolean; absences?: { date: string }[] }>(
  lead: T, lastContactDate: string, dayAfter: (date: string) => string, firstConsultDate = "",
): T {
  let out = lead;
  if (!lead.first && firstConsultDate) out = { ...out, first: firstConsultDate };
  if (DB_SHEET_AUTO_NEXT_RESULTS.includes(lead.result) && !lead.next) {
    const last = [lastContactDate, ...(lead.absences ?? []).map(a => a.date)].filter(Boolean).sort().at(-1);
    if (last) out = { ...out, next: dayAfter(last) };
  }
  return out;
}
/** 다음 연락일을 사용하는 컨택 결과: 상세 입력과 대시보드가 공유한다. */
const DB_SHEET_FOLLOW_UP_RESULTS: ReadonlySet<string> = new Set(["부재", "단순거절", "상담 후 거절", "재통화", "컨택진행"]);
export function isDbSheetFollowUpResult(result: string): boolean { return DB_SHEET_FOLLOW_UP_RESULTS.has(result); }
/** 부재 기록 한 줄(2026-10-23 belie): 전화를 건 날짜와 시각(08~21시). 다음 통화 시간대를 바꿔 보는 데 쓴다. */
export const DbSheetAbsence = z.object({ date: DbSheetDate, hour: z.number().int().min(8).max(21) });
export type DbSheetAbsence = z.infer<typeof DbSheetAbsence>;
export const DB_SHEET_CALL_HOURS = [8,9,10,11,12,13,14,15,16,17,18,19,20,21] as const;
/** 걸어 본 시간대와 안 걸어 본 시간대(오전 8~11 · 점심 12~13 · 오후 14~17 · 저녁 18~21) 안내 한 줄. */
export function dbSheetAbsenceHint(absences: readonly DbSheetAbsence[]): string {
  if (!absences.length) return "";
  const tried = new Set(absences.map(a => a.hour));
  const bands: [string, number[]][] = [["오전", [8,9,10,11]], ["점심", [12,13]], ["오후", [14,15,16,17]], ["저녁", [18,19,20,21]]];
  const untried = bands.filter(([, hs]) => hs.every(h => !tried.has(h))).map(([n]) => n);
  const hours = [...tried].sort((x, y) => x - y).map(h => `${h}시`).join("·");
  return untried.length ? `지금까지 ${hours}에 걸었어요. ${untried.join("·")}에 걸어 보세요.` : `지금까지 ${hours}에 걸었어요. 모든 시간대를 걸어 봤어요.`;
}
/** 업체명 비교용 — (주)·㈜·주식회사·공백·기호를 빼고 소문자로. 미팅 연결 후보 찾기에 쓴다. */
export function normalizeDbSheetCompany(name: string): string {
  return name.replace(/\(주\)|㈜|주식회사|\(유\)|유한회사/g, "").replace(/[\s.,·\-_()]/g, "").toLowerCase();
}
/** 같거나 비슷한 업체명(정규화 후 같거나, 2글자 이상에서 한쪽이 다른 쪽을 포함). */
export function isSimilarDbSheetCompany(a: string, b: string): boolean {
  const x = normalizeDbSheetCompany(a), y = normalizeDbSheetCompany(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return Math.min(x.length, y.length) >= 2 && (x.includes(y) || y.includes(x));
}
export const DbSheetContact = z.object({
 ci: CompanyInfo.default({}), note:text, date:z.union([DbSheetDate,z.literal("")]).default(""),
 meetingDate:text,time:text,place:text,reservationNote:text,registered:z.boolean().default(false),companyName:text,
});
export const DbSheetRecording = z.object({inflow:z.boolean(),activities:z.boolean()});
export type DbSheetRecording = z.infer<typeof DbSheetRecording>;
export type DbSheetInflowStatus = {state:"recorded"|"excluded";date?:string;channel?:z.infer<typeof Channel>;count:0|1};
export type DbSheetImpact = {inflow:number;contacts:number;meetings:number;rows:{date:string;channel:z.infer<typeof Channel>;inflow:number;contacts:number;meetings:number}[];blockedReason?:string};
export const DbSheetLeadInput = z.object({
 id:z.string().uuid(), supplier:text,date:DbSheetDate,channel:Channel,
 company:text,owner:text,phone:text,biz:text,address:text,industry:text,credit:text,sales:text,arrears:text,funds:text,
 next:z.union([DbSheetDate,z.literal("")]).default(""),memo:text,
 asReceived:z.boolean().optional(),asNote:z.string().max(20000).optional(),
 contact:DbSheetContact.default({}), recording:DbSheetRecording.optional(),
});
export type DbSheetLeadInput = z.infer<typeof DbSheetLeadInput>;
/** 현재상태 열에 보이는 미팅 단계 이름 — 저장소(projectMeeting)와 서비스(dbSheetFunnelStep)가 같은 글자를 쓴다. */
export const DB_SHEET_MEETING_STAGE: Readonly<Record<MeetingState, string>> = { 예약: "미팅예약", 변경: "미팅변경", 계약: "계약", 완료: "완료", 취소: "미팅취소" };
export const DB_SHEET_MEETING_DELETED = "미팅 삭제됨";
/** DB 한 건이 닿은 가장 높은 영업 단계(낮은 → 높은 순). 조회 때마다 서비스가 계산하고 저장하지 않는다. */
export const DbSheetFunnelStep = z.enum(["유입", "연락", "상담", "미팅", "계약"]);
export type DbSheetFunnelStep = z.infer<typeof DbSheetFunnelStep>;
/** Server-owned action generations. Draft contact dates never complete a scheduled action. */
export type DbSheetFollowUp = { generation: number; completedGeneration: number | null; lastContactDate: string };
export type DbSheetLead = DbSheetLeadInput & {inflowStatus?:DbSheetInflowStatus;_recorded?:{inflow:boolean;contacts:string[];meeting:boolean;meetingIds?:string[];legacyUnknown?:boolean};revision:number;result:z.infer<typeof DbSheetResult>;manualStage?:DbSheetManualStage;absences?:DbSheetAbsence[];linkedExisting?:boolean;first:string;firstManual?:boolean;hasQualifiedContact?:boolean;stage:string;meetingId:string|null;effectiveMeetingId?:string;meetingLineageIds?:string[];funnel?:DbSheetFunnelStep;followUp?:DbSheetFollowUp;/** 읽기 투영 전용 — 연결된 살아 있는 계약의 실무/수납 행(「STEP 4 실무/수납 →」 바로가기, 2026-10-25). 저장하지 않는다. */contractRow?:number};
export type DbSheetContext = { spreadsheetId:string;cohort:string;email:string };
export type DbSheetChange = {lead:DbSheetLead;changedSales:{date:string;channel:z.infer<typeof Channel>}[];meetingId?:string;impact?:DbSheetImpact};
