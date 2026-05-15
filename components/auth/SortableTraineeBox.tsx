/**
 * SortableTraineeBox — 박스(같은 cohort+team) 내 TraineeCard 들을 dnd 정렬.
 *
 * PR C-1 (2026-05-13) 도입, PR C-2 (2026-05-13) 에서 generic SortableList 사용
 * 으로 리팩터. TraineeCard 전용 어댑터 역할만 담당.
 *
 * viewOnly / archived / onReorder 없음 → SortableList 의 disabled 모드 (plain 렌더).
 */
"use client";

import TraineeCard from "./TraineeCard";
import SortableList from "./SortableList";
import type { Trainee, Trainer } from "./AdminUserPickerTypes";

interface BoxCommonProps {
  archived: boolean;
  viewOnly: boolean;
  busy: string | null;
  nameByEmail: Map<string, string>;
  linkedBySheet?: Map<string, string[]>;
  onPick: (email: string) => void;
  onReserve: (email: string) => void;
  onSetTeam: (email: string, team: string) => void;
  onAssignTrainers?: (traineeEmail: string, trainerEmails: string[]) => void;
  activeTrainers?: Trainer[];
  /** 트레이너 뷰 — 본인 email (lowercase). TraineeCard 로 그대로 전달. */
  trainerEmailLc?: string;
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
  return (
    <SortableList
      items={members}
      getId={(t) => t.email}
      onReorder={onReorder}
      disabled={rest.viewOnly || rest.archived}
      renderItem={(u, drag) => (
        <TraineeCard
          key={u.email}
          u={u}
          {...rest}
          dragRef={drag?.ref}
          dragStyle={drag?.style}
          dragAttributes={drag?.attributes}
          dragListeners={drag?.listeners}
          isDragging={drag?.isDragging}
        />
      )}
    />
  );
}
