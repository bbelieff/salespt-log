/**
 * /admin/trainers 페이지 셸 회귀 가드.
 *
 * 2026-09-14 사고 ①: 페이지가 컨테이너 없는 Fragment 였고 세 자식이 각자 다른 폭을
 * 들고 있어 본문 제목과 우측 버튼이 뷰포트 가장자리에서 잘렸다.
 *
 * 2026-09-14 사고 ②: 그 수리가 셸을 만들었지만 «셸 + 패널» 두 덩어리로 나뉘어,
 * 패널이 소유한 sticky 헤더가 페이지 중간에 놓이고 초대·권한 카드가 그 헤더보다
 * «위» 에 떴다. 사용자가 "헤더 아래로 정렬되어야 함" 으로 지적.
 *
 * 현재 계약: 페이지는 TrainerMgmtPanel 단일 루트다. 헤더는 패널이 소유하고 페이지
 * 최상단에 하나뿐이며, 모든 섹션은 그 아래 같은 셸 폭 안에 들어간다. 자식 컴포넌트는
 * 폭을 선언하지 않는다.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const classAttrs = (src: string) => [...src.matchAll(/className="([^"]*)"/g)].map(m => m[1] ?? "");

describe("admin trainers page shell", () => {
  it("페이지는 TrainerMgmtPanel 단일 루트다 — 헤더 밖에 뜨는 형제가 없다", () => {
    const page = read("app/admin/trainers/page.tsx");
    const body = page.slice(page.indexOf("return ("));
    // return 직후 첫 엘리먼트가 패널이어야 한다. Fragment(<>)로 감싸 형제를 두면
    // 그 형제가 패널의 sticky 헤더보다 «위» 에 렌더돼 사고 ② 가 재발한다.
    expect(body).toMatch(/return\s*\(\s*<TrainerMgmtPanel/);
    expect(body).not.toMatch(/return\s*\(\s*<>/);
  });

  it("셸 폭은 TrainerMgmtPanel 한 곳에서만 정의한다", () => {
    // 페이지는 폭을 선언하지 않는다 — 패널이 유일한 소유자.
    const pageWidths = classAttrs(read("app/admin/trainers/page.tsx")).filter(
      c => c.includes("max-w-") || c.includes("mx-auto"),
    );
    expect(pageWidths).toEqual([]);
    const hit = classAttrs(read("components/auth/TrainerMgmtPanel.tsx")).some(
      c => c.includes("max-w-3xl") && c.includes("pc:max-w-5xl") && c.includes("px-6"),
    );
    expect(hit).toBe(true);
  });

  it("헤더는 페이지에 하나뿐이고 모든 섹션이 그 아래에 온다", () => {
    const src = read("components/auth/TrainerMgmtPanel.tsx");
    expect([...src.matchAll(/<header/g)]).toHaveLength(1);
    const headerAt = src.indexOf("<header");
    const headerEnd = src.indexOf("</header>");
    // 섹션·슬롯이 전부 </header> 뒤에 있어야 한다.
    for (const marker of ["{accessSlot}", "{inviteSlot}", "<SectionAssign", "<SectionPending", "<SectionTraineeList", "<SectionManagement"]) {
      const at = src.indexOf(marker);
      expect(at, `${marker} 가 없다`).toBeGreaterThan(-1);
      expect(at, `${marker} 가 헤더보다 위에 있다`).toBeGreaterThan(headerEnd);
    }
    expect(headerAt).toBeGreaterThan(-1);
  });

  it("섹션 순서 — 담당부여 → 권한부여 → 요청관리 → 초대관리 → 수강생명단 → 관리부서", () => {
    // 2026-09-14 belie 가 직접 지정한 순서. 바꾸려면 사용자 확인이 필요하다.
    const src = read("components/auth/TrainerMgmtPanel.tsx");
    const order = [
      "<SectionAssign",
      "{accessSlot}",
      "<SectionPending",
      "{inviteSlot}",
      "<SectionTraineeList",
      "<SectionManagement",
    ].map(m => ({ m, at: src.indexOf(m) }));
    expect(order.filter(o => o.at < 0)).toEqual([]);
    const positions = order.map(o => o.at);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("TrainerInvites 루트가 폭을 다시 선언하지 않는다", () => {
    const m = read("components/auth/TrainerInvites.tsx").match(/<details\s+className="([^"]*)"/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toContain("mx-auto");
    expect(m![1]).not.toContain("max-w-");
  });

  it(".trainer-access 루트 규칙에 폭·여백을 박지 않는다", () => {
    const m = read("components/auth/TrainerAccessEditor.styles.ts").match(/\.trainer-access\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toMatch(/\bmax-width\s*:/);
    expect(m![1]).not.toMatch(/\bmargin\s*:/);
    expect(m![1]).not.toMatch(/\bpadding\s*:/);
  });

  it("TrainerAccessEditor 의 추가 CSS 규칙은 전부 .trainer-access 로 스코프된다", () => {
    const src = read("components/auth/TrainerAccessEditor.styles.ts");
    const open = src.indexOf("const editorStyles = `");
    expect(open).toBeGreaterThan(-1);
    const styles = src
      .slice(src.indexOf("`", open) + 1, src.indexOf("`;", open))
      .replace(/\/\*[\s\S]*?\*\//g, ""); // 주석 제거
    // 괄호(:is(a,b)) 안의 콤마는 분리하지 않는다.
    const splitGroups = (sel: string) => {
      const out: string[] = [];
      let depth = 0, buf = "";
      for (const ch of sel) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        if (ch === "," && depth === 0) { out.push(buf); buf = ""; continue; }
        buf += ch;
      }
      return [...out, buf];
    };
    const leaked = [...styles.matchAll(/([^{}]+)\{/g)]
      .map(m => (m[1] ?? "").trim())
      .filter(s => !s.startsWith("@media") && !s.startsWith("@container"))
      .flatMap(splitGroups)
      .map(s => s.trim())
      .filter(s => s && !s.startsWith(".trainer-access"));
    expect(leaked).toEqual([]);
  });

  it("TrainerMgmtPanel 이 기준 규격(sticky + max-w-3xl pc:max-w-5xl)을 유지한다", () => {
    const src = read("components/auth/TrainerMgmtPanel.tsx");
    expect(src).toContain("sticky");
    const hit = classAttrs(src).some(c => c.includes("max-w-3xl") && c.includes("pc:max-w-5xl"));
    expect(hit).toBe(true);
  });

  it("초대 목록은 취소·만료를 화면에서 거르되 revoke 는 DB 행을 지우지 않는다", () => {
    // 2026-09-14 belie: "DB 기록 자체는 남기고 화면에서만".
    const src = read("components/auth/TrainerInvites.tsx");
    // 화면 필터가 있다 — revoked_at / 만료를 뺀 live 목록을 렌더한다.
    expect(src).toMatch(/const\s+live\s*=\s*invites\.filter/);
    expect(src).toMatch(/live\.map\(/);
    expect(src).not.toMatch(/\binvites\.map\(/);
    // revoke 는 여전히 action:"revoke" 만 보낸다 — delete/purge 가 아니다.
    expect(src).toMatch(/action:\s*"revoke"/);
    expect(src).not.toMatch(/action:\s*"(delete|purge|remove)"/);
  });
});
