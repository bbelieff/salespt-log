/** DB sheet import source remains separate from verified contact/company data. */
import { z } from "zod";
import { Channel } from "./channel";
import { CompanyInfo } from "./meeting";
export const DbSheetDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, "Invalid date");
const text = z.string().max(20000).default("");
export const DbSheetResult = z.enum(["미컨택", "부재", "단순거절", "재통화", "컨택진행", "상담 후 거절"]);
export const DbSheetContact = z.object({
 ci: CompanyInfo.default({}), note:text, date:z.union([DbSheetDate,z.literal("")]).default(""),
 meetingDate:text,time:text,place:text,reservationNote:text,registered:z.boolean().default(false),companyName:text,
});
export const DbSheetLeadInput = z.object({
 id:z.string().uuid(), supplier:text,date:DbSheetDate,channel:z.enum(["매입DB","직접생산"]),
 company:text,owner:text,phone:text,biz:text,address:text,industry:text,credit:text,sales:text,arrears:text,funds:text,
 next:z.union([DbSheetDate,z.literal("")]).default(""),memo:text,
 contact:DbSheetContact.default({}),
});
export type DbSheetLeadInput = z.infer<typeof DbSheetLeadInput>;
export type DbSheetLead = DbSheetLeadInput & {revision:number;result:z.infer<typeof DbSheetResult>;first:string;stage:string;meetingId:string|null;effectiveMeetingId?:string;meetingLineageIds?:string[]};
export type DbSheetContext = { spreadsheetId:string;cohort:string;email:string };
export type DbSheetChange = {lead:DbSheetLead;changedSales:{date:string;channel:z.infer<typeof Channel>}[];meetingId?:string};
