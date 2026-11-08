/**
 * 인증 수단 아이콘(목업). 각 회사 대표색 + 글자로 만든 간이 마크다 — 공식 로고가 아니다.
 * 실제 구현에서는 각 사 브랜드 리소스(공식 로고 파일)로 바꾼다.
 */
import type { Method } from "./data";

const MARK: Record<Method, { bg: string; fg: string; text?: string }> = {
  카카오톡: { bg: "#FEE500", fg: "#191919" },
  네이버: { bg: "#03C75A", fg: "#FFFFFF", text: "N" },
  PASS: { bg: "#E4002B", fg: "#FFFFFF", text: "P" },
  토스: { bg: "#0064FF", fg: "#FFFFFF", text: "t" },
  삼성패스: { bg: "#1428A0", fg: "#FFFFFF", text: "S" },
  KB모바일: { bg: "#FFBC00", fg: "#60584C", text: "KB" },
  공동인증서: { bg: "#475569", fg: "#FFFFFF", text: "인" },
};

export default function AuthMethodIcon({ method, className = "h-5 w-5" }: { method: Method; className?: string }) {
  const m = MARK[method];
  return (
    <svg viewBox="0 0 20 20" className={`${className} shrink-0`} aria-hidden>
      <rect width="20" height="20" rx="5" fill={m.bg} />
      {m.text
        ? <text x="10" y="14.2" textAnchor="middle" fontSize={m.text.length > 1 ? 8.5 : 12} fontWeight="800" fontFamily="Arial, sans-serif" fill={m.fg}>{m.text}</text>
        : <path d="M10 4.6c-3.3 0-6 2.1-6 4.7 0 1.7 1.1 3.1 2.8 3.9l-.6 2.3c-.1.2.2.4.4.3l2.7-1.8c.2 0 .5.1.7.1 3.3 0 6-2.1 6-4.8S13.3 4.6 10 4.6z" fill={m.fg} />}
    </svg>
  );
}

/** 목록용 — 인증 수단을 회사색 띠 안의 아이콘으로(belie 2026-11-08: 글자 말고 아이콘). */
export function MethodBadge({ method, time }: { method: Method; time?: string }) {
  const m = MARK[method];
  const name = method === "공동인증서" ? "공동인증서" : `${method} 인증`;
  return (
    <span title={name} className="inline-flex shrink-0 items-center gap-1.5 rounded-full py-0.5 pl-1 pr-2 text-sm text-gray-700 tabular-nums" style={{ backgroundColor: `${m.bg}26`, boxShadow: `inset 0 0 0 1px ${m.bg}66` }}>
      <AuthMethodIcon method={method} className="h-4 w-4" />
      <span className="sr-only">{name}</span>
      {/* 날짜는 위 날짜 묶음에 있으므로 시각만(「11-08 14:02」 → 「14:02」, belie 2026-11-09 한 줄 요청). */}
      {time && <span>{time.split(" ").pop()}</span>}
    </span>
  );
}
