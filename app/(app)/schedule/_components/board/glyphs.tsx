/** 주간 보드 작은 아이콘 — 투두 종류(기타는 점 세 개가 말줄임표와 헷갈려 체크 클립보드). */
import type { TodoType } from "@/types";

const P: Record<string, string> = {
  전화: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2",
  메시지: "M4 5h16v11H8l-4 4z",
  미팅: "M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 10a3 3 0 100-6 3 3 0 000 6M22 20v-2a4 4 0 00-3-3.9M16 4.1a3 3 0 010 5.8",
  기타: "M7 4h10a2 2 0 012 2v13a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2zM9 4V3h6v1M9 12.5l2 2 4-4",
  일반: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
};

export function TodoTypeGlyph({ type, className }: { type: TodoType; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <path d={P[type] ?? P.기타} />
    </svg>
  );
}
