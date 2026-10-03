import {describe,it,expect} from "vitest";
import {containsRecruitmentUrl,scrubRecruitmentTelemetry} from "@/util/recruitment-privacy";
describe("queued invitation telemetry after SPA navigation",()=>{
 const token="S".repeat(43),url="https://app.example.test/trainer/invite#token="+token;
 it("finds history from/to, encoded login returns and legacy token paths",()=>{
  for(const value of [{data:{from:url,to:"/trainer/invite"}},"/trainer/invite/"+token,"/?returnTo="+encodeURIComponent(url),{request:{url}}])expect(containsRecruitmentUrl(value)).toBe(true);
  expect(containsRecruitmentUrl({data:{from:"/dashboard",to:"/contact"},message:"ordinary failure"})).toBe(false);
 });
 it("redacts queued event/transaction URLs without discarding ordinary failure detail",()=>{
  const event={message:"ordinary failure",request:{url:"https://app.example.test/dashboard"},breadcrumbs:[{data:{from:url,to:"/trainer/invite"}},{data:{from:"/dashboard",to:"/contact"}}],contexts:{trace:{description:url}}};
  const clean=scrubRecruitmentTelemetry(event);
  expect(JSON.stringify(clean)).not.toContain(token);expect(clean.message).toBe(event.message);
  expect(clean.request).toEqual(event.request);expect(clean.breadcrumbs[1]).toEqual(event.breadcrumbs[1]);expect(event.breadcrumbs[0]?.data.from).toBe(url);
 });
});
