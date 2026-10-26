/** 비서의 하루요약·사서함 (belie 2026-10-26). A snapshot of the day at send time, kept 90 days. */
export type ReportSlot = "morning" | "evening";
/** contact·meeting = [1] 영업, work = [2] 실무, missed = [3] 놓친 일 · 저녁은 left(오늘 남은 일)·tomorrow(내일 약속). */
export type ReportSectionKey = "contact" | "meeting" | "work" | "missed" | "left" | "tomorrow";

export interface ReportItem {
  key: string; label: string; detail: string; badge: string; href: string;
  /** 연락 결과 (미컨택·부재·재통화) — contact rows only. */
  tag?: string;
  /** HH:MM — meeting rows only. */
  time?: string;
  /** Days past due — missed rows only. */
  overdueDays?: number;
}
export interface ReportSection { key: ReportSectionKey; title: string; items: ReportItem[] }

export interface DailyReport {
  slot: ReportSlot;
  localDate: string;
  /** HH:MM the report was made (KST). */
  sentAt: string;
  headline: string;
  sections: ReportSection[];
}

/** 사서함 목록 한 줄. */
export interface InboxEntry {
  id: string; slot: ReportSlot; localDate: string; sentAt: string; headline: string; readAt: string | null;
  /** Item count per section, in report order — the list row shows these. */
  counts: Array<{ key: ReportSectionKey; title: string; n: number }>;
}
export interface InboxReport extends InboxEntry { sections: ReportSection[] }
