/**
 * 실무/수납 선택 상태 — 순수 상태 전이(2026-10-19 구조 개선 ⑩).
 *
 * 전에는 page.tsx 의 useState 7개를 화면 곳곳에서 손으로 같이 바꿨다(같은 「선택 → 상세 펼침 →
 * 포커스 요청」 묶음이 4번 복사). 전이를 한 곳에 모아 화면 없이 시험한다.
 * 스크롤·미저장 가드·외부 포커스 해제 같은 부작용은 page 가 그대로 맡는다.
 */
export type PaymentListMode = "company" | "institution";

export type PaymentSelection = {
  listMode: PaymentListMode;
  /** 업체명/기관 검색어. */
  query: string;
  /** 기관 보기에서 고른 진행건. */
  workKey: string | null;
  /** 업체 보기에서 고른 업체 카드. */
  companyKey: string | null;
  /** 상세에 보일 계약 행. */
  row: number | null;
  /** 상세가 해당 칸으로 다시 포커스하도록 올리는 번호. */
  focusId: number;
  /** 모바일 상세 펼침. */
  detailExpanded: boolean;
};

export const INITIAL_PAYMENT_SELECTION: PaymentSelection = {
  listMode: "company", query: "", workKey: null, companyKey: null, row: null, focusId: 0, detailExpanded: true,
};

export type PaymentSelectionAction =
  /** 알림·할 일에서 들어온 포커스 — 그 계약을 고르고 포커스만 다시 요청. */
  | { type: "focusTarget"; row: number; companyKey: string | null }
  | { type: "selectWork"; key: string; row: number | null }
  | { type: "selectCompany"; key: string; row: number | null }
  /** 보기 전환 — 지금 고른 것과 이어지는 항목으로 옮겨 간다. */
  | { type: "switchMode"; mode: PaymentListMode; workKey: string | null; companyKey: string | null; row: number | null }
  /** 성과 요약에서 특정 계약 칸으로 이동 — 업체 보기로. */
  | { type: "navigate"; row: number | null; companyKey: string | null }
  /** 업체를 새로 추가함. */
  | { type: "created"; row: number }
  | { type: "query"; value: string }
  | { type: "toggleDetail" }
  | { type: "collapseDetail" };

export function paymentSelectionReducer(s: PaymentSelection, a: PaymentSelectionAction): PaymentSelection {
  switch (a.type) {
    case "focusTarget":
      return { ...s, row: a.row, companyKey: a.companyKey, focusId: s.focusId + 1 };
    case "selectWork":
      return { ...s, workKey: a.key, row: a.row, detailExpanded: true, focusId: s.focusId + 1 };
    case "selectCompany":
      return { ...s, companyKey: a.key, row: a.row, detailExpanded: true, focusId: s.focusId + 1 };
    case "switchMode":
      if (a.mode === s.listMode) return s;
      return a.mode === "institution"
        ? { ...s, listMode: a.mode, workKey: a.workKey, detailExpanded: true, query: "" }
        : { ...s, listMode: a.mode, companyKey: a.companyKey, row: a.row, detailExpanded: true, query: "" };
    case "navigate":
      return { ...s, listMode: "company", query: "", row: a.row, companyKey: a.companyKey, focusId: s.focusId + 1 };
    case "created":
      return { ...s, query: "", companyKey: null, row: a.row, detailExpanded: true, focusId: s.focusId + 1 };
    case "query":
      return { ...s, query: a.value };
    case "toggleDetail":
      return { ...s, detailExpanded: !s.detailExpanded };
    case "collapseDetail":
      return { ...s, detailExpanded: false };
  }
}

/** 상세의 해당 수납 칸으로 부드럽게 스크롤(목록 갱신 뒤 80ms). */
export function scrollToPaymentSlot(row: number | null | undefined, slot: number | null | undefined) {
  window.setTimeout(() => document.getElementById(`payment-slot-${row}-${slot}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
}
