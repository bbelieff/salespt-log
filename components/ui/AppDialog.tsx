/**
 * AppDialog — 앱 공용 팝업 (2026-11-10 결정 4, app-dialog-unify).
 * SheetDialog(DB 목록 창) 방식을 공용으로: 네이티브 <dialog>.showModal() 이라 뒤 화면은 키보드·클릭이 닿지 않는다.
 *
 * 공통 규칙
 * - 닫기 = Esc · ✕ · 「취소」(창 안 버튼은 useAppDialogClose() 로 같은 닫기를 부른다).
 * - dirty(적던 내용 있음)면 닫기 전에 confirmDiscard 로 한 번 묻는다.
 * - 열리면 data-autofocus → 첫 입력 칸 → 브라우저 기본 순으로 초점, 닫히면 연 버튼으로 초점 복귀.
 * - 바깥(어두운 배경) 누르기는 dismissOnBackdrop 인 안내용 창만 닫는다. 입력 창은 안 닫는다.
 * - 휴대폰·태블릿(<1024px) = 아래에서 올라오는 서랍, PC(lg) = 가운데. 색·글꼴·내용은 각 창이 className 으로 그대로 가져온다.
 */
"use client";

import { createContext, useCallback, useContext, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { confirmDiscard } from "./confirm-discard";
import { PortalTargetContext, useTopLayerDialog } from "./top-layer";
import "./app-dialog.css";

const FIELD =
  "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([disabled]), select:not([disabled]), textarea:not([disabled])";

export type AppDialogSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface AppDialogProps {
  /** 닫기가 확정됐을 때(dirty 확인 통과 후) 부른다. */
  onClose: () => void;
  /** 화면 읽기용 이름. 보이는 제목에 id 가 있으면 labelledBy 를 쓴다. */
  title?: string;
  labelledBy?: string;
  /** 적던 내용이 있으면 true — 닫기 전에 confirmDiscard 로 묻는다. */
  dirty?: boolean;
  /** 입력 없는 안내용 창만 true. 기본 false(바깥을 눌러도 안 닫힘). */
  dismissOnBackdrop?: boolean;
  role?: "dialog" | "alertdialog";
  /** PC 가운데 창 폭: xs 20rem · sm 24rem · md 28rem · lg 32rem · xl 42rem. */
  size?: AppDialogSize;
  /** 판(흰 상자) 모양 — 각 창의 기존 색·여백 클래스를 그대로 넘긴다(폭은 size 가 정한다). */
  className?: string;
  children?: ReactNode;
}

const CloseContext = createContext<() => void>(() => {});

/** 창 안의 「취소」·✕ 가 부르는 닫기 — dirty 확인을 거친다. */
export function useAppDialogClose(): () => void {
  return useContext(CloseContext);
}

/** 「취소」·✕ 버튼 — 모양(className)·글자는 각 창 그대로, 누르면 AppDialog 의 닫기(dirty 확인 포함). */
export function AppDialogClose(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">) {
  const close = useAppDialogClose();
  return <button type="button" {...props} onClick={close} />;
}

export default function AppDialog({
  onClose,
  title,
  labelledBy,
  dirty = false,
  dismissOnBackdrop = false,
  role = "dialog",
  size = "sm",
  className = "",
  children,
}: AppDialogProps) {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const downOnBackdrop = useRef(false);

  const requestClose = useCallback(() => {
    if (confirmDiscard(dirtyRef.current)) onCloseRef.current();
  }, []);
  // 열리면 data-autofocus → 첫 입력 칸 → 브라우저 기본 순으로 초점, 닫히면 연 버튼으로(useTopLayerDialog).
  const { ref, panelRef, host, onCancel, onClose: onDialogClose } = useTopLayerDialog<HTMLDivElement>({
    requestClose,
    initialFocus: (el) => el.querySelector<HTMLElement>("[data-autofocus]") ?? el.querySelector<HTMLElement>(FIELD),
  });

  return (
    <CloseContext.Provider value={requestClose}>
      <dialog
        ref={ref}
        role={role === "alertdialog" ? "alertdialog" : undefined}
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        aria-modal="true"
        data-size={size}
        className="app-dialog"
        onCancel={onCancel}
        onClose={onDialogClose}
        onPointerDown={(e) => {
          downOnBackdrop.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          const onBackdrop = e.target === e.currentTarget && downOnBackdrop.current;
          downOnBackdrop.current = false;
          if (onBackdrop && dismissOnBackdrop) requestClose();
        }}
      >
        {/* 창 안의 포털 팝업(말풍선·자동입력 창 등)은 body 대신 이 dialog 안에 그린다 — 최상단 층 위로 보이게. */}
        <PortalTargetContext.Provider value={host}>
          <div ref={panelRef} className={`app-dialog-panel ${className}`}>{children}</div>
        </PortalTargetContext.Provider>
      </dialog>
    </CloseContext.Provider>
  );
}
