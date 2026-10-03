/**
 * CompanySearchBar — payment 업체/진행기관 보기의 목록 검색.
 *
 * 모바일은 목록 상단 sticky, PC 작업판에서는 정렬 버튼과 같은 줄의 compact 입력.
 * 클라 표시 필터 전용: 모드별 부분일치는 page 가 수행, 여기는 입력 UI.
 * 입력 중 X 버튼 = 초기화 → 전체 목록 복귀. 시트·데이터 로직 무변경.
 */
"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** 검색 중일 때 일치 업체 수 (빈 검색이면 표시 안 함). */
  matchCount: number;
  total: number;
  placeholder?: string;
  unit?: string;
  matchUnit?: string;
}

export default function CompanySearchBar({ value, onChange, matchCount, total, placeholder = "업체명 검색", unit = "개 업체", matchUnit = "개 업체" }: Props) {
  const active = value.trim() !== "";
  return (
    <div className="sticky top-app-content z-30 mb-3 min-[1280px]:static min-[1280px]:mb-0 min-[1280px]:min-w-[180px] min-[1280px]:max-w-[360px] min-[1280px]:flex-1">
      <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm min-[1280px]:py-1">
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
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-8 min-w-0 flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none min-[1280px]:h-6"
          />
          {active && (
            <>
              <span className="shrink-0 text-xs font-semibold text-gray-500">
                {matchCount}{matchUnit} 일치
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
            <span className="shrink-0 text-xs text-gray-300">{total}{unit}</span>
          )}
        </div>
      </div>
    </div>
  );
}
