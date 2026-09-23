/**
 * RowCard — 데이터 행 카드 (접힘/펼침).
 * 정본: db-management.html v11 `renderRow` + `makeRowSummary`
 *
 * 접힘: row-num + title + sub + 우측(가격 또는 배지) + ›
 * 펼침: row-num + 채널 badge + × close + RowForm (자동저장) + 삭제
 *
 * Scope B2 autosave: 별도 저장 버튼 없음. 700ms 디바운스는 텍스트/선택 등
 * 비금액·비날짜 필드만, 금액·날짜 그룹이 깨끗하고 포커스도 밖에 있을 때만
 * 동작한다. 금액/날짜(금액 number·날짜 date·비용채널 부가세토글)는 행 전체
 * 블러(포커스가 행 밖으로 나갈 때) 또는 Enter로만 플러시 — 행 내부 필드
 * 이동은 절대 플러시하지 않는다. 유효하지 않으면 전송하지 않고 초안을 유지한다.
 * 단일 비행 + 최신 우선 병합 + 리비전 가드(오래된 응답이 새 변경을 못 지움).
 * 저장은 서버 ACK 이후에만 "저장됨"으로 표시한다.
 */
"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ChannelKey, ChannelMeta } from "../_lib/channels";
import { makeSummary } from "../_lib/row-summary";
import {
  createRevisionGuard,
  dbEditCheck,
  newDraftId,
  payloadSignature,
} from "../_lib/db-autosave";
import { rowFormDirty } from "../_lib/dirty";
import { createSaveCoalescer } from "@/util/save-coalesce";
import RowForm from "./RowForm";
import { useDirtyEntry } from "@/components/DirtyGuard";

interface Props {
  channelKey: ChannelKey;
  channel: ChannelMeta;
  index: number; // 0-based, 화면 표시는 +1
  row: Record<string, unknown>;
  expanded: boolean;
  pending: boolean;
  badgeCls: string; // "badge-purchase" 등
  onExpand: () => void;
  onCollapse: () => void;
  onSave: (data: Record<string, unknown>) => void;
  onDeleteRequest: () => void;
}

type SaveStatus = "idle" | "pending" | "saved" | "error";

const DEBOUNCE_MS = 700;

/**
 * 금액·날짜 그룹 판정 — RowForm 을 건드리지 않고 RowCard 에서만 소유한다.
 * 대상: 날짜(date) + 금액 number(수식 자동값 제외) + 비용채널 부가세토글
 * (부가세 역산의 일부라 금액과 함께 확정돼야 한다). 그 외 텍스트/선택/연락처는
 * 디바운스 대상이다. 주문개수(건/장)는 금액 역산의 입력이므로 금액 그룹이다.
 */
function isMoneyDateField(channel: ChannelMeta, key: string): boolean {
  const field = channel.fields.find((f) => f.key === key);
  if (!field || field.formula) return false;
  if (field.type === "date") return true;
  if (field.type === "number") return true;
  if (field.type === "toggle" && channel.isCost) return true;
  return false;
}

function normCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

/** 기준선 대비 금액·날짜 그룹에 미확정 변경이 있는가(수식 자동값 제외). */
function hasMoneyDateDiff(
  channel: ChannelMeta,
  base: Record<string, unknown> | null,
  payload: Record<string, unknown> | null,
): boolean {
  if (!base || !payload) return false;
  return channel.fields.some(
    (f) =>
      isMoneyDateField(channel, f.key) &&
      normCell(base[f.key]) !== normCell(payload[f.key]),
  );
}

/**
 * 포커스된 DOM 을 필드 키로 되돌린다 — RowForm/MoneyInput 을 수정하지 않는다.
 * 일반 input 은 data-field, MoneyInput(콤마 표시)은 aria-label=필드라벨로 찾고,
 * 그래도 모르면 date 타입만 날짜 그룹으로 취급한다.
 */
function fieldKeyOfElement(channel: ChannelMeta, target: unknown): string | null {
  const el = target as HTMLElement | null;
  if (!el || typeof el.getAttribute !== "function") return null;
  const dataField = el.getAttribute("data-field");
  if (dataField) return dataField;
  const aria = el.getAttribute("aria-label");
  if (aria) {
    const found = channel.fields.find((f) => f.label === aria);
    if (found) return found.key;
  }
  if ((el as HTMLInputElement).type === "date") {
    return channel.fields.find((f) => f.type === "date")?.key ?? "__date__";
  }
  return null;
}

