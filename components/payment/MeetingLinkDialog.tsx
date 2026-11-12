/**
 * MeetingLinkDialog — 「영업기록 없이 추가」 업체를 영업기록 미팅에 연결하기 전 비교·선택 팝업(2026-09-29).
 *
 * 계약일은 미팅 날짜로 바뀐다(앱의 계약일 규칙 — 안내만). 업체명·수임비·업체정보가 양쪽에서 다르면
 * **최근에 저장된 쪽**을 기본으로 고르고 칸마다 바꿀 수 있다(belie). 빈 칸은 서로 채운다.
 * 일정·계약에서 열 때는 [따로 등록](=새 계약 행)도 고를 수 있다 — onSkip.
 *
 * 2026-11-12 AppDialog 로 통일(결정 4 2차).
 * - 실무/수납 진입(onSkip 없음): Esc·「취소」 = 아무것도 저장하지 않고 닫기.
 * - 일정·계약 진입(onSkip 있음): 「따로 등록」·「연결하기」 둘 중 하나를 꼭 고른다 — Esc·바깥 누르기로 안 닫힌다.
 *   이 창이 뜰 때는 미팅이 이미 「계약」으로 저장된 뒤라, 둘 다 안 하고 닫으면 그 계약이 장부(계약수납)에
 *   한 줄도 없어 매출이 빠진다(use-manual-link-prompt·contract-fanout). 그래서 「그냥 닫기」를 두지 않는다.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import AppDialog, { AppDialogClose } from "@/components/ui/AppDialog";
import { companyInfoFieldList } from "@/components/company-info-defs";
import { formatWon } from "@/lib/format/money";
import { findConflicts, mergeRecords, newerSide, type MergeSide } from "@/util/record-merge";
import { fetchMeetingLinkPreview, useLinkMeeting, type MeetingLinkPreview } from "@/query/contract-link-hooks";

interface Props {
  row: number;
  meetingId: string;
  onClose: () => void;
  onLinked: (failures: string[]) => void;
  /** 있으면 [따로 등록] 버튼 — 연결하지 않고 새 계약으로(일정·계약 진입). */
  onSkip?: () => void;
}

const fmtDay = (iso: string) => (iso ? iso.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1.$2.$3") : "—");
const fmtStamp = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }) : "");

