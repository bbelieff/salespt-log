"use client";
/**
 * 우하단 「오늘 챙길 일」 빠른 보기 — 원형 버튼(남보라) + 건수 배지, 누르면 버튼에서 원형으로 퍼지는 작은 창.
 * 긴급순 5건(배지·업체·할 일·STEP) + 「열기」(대시보드 표와 같은 목적지).
 * 아래 줄: 왼쪽 「오류신고」(창을 닫고 실제 화면을 찍은 뒤 신고 창) · 오른쪽 「대시보드에서 N건 더 보기」.
 * 닫기: ×·Esc(초점은 버튼으로) · 바깥 누르기. 조회·집계는 FollowUpsLauncher(useTodayFollowUps) 책임.
 */
import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowUpRight, X } from "lucide-react";
import { followUpBadgeLabel, topUrgentFollowUps, type FollowUpItem } from "@/lib/analytics/dashboard-follow-ups";
import { captureTab } from "@/components/bug-report/capture";
import { installErrorLog } from "@/components/bug-report/error-log";
import "./followups-table.css";
import "./followups-launcher.css";

type DialogProps = { capture: string; onClose: () => void };

const STEP_LABEL: Record<FollowUpItem["step"], string> = { "1.5": "DB관리시트", "2": "컨택관리", "3": "일정·계약", "4": "실무/수납" };

export default function FollowUpsLauncherView({ items, loading = false, incomplete = false, onRetry }: {
  items: FollowUpItem[];
  loading?: boolean;
  incomplete?: boolean;
  onRetry?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<{ capture: string; Dialog: ComponentType<DialogProps> } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const { top, rest, total } = topUrgentFollowUps(items);
  const countText = loading ? "불러오는 중" : incomplete && !total ? "확인 필요" : `${incomplete ? "확인된 " : ""}${total}건`;
  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) button.current?.focus({ preventScroll: true });
  };
  useEffect(() => { installErrorLog(); }, []);
  /** 실제 탭을 찍고(브라우저 허락 — 누른 직후에만 뜨므로 맨 먼저 부른다) 신고 창을 연다. 못 찍으면 사진 붙이기로. */
  const startReport = () => {
    setOpen(false);
    const shot = captureTab();
    void (async () => {
      const capture = await shot;
      const { default: Dialog } = await import("@/components/bug-report/BugReportDialog"); // 신고할 때만 불러온다
      setReport({ capture: capture ?? "", Dialog });
    })();
  };
  useEffect(() => {
    if (!open) return;
    panel.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && (panel.current?.contains(target) || button.current?.contains(target))) return;
      setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      button.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  return <div className="fl-root" data-followups-launcher>
    <button ref={button} type="button" className="fl-fab" onClick={() => open ? close(false) : setOpen(true)} aria-expanded={open} aria-controls={id} aria-haspopup="dialog" aria-label={`오늘 챙길 일 ${open ? "닫기" : "열기"} · ${countText}`}>
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <rect x="9" y="11" width="22" height="20" rx="4" fill="#fff" />
        <path d="M9 15a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v2H9z" fill="#fda4af" />
        <rect x="14" y="8" width="2.4" height="6" rx="1.2" fill="#fff" />
        <rect x="23.6" y="8" width="2.4" height="6" rx="1.2" fill="#fff" />
        <path d="M15 24.2l3.4 3.3 6.6-7" fill="none" stroke="#6d28d9" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!loading && total > 0 && <span className="fl-count" aria-hidden>{total > 99 ? "99+" : total}</span>}
    </button>
    <div ref={panel} id={id} className="fl-pop" data-open={open} role="dialog" aria-label={`오늘 챙길 일 ${countText}`} tabIndex={-1} inert={!open}>
      <div className="fl-head">
        <h2>오늘 챙길 일<small>{countText}{total > 0 ? " · 긴급순" : ""}</small></h2>
        <button type="button" className="fl-close" onClick={() => close(true)} aria-label="빠른 보기 닫기"><X size={17} aria-hidden /></button>
      </div>
      <div className="fl-body">
        {loading ? <div className="fl-loading" aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="fx-skeleton fl-skeleton" />)}</div>
          : top.length ? <ul className="fl-list">{top.map(item => <li key={item.key} className="fl-item">
            <span className="ft-badge" data-tone={item.group}>{followUpBadgeLabel(item.badge)}</span>
            <span className="fl-text"><strong title={item.company}>{item.company}</strong><small title={`${item.action} · ${STEP_LABEL[item.step]}`}>{item.action} · {STEP_LABEL[item.step]}</small></span>
            <Link href={item.href as Route} className="ft-go" aria-label={`${item.company} ${item.action} 열기`} onClick={() => close(false)}>열기<ArrowUpRight size={13} aria-hidden /></Link>
          </li>)}</ul>
          : <div className="ft-empty"><span aria-hidden>{incomplete ? "!" : "✓"}</span><strong>{incomplete ? "아직 확인하지 못한 항목이 있어요" : "지금 처리할 일이 없어요"}</strong><p>{incomplete ? "일부 조회에 실패했어요. 다시 시도한 뒤 확인해 주세요." : "오늘 챙길 일이 0건입니다."}</p></div>}
        {incomplete && !loading && <p className="fl-notice" role="status">일부 항목을 불러오지 못했어요{onRetry && <button type="button" onClick={onRetry}>다시 시도</button>}</p>}
      </div>
      <div className="fl-foot">
        <button type="button" className="fl-report" onClick={startReport}>🐞 오류신고</button>
        <Link href={"/dashboard" as Route} className="fl-all" onClick={() => close(false)}>{rest > 0 ? `대시보드에서 ${rest}건 더 보기` : "대시보드에서 전체 보기"}<ArrowUpRight size={12} aria-hidden /></Link>
      </div>
    </div>
    {report && <report.Dialog capture={report.capture} onClose={() => { setReport(null); button.current?.focus({ preventScroll: true }); }} />}
  </div>;
}
