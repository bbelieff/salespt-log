/** 대시보드 「오늘 챙길 일」 시험용 합성 레코드 — 이름은 전부 '샘플'·'가상', 전화·실데이터 없음. */
import type { ContractPayment, Meeting, PaymentSlot, Todo } from "@/types";
import type { DbSheetLead } from "@/types/db-sheet";

export const TODAY = "2026-10-12";

export const slot = (over: Partial<PaymentSlot> = {}): PaymentSlot => ({
  진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "", ...over,
});

export const contract = (over: Partial<ContractPayment> = {}): ContractPayment => ({
  row: 3, 계약일: "2026-09-01", 업체명: "샘플상사", 수임비: 100, 계약비고: "",
  공동인증서: false, 임대차계약서: false, 신분증: false, 드라이브업로드: false, 사업계획서초안발송: false,
  컨설팅5종서류발송: false, 플러그이관: false, 수납1: slot(), 수납2: slot(), 수납3: slot(), 로드맵메모: "",
  해지일: "", 해지사유: "", 반환액: 0, 해지숨김: false, ...over,
} as ContractPayment);

let seq = 0;
export const todo = (over: Partial<Todo> = {}): Todo => ({
  id: `todo-${++seq}`, contractRef: "2026-09-01|샘플상사", institutionRef: "", 업체명: "샘플상사", type: "기타",
  제목: "서류 확인", 예정일자: TODAY, 예정시각: "", 장소: "", 상세: "", showOnCalendar: true, 완료여부: false,
  생성시각: "", 분류: "", 기록종류: "todo", ...over,
});

export const meeting = (over: Partial<Meeting> = {}): Meeting => ({
  id: `meeting-${++seq}`, 예약일: "2026-10-01", 예약시각: "10:00", 미팅날짜: "2026-10-10", 미팅시간: "14:00",
  channel: "매입DB", 업체명: "샘플 가람식당", 장소: "가상 카페", 예약비고: "", 상태: "예약", 계약여부: false,
  수임비: 0, 미팅사유: "", 계약조건: "", ...over,
});

export const lead = (over: Partial<DbSheetLead> = {}): DbSheetLead => ({
  id: `lead-${++seq}`, supplier: "가상공급처", date: "2026-10-01", channel: "매입DB", company: "샘플 다온상회", owner: "김가상",
  phone: "", biz: "", address: "", industry: "", credit: "", sales: "", arrears: "", funds: "", next: "", memo: "",
  contact: { ci: {} as DbSheetLead["contact"]["ci"], note: "", date: "", meetingDate: "", time: "", place: "", reservationNote: "", registered: false, companyName: "" },
  revision: 1, result: "부재", first: "", stage: "미컨택", meetingId: null, ...over,
});
