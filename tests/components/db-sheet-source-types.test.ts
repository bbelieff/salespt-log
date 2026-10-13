import {describe,it,expect} from "vitest";
import {parse,defaults,columns,blank,issues,validChannel} from "@/app/(app)/db-sheet/_components/model";
import {DbSheetLeadInput} from "@/types/db-sheet";
import {CHANNEL_ORDER} from "@/types/channel";
describe("DB supplier type and source",()=>{
 it("uses purchase by default and places type next to supplier",()=>{
  expect(blank().channel).toBe("매입DB");expect(defaults.slice(0,2)).toEqual(["channel","supplier"]);
  expect(columns.filter(c=>c.key==="channel")).toHaveLength(1);
 });
 it("requires correcting unknown source types instead of silently showing purchase",()=>{
  const [row]=parse("공급처 유형,공급처,사업자명,전화번호,유입일\n현수막 광고,합성 출처,합성 상사,010-0000-4321,2026-10-13");
  if(!row)throw new Error("Missing synthetic CSV row");
  expect(row.channel).toBe("현수막 광고");expect(validChannel(row.channel)).toBe(false);
  expect(issues(row)).toBe("공급처 유형");expect(issues({...row,channel:"현수막"})).toBe("");
 });
 it.each(CHANNEL_ORDER)("imports %s with new and legacy headers",channel=>{
  for(const header of ["공급처 유형,공급처","유입채널,DB공급처"]){
   const [row]=parse(`${header},사업자명,유입일\n${channel},합성 출처,합성 상사,2026-10-13`);
   expect(DbSheetLeadInput.parse(row)).toMatchObject({channel,supplier:"합성 출처"});
  }
 });
});
