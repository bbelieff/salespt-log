/**
 * 사용 가이드 링크 — 회귀 가드.
 *
 * 2026-09-07 belie: 팝업의 「사용 가이드 보기」가 **오래된 노션**으로 가고 있었다.
 * 카페 게시판에 더 많고 최신인 자료가 이미 있고, **경영일지 사용자는 전원 카페 회원**이라
 * 가입 벽이 없다 → 목적지를 카페로 옮겼다.
 *
 * 함께 바꾼 것: 주소를 env(`NEXT_PUBLIC_GUIDE_URL`, VPS 에만 있음) 에서 **코드**로 내렸다.
 * `NEXT_PUBLIC_*` 은 빌드 타임에 박히므로 env 로 둬도 재배포가 필요하다 — env 의 이점이
 * 없으면서 바꾸려면 서버 접근이 필요했다. 이제 PR 한 줄로 바뀌고 이력이 남는다.
 */
import { describe, expect, it, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { GUIDE_URL } from "@/config/links";
import { guideUrl } from "@/config";

const original = process.env.NEXT_PUBLIC_GUIDE_URL;
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_GUIDE_URL;
  else process.env.NEXT_PUBLIC_GUIDE_URL = original;
});

describe("사용 가이드 목적지", () => {
  it("★카페 게시판을 가리킨다", () => {
    expect(GUIDE_URL).toContain("cafe.naver.com");
    expect(GUIDE_URL).toMatch(/^https:\/\//);
  });

  it("★노션 가이드는 더 이상 기본값이 아니다", () => {
    expect(GUIDE_URL).not.toContain("notion.site");
  });

  it("env 가 비어도 버튼이 나온다 — 예전엔 env 없으면 버튼 자체가 사라졌다", () => {
    delete process.env.NEXT_PUBLIC_GUIDE_URL;
    expect(guideUrl()).toBe(GUIDE_URL);
  });

  it("★VPS 에 남은 옛 env 가 이기지 못한다 — 코드가 유일한 정본", () => {
    // 2026-09-07: env 우선으로 뒀더니 VPS `.env` 의 옛 노션 주소가 조용히 이겨
    // 배포하고도 카페로 안 갔다. 그 회귀를 막는다.
    process.env.NEXT_PUBLIC_GUIDE_URL = "https://old.example.com/stale";
    expect(guideUrl()).toBe(GUIDE_URL);
  });

  it("★소스에 env 참조가 남아 있지 않다", () => {
    const cfg = readFileSync("lib/config/index.ts", "utf8");
    const at = cfg.indexOf("export const guideUrl");
    expect(cfg.slice(at, at + 200)).not.toContain("process.env");
  });

  it("세 곳이 같은 한 곳을 본다 — 팝업·새소식·상단 헤더", () => {
    for (const f of [
      "components/announcements/NoticePopup.tsx",
      "app/(app)/updates/page.tsx",
      "components/TopHeader.tsx",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src).toContain("guideUrl");
      expect(src).not.toContain("cafe.naver.com"); // 컴포넌트 하드코딩 금지
    }
  });

  it("새 탭으로 연다 — 카페로 나가도 앱이 닫히지 않게", () => {
    const popup = readFileSync("components/announcements/NoticePopup.tsx", "utf8");
    expect(popup).toContain('target="_blank"');
    expect(popup).toContain('rel="noopener noreferrer"');
  });
});
