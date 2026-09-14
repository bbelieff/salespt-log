/**
 * /admin/trainers 페이지 셸 회귀 가드.
 *
 * 2026-09-14 사고: 페이지가 컨테이너 없는 Fragment 였고 세 자식이 각자 다른 폭을
 * 들고 있어(초대 박스 max-w-3xl / 권한 편집기 폭 없음 / 관리 패널 max-w-3xl pc:max-w-5xl)
 * 본문 제목과 우측 버튼이 뷰포트 가장자리에서 잘렸다.
 *
 * 규칙: 폭·좌우패딩은 페이지 셸 한 곳에서만 정의한다. 자식 컴포넌트는 폭을 선언하지
 * 않는다. 단 TrainerMgmtPanel 의 sticky 헤더는 의도적 full-bleed 라 셸 밖에 둔다.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const classAttrs = (src: string) => [...src.matchAll(/className="([^"]*)"/g)].map(m => m[1] ?? "");

describe("admin trainers page shell", () => {
  it("페이지 셸이 폭·좌우패딩을 한 클래스에서 정의한다", () => {
    const hit = classAttrs(read("app/admin/trainers/page.tsx")).some(
      c => c.includes("max-w-3xl") && c.includes("pc:max-w-5xl") && c.includes("px-6"),
    );
    expect(hit).toBe(true);
  });

  it("TrainerMgmtPanel 은 셸 바깥에 렌더된다 (sticky full-bleed 보존)", () => {
    const page = read("app/admin/trainers/page.tsx");
    const panelAt = page.indexOf("<TrainerMgmtPanel");
    expect(panelAt).toBeGreaterThan(-1);
    // 셸 </div> 가 패널보다 먼저 닫혀야 한다.
    const shellCloseBefore = page.lastIndexOf("</div>", panelAt);
    expect(shellCloseBefore).toBeGreaterThan(-1);
    expect(shellCloseBefore).toBeLessThan(panelAt);
  });

  it("TrainerInvites 루트가 폭을 다시 선언하지 않는다", () => {
    const m = read("components/auth/TrainerInvites.tsx").match(/<details\s+className="([^"]*)"/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toContain("mx-auto");
    expect(m![1]).not.toContain("max-w-");
  });

  it(".trainer-access 루트 규칙에 폭·여백을 박지 않는다", () => {
    const m = read("components/auth/TrainerAccessEditor.tsx").match(/\.trainer-access\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toMatch(/\bmax-width\s*:/);
    expect(m![1]).not.toMatch(/\bmargin\s*:/);
    expect(m![1]).not.toMatch(/\bpadding\s*:/);
  });

  it("TrainerAccessEditor 의 추가 CSS 규칙은 전부 .trainer-access 로 스코프된다", () => {
    const src = read("components/auth/TrainerAccessEditor.tsx");
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
      .filter(s => !s.startsWith("@media"))
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
});
