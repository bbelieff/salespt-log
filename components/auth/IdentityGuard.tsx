/**
 * 탭 신원 가드 — **이 탭이 열릴 때의 사람**과 **지금 서버가 보는 사람**이 달라지면 화면을 막는다.
 *
 * ## 왜 (2026-09-01 belie 신고 · 실제 화면으로 확인)
 * 대리접속 신원(`salespt_as`)은 httpOnly 쿠키(path=/)라 **브라우저 전체 공용**인데,
 * 전환은 **새 탭을 여는 방식**이다. 그래서 A 학생 탭을 열어둔 채 B 학생을 열면
 * A 탭도 그 순간부터 B 로 동작한다. belie 화면에서 상단은 `A2-8기 김현민`,
 * 목록은 문병규 님 계약이 떴다(헤더는 `useMe` 1시간 캐시라 안 바뀌고, 목록만 새로 받아서).
 *
 * **읽기보다 쓰기가 더 위험하다** — 저장도 같은 쿠키를 쓰므로(`getWritableUserEmail`)
 * A 탭에서 누른 저장이 **B 학생 기록에 써진다.** 그래서 "이상해 보이면 알림" 이 아니라
 * **조작 자체를 막는다.**
 *
 * ## 어떻게
 * `/api/whoami`(세션+쿠키만 읽는 초경량 라우트)를 마운트 시 1회, 이후 창 포커스 복귀와
 * 30초 주기로 확인한다. 처음 본 지문과 달라지면 전체 화면 오버레이로 덮는다.
 * **자동 새로고침은 하지 않는다** — 입력 중이던 내용이 날아갈 수 있어, 사람이 누르게 한다.
 *
 * 오탐 방지: 지문을 못 받아오면(오프라인·401) 아무것도 하지 않는다. 막는 쪽이 기본이 아니다.
 */
"use client";

import { useEffect, useRef, useState } from "react";

interface WhoAmI {
  activeFingerprint: string;
  activeMasked: string;
}

/** 순수 판정 — 처음 본 지문과 지금 지문이 다르면 막는다. 값이 없으면 판단하지 않는다. */
export function shouldBlockTab(
  first: string | null,
  current: string | null,
): boolean {
  if (!first || !current) return false;
  return first !== current;
}

const POLL_MS = 30_000;

export default function IdentityGuard() {
  const firstRef = useRef<string | null>(null);
  const [now, setNow] = useState<WhoAmI | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch("/api/whoami", { cache: "no-store" });
        if (!res.ok) return; // 401·오프라인 — 판단하지 않는다(오탐 금지).
        const body = (await res.json()) as WhoAmI;
        if (!alive || !body?.activeFingerprint) return;
        if (firstRef.current === null) firstRef.current = body.activeFingerprint;
        setNow(body);
      } catch {
        // 네트워크 실패 — 무시. 가드가 화면을 망가뜨리지 않게.
      }
    };
    void check();
    const timer = setInterval(check, POLL_MS);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!shouldBlockTab(firstRef.current, now?.activeFingerprint ?? null)) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="다른 사람 화면으로 바뀌었어요"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-6"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <p className="text-2xl">🔀</p>
        <h2 className="mt-2 text-lg font-bold text-slate-900">
          다른 분의 화면으로 바뀌었어요
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          다른 탭에서 <b>{now?.activeMasked}</b> 님으로 전환하셨어요.
          <br />
          이 탭도 같이 바뀌어서, 지금 저장하면 <b>그분 기록에 저장</b>됩니다.
          <br />
          잘못 저장되지 않게 잠시 막아 뒀어요.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
        >
          이 탭 새로고침하기
        </button>
        <p className="mt-3 text-xs text-slate-400">
          원래 보던 분으로 돌아가려면 그 탭에서 다시 여세요.
        </p>
      </div>
    </div>
  );
}
