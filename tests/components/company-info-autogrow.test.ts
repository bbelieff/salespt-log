// @vitest-environment jsdom
/** 업체정보 여러 줄 칸(기대출 개인·사업자 대출·기타메모)은 내용이 늘면 높이가 따라 늘어난다 (2026-11-17 belie). */
import * as React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import CompanyInfoField from "@/components/company-info/CompanyInfoField";
import type { FieldDef } from "@/components/company-info-defs";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => vi.restoreAllMocks());

it("값이 길어지면 내용 높이(scrollHeight)에 맞춰 늘어나고, 한 줄 칸은 건드리지 않는다", () => {
  // 합성 측정값: 글자 60자마다 한 줄(20px) — 줄바꿈 없이 길게 적어도 접힌 줄만큼 늘어야 한다.
  vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLTextAreaElement) { return Math.max(2, Math.ceil(this.value.length / 60)) * 20; });
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const def = (k: string, multi?: boolean) => [k, k, k, 2, multi] as unknown as FieldDef;
  const draw = (value: string) => React.act(() => root.render(React.createElement(React.Fragment, null,
    React.createElement(CompanyInfoField, { def: def("기대출개인", true), value, onChange: () => {}, id: "a" }),
    React.createElement(CompanyInfoField, { def: def("개업일"), value: "25.01.24", onChange: () => {}, id: "b" }))));
  draw("캐피탈 38백만");
  const area = host.querySelector("textarea")!;
  expect(area.style.height).toBe("40px");
  expect(area.className).toContain("overflow-hidden");
  draw("가".repeat(300)); // 줄바꿈 없는 긴 글 → 5줄
  expect(area.style.height).toBe("100px");
  draw("짧게");
  expect(area.style.height).toBe("40px"); // 지우면 다시 줄어든다
  expect((host.querySelector("#b") as HTMLInputElement).style.height).toBe("");
  React.act(() => root.unmount()); host.remove();
});
