/**
 * TodoSection — 진행 슬롯 내 ToDo 목록 + 추가 버튼 (Scope 2).
 * (계약 × 기관) 단위. institutionRef = 슬롯 진행기관 (비어있으면 추가 비활성).
 * 시각 정본: docs/design/prototypes/practice-payment-mockup.html
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { Todo, TodoType } from "@/types";
import {
  newTodoOperationId,
  useCreateTodo,
  usePatchTodo,
  useRemoveTodo,
} from "@/query/todos-hooks";
import { useFocusScroll } from "@/lib/hooks/useFocusScroll";
import TodoFormModal from "./TodoFormModal";

const TYPE_BADGE: Record<TodoType, string> = {
  미팅: "bg-blue-100 text-blue-700",
  전화: "bg-green-100 text-green-700",
  메시지: "bg-violet-100 text-violet-700",
  기타: "bg-gray-100 text-gray-600",
  일반: "bg-teal-100 text-teal-700", // 일반이벤트 (비집계, tokens 일반이벤트 teal)
};

function fmtWhen(예정일자: string, 예정시각: string): string {
  const m = 예정일자.match(/^\d{4}-(\d{2})-(\d{2})$/);
  const d = m ? `${parseInt(m[1]!, 10)}/${parseInt(m[2]!, 10)}` : 예정일자;
  return 예정시각 ? `${d} ${예정시각}` : d;
}

interface Props {
  contractRef: string;
  /** 저장본 진행기관 — ToDo 키. 비어있으면 추가 비활성. */
  institutionRef: string;
  /** draft(편집 중) 진행기관 — 입력했지만 미저장인 경우 자동 저장 트리거용. */
  draftInstitution?: string;
  companyName: string;
  todos: Todo[];
  /** 캘린더 포커스 ToDo id — 해당 카드 스크롤+하이라이트(3s). */
  focusId?: string | null;
  /** [4] 미저장 진행기관으로 추가 시 슬롯(계약)을 먼저 저장. */
  onEnsureSaved?: () => void;
}

