/**
 * CollapsibleSection — 페이지 섹션을 접었다 펼 수 있게 감싸는 카드.
 *
 * 왜 있나 (2026-09-14 belie 지시): /admin/trainers 의 «권한부여»·«초대관리» 는
 * 상시 작업이 아니라 가끔 쓰는 기능이다. 항상 펼쳐 두면 아래의 수강생 명단까지
 * 스크롤이 길어져서 정작 자주 보는 것이 화면 밖으로 밀린다.
 *
 * 폭·바깥여백은 호출부(페이지 셸)가 정한다 — 여기서 mx-auto/max-w-* 를 선언하지 않는다.
 * 이 규칙은 tests/structural/admin-page-shell.test.ts 가 강제한다.
 *
 * 등재: docs/design/components.md §8.
 */
"use client";

import type { ReactNode } from "react";
import PersistentDetails from "./PersistentDetails";

export default function CollapsibleSection({
  title,
  badge,
  persistKey,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** 제목 옆 작은 뱃지(예: "3명"). 없으면 생략. */
  badge?: string;
  /** 펼침 상태 저장 키 — 같은 섹션은 항상 같은 키를 써야 복원된다. */
  persistKey: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <PersistentDetails
      persistKey={persistKey}
      defaultOpen={defaultOpen}
      className="group w-full overflow-hidden rounded-2xl border border-gray-200 bg-white"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold text-gray-800 hover:bg-gray-50">
        <span>{title}</span>
        {badge && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">
            {badge}
          </span>
        )}
        <span className="ml-auto shrink-0 text-xs font-semibold text-gray-400 group-open:hidden">
          펼치기 ▾
        </span>
        <span className="ml-auto hidden shrink-0 text-xs font-semibold text-gray-400 group-open:inline">
          접기 ▴
        </span>
      </summary>
      <div className="border-t border-gray-100 px-4 pb-4 pt-3">{children}</div>
    </PersistentDetails>
  );
}
