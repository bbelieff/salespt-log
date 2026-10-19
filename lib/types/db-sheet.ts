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
/** 다음 연락일을 사용하는 컨택 결과: 상세 입력과 대시보드가 공유한다. */
const DB_SHEET_FOLLOW_UP_RESULTS: ReadonlySet<string> = new Set(["부재", "단순거절", "상담 후 거절", "재통화", "컨택진행"]);
export function isDbSheetFollowUpResult(result: string): boolean { return DB_SHEET_FOLLOW_UP_RESULTS.has(result); }
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
export type DbSheetLead = DbSheetLeadInput & {inflowStatus?:DbSheetInflowStatus;_recorded?:{inflow:boolean;contacts:string[];meeting:boolean;meetingIds?:string[];legacyUnknown?:boolean};revision:number;result:z.infer<typeof DbSheetResult>;first:string;firstManual?:boolean;hasQualifiedContact?:boolean;stage:string;meetingId:string|null;effectiveMeetingId?:string;meetingLineageIds?:string[];funnel?:DbSheetFunnelStep;followUp?:DbSheetFollowUp};
export type DbSheetContext = { spreadsheetId:string;cohort:string;email:string };
export type DbSheetChange = {lead:DbSheetLead;changedSales:{date:string;channel:z.infer<typeof Channel>}[];meetingId?:string;impact?:DbSheetImpact};
