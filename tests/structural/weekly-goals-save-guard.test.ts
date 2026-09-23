import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const editor = readFileSync(join(ROOT, "components/weekly-goals/WeeklyGoalEditor.tsx"), "utf8");
const internal = readFileSync(join(ROOT, "components/weekly-goals/GoalInternalEditor.tsx"), "utf8");

function bodyOf(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

describe("weekly-goals save guard split (no duplicate internal PUT)", () => {
  it("registers a public-only week-move guard while the button still chains internal", () => {
    const reg = editor.match(/useDirtyEntry\(\s*"weekly-goal-public"\s*,\s*dirty\s*,\s*(\w+)/);
    expect(reg?.[1]).toBe("savePublicGuard");
    const guardAll = bodyOf(editor, "savePublicGuard") + bodyOf(editor, "savePublicCore");
    expect(guardAll).not.toContain("internalSave.current");
    expect(bodyOf(editor, "save")).toContain("internalSave.current");
  });
  it("keeps internal CAS revision and its own guard entry", () => {
    expect(internal).toContain('useDirtyEntry("weekly-goal-internal"');
    expect(internal).toContain("revision: draft.revision");
    expect(internal).toContain("revision: result.revision");
  });
  it("keeps public CAS revision on the saved (not draft) value", () => {
    expect(bodyOf(editor, "savePublicCore")).toContain("revision: saved.revision");
  });
});
