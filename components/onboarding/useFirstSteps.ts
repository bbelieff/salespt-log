"use client";
/**
 * 첫걸음 기억(이 브라우저, 계정별)과 「수강생 본인 화면인지」. 1차는 브라우저 저장만 쓴다 —
 * 계정별(폰·PC 공통) 저장은 DB 표가 필요해 따로 승인 뒤 2차(plan first-steps-spotlight).
 * 끝났는지 판정은 실제 기록(@/util/first-steps)이라 저장이 비어도 이미 한 단계는 다시 안 뜬다.
 */
import { useCallback, useEffect, useState } from "react";
import { useMe } from "@/query/me-hook";
import {
  EMPTY_FIRST_STEPS_MEMORY,
  firstStepsStorageKey,
  parseFirstStepsMemory,
  type FirstStepsMemory,
} from "@/util/first-steps";

const CHANGE_EVENT = "salespt-first-steps-change";

export function useFirstSteps() {
  const me = useMe();
  const email = me.data?.sessionEmail || me.data?.email || "";
  // 관리자·트레이너가 수강생 화면을 대신 볼 때, 트레이너 본인 화면에서는 띄우지 않는다.
  const isTraineeSelf = !!me.data && me.data.sessionRole === "trainee" && !me.data.impersonating && !!email;
  const key = email ? firstStepsStorageKey(email) : "";
  const [memory, setMemory] = useState<FirstStepsMemory>(EMPTY_FIRST_STEPS_MEMORY);

  useEffect(() => {
    if (!key) return;
    const load = () => {
      try {
        setMemory(parseFirstStepsMemory(localStorage.getItem(key)));
      } catch {
        setMemory(EMPTY_FIRST_STEPS_MEMORY);
      }
    };
    load();
    window.addEventListener(CHANGE_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(CHANGE_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [key]);

  const update = useCallback(
    (fn: (m: FirstStepsMemory) => FirstStepsMemory) => {
      if (!key) return;
      let current = EMPTY_FIRST_STEPS_MEMORY;
      try {
        current = parseFirstStepsMemory(localStorage.getItem(key));
      } catch {
        /* 저장소를 못 쓰면 이번 화면에서만 기억 */
      }
      const next = fn(current);
      setMemory(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
        window.dispatchEvent(new Event(CHANGE_EVENT));
      } catch {
        /* 사생활 보호 창 등 — 화면 상태만 바뀐다 */
      }
    },
    [key],
  );

  return { ready: !!me.data, isTraineeSelf, memory, update };
}
