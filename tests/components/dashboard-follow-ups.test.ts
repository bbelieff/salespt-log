import { describe, expect, it } from "vitest";
import { buildInitialLeads, buildRecontactLeads, buildStalledWork, buildTodoFollowUps, buildUnresultedMeetings, summarizeFollowUps } from "@/lib/analytics/dashboard-follow-ups";
import { TODAY, contract, lead, meeting, slot, todo } from "./follow-ups-factories";

describe("approved follow-up rules", () => {
  it("first contact is due on inflow day; boundaries 0/1/6/7 classify without invented ages", () => {
    const rows = [TODAY,"2026-10-11","2026-10-06","2026-10-05", ""].map((date,i) => lead({ id:String(i), date, result:"미컨택" }));
    const out = buildInitialLeads(rows,TODAY);
    expect(rows.map(r=>out.find(i=>i.key===`lead:${r.id}`)?.group)).toEqual(["today","overdue","overdue","long-overdue","unknown"]);
    expect(out.find(i=>i.group==="unknown")?.overdueDays).toBeNull();
    expect(buildInitialLeads([lead({result:"미컨택",date:"2026-10-13"})],TODAY)).toEqual([]);
  });
  it("draft contact date edits never complete a reservation; only server generation does", () => {
    const l=lead({next:TODAY,contact:{...lead().contact,date:TODAY}});
    expect(buildRecontactLeads([l],TODAY)[0]?.reasons).toEqual(["다시 연락 예정"]);
    expect(buildRecontactLeads([{...l,followUp:{generation:2,completedGeneration:2,lastContactDate:TODAY}}],TODAY)[0]?.reasons).toEqual(["다음 연락일 없음"]);
    expect(buildRecontactLeads([{...l,followUp:{generation:3,completedGeneration:2,lastContactDate:TODAY}}],TODAY)[0]?.reasons).toEqual(["다시 연락 예정"]);
  });
  it("missing next date is due on real contact day; legacy unknown dates stay unknown", () => {
    for(const result of ["부재","컨택진행","재통화"] as const){
      expect(buildRecontactLeads([lead({result,next:"",followUp:{generation:0,completedGeneration:0,lastContactDate:TODAY}})],TODAY)[0]?.group).toBe("today");
      expect(buildRecontactLeads([lead({result,next:""})],TODAY)[0]?.group).toBe("unknown");
    }
    expect(buildRecontactLeads([lead({result:"단순거절",next:""}),lead({result:"상담 후 거절",next:""})],TODAY)).toEqual([]);
  });
  it("booked/closed leads leave the contact queue, even when an old next date remains", () => {
    expect(buildRecontactLeads([lead({next:TODAY,meetingId:"m"}),lead({next:TODAY,stage:"계약해지"}),lead({next:TODAY,funnel:"계약"})],TODAY)).toEqual([]);
  });
  it("pending meeting results include today and older than 30 days, exclude all terminal/rescheduled states", () => {
    const rows=[meeting({id:"old",미팅날짜:"2025-01-01"}),meeting({id:"today",미팅날짜:TODAY}),meeting({id:"future",미팅날짜:"2026-10-19"}),meeting({id:"later",미팅날짜:"2026-10-20"}),meeting({미팅날짜:"2026-02-30"}),...(["취소","변경","완료","계약"] as const).map(상태=>meeting({상태}))];
    expect(buildUnresultedMeetings(rows,TODAY).map(i=>[i.key,i.group])).toEqual([["meeting:old","long-overdue"],["meeting:today","today"],["meeting:future","upcoming"]]);
    expect(buildUnresultedMeetings([rows[0]!,rows[0]!],TODAY)).toHaveLength(1);
  });
  it("task dates include +7 only; exclude completed, history, invalid, generic and closed", () => {
    const cp=contract();
    const out=buildTodoFollowUps([todo({id:"old",예정일자:"2026-10-05"}),todo({id:"today"}),todo({id:"plus7",예정일자:"2026-10-19"}),todo({예정일자:"2026-10-20"}),todo({기록종류:"history"}),todo({완료여부:true}),todo({type:"일반"}),todo({예정일자:""}),todo({예정일자:"2026-02-30"})],[cp],TODAY);
    expect(out.overdue.map(i=>i.group)).toEqual(["long-overdue"]); expect(out.today).toHaveLength(1);expect(out.upcoming.map(i=>i.key)).toEqual(["todo:plus7"]);
    expect(buildTodoFollowUps([todo()],[contract({해지일:TODAY})],TODAY).today).toEqual([]);
    expect(buildTodoFollowUps([todo()],[contract({수납1:slot({수납액:1})})],TODAY).today).toEqual([]);
    expect(buildTodoFollowUps([todo({contractRef:"unlinked"})],[cp],TODAY).unlinked).toBe(1);
  });
  it("work slots remain separate; missing institution + task is one item with two reasons, immediately", () => {
    const cp=contract({계약일:TODAY,수납1:slot({진행상품:"합성 상품"}),수납2:slot({진행기관:"기관B"})});
    const out=buildStalledWork([cp],[],TODAY);
    expect(out).toHaveLength(2);expect(out[0]?.reasons).toEqual(["진행기관 없음","다음 할 일 없음"]);
    expect(out.every(i=>i.group==="today")).toBe(true);expect(new Set(out.map(i=>i.key)).size).toBe(2);
  });
  it("per-slot todo/history never suppresses another slot; mismatched institutions are not guessed", () => {
    const cp=contract({수납1:slot({진행기관:"기관A"}),수납2:slot({진행기관:"기관B"})});
    const out=buildStalledWork([cp],[todo({institutionRef:"기관A",예정일자:"2026-11-01"}),todo({institutionRef:"기관B",기록종류:"history",예정일자:"2026-10-06"})],TODAY);
    expect(out).toHaveLength(1);expect(out[0]).toMatchObject({slot:2,group:"overdue",dueISO:"2026-10-06"});
    expect(buildStalledWork([cp],[todo({institutionRef:"다른기관"})],TODAY)).toHaveLength(2);
  });
  it("unknown contract dates stay unknown; future completed schedules do not invent activity today", () => {
    expect(buildStalledWork([contract({계약일:""})],[],TODAY)[0]?.group).toBe("unknown");
    expect(buildStalledWork([contract()],[todo({완료여부:true,예정일자:"2026-11-01"})],TODAY)[0]?.dueISO).toBe("2026-09-01");
  });
  it("hidden/terminated/collected slots excluded; active approved slots and carryover retained", () => {
    const rows=[contract({row:1,해지숨김:true}),contract({row:2,해지일:TODAY}),contract({row:3,수납1:slot({수납액:1})}),contract({row:4,수납1:slot({승인금액:1})}),contract({row:5,구분:"이월"})];
    expect(buildStalledWork(rows,[],TODAY).map(i=>i.key)).toEqual(["stalled:4:1","stalled:5:1"]);
  });
  it("all counts derive from the same unique items, future contacts are separate; failed source contributes nothing", () => {
    const summary=summarizeFollowUps({leads:[lead({id:"future",next:"2026-10-19"}),lead({id:"first",result:"미컨택",date:TODAY})],meetings:undefined},TODAY);
    expect(summary.total).toBe(1);expect(summary.counts.upcoming).toBe(1);expect(summary.stepCounts["1.5"]).toBe(1);
    expect(Object.values(summary.groupCounts).reduce((a,b)=>a+b,0)).toBe(summary.items.length);
    expect(Object.values(summary.stepCounts).reduce((a,b)=>a+b,0)).toBe(summary.total);
    expect(JSON.stringify(summary.items)).not.toContain("phone");
  });
});

it("unmatched or ambiguous task institutions never guess a work slot",()=>{
 const cp=contract({수납1:slot({진행기관:"기관A"}),수납2:slot({진행기관:"기관A"})});
 for(const institutionRef of ["기관A","없는기관"]){
  const [item]=buildTodoFollowUps([todo({id:"focus",institutionRef})],[cp],TODAY).today;
  expect(item?.slot).toBeUndefined();expect(item?.href).toBe("/payment?row=3&focus=focus");expect(item?.reasons).toContain("연결 진행건 확인 필요");
 }
 expect(buildStalledWork([cp],[todo({institutionRef:"기관A"})],TODAY)).toHaveLength(2);
});
