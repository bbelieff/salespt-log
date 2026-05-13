/**
 * SortableList — 일반화된 dnd-kit wrapper (render prop 패턴).
 *
 * PR C-2 (2026-05-13). PR C-1 의 SortableTraineeBox 를 generic 화한 것.
 * Trainee 카드(/admin/users) 와 Trainer 카드(/admin/trainers) 가 공유.
 *
 * 책임 분리:
 *   - dnd 메커니즘 (DndContext + SortableContext + Sensors + optimistic state) → 이 컴포넌트
 *   - 카드 렌더 (TraineeCard / TrainerAssignCard) → renderItem 콜백
 *
 * 사용 예:
 *   <SortableList items={trainers} getId={t => t.email} onReorder={(emails) => api(emails)}
 *     renderItem={(t, drag) => (
 *       <TrainerAssignCard trainer={t} dragRef={drag.ref} dragStyle={drag.style}
 *         dragAttributes={drag.attributes} dragListeners={drag.listeners}
 *         isDragging={drag.isDragging} ... />
 *     )} />
 *
 * Sensors:
 *   - PointerSensor: distance 5px (클릭 vs 드래그 구분)
 *   - TouchSensor: 200ms long-press (모바일 스크롤 보호)
 *   - KeyboardSensor: 접근성
 *
 * 비활성: onReorder 미제공 또는 disabled=true → plain render (dnd 없음).
 */
"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
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

/** renderItem 콜백에 전달되는 dnd handle 객체. */
export interface DragHandle {
  ref: (el: HTMLElement | null) => void;
  style: CSSProperties;
  attributes: HTMLAttributes<HTMLElement>;
  listeners: HTMLAttributes<HTMLElement> | undefined;
  isDragging: boolean;
}

export default function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
  disabled = false,
}: {
  items: T[];
  /** 안정 식별자 — email 같은 unique 키. */
  getId: (item: T) => string;
  /** 드래그 종료 시 새 순서의 id 배열. 미제공 / disabled → dnd 비활성. */
  onReorder?: (ids: string[]) => void | Promise<void>;
  /** 카드 렌더 콜백. drag handle 을 받아 핸들 부착. */
  renderItem: (item: T, drag: DragHandle | null) => ReactNode;
  /** 강제 비활성 (viewOnly 등). */
  disabled?: boolean;
}) {
  const [order, setOrder] = useState<T[]>(items);

  // 서버 fetch 새 결과 들어오면 (router.refresh) local state 재초기화.
  useEffect(() => {
    setOrder(items);
  }, [items]);

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
    const oldIndex = order.findIndex((it) => getId(it) === active.id);
    const newIndex = order.findIndex((it) => getId(it) === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next); // optimistic
    void onReorder?.(next.map(getId));
  }

  // 드래그 비활성 — plain 렌더.
  if (!onReorder || disabled) {
    return <>{order.map((it) => renderItem(it, null))}</>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={order.map(getId)}
        strategy={verticalListSortingStrategy}
      >
        {order.map((it) => (
          <SortableItem
            key={getId(it)}
            id={getId(it)}
            item={it}
            renderItem={renderItem}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableItem<T>({
  id,
  item,
  renderItem,
}: {
  id: string;
  item: T;
  renderItem: (item: T, drag: DragHandle | null) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const handle: DragHandle = {
    ref: setNodeRef,
    style: {
      transform: CSS.Transform.toString(transform),
      transition,
    },
    attributes,
    listeners,
    isDragging,
  };
  return <>{renderItem(item, handle)}</>;
}
