/** Approved synthetic data rendered by the production view. */
import { useState } from "react";
import DashboardFollowUpsView from "@/components/dashboard/DashboardFollowUpsView";
import type { FollowUpItem, FollowUpStep } from "@/lib/analytics/dashboard-follow-ups";
type Group = "overdue" | "long" | "today" | "upcoming";
type Example = { group: Group; step: string; company: string; action: string; reason: string; badge: string; href: string; due: string; facts: [string, string][]; cta: string };
function shift(iso: string, n: number) {
  const date = new Date(iso + "T00:00:00Z"); date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
function examples(today: string): Example[] {
  const db = (n: number) => `/db-sheet?lead=00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  return [
    { group: "long", step: "STEP 3", company: "샘플 바른학원", action: "미팅 결과 입력", reason: "31일 전 미팅 · 결과 미입력", badge: "D+31", due: shift(today, -31), facts: [["미팅일", shift(today, -31)], ["미팅 상태", "예약 · 결과 미입력"]], cta: "미팅 결과 입력하기", href: `/schedule?date=${shift(today, -31)}&focus=mtg-bareun` },
    { group: "long", step: "STEP 4", company: "샘플 고운상사", action: "다음 투두 등록", reason: "신용보증기금 · 다음 행동 없이 9일", badge: "9일 미처리", due: shift(today, -9), facts: [["진행건", "1 · 시설자금"], ["진행기관", "신용보증기금"], ["최근 기록", shift(today, -9) + " · 보완 서류 안내"], ["다음 투두", "미등록"]], cta: "다음 투두 등록하기", href: "/payment?row=9&slot=1" },
    { group: "overdue", step: "STEP 4", company: "샘플 한빛상사", action: "서류 보완 요청", reason: "신용보증기금 · 투두 마감 3일 경과", badge: "D+3", due: shift(today, -3), facts: [["진행건", "1 · 운전자금"], ["진행기관", "신용보증기금"], ["처리기한", shift(today, -3) + " 10:00"], ["투두 상태", "미완료"]], cta: "해당 투두 열기", href: "/payment?row=3&slot=1&focus=todo-overdue" },
    { group: "overdue", step: "STEP 1.5", company: "샘플 라온카페", action: "첫 연락하기", reason: "어제 유입 · 연락 기록 없음", badge: "D+1", due: shift(today, -1), facts: [["유입일", shift(today, -1)], ["컨택 상태", "미컨택"], ["첫 연락 기한", shift(today, -1)], ["상담 기록", "없음"]], cta: "컨택할 업체 열기", href: db(3) },
    { group: "overdue", step: "STEP 4", company: "샘플 온유상사", action: "기관·투두 등록", reason: "진행건 1 · 기관·투두 미등록 3일", badge: "D+3", due: shift(today, -3), facts: [["진행건", "1"], ["계약일", shift(today, -3)], ["진행기관", "미등록"], ["다음 투두", "미등록"]], cta: "진행건 설정하기", href: "/payment?row=6&slot=1" },
    { group: "today", step: "STEP 1.5", company: "샘플 소담제과", action: "첫 연락하기", reason: "오늘 유입 · 연락 기록 없음", badge: "오늘", due: today, facts: [["유입일", today], ["컨택 상태", "미컨택"], ["첫 연락 기한", today], ["상담 기록", "없음"]], cta: "컨택할 업체 열기", href: db(2) },
    { group: "today", step: "STEP 3", company: "샘플 가람식당", action: "미팅 후 결과 입력", reason: "오늘 14:00 · 가상 카페 본점", badge: "14:00", due: today, facts: [["미팅일", today + " 14:00"], ["장소", "가상 카페 본점"], ["미팅 상태", "예약"], ["결과 입력 기한", today]], cta: "미팅 결과 입력하기", href: `/schedule?date=${today}&focus=mtg-garam` },
    { group: "today", step: "STEP 4", company: "샘플 달빛공방", action: "현장실사 일정 확인", reason: "소진공 · 투두 마감 오늘", badge: "15:00", due: today, facts: [["진행건", "1 · 일반경영안정"], ["진행기관", "소진공"], ["처리기한", today + " 15:00"], ["투두 상태", "미완료"]], cta: "해당 투두 열기", href: "/payment?row=4&slot=1&focus=todo-today" },
    { group: "long", step: "STEP 4", company: "샘플 늘봄상사", action: "진행기관·투두 등록", reason: "기관·다음 할 일 미등록", badge: "D+26", due: shift(today, -26), facts: [["진행건", "1"], ["진행기관", "미정"], ["계약일", shift(today, -26)]], cta: "진행건 열기", href: "/payment?row=21&slot=1" },
    { group: "long", step: "STEP 4", company: "샘플 은하제작", action: "보완 서류 확인", reason: "보완 요청 후 후속 일정 없음", badge: "D+22", due: shift(today, -22), facts: [["진행건", "2 · 운전자금"], ["진행기관", "중진공"], ["마지막 기록", shift(today, -22)]], cta: "진행건 열기", href: "/payment?row=22&slot=2" },
    { group: "long", step: "STEP 4", company: "샘플 푸른유통", action: "심사 결과 확인", reason: "심사 후속 연락 미등록", badge: "D+14", due: shift(today, -14), facts: [["진행건", "1 · 보증"], ["진행기관", "기술보증기금"], ["처리기한", shift(today, -14)]], cta: "진행건 열기", href: "/payment?row=23&slot=1" },
    { group: "upcoming", step: "STEP 3", company: "샘플 마루상회", action: "미팅 준비", reason: "내일 14:00 · 가상 카페", badge: "D-1", due: shift(today, 1), facts: [["미팅일", shift(today, 1) + " 14:00"], ["장소", "가상 카페"]], cta: "미팅 일정 열기", href: `/schedule?date=${shift(today, 1)}&focus=mtg-maru` },
    { group: "upcoming", step: "STEP 4", company: "샘플 한빛상사", action: "보증서 발급 확인", reason: "신용보증기금 · 이틀 뒤 마감", badge: "D-2", due: shift(today, 2), facts: [["진행건", "1 · 운전자금"], ["진행기관", "신용보증기금"], ["처리기한", shift(today, 2)], ["투두 상태", "미완료"]], cta: "해당 투두 열기", href: "/payment?row=3&slot=1&focus=todo-soon" },
  ];
}

export default function DashboardFollowUpsRulesPreview({todayISO}:{todayISO:string}) {
 const [empty,setEmpty]=useState(false);
 const items:FollowUpItem[]=(empty?[]:examples(todayISO)).map((row,i)=>({
  key:`example:${i}`,kind:"today",step:row.step.replace("STEP ","") as FollowUpStep,
  group:row.group === "long" ? "long-overdue" : row.group,
  title:row.company,company:row.company,detail:row.reason,action:row.action,reasons:[row.reason],
  dueISO:row.due,overdueDays:null,badge:row.badge,href:row.href,facts:row.facts.map(([label,value])=>({label,value})),
 }));
 return <DashboardFollowUpsView items={items} notice={<footer>합성 예시 · 운영 반영 전<button type="button" onClick={()=>setEmpty(!empty)}>{empty?"예시 복원":"0건 보기"}</button></footer>} />;
}