function Choice({ name, side, value, pick, recent, onPick }: {
  name: string; side: MergeSide; value: string; pick: MergeSide; recent: boolean; onPick: (s: MergeSide) => void;
}) {
  return (
    <label className={`flex min-w-0 flex-1 cursor-pointer items-start gap-1.5 rounded-lg border px-2 py-1.5 text-xs ${pick === side ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <input type="radio" name={name} checked={pick === side} onChange={() => onPick(side)} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block font-semibold text-slate-500">{side === "contract" ? "실무/수납" : "영업기록"}{recent && <span className="ml-1 rounded bg-amber-100 px-1 text-amber-700">최근</span>}</span>
        <span className="block break-words text-slate-900">{value || "(비어 있음)"}</span>
      </span>
    </label>
  );
}

export default function MeetingLinkDialog({ row, meetingId, onClose, onLinked, onSkip }: Props) {
  const [preview, setPreview] = useState<MeetingLinkPreview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [picks, setPicks] = useState<Record<string, MergeSide>>({});
  const link = useLinkMeeting();

  useEffect(() => {
    let alive = true;
    fetchMeetingLinkPreview(row, meetingId).then(
      (p) => alive && setPreview(p),
      (e: Error) => alive && setLoadError(e.message),
    );
    return () => { alive = false; };
  }, [row, meetingId]);

  const view = useMemo(() => {
    if (!preview) return null;
    const { contract: c, meeting: m, updatedAt: u } = preview;
    const rowSide = newerSide(u.contract, u.meeting);
    const infoSide = newerSide(u.contractInfo ?? u.contract, u.meeting);
    const cInfo = (c.업체정보 ?? {}) as Record<string, unknown>;
    const mInfo = (m.업체정보 ?? {}) as Record<string, unknown>;
    const labels = new Map(companyInfoFieldList(Number(m.미팅날짜.slice(0, 4)) || new Date().getFullYear()));
    const conflicts = findConflicts(cInfo, mInfo, infoSide).filter((f) => labels.has(f.key as never));
    return { c, m, u, rowSide, infoSide, cInfo, mInfo, labels, conflicts };
  }, [preview]);

  const pickOf = (key: string, fallback: MergeSide) => picks[key] ?? fallback;
  const setPick = (key: string) => (side: MergeSide) => setPicks((p) => ({ ...p, [key]: side }));

  const submit = async () => {
    if (!view) return;
    const { c, m, rowSide, infoSide, cInfo, mInfo, conflicts } = view;
    const infoPicks: Record<string, MergeSide> = {};
    for (const f of conflicts) infoPicks[f.key] = pickOf(`info:${f.key}`, infoSide);
    const res = await link.mutateAsync({
      row,
      meetingId,
      업체명: pickOf("업체명", rowSide) === "meeting" ? m.업체명 : c.업체명,
      수임비: pickOf("수임비", rowSide) === "meeting" ? m.수임비 : c.수임비,
      업체정보: mergeRecords(cInfo, mInfo, infoSide, infoPicks),
    });
    onLinked(res.failures);
  };

  return (
    // onSkip 이 있으면(일정·계약) 닫기 요청을 받지 않는다 — 위 머리말의 이유.
    <AppDialog title="영업기록과 연결" size="lg" onClose={onSkip ? () => {} : onClose} className="rounded-2xl bg-white p-4 shadow-2xl">
        <h2 className="text-base font-bold text-slate-900">영업기록과 연결</h2>
        {!view && !loadError && <p className="mt-3 text-sm text-slate-500">비교할 내용을 불러오는 중…</p>}
        {loadError && <p className="mt-3 text-sm text-red-600">{loadError}</p>}
        {view && (
          <div className="mt-3 space-y-3 text-sm">
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              계약일이 미팅 날짜로 바뀌어요: <b>{fmtDay(view.c.계약일)}</b> → <b>{fmtDay(view.m.미팅날짜)}</b>.
              할일·History·업체정보도 함께 옮겨요. 다른 값은 <b>최근에 저장된 쪽</b>을 먼저 골라 두었어요.
            </p>
            {view.c.업체명.trim() !== view.m.업체명.trim() && (
              <fieldset>
                <legend className="mb-1 text-xs font-bold text-slate-700">업체명</legend>
                <div className="flex gap-2">
                  {(["contract", "meeting"] as const).map((s) => (
                    <Choice key={s} name="link-name" side={s} value={s === "contract" ? view.c.업체명 : view.m.업체명}
                      pick={pickOf("업체명", view.rowSide)} recent={s === view.rowSide} onPick={setPick("업체명")} />
                  ))}
                </div>
              </fieldset>
            )}
            {view.c.수임비 !== view.m.수임비 && (
              <fieldset>
                <legend className="mb-1 text-xs font-bold text-slate-700">수임비</legend>
                <div className="flex gap-2">
                  {(["contract", "meeting"] as const).map((s) => (
                    <Choice key={s} name="link-fee" side={s} value={`${formatWon(s === "contract" ? view.c.수임비 : view.m.수임비)}`}
                      pick={pickOf("수임비", view.rowSide)} recent={s === view.rowSide} onPick={setPick("수임비")} />
                  ))}
                </div>
              </fieldset>
            )}
            {view.conflicts.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-xs font-bold text-slate-700">
                  업체정보가 다른 칸 {view.conflicts.length}개
                  {(view.u.contractInfo || view.u.meeting) && (
                    <span className="ml-1 font-normal text-slate-400">
                      (마지막 저장 실무/수납 {fmtStamp(view.u.contractInfo ?? view.u.contract) || "?"} · 영업기록 {fmtStamp(view.u.meeting) || "?"})
                    </span>
                  )}
                </legend>
                {view.conflicts.map((f) => (
                  <div key={f.key}>
                    <p className="mb-1 text-xs text-slate-500">{view.labels.get(f.key as never) ?? f.key}</p>
                    <div className="flex gap-2">
                      {(["contract", "meeting"] as const).map((s) => (
                        <Choice key={s} name={`link-info-${f.key}`} side={s} value={s === "contract" ? f.contract : f.meeting}
                          pick={pickOf(`info:${f.key}`, view.infoSide)} recent={s === view.infoSide} onPick={setPick(`info:${f.key}`)} />
                      ))}
                    </div>
                  </div>
                ))}
              </fieldset>
            )}
            {view.c.업체명.trim() === view.m.업체명.trim() && view.c.수임비 === view.m.수임비 && view.conflicts.length === 0 && (
              <p className="text-xs text-slate-500">서로 다른 값이 없어요. 빈 칸은 양쪽에서 채워 넣어요.</p>
            )}
            {link.error && <p className="text-xs text-red-600">{(link.error as Error).message}</p>}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          {onSkip ? (
            <button type="button" onClick={onSkip} disabled={link.isPending} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">따로 등록</button>
          ) : (
            <AppDialogClose disabled={link.isPending} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">취소</AppDialogClose>
          )}
          <button type="button" onClick={() => void submit()} disabled={!view || link.isPending}
            className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {link.isPending ? "연결하는 중…" : "연결하기"}
          </button>
        </div>
    </AppDialog>
  );
}
