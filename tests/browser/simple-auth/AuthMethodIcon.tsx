/**
 * 인증 수단 아이콘(목업). 각 회사 대표색 + 글자로 만든 간이 마크다 — 공식 로고가 아니다.
 * 실제 구현에서는 각 사 브랜드 리소스(공식 로고 파일)로 바꾼다.
 */
import type { AuthMethod } from "./data";

const MARK: Record<AuthMethod, { bg: string; fg: string; text?: string }> = {
  카카오톡: { bg: "#FEE500", fg: "#191919" },
  네이버: { bg: "#03C75A", fg: "#FFFFFF", text: "N" },
  PASS: { bg: "#E4002B", fg: "#FFFFFF", text: "P" },
  토스: { bg: "#0064FF", fg: "#FFFFFF", text: "t" },
  삼성패스: { bg: "#1428A0", fg: "#FFFFFF", text: "S" },
  KB모바일: { bg: "#FFBC00", fg: "#60584C", text: "KB" },
};

export default function AuthMethodIcon({ method }: { method: AuthMethod }) {
  const m = MARK[method];
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" aria-hidden>
      <rect width="20" height="20" rx="5" fill={m.bg} />
      {m.text
        ? <text x="10" y="14.2" textAnchor="middle" fontSize={m.text.length > 1 ? 8.5 : 12} fontWeight="800" fontFamily="Arial, sans-serif" fill={m.fg}>{m.text}</text>
        : <path d="M10 4.6c-3.3 0-6 2.1-6 4.7 0 1.7 1.1 3.1 2.8 3.9l-.6 2.3c-.1.2.2.4.4.3l2.7-1.8c.2 0 .5.1.7.1 3.3 0 6-2.1 6-4.8S13.3 4.6 10 4.6z" fill={m.fg} />}
    </svg>
  );
}
