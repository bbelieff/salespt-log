import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { ContractPayment, PaymentSlot, Todo } from "@/types";
import { buildCompanyWorkItems, sortCompanyWorkItems } from "@/app/(app)/payment/_lib/company-work-view";
import { buildInstitutionWorkItems, groupInstitutionWorkItems } from "@/app/(app)/payment/_lib/institution-view";
import ContractListTable from "@/app/(app)/payment/_components/ContractListTable";
import InstitutionWorkList from "@/app/(app)/payment/_components/InstitutionWorkList";
const slot = (over: Partial<PaymentSlot> = {}): PaymentSlot => ({
  진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0,
  수납액: 0, 수납일: "", 메모: "", ...over,
});
const contract = (row: number, name: string, date: string, slots: PaymentSlot[]): ContractPayment => ({
  row, 계약일: date, 업체명: name, 수임비: 0, 계약비고: "", 공동인증서: false,
  임대차계약서: false, 신분증: false, 드라이브업로드: false,
  사업계획서초안발송: false, 컨설팅5종서류발송: false, 플러그이관: false,
  수납1: slots[0] ?? slot(), 수납2: slots[1] ?? slot(), 수납3: slots[2] ?? slot(),
  로드맵메모: "", 해지일: "", 해지사유: "", 반환액: 0, 해지숨김: false,
});
const todo = (name: string, date: string, kind: "todo" | "history"): Todo => ({
  id: `${name}-${date}`, contractRef: `2026-09-04|${name}`, institutionRef: "신보",
  업체명: name, type: "기타", 제목: "연락", 예정일자: date, 예정시각: "09:00",
  장소: "", 상세: "", showOnCalendar: true, 완료여부: false,
  생성시각: "", 분류: "", 기록종류: kind,
});


const names = ["미래", "최근기록", "오늘", "미지정", "오래된연체", "연체", "오래된기록"];
const rows = names.map((n, i) => contract(i+3, n, "2026-09-04", [slot({ 진행기관: "신보", 진행상품: "합성 상품" })]));
const records = [todo("미래", "2026-10-12", "todo"),todo("최근기록", "2026-10-08", "history"),todo("오늘", "2026-10-10", "todo"),todo("오래된연체", "2026-10-01", "todo"),todo("연체", "2026-10-09", "todo"),todo("오래된기록", "2026-10-02", "history")];
const works = buildInstitutionWorkItems(rows, "", records, "2026-10-10");
const items = sortCompanyWorkItems(buildCompanyWorkItems(rows, works, "2026-10-10"), "dday", "2026-10-10");
function App(){const [mode,setMode]=useState(false);const [selected,setSelected]=useState<string|null>(null);return <main className="mx-auto max-w-xl"><button onClick={()=>{setMode(!mode);setSelected(null);}}>{mode?"업체 보기":"진행기관 보기"}</button>{mode?<InstitutionWorkList groups={groupInstitutionWorkItems(works,"","activity","2026-10-10")} selectedKey={selected} onSelect={w=>setSelected(w.key)} />:<ContractListTable items={items} selectedKey={selected} onSelect={i=>setSelected(i.key)} />}</main>}
createRoot(document.getElementById("root")!).render(<App/>);
