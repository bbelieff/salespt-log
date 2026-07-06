/**
 * pickActiveAnchor — 앱 내 NEW 앵커 활성 판정 (new-feature-highlight §1·§2, QA 2~5).
 * 규칙: visible feat(그룹에 feat 포함) 중 anchor 있는 최신 1건, 상한 14일,
 * 미등록 키 무시(경고 로그, 화면 깨짐 없음).
 */
import { describe, expect, it, vi } from "vitest";
import { pickActiveAnchor } from "@/service/announcements";
import { UpdateItem } from "@/types";

const ANCHORS = {
  "calendar.gcalCard": { tab: "/calendar", label: "테스트 앵커" },
  "db.someCard": { tab: "/db", label: "테스트 앵커2" },
};
const TODAY = "2026-07-06";

const row = (over: Partial<UpdateItem>): UpdateItem =>
  UpdateItem.parse({ pr: 1, type: "feat", date: "2026-07-01", visible: true, ...over });

describe("pickActiveAnchor", () => {
  it("QA2: anchor 있는 visible feat → 활성 (키·탭·pr)", () => {
    const r = pickActiveAnchor([row({ pr: 480, anchor: "calendar.gcalCard" })], {
      today: TODAY,
      anchors: ANCHORS,
    });
    expect(r).toEqual({ key: "calendar.gcalCard", tab: "/calendar", pr: 480 });
  });

  it("QA3: 다음 anchor feat 배포 → 최신 1건으로 자동 교체", () => {
    const r = pickActiveAnchor(
      [
        row({ pr: 480, anchor: "calendar.gcalCard" }),
        row({ pr: 485, anchor: "db.someCard" }),
      ],
      { today: TODAY, anchors: ANCHORS },
    );
    expect(r?.key).toBe("db.someCard");
    expect(r?.pr).toBe(485);
  });

  it("QA4: 미등록 키(오타)는 무시 + 경고 로그 — 다른 유효 앵커로 폴백", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = pickActiveAnchor(
      [
        row({ pr: 490, anchor: "calendar.gcalCrad" }), // 오타
        row({ pr: 480, anchor: "calendar.gcalCard" }),
      ],
      { today: TODAY, anchors: ANCHORS },
    );
    expect(r?.pr).toBe(480); // 오타 행은 건너뛰고 유효 행 활성
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("QA5: 14일 경과 → 자동 해제 (경계: 14일=활성, 15일=해제)", () => {
    const at = (date: string) =>
      pickActiveAnchor([row({ anchor: "calendar.gcalCard", date })], {
        today: TODAY,
        anchors: ANCHORS,
      });
    expect(at("2026-06-22")).not.toBeNull(); // 14일 전 — 활성
    expect(at("2026-06-21")).toBeNull(); // 15일 전 — 해제
  });

  it("visible=FALSE·anchor 없음·빈 날짜는 대상 아님", () => {
    const opts = { today: TODAY, anchors: ANCHORS };
    expect(
      pickActiveAnchor([row({ anchor: "calendar.gcalCard", visible: false })], opts),
    ).toBeNull();
    expect(pickActiveAnchor([row({ anchor: "" })], opts)).toBeNull();
    expect(
      pickActiveAnchor([row({ anchor: "calendar.gcalCard", date: "" })], opts),
    ).toBeNull();
  });

  it("fix 단건은 대상 아님, 그룹에 feat 포함이면 fix 행의 anchor 도 유효 (feat 포함 그룹)", () => {
    const opts = { today: TODAY, anchors: ANCHORS };
    expect(
      pickActiveAnchor([row({ type: "fix", anchor: "calendar.gcalCard" })], opts),
    ).toBeNull();
    const r = pickActiveAnchor(
      [
        row({ pr: 490, type: "fix", milestone: "구글캘린더", anchor: "calendar.gcalCard" }),
        row({ pr: 489, type: "feat", milestone: "구글캘린더" }),
      ],
      opts,
    );
    expect(r?.pr).toBe(490);
  });
});
