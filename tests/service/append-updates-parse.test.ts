/**
 * append-updates parseCommit — Changelog/Group/Done 추출 (announcement-popup §2·§7).
 * 핵심: 그룹 PR 은 visible=FALSE 적재(반쪽 기능 가드), Done 줄 감지.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error — 배포 스크립트(.mjs, 타입 선언 없음)의 순수 파서를 직접 검증
import { parseCommit } from "../../scripts/append-updates.mjs";

describe("parseCommit (grouped-updates)", () => {
  it("Changelog + Group → milestone 적재용 group + visible=FALSE", () => {
    const r = parseCommit(
      "2026-06-11",
      "fix(contact): 미팅예약+1 신규 카드에 업체정보 연결 (#358)",
      "본문\n\nChangelog: 컨택관리에서 미팅을 잡으면서 업체정보를 바로 적을 수 있어요.\nChangelog-Group: 업체정보\n",
    );
    expect(r.pr).toBe(358);
    expect(r.titleUser).toContain("바로 적을 수 있어요");
    expect(r.group).toBe("업체정보");
    expect(r.visible).toBe("FALSE"); // 그룹 = 숨김 적재
    expect(r.done).toBe(false);
  });

  it("Changelog-Done 감지 (그룹 마지막 PR)", () => {
    const r = parseCommit(
      "2026-06-12",
      "feat(updates): 보관함 (#360)",
      "Changelog: 지난 업데이트를 모아 볼 수 있어요.\nChangelog-Group: 새소식\nChangelog-Done\n",
    );
    expect(r.group).toBe("새소식");
    expect(r.done).toBe(true);
  });

  it("그룹 없는 feat/fix 는 기존대로 TRUE", () => {
    const r = parseCommit("2026-06-11", "feat(payment): 검색 (#356)", "Changelog: 찾을 수 있어요.");
    expect(r.group).toBe("");
    expect(r.visible).toBe("TRUE");
  });

  it("사용자 Changelog 없는 fix(내부전용) → FALSE (P15 기본 노출 규칙)", () => {
    const r = parseCommit(
      "2026-06-14",
      "fix(claim): 레지스트리 append 컬럼 밀림 수정 (#376)",
      "본문만 있고 사용자용 Changelog 줄 없음(내부 수정)",
    );
    expect(r.type).toBe("fix");
    expect(r.visible).toBe("FALSE");
  });

  it("Changelog 있는 fix → TRUE (P15)", () => {
    const r = parseCommit("2026-06-14", "fix(x): y (#1)", "Changelog: 더 좋아졌어요.");
    expect(r.visible).toBe("TRUE");
  });

  it("docs 는 FALSE + 깨진 제목(@)은 본문 첫 줄 fallback", () => {
    const r = parseCommit("2026-06-10", "@ (#349)", "docs(plan): 새소식 팝업 플랜 등재 (SoR)\n\n내용");
    expect(r.pr).toBe(349);
    expect(r.type).toBe("docs");
    expect(r.visible).toBe("FALSE");
  });
});