export default function RowCard({
  channelKey,
  channel,
  index,
  row,
  expanded,
  pending,
  badgeCls,
  onExpand,
  onCollapse,
  onSave,
  onDeleteRequest,
}: Props) {
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [invalidHint, setInvalidHint] = useState<string | null>(null);
  const [hasUndo, setHasUndo] = useState(false);
  const [payloadTick, setPayloadTick] = useState(0);
  // 금액·날짜 입력이 현재 포커스를 갖고 있으면 텍스트 디바운스도 묶는다 —
  // 디바운스 발사가 전체 payload 를 보내 미확정 금액을 조기에 유출하는 것을 막는다.
  const [moneyDateFocused, setMoneyDateFocused] = useState(false);
  const [restoreEpoch, setRestoreEpoch] = useState(0);
  const [restoreValues, setRestoreValues] = useState<Record<string, unknown> | null>(null);

  const entryId = useId();
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onCollapseRef = useRef(onCollapse);
  onCollapseRef.current = onCollapse;
  // 編集中 payload / 마지막 ACK 기준선 — 메모리 보관(영속 초안 아님).
  const payloadRef = useRef<Record<string, unknown> | null>(null);
  const committedRef = useRef<Record<string, unknown> | null>(null);
  const prevRef = useRef<Record<string, unknown> | null>(null);
  const dirtyRef = useRef(false);
  const queueRef = useRef<{ trigger: (run: () => Promise<void>) => Promise<void> } | null>(null);
  if (!queueRef.current) queueRef.current = createSaveCoalescer<void>();
  const pendingRef = useRef<{ sig: string; promise: Promise<void> } | null>(null);
  const guardRef = useRef<ReturnType<typeof createRevisionGuard> | null>(null);
  if (!guardRef.current) guardRef.current = createRevisionGuard();
  const draftIdRef = useRef<string | null>(null);
  if (!draftIdRef.current) draftIdRef.current = newDraftId();

  const markDirty = (d: boolean) => {
    dirtyRef.current = d;
    setDirty(d);
  };

  const safeError = (e: unknown): string => {
    const m = e instanceof Error ? e.message : "";
    return m && !/HTTP \d+/.test(m) ? m : "저장에 실패했어요. 잠시 후 다시 시도해 주세요.";
  };

  /**
   * 최신 payload 1건을 저장한다. clean 이면 요청 0건.
   * invalid/실패 시 reject → DirtyGuard 이탈 모달이 머무른다.
   * 채널·행·payload 는 큐 생성 시점에 동결된다.
   */
  const flush = useCallback((): Promise<void> => {
    const payload = payloadRef.current;
    const committed = committedRef.current;
    if (!payload || !committed) return Promise.resolve();
    if (!rowFormDirty(channel.fields, committed, payload)) {
      markDirty(false);
      setInvalidHint(null);
      return Promise.resolve();
    }
    const check = dbEditCheck(channelKey, payload, committed);
    if (check.status === "invalid") {
      const reason = check.reasons[0] ?? "입력을 확인해 주세요.";
      setInvalidHint(reason);
      return Promise.reject(new Error(reason));
    }
    const frozen = { ...payload };
    const sig = payloadSignature(frozen);
    // 동일 바이트가 이미 진행 중이면 같은 promise 에 합류(블러·디바운스 레이스 1회).
    if (pendingRef.current?.sig === sig) return pendingRef.current.promise;
    const queue = queueRef.current!;
    const guard = guardRef.current!;
    const seq = guard.begin();
    setSaveStatus("pending");
    setSaveError("");
    const promise = queue
      .trigger(() => Promise.resolve(onSaveRef.current(frozen)))
      .then(() => {
        if (!guard.isCurrent(seq)) return; // 더 새 저장이 있음 — 상태는 그쪽이 소유
        prevRef.current = committed;
        committedRef.current = frozen;
        setHasUndo(true);
        const latest = payloadRef.current;
        markDirty(latest ? rowFormDirty(channel.fields, frozen, latest) : false);
        setInvalidHint(null);
        setSaveStatus("saved");
      })
      .catch((e) => {
        if (!guard.isCurrent(seq)) throw e;
        setSaveStatus("error");
        setSaveError(safeError(e));
        throw e;
      });
    pendingRef.current = { sig, promise };
    const clearPending = () => {
      if (pendingRef.current?.promise === promise) pendingRef.current = null;
    };
    promise.then(clearPending, clearPending);
    return promise;
  }, [channel, channelKey]);

  /** 이탈 가드 저장 — 대기 중인 최신 쓰기까지 모두 settled 후에도 dirty 면 실패로 보고한다. */
  const saveAndSettle = useCallback(async () => {
    await flush();
    await queueRef.current!.trigger(() => Promise.resolve());
    if (dirtyRef.current) throw new Error("저장되지 않은 변경이 있어요.");
  }, [flush]);

  const discardEdits = useCallback(() => {
    const committed = committedRef.current;
    if (committed) {
      setRestoreValues({ ...committed });
      setRestoreEpoch((e) => e + 1);
    }
    markDirty(false);
    setInvalidHint(null);
    setSaveStatus("idle");
    setSaveError("");
  }, []);

  useDirtyEntry(
    entryId,
    dirty,
    saveAndSettle,
    discardEdits,
    `${channel.name} ${index + 1}행`,
  );

  const handlePayload = (p: Record<string, unknown>) => {
    payloadRef.current = p;
    if (!committedRef.current) {
      // 첫 payload = 기준선(하이드레이션·refetch 로 요청 만들지 않음).
      committedRef.current = { ...p };
      return;
    }
    const d = rowFormDirty(channel.fields, committedRef.current, p);
    markDirty(d);
    if (d) {
      const check = dbEditCheck(channelKey, p, committedRef.current);
      setInvalidHint(check.status === "invalid" ? (check.reasons[0] ?? null) : null);
      setSaveStatus((s) => (s === "saved" ? "idle" : s));
      setPayloadTick((t) => t + 1);
    } else {
      setInvalidHint(null);
    }
  };

  // 텍스트 등 비금액·비날짜 디바운스 — 금액·날짜 미확정 변경이 있거나
  // 금액·날짜 입력에 포커스가 있으면 타이머 없이 힌트만 유지(전송 0).
  // 금액·날짜는 행 전체 블러/Enter 로만 확정된다. invalid 도 전송 0.
  useEffect(() => {
    if (payloadTick === 0 || !dirtyRef.current) return;
    if (moneyDateFocused) return;
    const payload = payloadRef.current;
    const committed = committedRef.current;
    if (!payload) return;
    if (hasMoneyDateDiff(channel, committed, payload)) return;
    if (dbEditCheck(channelKey, payload, committed).status === "invalid") return;
    const t = setTimeout(() => {
      void flush().catch(() => {});
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [payloadTick, channelKey, channel, moneyDateFocused, flush]);

  // 접힘 시 dirty 해제 — RowForm 은 펼침에서만 렌더돼 언마운트로는 dirty 해제를
  // 못 낸다. 저장·무시·× 후에도 dirty 가 true 로 얼어붙어 다음 이동마다 유령
  // 이탈 가드가 재발한다(2026-07-20 유실 사고의 증상 ②).
  useEffect(() => {
    if (!expanded) {
      markDirty(false);
      setSaveStatus("idle");
      setSaveError("");
      setInvalidHint(null);
    }
  }, [expanded]);

  const displayNum = String(index + 1).padStart(2, "0");

  if (!expanded) {
    const s = makeSummary(channelKey, row);
    const rightCls = channel.isCost ? "text-red-600" : "text-gray-900";
    return (
      <div
        className="row-card flex cursor-pointer items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-3 transition-all hover:border-slate-300"
        onClick={onExpand}
      >
        <span className="row-num shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold tracking-wider text-slate-600 num-mono">
          {displayNum}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-gray-900">
            {s.title}
          </div>
          <div className="mt-0.5 line-clamp-2 break-keep text-xs text-gray-500">{s.sub}</div>
        </div>
        {s.right && (
          <div
            className={`shrink-0 num-mono text-sm font-bold ${rightCls}`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {s.right}
          </div>
        )}
        {s.rightBadge && (
          <span className={`badge ${badgeCls} shrink-0`}>{s.rightBadge}</span>
        )}
        <span className="shrink-0 text-lg leading-none text-gray-300">›</span>
      </div>
    );
  }

  const undo = () => {
    const prev = prevRef.current;
    if (!prev) return;
    const frozen = { ...prev };
    const guard = guardRef.current!;
    const seq = guard.begin();
    setSaveStatus("pending");
    setSaveError("");
    void queueRef
      .current!.trigger(() => Promise.resolve(onSaveRef.current(frozen)))
      .then(() => {
        if (!guard.isCurrent(seq)) return;
        committedRef.current = frozen;
        prevRef.current = null;
        setHasUndo(false);
        setRestoreValues(frozen);
        setRestoreEpoch((e) => e + 1);
        markDirty(false);
        setInvalidHint(null);
        setSaveStatus("saved");
      })
      .catch((e) => {
        if (!guard.isCurrent(seq)) return;
        setSaveStatus("error");
        setSaveError(safeError(e));
      });
  };

  const retry = () => {
    void flush().catch(() => {});
  };

  // × = 편집 완료. 대기 쓰기를 먼저 플러시하고 clean 일 때만 접는다.
  // invalid/실패면 부모 가드(등록 dirty → 이탈 모달)로 이어진다.
  const finishEditing = () => {
    void flush()
      .then(() => onCollapseRef.current())
      .catch(() => onCollapseRef.current());
  };

  // 펼침
  return (
    <div
      className="row-card expanded rounded-xl border border-blue-300 bg-white p-3 shadow-md"
      onFocus={(e) => {
        // 금액·날짜 입력에 들어오면 텍스트 디바운스를 묶는다(조기 유출 방지).
        const key = fieldKeyOfElement(channel, e.target);
        if (key) setMoneyDateFocused(isMoneyDateField(channel, key));
      }}
      onBlur={(e) => {
        // 행 내부 포커스 이동 추적 — 금액·날짜 안에 머물면 디바운스 유지 차단.
        const next = e.relatedTarget as Node | null;
        if (e.currentTarget.contains(next)) {
          const key = fieldKeyOfElement(channel, next);
          if (key) setMoneyDateFocused(isMoneyDateField(channel, key));
          return;
        }
        // 행 전체 블러(필드 간 이동이 아닌, 행 밖으로 나갈 때) → 즉시 저장 시도.
        setMoneyDateFocused(false);
        void flush().catch(() => {});
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement)?.tagName === "INPUT") {
          e.preventDefault();
          void flush().catch(() => {});
        }
      }}
    >
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold tracking-wider text-slate-600 num-mono">
            {displayNum}
          </span>
          <span className={`badge ${badgeCls}`}>{channel.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDeleteRequest}
            disabled={pending}
            aria-label={`${channel.name} ${displayNum}행 삭제`}
            className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
          >
            삭제
          </button>
          <button
            type="button"
            onClick={finishEditing}
            aria-label="접기"
            className="h-8 w-8 text-xl leading-none text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        </div>
      </div>

      {/* 저장 상태 — 제목줄 바로 아래 작은 한 줄(추가 카드 없음). */}
      <p aria-live="polite" className="mb-2 min-h-4 text-xs">
        {saveStatus === "pending" && <span className="text-slate-500">저장 중…</span>}
        {saveStatus === "saved" && (
          <span className="text-slate-400">
            저장됨
            {hasUndo && (
              <button type="button" onClick={undo} className="ml-1 font-semibold text-blue-600 hover:underline">
                되돌리기
              </button>
            )}
          </span>
        )}
        {saveStatus === "error" && (
          <span className="font-semibold text-red-600">
            {saveError}{" "}
            <button type="button" onClick={retry} className="font-bold text-red-700 hover:underline">
              다시 시도
            </button>
          </span>
        )}
        {saveStatus !== "error" && saveStatus !== "pending" && invalidHint && (
          <span className="font-medium text-amber-700">{invalidHint}</span>
        )}
      </p>

      {/* 현수막 게시로그(AF:AI) 폐기 — 게시=생산은 컨택 게시 스테퍼가 소유(ADR-0025). */}
      {/* initial=서버 정본 + restoreEpoch 리마운트(되돌리기/버리기 전용). 편집 중 draft 는
          RowForm 내부에 유지되고 refetch 로 row 가 바뀌어도 덮지 않는다. */}
      <RowForm
        key={restoreEpoch}
        channel={channel}
        initial={restoreValues ?? row}
        onChange={handlePayload}
      />
    </div>
  );
}
