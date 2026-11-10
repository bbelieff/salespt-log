"use client";
/**
 * 아직 등록 안 한 새 미팅 카드의 「✕ 삭제」 확인 (2026-11-10 UI 점검).
 * 저장된 카드는 확인을 묻는데 새 카드만 바로 지워져, 적던 업체명·장소·업체정보가 되돌릴 수 없이 사라졌다.
 * 빈 카드는 묻지 않고 바로 지운다(−버튼과 같은 가벼운 동작 유지).
 */
import { useEffect, useRef, useState } from "react";
import MeetingSafetyDialog from "./MeetingSafetyDialog";

export interface DraftLike {
  미팅시간: string;
  업체명: string;
  장소: string;
  예약비고: string;
  업체정보?: object;
}

/** 사람이 적은 내용이 하나라도 있으면 true. */
export function draftHasContent(d: DraftLike): boolean {
  if ([d.미팅시간, d.업체명, d.장소, d.예약비고].some((v) => (v ?? "").trim() !== "")) return true;
  return Object.values(d.업체정보 ?? {}).some((v) => (typeof v === "string" ? v.trim() !== "" : v != null && v !== false));
}

export function useDraftRemoveConfirm() {
  const [name, setName] = useState<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const finish = (ok: boolean) => { resolver.current?.(ok); resolver.current = null; setName(null); };
  useEffect(() => () => { resolver.current?.(false); }, []);
  const request = (draft: DraftLike) => {
    if (!draftHasContent(draft)) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => { resolver.current?.(false); resolver.current = resolve; setName(draft.업체명.trim()); });
  };
  const element = name !== null ? (
    <MeetingSafetyDialog title="적던 미팅 카드를 지울까요?" onClose={() => finish(false)}>
      <p className="mb-4 text-sm text-slate-600">
        {name ? <><b className="text-slate-900">{name}</b> 카드에 </> : "이 카드에 "}적은 내용이 사라지고 미팅예약이 1 줄어요. 되돌릴 수 없어요.
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="min-h-11 rounded-lg border px-4 py-2 text-sm" onClick={() => finish(false)}>돌아가기</button>
        <button type="button" className="min-h-11 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700" onClick={() => finish(true)}>카드 지우기</button>
      </div>
    </MeetingSafetyDialog>
  ) : null;
  return { request, element };
}
