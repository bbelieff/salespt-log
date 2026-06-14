/**
 * ArenaCohortBoard — admin 아레나 관리(`/admin/arena`) 시즌 컨테이너 + 기수 박스 DnD.
 *
 * 시즌(A{n})별로 묶고, 그 안의 기수 박스(A{n}-1~6)를 드래그앤드롭으로 재정렬.
 * 순서 저장은 하지 않음(사용자 요구 "정렬 기능만") — SortableList 내부 order state 로
 * 화면 정렬만 유지(새로고침 시 시즌·기수 asc 기본 정렬로 복귀). (arena-admin-dnd §P6)
 *
 * 멤버 행은 기존 /admin/arena 패턴(이름 + 이메일 + 이월 버튼 + 회장 토글) 유지.
 */
"use client";

import SortableList, { type DragHandle } from "./SortableList";
import ArenaCaptainToggle from "./ArenaCaptainToggle";
import ArenaCarryoverButton from "./ArenaCarryoverButton";

export interface ArenaMember {
  email: string;
  name: string;
  nameLabel: string;
  captainOf: string;
}
export interface ArenaCohortGroup {
  /** 정규화 cohort 키 (예 "A1-1"). */
  key: string;
  /** 표시 라벨 (예 "A1-1기"). */
  label: string;
  members: ArenaMember[];
}
export interface ArenaSeason {
  /** 시즌 키 (예 "A1"). */
  season: string;
  cohorts: ArenaCohortGroup[];
}

function CohortBox({
  group,
  drag,
}: {
  group: ArenaCohortGroup;
  drag: DragHandle | null;
}) {
  const captainCount = group.members.filter(
    (m) => m.captainOf.trim() !== "",
  ).length;
  return (
    <section
      ref={drag?.ref}
      style={drag?.style}
      {...(drag?.attributes ?? {})}
      className={`overflow-hidden rounded-xl border border-gray-200 bg-white ${
        drag?.isDragging ? "opacity-50 ring-2 ring-purple-300" : ""
      }`}
    >
      <div className="flex items-center justify-between bg-gray-50 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {drag && (
            <button
              type="button"
              aria-label="기수 박스 순서 변경"
              title="드래그하여 순서 변경"
              {...drag.listeners}
              style={{ touchAction: "none" }}
              className="inline-flex w-6 shrink-0 cursor-grab select-none items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing"
            >
              <span className="text-base leading-none">⋮⋮</span>
            </button>
          )}
          <h2 className="truncate text-sm font-bold text-gray-800">
            {group.label}
          </h2>
        </div>
        <span className="shrink-0 text-[11px] text-gray-500">
          {group.members.length}명 · 회장 {captainCount}
        </span>
      </div>
      <ul className="divide-y divide-gray-50">
        {group.members.map((m, i) => (
          <li
            key={`${m.email || m.name}-${i}`}
            className="flex items-center justify-between gap-2 px-4 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900">
                {m.nameLabel || m.name}
              </div>
              <div className="flex items-center gap-2 truncate text-[11px] text-gray-400">
                <span className="truncate">{m.email || "(미클레임)"}</span>
                <ArenaCarryoverButton email={m.email} />
              </div>
            </div>
            <ArenaCaptainToggle
              email={m.email}
              cohort={group.key}
              initialOn={m.captainOf.trim() !== ""}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ArenaCohortBoard({
  seasons,
}: {
  seasons: ArenaSeason[];
}) {
  return (
    <div className="space-y-6">
      {seasons.map((s) => (
        <div
          key={s.season}
          className="rounded-2xl border-2 border-purple-200 bg-purple-50 p-3"
        >
          <div className="mb-2 px-1 text-sm font-black text-purple-800">
            {s.season} 시즌
          </div>
          <div className="space-y-3">
            <SortableList
              items={s.cohorts}
              getId={(c) => c.key}
              // 저장 없음 — 내부 order state 로 화면 정렬만(P6 "정렬 기능만").
              onReorder={() => {}}
              renderItem={(c, drag) => <CohortBox group={c} drag={drag} />}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
