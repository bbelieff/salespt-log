"use client";

import { forwardRef } from "react";

/** 선택 행에서 상세 패널의 외곽선까지 이어지는 역라운드 연결부. */
const PaymentSelectionBridge = forwardRef<SVGSVGElement, { mode?: "company" | "institution" }>(function PaymentSelectionBridge({ mode = "company" }, ref) {
  const institution = mode === "institution";
  return (
    <svg ref={ref} aria-hidden="true" preserveAspectRatio="none" className="payment-selection-link pointer-events-none absolute z-20 overflow-hidden opacity-0 transition-opacity duration-150">
      <defs>
        <linearGradient id="payment-selection-gradient" x1="0" y1="0" x2="1" y2="0">
          {/* 선택 박스는 오른쪽 끝이 흰색으로 끝나고(목록 컴포넌트의 to-white) 상세 패널도 흰색이라
              연결부도 흰색 한 가지 — 사이에 바래는 띠가 생기지 않아 박스가 패널까지 한 덩어리로 보인다. */}
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="payment-selection-edge-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={institution ? "#f87171" : "#60a5fa"} />
          <stop offset="100%" stopColor={institution ? "#fecaca" : "#bfdbfe"} />
        </linearGradient>
      </defs>
      <path data-bridge-fill fill="url(#payment-selection-gradient)" />
      <path data-bridge-edge fill="none" stroke="url(#payment-selection-edge-gradient)" strokeWidth="1" strokeLinecap="square" />
    </svg>
  );
});

export default PaymentSelectionBridge;

/** 선이 선택 박스 테두리·패널 외곽선과 겹치는 길이(px) — 이음매 틈을 없앤다. 같은 색이라 겹침은 안 보인다. */
const BRIDGE_OVERLAP = 2;

/** 선택 박스의 모서리 R(px) — 연결부의 역라운드도 같은 R 로 뒤집어 쓴다. */
function cornerRadius(el: HTMLElement): number {
  const r = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(r) && r > 0 ? r : 12;
}

export function syncPaymentSelectionBridge(root: HTMLDivElement | null, pane: HTMLDivElement | null, bridge: SVGSVGElement | null) {
  const detail = root?.querySelector<HTMLElement>(".payment-detail-shell");
  // 접힌 기관에서는 선택 행이 DOM에서 사라지므로 활성 기관 헤더에 연결한다.
  const selected = pane?.querySelector<HTMLElement>('[aria-selected="true"]')
    ?? pane?.querySelector<HTMLElement>('[data-active-institution="true"]');
  if (!root || !pane || !bridge || !detail || !selected) {
    if (bridge) bridge.style.opacity = "0";
    return;
  }
  // 브라우저는 박스 테두리를 기기 픽셀 칸에 반올림해 그린다. 연결선도 같은 칸에 맞추지 않으면 목록 칸마다
  // 세로 위치의 소수점이 달라 0.25~0.75px 씩 어긋나 선이 흐리거나 이가 빠져 보인다(2026-09-28 10기 실측).
  const dpr = typeof window !== "undefined" && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  const snap = (v: number) => Math.round(v * dpr) / dpr;
  // 1px 테두리가 실제로 그려지는 두께 — 기기 픽셀 정수배(최소 1칸).
  const bw = Math.max(1, Math.floor(dpr + 1e-6)) / dpr;
  const row = selected.getBoundingClientRect();
  const viewport = pane.getBoundingClientRect();
  const top = snap(Math.max(row.top, viewport.top));
  const bottom = snap(Math.min(row.bottom, viewport.bottom));
  if (bottom - top < 12) { bridge.style.opacity = "0"; return; }

  const panelRect = detail.getBoundingClientRect();
  const rowRight = snap(row.right);
  const panelLeft = snap(panelRect.left);
  const panelTop = snap(panelRect.top);
  const width = panelLeft - rowRight;
  const height = snap(panelRect.bottom) - panelTop;
  if (width <= 1 || height <= 0) { bridge.style.opacity = "0"; return; }
  const startY = Math.max(0, Math.min(height, top - panelTop));
  const endY = Math.max(0, Math.min(height, bottom - panelTop));
  if (endY <= startY) { bridge.style.opacity = "0"; return; }
  // 물방울 연결: 선택 박스의 위·아래 직선이 상세 패널 앞까지 그대로 뻗고, 끝에서 박스와 같은 R 로
  // 바깥쪽(위는 위로, 아래는 아래로) 뒤집혀 휘어 패널 외곽선에 수직으로 붙는다(역라운드).
  // 선이 끊겨 보이지 않게: ① 선을 테두리 픽셀 한가운데(두께 bw 의 절반)에 맞추고 ② SVG 를 박스 안쪽 OVERLAP 만큼
  // 당겨 시작해 박스 테두리와 겹치고 ③ 역라운드 끝도 패널 외곽선을 따라 OVERLAP 만큼 더 긋는다.
  const lead = Math.max(1, Math.round(BRIDGE_OVERLAP * dpr)) / dpr; // 겹침 길이도 기기 픽셀 칸 단위
  const half = bw / 2;
  const topLine = startY + half;
  const bottomLine = endY - half;
  const panelLine = lead + width + half;
  // R 은 박스 모서리 값을 쓰되 틈의 55% 를 넘지 않게 — 틈이 좁을 때 곧은 연장선이 너무 짧아
  // 갈고리처럼 보이지 않도록(belie 2026-09-28 "R 수정해도 됨").
  const r = Math.max(0, Math.min(cornerRadius(selected), width * 0.55, topLine, height - bottomLine));
  const straight = panelLine - r;
  const upperY = topLine - r;
  const lowerY = bottomLine + r;
  const upperArc = `M 0 ${topLine} L ${straight} ${topLine} A ${r} ${r} 0 0 0 ${panelLine} ${upperY}`;
  const lowerArc = `L ${panelLine} ${lowerY} A ${r} ${r} 0 0 0 ${straight} ${bottomLine} L 0 ${bottomLine}`;
  // 채움은 패널 외곽선 픽셀을 넘어 edgeX 까지 — 이어지는 구간의 테두리를 지운다.
  const edgeX = lead + width + bw + 1;
  bridge.querySelector("[data-bridge-fill]")?.setAttribute("d", `${upperArc} L ${edgeX} ${upperY} L ${edgeX} ${lowerY} ${lowerArc} Z`);
  // 외곽선 = 박스 위·아래 선의 연장 + 역라운드. 이어지는 구간에는 세로선이 없다.
  const edge = bridge.querySelector("[data-bridge-edge]");
  edge?.setAttribute("d", `${upperArc} L ${panelLine} ${Math.max(0, upperY - BRIDGE_OVERLAP)} M ${panelLine} ${Math.min(height, lowerY + BRIDGE_OVERLAP)} ${lowerArc}`);
  edge?.setAttribute("stroke-width", String(bw));
  bridge.setAttribute("viewBox", `0 0 ${edgeX} ${height}`);
  // SVG 원점도 기기 픽셀 칸 위(스냅된 절대 좌표)에 둔다 — 원점이 소수점이면 브라우저가 다시 반올림해 전체가 밀린다.
  const bounds = root.getBoundingClientRect();
  bridge.style.left = `${rowRight - lead - bounds.left}px`;
  bridge.style.top = `${panelTop - bounds.top}px`;
  bridge.style.width = `${edgeX}px`;
  bridge.style.height = `${height}px`;
  bridge.style.opacity = "1";
}
