"use client";
/**
 * 처음 하는 일 안내 — 작은 제안 한 줄(「처음이시죠? 30초 안내」)과, 누르면 켜지는 스포트라이트.
 * 저절로 켜지는 건 대시보드 「첫걸음」 카드의 「해 보기」(`?tour=`)로 들어왔을 때뿐이다(2026-11-11 belie 「추천대로」).
 * 문구는 짧게 — 할 일 한 줄만(belie 「잡다한 설명 생략」).
 */
import { useCallback, useContext, useEffect, useState } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { track, EVENTS } from "@/analytics";
import Spotlight, { type SpotFinal, type SpotStep } from "./Spotlight";
import { useFirstSteps } from "./useFirstSteps";
import { shouldOfferTour, type FirstStepTour } from "@/util/first-steps";

const visibleEl = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].find((e) => e.getClientRects().length > 0) ?? null;
const SLOT1 = "[id^='payment-slot-'][id$='-1']";

const TOURS: Record<FirstStepTour, { offer: string; label: string; steps: SpotStep[]; final: SpotFinal }> = {
  purchase: {
    offer: "처음이시죠? DB 구매 기록 30초 안내",
    label: "첫 DB 구매 기록 안내",
    steps: [
      { target: "section[aria-label='입력할 채널'] button", title: "산 DB의 채널을 고르세요", body: "", advance: "click", skipIf: () => !!visibleEl("[data-first-steps='db-add-row'], [data-first-steps='db-add-form']") },
      { target: "[data-first-steps='db-add-row']", title: "「추가」를 누르세요", body: "", advance: "click", skipIf: () => !!visibleEl("[data-first-steps='db-add-form']") },
      { target: "[data-first-steps='db-add-form']", title: "구매일·업체명·결제 총액·주문개수", body: "적으면 저절로 저장돼요.", advance: "next" },
    ],
    final: { title: "첫 DB 구매 기록 끝", body: "" },
  },
  "db-add": {
    offer: "처음이시죠? DB 넣는 법 30초 안내",
    label: "첫 DB 넣기 안내",
    steps: [{ target: ".sheet-empty-add, button[aria-label='DB 추가']", title: "여기를 눌러 DB를 넣으세요", body: "엑셀·복사한 글·통화 녹음 모두 돼요.", advance: "click" }],
    final: { title: "파일을 놓거나 붙여 넣으세요", body: "다음 화면에서 채울 곳만 밝혀 드려요." },
  },
  contact: {
    offer: "처음이시죠? 컨택 기록 30초 안내",
    label: "첫 컨택 기록 안내",
    steps: [{ target: "button[aria-label='컨택진행 증가']", title: "통화가 연결되면 컨택진행 ＋", body: "숫자는 저절로 저장돼요.", advance: "click" }],
    final: { title: "첫 컨택 기록 끝", body: "" },
  },
  meeting: {
    offer: "처음이시죠? 미팅 예약 30초 안내",
    label: "첫 미팅 예약 안내",
    steps: [
      {
        target: "button[aria-label='컨택진행 증가']",
        title: "먼저 컨택진행 ＋",
        body: "미팅예약은 컨택진행보다 많을 수 없어요.",
        advance: "click",
        // 미팅예약 ＋를 이미 누를 수 있으면 이 단계는 건너뛴다.
        skipIf: () => visibleEl("button[aria-label='미팅예약 증가']")?.getAttribute("aria-disabled") !== "true",
      },
      { target: "button[aria-label='미팅예약 증가']", title: "미팅예약 ＋", body: "", advance: "click" },
      { target: "[data-first-steps='new-meeting']", title: "업체명·장소·시간 → 「예약 등록」", body: "", advance: "gone" },
    ],
    final: { title: "첫 미팅 예약 끝", body: "", href: "/schedule", hrefLabel: "일정 보기" },
  },
  result: {
    offer: "처음이시죠? 미팅 결과 기록 30초 안내",
    label: "첫 미팅 결과 기록 안내",
    steps: [
      { target: "[data-first-steps='meeting-card-toggle']", title: "끝난 미팅을 누르세요", body: "", advance: "click", skipIf: () => !!visibleEl("[data-first-steps='meeting-actions']") },
      { target: "[data-first-steps='meeting-actions']", title: "결과를 고르세요", body: "계약했으면 「💵 계약」, 아니면 「완료」.", advance: "click" },
    ],
    final: { title: "첫 미팅 결과 기록 끝", body: "", href: "/payment", hrefLabel: "실무/수납 보기" },
  },
  payment: {
    offer: "처음이시죠? 수납 기록 30초 안내",
    label: "첫 수납 기록 안내",
    steps: [
      { target: "[data-first-steps='contract-open']", title: "계약을 누르세요", body: "", advance: "click", skipIf: () => !!visibleEl(SLOT1) },
      { target: `${SLOT1} [role='button']`, title: "「진행 1」을 펼치세요", body: "", advance: "click", skipIf: () => !!visibleEl(`${SLOT1} [aria-label='수납액 (원)']`) },
      { target: `${SLOT1} [aria-label='수납액 (원)']`, title: "수납일·수납액", body: "적으면 저절로 저장돼요.", advance: "next" },
    ],
    final: { title: "첫 수납 기록 끝", body: "" },
  },
};

type OfferProps = { tour: FirstStepTour; alreadyDone: boolean; available?: boolean };

/** 데이터 공급자(QueryClient)가 없는 화면(단독 시험 등)에서는 아무것도 그리지 않는다. */
export default function FirstStepTourOffer(props: OfferProps) {
  return useContext(QueryClientContext) ? <TourOffer {...props} /> : null;
}

function TourOffer({ tour, alreadyDone, available = true }: OfferProps) {
  const { ready, isTraineeSelf, memory, update } = useFirstSteps();
  const [running, setRunning] = useState(false);
  const [closed, setClosed] = useState(false);
  const def = TOURS[tour];

  const start = useCallback(
    (from: "offer" | "card") => {
      track(EVENTS.FIRST_STEP_TOUR_STARTED, { tour, from });
      setRunning(true);
    },
    [tour],
  );

  // 「첫걸음」 카드의 「해 보기」로 들어오면 바로 켠다(본인 화면일 때만).
  useEffect(() => {
    if (ready && isTraineeSelf && new URLSearchParams(window.location.search).get("tour") === tour) start("card");
  }, [ready, isTraineeSelf, tour, start]);

  const remember = useCallback(
    (kind: "never" | "finished") =>
      update((m) => (m[kind].includes(tour) ? m : { ...m, [kind]: [...m[kind], tour] })),
    [update, tour],
  );
  const never = () => {
    track(EVENTS.FIRST_STEP_TOUR_DISMISSED, { tour, how: "never" });
    remember("never");
    setRunning(false);
  };

  if (running) {
    return (
      <Spotlight
        label={def.label}
        steps={def.steps}
        final={def.final}
        onFinish={() => {
          track(EVENTS.FIRST_STEP_TOUR_FINISHED, { tour });
          remember("finished");
        }}
        onLater={() => {
          setRunning(false);
          setClosed(true);
        }}
        onNever={never}
      />
    );
  }

  if (closed || !ready || !available || !shouldOfferTour({ tour, memory, isTraineeSelf, alreadyDone })) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="note">
      <span className="min-w-0 flex-1 break-keep">{def.offer}</span>
      <button type="button" onClick={() => start("offer")} className="hit-44 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800">
        안내 보기
      </button>
      <button type="button" onClick={never} className="hit-44 px-2 text-xs text-amber-800 underline underline-offset-2">
        다시 보지 않기
      </button>
    </div>
  );
}
