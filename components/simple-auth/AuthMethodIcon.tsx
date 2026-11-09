/**
 * 인증 수단 아이콘 — 각 사 공식 앱 아이콘(belie 2026-11-09: 각사 공식 아이콘).
 * 파일: public/auth-methods/*.png(96px). 출처는 각 앱의 공식 스토어 아이콘
 * (App Store: 카카오톡·네이버·토스·PASS by SKT·KB스타뱅킹 / Galaxy Store: 삼성 패스).
 * 공동인증서는 회사 로고가 없어 중립 마크를 그린다.
 */
import type { SimpleAuthMethod as Method } from "@/types/simple-auth";

const ICON: Record<Method, { src?: string; tint: string }> = {
  카카오톡: { src: "/auth-methods/kakao.png", tint: "#FEE500" },
  네이버: { src: "/auth-methods/naver.png", tint: "#03C75A" },
  PASS: { src: "/auth-methods/pass.png", tint: "#E4002B" },
  토스: { src: "/auth-methods/toss.png", tint: "#0064FF" },
  삼성패스: { src: "/auth-methods/samsungpass.png", tint: "#1428A0" },
  KB모바일: { src: "/auth-methods/kb.png", tint: "#FFBC00" },
  공동인증서: { tint: "#475569" },
};

export default function AuthMethodIcon({ method, className = "h-5 w-5" }: { method: Method; className?: string }) {
  const m = ICON[method];
  if (m.src) {
    return <img src={m.src} alt="" aria-hidden width={20} height={20} className={`${className} shrink-0 rounded-[22%] ring-1 ring-black/10`} />;
  }
  return (
    <svg viewBox="0 0 20 20" className={`${className} shrink-0`} aria-hidden>
      <rect width="20" height="20" rx="5" fill={m.tint} />
      <text x="10" y="14.2" textAnchor="middle" fontSize={12} fontWeight="800" fontFamily="Arial, sans-serif" fill="#FFFFFF">인</text>
    </svg>
  );
}

/** 목록용 — 인증 수단을 회사색 띠 안의 아이콘으로(belie 2026-11-08: 글자 말고 아이콘). */
export function MethodBadge({ method, time }: { method: Method; time?: string }) {
  const m = ICON[method];
  const name = method === "공동인증서" ? "공동인증서" : `${method} 인증`;
  return (
    <span title={name} className="inline-flex shrink-0 items-center gap-1.5 rounded-full py-0.5 pl-1 pr-2 text-sm text-gray-700 tabular-nums" style={{ backgroundColor: `${m.tint}26`, boxShadow: `inset 0 0 0 1px ${m.tint}66` }}>
      <AuthMethodIcon method={method} className="h-4 w-4" />
      <span className="sr-only">{name}</span>
      {/* 날짜는 위 날짜 묶음에 있으므로 시각만(「11-08 14:02」 → 「14:02」, belie 2026-11-09 한 줄 요청). */}
      {time && <span>{time.split(" ").pop()}</span>}
    </span>
  );
}
