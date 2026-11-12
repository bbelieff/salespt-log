/** 보드 미팅 창의 제목 줄 — 업체명 · 날짜·시간·장소 · 채널/상태 점. 주간 보드와 캘린더 한 달 보드가 같이 쓴다(시안 v44). */
import type { Meeting } from "@/types";
import { needsResult } from "../../_lib/board";
import { dayLabelKO, parseISO } from "../../_lib/week";
import { CH_DOT } from "./board-style";

/** 미팅은 한 시간으로 그린다(격자·결과 대기 판정과 같은 가정). */
const plusHour = (t: string) => `${String((Number(t.slice(0, 2)) + 1) % 24).padStart(2, "0")}${t.slice(2)}`;

export default function MeetingPopHead({ meeting: m, now }: { meeting: Meeting; now: Date }) {
  return (
    <>
      <h3 className="wb-pop-h">{m.업체명}</h3>
      <p className="wb-pop-meta">{m.미팅날짜.slice(5).replace("-", "/")} ({dayLabelKO(parseISO(m.미팅날짜))}) {m.미팅시간}–{plusHour(m.미팅시간)}{m.장소 ? ` · ${m.장소}` : ""}</p>
      <div className="wb-pmeta">
        <span><i className={CH_DOT[m.channel]} />{m.channel}</span>
        {m.상태 === "예약" && <span><i className="bg-amber-500" />예약</span>}
        {needsResult(m, now) && <span className="wb-need">결과 입력 필요</span>}
      </div>
    </>
  );
}
