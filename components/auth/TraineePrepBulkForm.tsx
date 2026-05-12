/**
 * BulkPrepForm — admin 이 여러 수강생을 한 번에 paste 로 prep row 등록.
 *
 * 입력 형식 (둘 다 지원, mix OK):
 *
 * 1) 시트 이름 + URL 페어 (사용자 메시지 그대로):
 *      세일즈PT_ 6기 김미란 수강생 경영일지
 *      https://docs.google.com/spreadsheets/d/1QXfmT.../edit?usp=sharing
 *
 *      세일즈PT_ 6기 김선주 수강생 경영일지
 *      https://docs.google.com/spreadsheets/d/.../edit
 *
 * 2) TSV 한 줄: `기수<tab>이름<tab>URL`.
 *
 * 헤더 + URL 같은 줄에 붙어있는 경우(`...경영일지https://...`)도 처리.
 *
 * AdminUserPickerSections.tsx 가 500줄 cap 위반 — 별도 파일로 분리.
 */
"use client";

export interface PrepItem {
  cohort: string;
  name: string;
  spreadsheetUrl: string;
}

const SHEET_NAME_RE =
  /세일즈PT_\s*(\d+)\s*기\s+(\S(?:.*?\S)?)\s+수강생\s+경영일지/;
const URL_RE =
  /(https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9_-]{20,}[^\s]*)/;

/** paste 텍스트를 PrepItem[] 으로 파싱. invalid 라인은 무시. */
export function parsePrepText(text: string): PrepItem[] {
  const items: PrepItem[] = [];
  let pending: { cohort: string; name: string } | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    // TSV.
    if (line.includes("\t")) {
      const [c, n, u] = line.split("\t").map((s) => s.trim());
      if (c && n && u && URL_RE.test(u)) {
        items.push({ cohort: c, name: n, spreadsheetUrl: u });
        continue;
      }
    }

    // 시트 이름 헤더.
    const head = SHEET_NAME_RE.exec(line);
    if (head) {
      pending = { cohort: head[1]!, name: head[2]!.trim() };
      // 헤더 + URL 같은 줄에 붙어있는 경우.
      const urlInline = URL_RE.exec(line);
      if (urlInline) {
        items.push({
          cohort: pending.cohort,
          name: pending.name,
          spreadsheetUrl: urlInline[1]!,
        });
        pending = null;
      }
      continue;
    }

    // URL 단독 — 직전 헤더와 페어링.
    const urlOnly = URL_RE.exec(line);
    if (urlOnly && pending) {
      items.push({
        cohort: pending.cohort,
        name: pending.name,
        spreadsheetUrl: urlOnly[1]!,
      });
      pending = null;
    }
  }
  return items;
}

export function BulkPrepForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (items: PrepItem[]) => Promise<void>;
}) {
  const placeholder = `예시 — 사용자 메시지 그대로 paste 가능:

세일즈PT_ 6기 김미란 수강생 경영일지
https://docs.google.com/spreadsheets/d/.../edit?usp=sharing

세일즈PT_ 6기 김선주 수강생 경영일지
https://docs.google.com/spreadsheets/d/.../edit

또는 TSV 한 줄:
4\t손기학\thttps://docs.google.com/spreadsheets/d/.../edit`;
  return (
    <details className="rounded-2xl border border-emerald-200 bg-emerald-50/40">
      <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-100">
        📋 일괄 사전 등록 (여러 명을 한 번에 paste)
      </summary>
      <form
        className="space-y-2 border-t border-emerald-200 px-4 py-4"
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
              `${items.length}명을 사전 등록합니다.\n첫 항목: ${items[0]!.cohort}기 ${items[0]!.name}\n계속할까요?`,
            )
          ) {
            return;
          }
          await onSubmit(items);
          form.reset();
        }}
      >
        <p className="text-[11px] text-gray-500">
          시트 이름 줄 + URL 줄 페어 (페어 사이 빈 줄 OK) — 사용자에게 받은
          메시지를 그대로 paste 하면 자동 파싱.
        </p>
        <textarea
          name="bulk"
          rows={8}
          placeholder={placeholder}
          required
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-[11px] outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "등록 중..." : "일괄 등록"}
        </button>
      </form>
    </details>
  );
}
