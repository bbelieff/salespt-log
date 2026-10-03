import { describe, expect, it } from "vitest";
import { meetingConflicts } from "@/app/(app)/contact/_lib/meeting-conflicts";
const m = (id: string, time = "08:00", day = "2026-09-17") => ({ id, 업체명: id, 미팅시간: time, 미팅날짜: day });
describe("미팅 예정일시 중복", () => {
  it("가민·로지텍 동일 8시는 겹치고 가민을 10시로 고치면 해소", () => {
    expect(meetingConflicts([m("가민"), m("로지텍")], [])).toHaveLength(2);
    expect(meetingConflicts([m("가민", "10:00"), m("로지텍")], [])).toEqual([]);
  });
  it("다른 날 기록한 기존 예약도 확인, 같은 카드의 서버 복사본은 중복 아님", () => {
    expect(meetingConflicts([m("가민")], [m("로지텍"), m("로지텍")])).toHaveLength(2);
    expect(meetingConflicts([m("가민")], [m("가민")])).toEqual([]);
    expect(meetingConflicts([m("가민")], [m("로지텍", "08:00", "2026-09-18")])).toEqual([]);
  });
});
