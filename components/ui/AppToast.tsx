/**
 * AppToast — 알림 한 줄(효과 ⑦, belie 2026-10-28). 모든 화면에서 같은 자리(휴대폰 = 아래 탭 위 가운데, PC = 아래 가운데)·같은 모양.
 * 전에는 화면마다 위·아래·높이가 달랐다. raised = 화면 아래에 고정 버튼 줄이 있는 곳(컨택)에서 그 위로 띄운다.
 */
import type { ReactNode } from "react";

export default function AppToast({ children, raised = false }: { children: ReactNode; raised?: boolean }) {
  return (
    <div role="status" aria-live="polite" data-raised={raised || undefined} className="app-toast rounded-xl bg-slate-900/95 px-5 py-3 text-sm font-medium text-white shadow-lg">
      {children}
    </div>
  );
}
