// @vitest-environment jsdom
/**
 * Scope C2 — CompanyInfoEditor 안정 신원(identityKey) 렌더 회귀.
 *
 * txtCompanyName 은 개명 시 바뀌는 표시명이라 자동 저장 라우팅 키로 쓰면
 * 빠른 대상 전환·개명 때 다른 레코드로 필드가 전송된다. useAutosave 를
 * 스텁해 전달된 target 을 직접 고정한다:
 *  ① identityKey 가 있으면 target.key 로 사용한다.
 *  ② 개명(txtCompanyName 변경)해도 identityKey 가 같으면 target 이 안 바뀐다.
 *  ③ identityKey 없으면 기존 폴백(txtCompanyName) — A 소유 호출자 무영향.
 *  ④ 일상 입력은 pending 과 무관하게 막히지 않는다.
 *
 * C3 추가 — CompanyInfoContractSection 실제 렌더:
 *  ⑤ 섹션은 identityKey 를 그대로 에디터에 전달한다(가변 업체명 미사용).
 *  ⑥ 개명(업체명 변경) 후에도 target 신원이 유지된다.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyInfo } from "@/types";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";
import CompanyInfoContractSection from "@/components/CompanyInfoContractSection";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const autoMocks = vi.hoisted(() => ({
  lastTarget: null as unknown,
  syncServer: vi.fn(),
  update: vi.fn(),
  stage: vi.fn(),
  commit: vi.fn(),
  retry: vi.fn(),
  undo: vi.fn(),
  flush: vi.fn(),
}));

vi.mock("@/components/autosave/useAutosave", () => ({
  useAutosave: (opts: { target: unknown; initial: unknown }) => {
    autoMocks.lastTarget = opts.target;
    return {
      draft: opts.initial,
      saved: opts.initial,
      status: "idle",
      error: "",
      dirty: false,
      savedAt: null,
      canUndo: false,
      update: autoMocks.update,
      stage: autoMocks.stage,
      commit: autoMocks.commit,
      syncServer: autoMocks.syncServer,
      retry: autoMocks.retry,
      flush: autoMocks.flush,
      undo: autoMocks.undo,
    };
  },
}));

let root: Root | undefined;
let el: HTMLDivElement | undefined;

const ci = () => CompanyInfo.parse({ 대표자이름: "홍길동" });

function renderEditor(props: {
  txtCompanyName?: string;
  identityKey?: string;
}) {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  act(() => {
    root?.render(
      h(CompanyInfoEditor, {
        value: ci(),
        onSave: () => undefined,
        txtCompanyName: props.txtCompanyName,
        identityKey: props.identityKey,
      }),
    );
  });
}

function rerenderEditor(props: { txtCompanyName?: string; identityKey?: string }) {
  act(() => {
    root?.render(
      h(CompanyInfoEditor, {
        value: ci(),
        onSave: () => undefined,
        txtCompanyName: props.txtCompanyName,
        identityKey: props.identityKey,
      }),
    );
  });
}

function toggleOpen() {
  const btn = [...el!.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("업체정보"),
  );
  if (!btn) throw new Error("editor toggle is missing");
  act(() => {
    btn.click();
  });
}

afterEach(() => {
  act(() => root?.unmount());
  el?.remove();
  root = undefined;
  el = undefined;
  vi.clearAllMocks();
});

describe("CompanyInfoEditor identity", () => {
  it("uses identityKey for the autosave target when provided", () => {
    renderEditor({ txtCompanyName: "가나상사", identityKey: "meeting-m1" });
    expect(autoMocks.lastTarget).toEqual({
      kind: "company-info",
      key: "meeting-m1",
    });
  });

  it("keeps the target across a rename while identityKey is stable", () => {
    renderEditor({ txtCompanyName: "가나상사", identityKey: "meeting-m1" });
    rerenderEditor({ txtCompanyName: "다라상사", identityKey: "meeting-m1" });
    expect(autoMocks.lastTarget).toEqual({
      kind: "company-info",
      key: "meeting-m1",
    });
  });

  it("falls back to txtCompanyName without identityKey (existing callers unchanged)", () => {
    renderEditor({ txtCompanyName: "가나상사" });
    expect(autoMocks.lastTarget).toEqual({
      kind: "company-info",
      key: "가나상사",
    });
  });

  it("never disables routine inputs", () => {
    renderEditor({ txtCompanyName: "가나상사", identityKey: "meeting-m1" });
    toggleOpen();
    const inputs = [...el!.querySelectorAll("input, textarea")];
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect((input as HTMLInputElement).disabled).toBe(false);
    }
  });
});

describe("CompanyInfoContractSection stable identity (C3)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function renderSection(업체명: string) {
    el = document.createElement("div");
    document.body.append(el);
    root = createRoot(el);
    await act(async () => {
      root?.render(
        h(CompanyInfoContractSection, {
          계약일: "2026-07-10",
          업체명,
          hideSave: true,
          identityKey: "contract-row:7",
        }),
      );
      await Promise.resolve();
    });
    // fetch effect + loaded 상태 반영을 플러시한다.
    await act(async () => {
      await Promise.resolve();
    });
  }

  it("routes the editor by identityKey, never the mutable company name", async () => {
    await renderSection("가나상사");
    expect(autoMocks.lastTarget).toEqual({
      kind: "company-info",
      key: "contract-row:7",
    });
  });

  it("keeps the identity when the company is renamed", async () => {
    await renderSection("가나상사");
    await act(async () => {
      root?.render(
        h(CompanyInfoContractSection, {
          계약일: "2026-07-10",
          업체명: "다라상사",
          hideSave: true,
          identityKey: "contract-row:7",
        }),
      );
      await Promise.resolve();
    });
    expect(autoMocks.lastTarget).toEqual({
      kind: "company-info",
      key: "contract-row:7",
    });
  });
});
