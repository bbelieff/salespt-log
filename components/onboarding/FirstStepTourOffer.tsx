"use client";
/**
 * 처음 하는 일 안내 — 작은 제안 한 줄(「처음이시죠? 30초 안내 보기」)과, 누르면 켜지는 스포트라이트.
 * 저절로 켜지는 건 대시보드 「첫걸음」 카드의 「해 보기」(`?tour=`)로 들어왔을 때뿐이다(2026-11-11 belie 「추천대로」).
 * 1차 안내 두 가지: DB 넣기(DB관리시트) · 미팅 예약(컨택).
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Spotlight, { type SpotFinal, type SpotStep } from "./Spotlight";
import { useFirstSteps } from "./useFirstSteps";
import { shouldOfferTour, type FirstStepTour } from "@/util/first-steps";

const visibleEl = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].find((e) => e.getClientRects().length > 0) ?? null;

const TOURS: Record<FirstStepTour, { offer: string; label: string; steps: SpotStep[]; final: SpotFinal }> = {
  "db-add": {
    offer: "처음이시죠? DB 넣는 법 30초 안내",
    label: "첫 DB 넣기 안내",
    steps: [
      {
        target: ".sheet-empty-add, button[aria-label='DB 추가']",
        title: "여기를 눌러 첫 DB를 넣어 보세요",
        body: "엑셀 파일, 복사한 글, 통화 녹음 무엇이든 넣으면 알아서 칸을 나눠 줘요.",
        advance: "click",
      },
    ],
    final: {
      title: "이제 파일을 놓거나 붙여 넣으세요",
      body: "「자동 배치」를 누르면 다음 화면에서 채울 곳만 밝게 보여 줘요. 공급처·유입일을 채우고 「추가」를 누르면 끝이에요.",
    },
  },
  meeting: {
    offer: "처음이시죠? 미팅 예약하는 법 30초 안내",
    label: "첫 미팅 예약 안내",
    steps: [
      {
        target: "button[aria-label='컨택진행 증가']",
        title: "먼저 통화가 연결된 건수를 올려 주세요",
        body: "미팅예약은 컨택진행보다 많을 수 없어요. 연결된 통화가 있으면 컨택진행 ＋를 눌러 주세요.",
        advance: "click",
        // 미팅예약 ＋를 이미 누를 수 있으면 이 단계는 건너뛴다.
        skipIf: () => visibleEl("button[aria-label='미팅예약 증가']")?.getAttribute("aria-disabled") !== "true",
      },
      {
        target: "button[aria-label='미팅예약 증가']",
        title: "미팅을 잡았다면 미팅예약 ＋",
        body: "누르면 아래에 미팅 카드가 하나 생겨요.",
        advance: "click",
      },
      {
        target: "[data-first-steps='new-meeting']",
        title: "업체명·장소·시간을 적고 「예약 등록」",
        body: "등록하면 일정(STEP 3)에 미팅이 바로 올라가요.",
        advance: "gone",
      },
    ],
    final: {
      title: "첫 미팅 예약을 마쳤어요",
      body: "미팅이 끝나면 일정 탭에서 결과를 기록해요.",
      href: "/schedule",
      hrefLabel: "일정 보기",
    },
  },
};

export default function FirstStepTourOffer({ tour, alreadyDone }: { tour: FirstStepTour; alreadyDone: boolean }) {
  const { ready, isTraineeSelf, memory, update } = useFirstSteps();
  const params = useSearchParams();
  const [running, setRunning] = useState(false);
  const [closed, setClosed] = useState(false);
  const def = TOURS[tour];

  // 「첫걸음」 카드의 「해 보기」로 들어오면 바로 켠다(본인 화면일 때만).
  useEffect(() => {
    if (ready && isTraineeSelf && params?.get("tour") === tour) setRunning(true);
  }, [ready, isTraineeSelf, params, tour]);

  const remember = useCallback(
    (kind: "never" | "finished") =>
      update((m) => (m[kind].includes(tour) ? m : { ...m, [kind]: [...m[kind], tour] })),
    [update, tour],
  );

  if (running) {
    return (
      <Spotlight
        label={def.label}
        steps={def.steps}
        final={def.final}
        onFinish={() => remember("finished")}
        onLater={() => {
          setRunning(false);
          setClosed(true);
        }}
        onNever={() => {
          remember("never");
          setRunning(false);
        }}
      />
    );
  }

  if (closed || !ready || !shouldOfferTour({ tour, memory, isTraineeSelf, alreadyDone })) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="note">
      <span className="min-w-0 flex-1 break-keep">{def.offer}</span>
      <button type="button" onClick={() => setRunning(true)} className="hit-44 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800">
        안내 보기
      </button>
      <button type="button" onClick={() => remember("never")} className="hit-44 px-2 text-xs text-amber-800 underline underline-offset-2">
        다시 보지 않기
      </button>
    </div>
  );
}
