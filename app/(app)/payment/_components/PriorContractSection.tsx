/**
 * PriorContractSection — 모바일 바깥 링크 2개(업무매뉴얼·정책자금 뉴스).
 * 아레나/이월 매출 보조 카드는 성과 요약과 중복되어 2026-09-27 제거했다.
 *
 * 2026-09-05 belie: 여기 있던 「이전 계약업체 등록」 버튼을 **업무매뉴얼 버튼으로 교체**했다.
 * 등록 흐름은 지우지 않고 `PriorContractRegister.tsx` 로 통째로 옮겨 뒀다 — 되살리는 법은
 * 그 파일 머리말 두 줄. 서버(API·서비스)는 그대로라 붙이는 즉시 동작한다.
 * 이미 등록된 이전 계약은 계약 목록에 그대로 보인다.
 */
"use client";

import { POLICY_NEWS_URL, WORK_MANUAL_URL } from "@/config/links";

export default function PriorContractSection() {
  return (
    <>
      {/* 앱 밖으로 나가는 문 2개 — 2열로 둔다.
          2026-09-05 belie: 이 자리에 있던 「이전 계약업체 등록」을 업무매뉴얼로 교체
          (등록 흐름은 `PriorContractRegister.tsx` 에 보존 — 되살리는 법은 그 파일 머리말).
          2026-09-18 belie: 정책자금 뉴스를 그 **옆에** 붙였다. 세로로 쌓으면 모바일에서
          계약 목록이 한 칸 더 밀리는데, 둘 다 성격이 같은 바깥 링크라 나란히 두는 게 맞다. */}
      <div className="mb-3 grid grid-cols-2 gap-2 pc:hidden">
        <a
          href={WORK_MANUAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
        >
          <span className="text-base leading-none">📘</span>
          업무매뉴얼 보기
        </a>
        {/* emerald 는 앱에 이미 쓰이는 조합이라 새 토큰이 필요 없다.
            주소를 날짜로 박지 않는 이유는 `lib/config/links.ts` 의 POLICY_NEWS_URL 주석 참고. */}
        <a
          href={POLICY_NEWS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
        >
          <span className="text-base leading-none">📊</span>
          정책자금 뉴스
        </a>
      </div>

    </>
  );
}
