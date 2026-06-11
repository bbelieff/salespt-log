/**
 * CompanySearchBar — payment 업체 검색 (feat/payment-company-search).
 *
 * 목록 상단 sticky(top-24 — TopHeader 48 + 배너 48 아래, z-30 — tokens z-stack).
 * 클라 표시 필터 전용: 부분일치(대소문자·공백 무시)는 page 가 수행, 여기는 입력 UI.
 * 입력 중 X 버튼 = 초기화 → 전체 목록 복귀. 시트·데이터 로직 무변경.
 */
"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** 검색 중일 때 일치 업체 수 (빈 검색이면 표시 안 함). */
  matchCount: number;
  total: number;
}

export default function CompanySearchBar({ value, onChange, matchCount, total }: Props) {
  const active = value.trim() !== "";
  return (
    <div className="sticky top-24 z-30 mb-3">
      <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          {/* 돋보기 — 기존 인라인 svg 아이콘 세트 패턴 */}
          <svg
            className="h-4 w-4 shrink-0 text-gray-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"
            />
          </svg>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="업체명 검색"
            aria-label="업체명 검색"
            className="h-8 min-w-0 flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none"
          />
          {active && (
            <>
              <span className="shrink-0 text-xs font-semibold text-gray-500">
                {matchCount}개 업체 일치
              </span>
              <button
                type="button"
                onClick={() => onChange("")}
                aria-label="검색 초기화"
                className="shrink-0 rounded-full px-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ✕
              </button>
            </>
          )}
          {!active && total > 0 && (
            <span className="shrink-0 text-xs text-gray-300">{total}개 업체</span>
          )}
        </div>
      </div>
    </div>
  );
}
