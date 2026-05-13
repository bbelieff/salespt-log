/**
 * SortableTraineeBox — 박스(같은 cohort+team) 내 TraineeCard 들을 dnd-kit 로 묶음.
 *
 * PR C-1 (2026-05-13).
 *
 * 동작:
 *   - DndContext + SortableContext (verticalListSortingStrategy).
 *   - useSortable 로 각 카드에 listeners/transform 부여 → TraineeCard 좌측 핸들로 격리.
 *   - onDragEnd 시 local state 즉시 갱신 (optimistic) + onReorder(emails) 호출.
 *   - members prop 갱신 시(router.refresh) useEffect 가 local state 재초기화.
 *
 * Sensors:
 *   - PointerSensor: distance 5px 활성 → 클릭 vs 드래그 구분.
 *   - TouchSensor: 200ms long-press → 모바일 스크롤 보호.
 *   - KeyboardSensor: 접근성 (Tab → Space → 화살표).
 *
 * onReorder 미제공 (viewOnly / archived) → plain TraineeCard 렌더링 (dnd 비활성).
 */
"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TraineeCard from "./TraineeCard";
import type { Trainee } from "./AdminUserPickerTypes";

interface BoxCommonProps {
  archived: boolean;
  viewOnly: boolean;
  busy: string | null;
  nameByEmail: Map<string, string>;
  linkedBySheet?: Map<string, string[]>;
  onPick: (email: string) => void;
  onReserve: (email: string) => void;
  onSetTeam: (email: string, team: string) => void;
}

export default function SortableTraineeBox({
  members,
  onReorder,
  ...rest
}: BoxCommonProps & {
  members: Trainee[];
  /** 드래그 종료 시 새 순서의 email 배열 — 미제공이면 dnd 비활성. */
  onReorder?: (emails: string[]) => void | Promise<void>;
}) {
  const [items, setItems] = useState<Trainee[]>(members);

  // 서버 fetch 새 결과 들어오면 (router.refresh) local state 재초기화.
  // 길이/순서 모두 다를 수 있어 단순 replace.
  useEffect(() => {
    setItems(members);
  }, [members]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.email === active.id);
    const newIndex = items.findIndex((i) => i.email === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next); // optimistic
    void onReorder?.(next.map((i) => i.email));
  }

  // 드래그 비활성 — viewOnly / archived / onReorder 없음.
  if (!onReorder || rest.viewOnly || rest.archived) {
    return (
      <>
        {items.map((u) => (
          <TraineeCard key={u.email} u={u} {...rest} />
        ))}
      </>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.email)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((u) => (
          <SortableCard key={u.email} u={u} {...rest} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableCard({
  u,
  ...rest
}: BoxCommonProps & { u: Trainee }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: u.email });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <TraineeCard
      u={u}
      {...rest}
      dragRef={setNodeRef}
      dragStyle={style}
      dragAttributes={attributes}
      dragListeners={listeners}
      isDragging={isDragging}
    />
  );
}
