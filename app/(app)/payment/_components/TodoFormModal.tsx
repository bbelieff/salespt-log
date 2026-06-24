/**
 * TodoFormModal — 실무 ToDo 생성 팝업 (Pluuug 모티브, 담당자 없음).
 * (계약 × 기관) 단위 — institutionRef = 슬롯 진행기관.
 * 시각 정본: docs/design/prototypes/practice-payment-mockup.html
 */
"use client";

import { useState } from "react";
import { useCreateTodo } from "@/query/todos-hooks";
import { useDirtyEntry, useGuardedNav } from "@/components/DirtyGuard";
import type { TodoType } from "@/types";

const TYPES: TodoType[] = ["기타", "미팅", "전화", "메시지"];
const HOURS = [
  "08", "09", "10", "11", "12", "13", "14",
  "15", "16", "17", "18", "19", "20",
];
const MINUTES = ["00", "30"];

interface Props {
  contractRef: string;
  institutionRef: string;
  companyName: string;
  onClose: () => void;
}

export default function TodoFormModal({
  contractRef,
  institutionRef,
  companyName,
  onClose,
}: Props) {
  const create = useCreateTodo();
  const [type, setType] = useState<TodoType>("기타");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("09");
  const [minute, setMinute] = useState("00");
  const [detail, setDetail] = useState("");
  const [showOnCalendar, setShowOnCalendar] = useState(true);
  const [error, setError] = useState("");

  // 검증 실패·API 실패 시 throw 하는 코어 — 가드 save 가 이걸 호출해 실패 시 이동을 막는다.
  const doCreate = async () => {
    if (!title.trim()) throw new Error("제목을 입력해주세요.");
    if (!date) throw new Error("예정 일자를 선택해주세요.");
    await create.mutateAsync({
      contractRef,
      institutionRef,
      업체명: companyName,
      type,
      제목: title.trim(),
      예정일자: date,
      예정시각: `${hour}:${minute}`,
      장소: "",
      상세: detail.trim(),
      showOnCalendar,
    });
    onClose();
  };
  const submit = async () => {
    try {
      await doCreate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패");
    }
  };

  // 미저장 이탈 가드 — 의미있는 입력이 있으면 dirty. 저장하고 이동=doCreate(검증 throw 시 이동 차단).
  // 무시하고 이동=onClose(모달 언마운트로 입력 폐기). id 는 (계약×기관) 안정키.
  useDirtyEntry(
    `todo-${contractRef}-${institutionRef}`,
    title.trim() !== "" || date !== "" || detail.trim() !== "",
    doCreate,
    onClose,
    `투두 · ${companyName || institutionRef || "신규"}`,
  );

  const SELECT_CLASS =
    "h-9 w-full rounded-md border border-gray-300 px-1 text-sm focus:border-blue-500 focus:outline-none";

  const guardedNav = useGuardedNav();
  const guardedClose = () => guardedNav(onClose); // 닫기(배경·×)도 미저장 가드
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4"
      onClick={guardedClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-sm overflow-auto rounded-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pb-1 pt-4">
          <span className="text-xs font-medium text-gray-400">
            실무 투두 생성{institutionRef ? ` · ${institutionRef}` : ""}
          </span>
          <button
            type="button"
            onClick={guardedClose}
            className="text-xl leading-none text-gray-400"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <div className="px-4 pb-4">
          <h3 className="mb-3 text-lg font-bold text-gray-900">
            실무 투두 내용을 입력하세요
          </h3>

          {/* type 탭 */}
          <div className="mb-4 flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`inline-flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  type === t
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-500"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* 제목 */}
          <label className="mb-1 block text-xs text-gray-500">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력해주세요."
            className="mb-3 h-9 w-full rounded-md border border-gray-300 px-2 text-sm focus:border-blue-500 focus:outline-none"
          />

          {/* 예정 일자 + 시각 */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label className="mb-1 block text-xs text-gray-500">
                예정 일자 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 w-full appearance-none rounded-md border border-gray-300 px-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                예정 시각
              </label>
              <div className="flex gap-1.5">
                <select
                  value={hour}
                  onChange={(e) => setHour(e.target.value)}
                  className={SELECT_CLASS}
                  aria-label="시"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <select
                  value={minute}
                  onChange={(e) => setMinute(e.target.value)}
                  className={SELECT_CLASS}
                  aria-label="분"
                >
                  {MINUTES.map((mm) => (
                    <option key={mm} value={mm}>
                      {mm}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 상세 */}
          <label className="mb-1 block text-xs text-gray-500">상세 내용</label>
          <textarea
            rows={3}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="상세 내용을 입력해주세요."
            className="mb-3 w-full resize-none rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />

          {/* 캘린더 표시 */}
          <label className="mb-4 flex cursor-pointer select-none items-center gap-2">
            <input
              type="checkbox"
              checked={showOnCalendar}
              onChange={(e) => setShowOnCalendar(e.target.checked)}
              className="h-4 w-4 rounded accent-gray-900"
            />
            <span className="text-sm text-gray-700">캘린더에 표시</span>
          </label>

          {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={create.isPending}
            className="h-12 w-full rounded-xl bg-blue-600 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300"
          >
            {create.isPending ? "생성 중..." : "생성"}
          </button>
        </div>
      </div>
    </div>
  );
}