export default function TodoSection({
  contractRef,
  institutionRef,
  draftInstitution,
  companyName,
  todos,
  focusId,
  onEnsureSaved,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const patch = usePatchTodo();
  const remove = useRemoveTodo();
  const create = useCreateTodo();
  // 제목만 빠른 추가 — Enter 즉시 생성, 별도 저장 단계 없음. 날짜=오늘,
  // 달력 미표시(외부 캘린더 발행은 상세 추가에서 의도적으로).
  const [quick, setQuick] = useState("");
  const [quickError, setQuickError] = useState<string | null>(null);
  // 실패한 전송 의도의 멱등 키 보관 — 전체 페이로드 서명별로 유지한다.
  // A 실패 → B 전송 → 다시 A 재시도가 최초 A 키를 재사용해 서버가 원본 1행으로
  // 수렴시킨다. 제목 변경만으로 회전시키지 않으며, 성공 확인·레코드 전환 시에만
  // 제거한다. 성공 뒤 같은 제목의 정당한 중복은 서명이 지워져 새 키로 별개 생성된다.
  const quickFailOps = useRef(new Map<string, string>());
  // 같은 서명의 중복 Enter/blur 를 before-ACK 에 1회로 합치는 in-flight 집합.
  const inFlightQuick = useRef(new Set<string>());
  // 사용자 편집 revision — submit 시점에 캡처해 stale ACK/에러가 새 입력을
  // 지우거나 덮지 않게 한다(입력은 저장 중에도 활성이라 C3 무조건 클리어가 B를 지웠다).
  const quickRev = useRef(0);
  const scopeKey = `${contractRef}|${institutionRef}|${draftInstitution ?? ""}`;
  const scopeKeyRef = useRef(scopeKey);
  useEffect(() => {
    scopeKeyRef.current = scopeKey;
  }, [scopeKey]);
  useEffect(() => {
    quickFailOps.current.clear();
    inFlightQuick.current.clear();
  }, [scopeKey]);
  const todayISO = new Date().toISOString().slice(0, 10);
  const quickBusy = create.isPending;
  // 빠른 추가는 저장된 진행기관 키로만 (미저장 draft 키는 상세 추가 경로가 저장 후 생성).
  // institutionRef prop 직접 참조 — 아래 savedReady 선언보다 먼저 평가되므로.
  const quickReady = institutionRef.trim() !== "";
  // [4] 4-A 계산을 submitQuick 보다 먼저 둔다(클로저 TDZ 회피 + 스코프 캡처 명확화).
  const savedReadyEarly = institutionRef.trim() !== "";
  const draftInstEarly = (draftInstitution ?? "").trim();
  const effectiveInstitutionEarly = savedReadyEarly
    ? institutionRef.trim()
    : draftInstEarly;
  const handleQuickChange = (v: string) => {
    quickRev.current += 1;
    setQuick(v);
  };
  const submitQuick = () => {
    const title = quick.trim();
    if (!title || !quickReady) return;
    // NOTE: 제목·날짜 일치 조회로 중복 생성을 막지 않는다 — 같은 할 일을
    // 두 번 적는 정상 중복을 억제해 버린다. 멱등은 서버 operationId 가 담당.
    // 409(TodoOperationConflict) 포함 모든 실패는 초안을 유지한다 — 입력이
    // 지워지면 재시도 키가 끊기고 사용자는 내용을 다시 적어야 한다.
    const base = {
      contractRef,
      institutionRef: effectiveInstitutionEarly,
      업체명: companyName,
      type: "기타" as const,
      제목: title,
      예정일자: todayISO,
      예정시각: "",
      장소: "",
      상세: "",
      showOnCalendar: false,
    };
    const sig = JSON.stringify([
      base.contractRef,
      base.institutionRef,
      base.업체명,
      base.type,
      base.제목,
      base.예정일자,
      base.예정시각,
      base.장소,
      base.상세,
      base.showOnCalendar,
    ]);
    // before-ACK 같은 동작 join/suppress — 같은 서명이 이미 날아갔으면 중복 전송하지 않는다.
    if (inFlightQuick.current.has(sig)) return;
    let op = quickFailOps.current.get(sig);
    if (!op) {
      op = newTodoOperationId();
      quickFailOps.current.set(sig, op);
    }
    const opForCall = op;
    const capturedRev = quickRev.current;
    const capturedScope = scopeKey;
    const capturedSig = sig;
    inFlightQuick.current.add(capturedSig);
    setQuickError(null);
    create.mutate(
      { ...base, operationId: opForCall },
      {
        onSuccess: () => {
          inFlightQuick.current.delete(capturedSig);
          // 확인된 성공에서만 서명 제거 — 이후 같은 제목은 새 키로 별개 생성된다.
          // stale ACK 라도 키 정리는 수행한다(서버 커밋 사실은 유효).
          quickFailOps.current.delete(capturedSig);
          // 오래된 ACK 가 새 입력·전환된 계약을 지우면 안 된다.
          if (quickRev.current !== capturedRev) return;
          if (scopeKeyRef.current !== capturedScope) return;
          setQuick("");
          setQuickError(null);
        },
        onError: (e) => {
          inFlightQuick.current.delete(capturedSig);
          // 오래된 에러가 새 입력·전환된 계약에 라벨을 붙이면 안 된다.
          if (quickRev.current !== capturedRev) return;
          if (scopeKeyRef.current !== capturedScope) return;
          setQuickError(e instanceof Error ? e.message : "추가하지 못했어요");
        },
      },
    );
  };
  const onQuickGroupBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // 그룹 내 이동(입력↔버튼)은 저장하지 않는다 — 바깥으로 나갈 때만 1회 제출.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    submitQuick();
  };

  // 캘린더 포커스 — 매칭 ToDo 카드 스크롤 + 3초 하이라이트 링.
  const focusActive = !!focusId && todos.some((t) => t.id === focusId);
  const { ref: focusedRef, ring } = useFocusScroll<HTMLDivElement>(focusActive);
  // 완료 토글 낙관적 UI (2026-06 PostHog 분노클릭): checked 가 서버값에 묶여 시트 write
  // 완료 전까지 반응이 없던 lag 제거. id→희망값 override, onSettled 시 해제.
  const [optimisticDone, setOptimisticDone] = useState<Record<string, boolean>>({});
  const toggleDone = (id: string, next: boolean) => {
    setOptimisticDone((m) => ({ ...m, [id]: next }));
    patch.mutate(
      { contractRef, id, partial: { 완료여부: next } },
      {
        onSettled: () =>
          setOptimisticDone((m) => {
            const c = { ...m };
            delete c[id];
            return c;
          }),
      },
    );
  };
  // [4] 4-A: 저장본이 있으면 그 값, 없으면 입력 중(draft) 진행기관으로 추가 허용.
  // 미저장이면 추가 클릭 시 onEnsureSaved 로 슬롯을 먼저 저장 → 키 일치 유지.
  // 위 Early 계산과 동일(단일 원천) — submitQuick sig 와 모달 target 일치 보장.
  const savedReady = savedReadyEarly;
  const draftInst = draftInstEarly;
  const effectiveInstitution = effectiveInstitutionEarly;
  const canAdd = effectiveInstitution !== "";
  const needsSave = !savedReady && draftInst !== "";
  const addLabel = canAdd ? "ToDo 추가" : "진행기관 입력 후 추가";

  const handleAdd = () => {
    if (!canAdd) return;
    if (needsSave) onEnsureSaved?.(); // 미저장 진행기관 → 자동 저장 후 모달.
    setShowModal(true);
  };

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">ToDo</span>
        <span className="text-[10px] text-gray-400">이 기관 할 일</span>
      </div>

      {todos.length > 0 && (
        <div className="space-y-1.5">
          {todos.map((t) => (
            <div
              key={t.id}
              ref={t.id === focusId ? focusedRef : undefined}
              className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 scroll-mt-28 ${
                ring && t.id === focusId
                  ? "animate-pulse ring-2 ring-inset ring-blue-400"
                  : ""
              }`}
            >
              <label className="-m-1 flex shrink-0 cursor-pointer items-center p-1">
                <input
                  type="checkbox"
                  checked={optimisticDone[t.id] ?? t.완료여부}
                  onChange={(e) => toggleDone(t.id, e.target.checked)}
                  className="h-4 w-4 rounded accent-gray-700"
                  aria-label="완료 토글"
                />
              </label>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${TYPE_BADGE[t.type]}`}
              >
                {t.type}
              </span>
              <span
                className={`flex-1 truncate text-xs ${
                  t.완료여부 ? "text-gray-400 line-through" : "text-gray-800"
                }`}
              >
                {t.제목}
              </span>
              <span className="shrink-0 text-[11px] text-gray-400">
                {fmtWhen(t.예정일자, t.예정시각)}
              </span>
              <button
                type="button"
                onClick={() => remove.mutate({ contractRef, id: t.id })}
                className="shrink-0 text-xs text-gray-300 hover:text-red-500"
                aria-label="ToDo 삭제"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-1.5 flex gap-1.5" onBlur={onQuickGroupBlur}>
        <input
          type="text"
          value={quick}
          onChange={(e) => handleQuickChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitQuick();
          }}
          placeholder={quickReady ? "빠른 추가 — 제목만 입력 후 Enter" : "진행기관 저장 후 빠른 추가 가능"}
          aria-label="할 일 빠르게 추가"
          // 저장 중에도 입력 가능해야 한다 — 매 키 입력 후 비활성화는
          // 연속 타이핑·포커스를 깨뜨린다(상위 리뷰 CRITICAL A). 같은 초안
          // 중복 Enter 는 서버 operationId 가 1행으로 수렴시킨다.
          disabled={!quickReady}
          className="h-9 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-800 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none disabled:bg-gray-100"
        />
        <button
          type="button"
          onClick={submitQuick}
          disabled={!quick.trim() || !quickReady}
          aria-label="할 일 추가"
          className="h-9 shrink-0 rounded-md bg-gray-900 px-2.5 text-sm font-bold leading-none text-white transition-colors hover:bg-black disabled:opacity-40"
        >
          {quickBusy ? "…" : "+"}
        </button>
      </div>
      {quickError && (
        <p className="mt-1 text-[11px] font-medium text-red-600" aria-live="polite">
          {quickError} — 입력은 유지됩니다. Enter로 다시 시도해주세요.
        </p>
      )}

      <button
        type="button"
        disabled={!canAdd}
        onClick={handleAdd}
        className="mt-1.5 flex min-h-[36px] w-full items-center justify-center gap-1 rounded-lg border-[1.5px] border-dashed border-slate-300 bg-transparent text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
      >
        <span className="text-sm leading-none">+</span>
        <span>{addLabel} (상세)</span>
      </button>

      {showModal && (
        <TodoFormModal
          contractRef={contractRef}
          institutionRef={effectiveInstitution}
          companyName={companyName}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
