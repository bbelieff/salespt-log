/**
 * CompanyDocDiffTable — 「문서로 자동입력」 비교표. 항목 | 지금 값 | 문서에서 읽은 값 | 정확도 | 적용.
 * 행·기본 체크 규칙은 lib/document-ocr/diff.ts(buildDiffRows) 가 정한다 — 이 파일은 그리기만.
 * 두 문서가 다른 값을 내면(충돌) 값 칸이 고르기 상자가 되고, 기본은 정확도 높은 값.
 */
"use client";

import { accuracyOf, checkState, type Accuracy, type DiffRow } from "@/lib/document-ocr/diff";

const ACC_CLS: Record<Accuracy, string> = {
  높음: "bg-emerald-50 text-emerald-700",
  보통: "bg-amber-50 text-amber-700",
  낮음: "bg-red-50 text-red-600",
};

interface Props {
  rows: DiffRow[];
  labelOf: (key: string) => string;
  checked: Record<string, boolean>;
  choice: Record<string, number>;
  onCheck: (key: string, v: boolean) => void;
  onChoose: (key: string, index: number) => void;
}

export default function CompanyDocDiffTable({ rows, labelOf, checked, choice, onCheck, onChoose }: Props) {
  if (rows.length === 0) return null;
  return (
    <table className="w-full table-fixed border-collapse text-xs">
      <caption className="sr-only">문서에서 읽은 값과 지금 값 비교</caption>
      <thead>
        <tr className="border-b border-gray-200 text-left text-gray-500">
          <th scope="col" className="w-14 py-1.5 pr-1 font-medium sm:w-1/5">항목</th>
          <th scope="col" className="w-16 py-1.5 pr-1 font-medium sm:w-1/4">지금 값</th>
          <th scope="col" className="py-1.5 pr-1 font-medium">문서에서 읽은 값</th>
          <th scope="col" className="w-10 py-1.5 pr-1 font-medium sm:w-12">정확도</th>
          <th scope="col" className="w-8 py-1.5 text-center font-medium sm:w-10">적용</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const idx = choice[row.key] ?? 0;
          const c = row.candidates[idx] ?? row.candidates[0]!;
          const acc = accuracyOf(c.confidence);
          const label = labelOf(row.key);
          const boxId = `doc-apply-${row.key}`;
          // 안내는 지금 고른 후보 기준(충돌 행에서 다른 값을 고르면 바뀐다).
          const note = checkState(row.current, c).note;
          const warn = [...c.warnings, ...(row.conflict ? ["문서마다 값이 달라요. 맞는 값을 골라 주세요."] : [])];
          return (
            <tr key={row.key} className="border-b border-gray-100 align-top" data-row={row.key}>
              <th scope="row" className="break-words py-1.5 pr-1 text-left font-medium text-gray-800">
                <label htmlFor={boxId}>{label}</label>
              </th>
              <td className="whitespace-pre-line break-words py-1.5 pr-1 text-gray-500">
                {row.current || <span className="text-gray-300">비어 있음</span>}
              </td>
              <td className="break-words py-1.5 pr-1 text-gray-900">
                {row.conflict ? (
                  <select
                    aria-label={`${label} 값 고르기`}
                    className="w-full rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-xs"
                    value={idx}
                    onChange={(e) => onChoose(row.key, Number(e.target.value))}
                  >
                    {row.candidates.map((o, i) => (
                      <option key={`${o.value}-${i}`} value={i}>
                        {o.value} ({o.sources.join(", ")})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="whitespace-pre-line">{c.value}</span>
                )}
                {warn.map((w) => (
                  <p key={w} className="mt-0.5 text-amber-700">
                    ⚠ {w}
                  </p>
                ))}
                {note && <p className="mt-0.5 text-gray-400">{note}</p>}
              </td>
              <td className="py-1.5 pr-1">
                <span className={`rounded px-1 py-0.5 font-medium ${ACC_CLS[acc]}`}>{acc}</span>
              </td>
              <td className="py-1.5 text-center">
                <input
                  id={boxId}
                  type="checkbox"
                  className="h-4 w-4 accent-gray-900"
                  checked={Boolean(checked[row.key])}
                  onChange={(e) => onCheck(row.key, e.target.checked)}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
