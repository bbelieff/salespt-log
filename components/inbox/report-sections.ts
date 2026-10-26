/** 하루요약 구역별 표시 — 색은 하단 탭 단계색(컨택=에메랄드·미팅=바이올렛·실무=로즈)을 그대로 따른다. */
import { CalendarClock, ClipboardList, Clock3, Phone, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReportSectionKey } from "@/types/push-report";

export interface SectionMeta { short: string; icon: LucideIcon; tone: "contact" | "meeting" | "work" | "missed" | "left"; empty: string }

export const SECTION_META: Record<ReportSectionKey, SectionMeta> = {
  contact: { short: "컨택", icon: Phone, tone: "contact", empty: "오늘 연락할 DB가 없어요." },
  meeting: { short: "미팅", icon: CalendarClock, tone: "meeting", empty: "오늘 잡힌 미팅이 없어요." },
  work: { short: "실무", icon: ClipboardList, tone: "work", empty: "오늘 기한인 실무가 없어요." },
  left: { short: "남은 일", icon: Clock3, tone: "left", empty: "오늘 할 일을 모두 마쳤어요." },
  tomorrow: { short: "내일", icon: CalendarClock, tone: "meeting", empty: "내일 잡힌 약속이 아직 없어요." },
  missed: { short: "놓친 일", icon: TriangleAlert, tone: "missed", empty: "놓친 일이 없어요." },
};
