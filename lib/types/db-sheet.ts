/** DB sheet import source remains separate from verified contact/company data. */
import { z } from "zod";
import { Channel } from "./channel";
import { CompanyInfo, type MeetingState } from "./meeting";
export const DbSheetDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, "Invalid date");
const text = z.string().max(20000).default("");
export const DbSheetResult = z.enum(["미컨택", "부재", "단순거절", "재통화", "컨택진행", "상담 후 거절"]);
/** 다음 연락일을 사용하는 컨택 결과: 상세 입력과 대시보드가 공유한다. */
const DB_SHEET_FOLLOW_UP_RESULTS: ReadonlySet<string> = new Set(["부재", "단순거절", "상담 후 거절", "재통화", "컨택진행"]);
export function isDbSheetFollowUpResult(result: string): boolean { return DB_SHEET_FOLLOW_UP_RESULTS.has(result); }
export const DbSheetContact = z.object({
 ci: CompanyInfo.default({}), note:text, date:z.union([DbSheetDate,z.literal("")]).default(""),
 meetingDate:text,time:text,place:text,reservationNote:text,registered:z.boolean().default(false),companyName:text,
});
export const DbSheetLeadInput = z.object({
 id:z.string().uuid(), supplier:text,date:DbSheetDate,channel:Channel,
 company:text,owner:text,phone:text,biz:text,address:text,industry:text,credit:text,sales:text,arrears:text,funds:text,
 next:z.union([DbSheetDate,z.literal("")]).default(""),memo:text,
 contact:DbSheetContact.default({}),
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
export type DbSheetLead = DbSheetLeadInput & {revision:number;result:z.infer<typeof DbSheetResult>;first:string;stage:string;meetingId:string|null;effectiveMeetingId?:string;meetingLineageIds?:string[];funnel?:DbSheetFunnelStep;followUp?:DbSheetFollowUp};
export type DbSheetContext = { spreadsheetId:string;cohort:string;email:string };
export type DbSheetChange = {lead:DbSheetLead;changedSales:{date:string;channel:z.infer<typeof Channel>}[];meetingId?:string};
