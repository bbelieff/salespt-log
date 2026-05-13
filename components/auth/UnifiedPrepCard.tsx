/**
 * UnifiedPrepCard — 신규 수강생 사전 등록 (단일 + 일괄 paste 모드 토글).
 *
 * 기존 BulkPrepForm / TraineePrepForm 두 카드가 화면 공간 많이 차지하고 내용
 * 겹쳐서 한 collapsible details 안에 모드 토글로 통합 (사용자 피드백 2026-05-13).
 *
 * 모드:
 *   - "single" — 한 명씩: 기수 + 이름 + 시트 URL → POST /api/admin/add-trainee-prep
 *   - "bulk"   — paste: 여러 줄 텍스트 자동 파싱 → POST /api/admin/bulk-add-trainee-prep
 */
"use client";

import { useState } from "react";
import { type PrepItem, parsePrepText } from "./TraineePrepBulkForm";

type Mode = "single" | "bulk";

export default function UnifiedPrepCard({
  busy,
  onSubmitSingle,
  onSubmitBulk,
}: {
  busy: boolean;
  onSubmitSingle: (
    cohort: string,
    name: string,
    spreadsheetUrl: string,
  ) => Promise<void>;
  onSubmitBulk: (items: PrepItem[]) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("single");

  return (
    <details className="rounded-2xl border border-sky-200 bg-sky-50/50">
      <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-sky-800 hover:bg-sky-100">
        ➕ 신규 수강생 사전 등록
      </summary>
      <div className="border-t border-sky-200 px-4 py-4">
        {/* 모드 토글 */}
        <div className="mb-3 inline-flex rounded-full border border-sky-200 bg-white p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`rounded-full px-3 py-1 font-bold transition-colors ${
              mode === "single"
                ? "bg-sky-600 text-white"
                : "text-sky-700 hover:bg-sky-50"
            }`}
          >
            한 명씩
          </button>
          <button
            type="button"
            onClick={() => setMode("bulk")}
            className={`rounded-full px-3 py-1 font-bold transition-colors ${
              mode === "bulk"
                ? "bg-sky-600 text-white"
                : "text-sky-700 hover:bg-sky-50"
            }`}
          >
            여러 명 paste
          </button>
        </div>

        {mode === "single" ? (
          <SingleForm busy={busy} onSubmit={onSubmitSingle} />
        ) : (
          <BulkForm busy={busy} onSubmit={onSubmitBulk} />
        )}
      </div>
    </details>
  );
}

function SingleForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (
    cohort: string,
    name: string,
    spreadsheetUrl: string,
  ) => Promise<void>;
}) {
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const cohort = String(fd.get("cohort") ?? "").trim();
        const name = String(fd.get("name") ?? "").trim();
        const url = String(fd.get("spreadsheetUrl") ?? "").trim();
        if (!cohort || !name || !url) return;
        await onSubmit(cohort, name, url);
        (e.currentTarget as HTMLFormElement).reset();
      }}
    >
      <p className="text-[11px] text-gray-500">
        시트 URL 입력하면 자동으로 ID 추출. 본인이 같은 기수·이름으로 로그인
        하면 즉시 활성.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[80px_1fr]">
        <input
          name="cohort"
          type="text"
          inputMode="numeric"
          placeholder="기수"
          required
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
        <input
          name="name"
          type="text"
          placeholder="이름"
          required
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
      </div>
      <input
        name="spreadsheetUrl"
        type="text"
        placeholder="https://docs.google.com/spreadsheets/d/.../edit"
        required
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50"
      >
        {busy ? "등록 중..." : "사전 등록"}
      </button>
    </form>
  );
}

function BulkForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (items: PrepItem[]) => Promise<void>;
}) {
  const placeholder = `세일즈PT_ 6기 김미란 수강생 경영일지
https://docs.google.com/spreadsheets/d/.../edit

세일즈PT_ 6기 김선주 수강생 경영일지
https://docs.google.com/spreadsheets/d/.../edit`;
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const text = String(fd.get("bulk") ?? "");
        const items = parsePrepText(text);
        if (items.length === 0) {
          window.alert("파싱된 항목이 없습니다. 형식을 확인하세요.");
          return;
        }
        if (
          !window.confirm(
            `${items.length}명을 사전 등록합니다. 계속할까요?\n첫 항목: ${items[0]!.cohort}기 ${items[0]!.name}`,
          )
        )
          return;
        await onSubmit(items);
        form.reset();
      }}
    >
      <p className="text-[11px] text-gray-500">
        시트 이름 줄 + URL 줄 페어 (페어 사이 빈 줄 OK).
      </p>
      <textarea
        name="bulk"
        rows={6}
        placeholder={placeholder}
        required
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-[11px] outline-none focus:border-sky-500"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50"
      >
        {busy ? "등록 중..." : "일괄 등록"}
      </button>
    </form>
  );
}
