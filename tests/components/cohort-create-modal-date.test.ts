// @vitest-environment jsdom
/**
 * CohortCreateModal 수강시작일 회귀 (사고 2회 — 연습용2 · 10기 6명).
 *
 * 사고: 폼 자체는 정상 controlled input 이었다. 그런데 **자동화(브라우저 조작)가 date input 의
 * DOM `.value` 를 직접 세팅**하면 React onChange 가 발화하지 않아 state 는 빈 채로 제출된다
 * → 서버가 "날짜 없음 → 시트 값 유지" 경로를 타고 템플릿(0605=8기 사본)의 O1/B3 이 새 시트에
 * 그대로 남는다 → 개막 후 전 지표 0 + 잘못된 기수 표시.
 *
 * 여기서 고정하는 계약:
 *  ① state 가 비어도 input 의 DOM value 를 폴백으로 읽어 **서버에 전달**한다.
 *  ② 폴백으로 찾은 값은 화면 state 에도 반영한다 (보이는 값 = 보낸 값).
 *  ③ 날짜가 정말 없으면 첫 [실행]은 **경고만 띄우고 전송하지 않는다**(확인 1회).
 *  ④ 응답 dates[] 의 미기록 건은 시트 실측값(O1/O2/B3)과 함께 화면에 뜬다.
 */
import * as React from "react";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import CohortCreateModal from "@/components/auth/CohortCreateModal";

// jsdom + React 18 act 환경 (tests/components/date-input-picker.test.ts 와 동일 패턴)
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const TEMPLATE_RESIDUE = { o1: "2026-06-12", o2: "=O1+50", b3: "8", c3: "" };

/** React onChange 를 정상 발화시키는 입력 (사람이 타이핑한 경우). */
function typeInto(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function click(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** 모달을 열고 토큰·참가자까지 채운 상태로 반환. */
function openModal() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(CohortCreateModal));
  });
  const openBtn = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("기수/참가자 추가"),
  )!;
  click(openBtn);

  const q = <T extends Element>(sel: string) => host.querySelector<T>(sel)!;
  const runBtn = () =>
    [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === "실행")!;

  typeInto(q<HTMLInputElement>('input[placeholder^="예: 8"]'), "10");
  typeInto(q<HTMLTextAreaElement>("textarea"), "김도연");

  return {
    host,
    dateInput: () => q<HTMLInputElement>('input[type="date"]'),
    runBtn,
    text: () => host.textContent ?? "",
  };
}

function mockFetchOk(body: Record<string, unknown>) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, created: [], skipped: [], failed: [], pending: [], ...body }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** 마지막 fetch 호출의 JSON body. */
function sentBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const init = fetchMock.mock.calls.at(-1)![1] as RequestInit;
  return JSON.parse(String(init.body));
}

beforeEach(() => {
  document.body.innerHTML = "";
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CohortCreateModal — 수강시작일 전달 보장", () => {
  it("사람이 고른 날짜는 그대로 전송된다 (기존 동작 불변)", async () => {
    const fetchMock = mockFetchOk({ created: [{ name: "김도연", sheetId: "s1" }] });
    const m = openModal();

    typeInto(m.dateInput(), "2026-08-07");
    await act(async () => {
      click(m.runBtn());
    });

    expect(sentBody(fetchMock).courseStartISO).toBe("2026-08-07");
  });

  it("★자동화가 DOM value 만 세팅해 onChange 가 안 떠도 서버에 전달된다 (ref 폴백)", async () => {
    const fetchMock = mockFetchOk({ created: [{ name: "김도연", sheetId: "s1" }] });
    const m = openModal();
    const date = m.dateInput();

    // 자동화가 하는 그대로 — React tracker 를 우회하지 않는 **평범한 대입**. onChange 미발화.
    date.value = "2026-08-07";
    expect(date.value).toBe("2026-08-07");

    await act(async () => {
      click(m.runBtn());
    });

    // ① 서버에 전달됐다 (예전에는 undefined 로 나가 "날짜 없음" 경로를 탔다)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBody(fetchMock).courseStartISO).toBe("2026-08-07");
    // ② 화면에도 반영됐다 — 보이는 값 = 보낸 값
    expect(m.dateInput().value).toBe("2026-08-07");
  });

  it("★날짜가 정말 없으면 첫 [실행]은 전송하지 않고 경고만 띄운다", async () => {
    const fetchMock = mockFetchOk({});
    const m = openModal();

    await act(async () => {
      click(m.runBtn());
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(m.text()).toContain("수강시작일이 비어 있어요");
    expect(m.text()).toContain("템플릿(이전 기수)의 날짜");
  });

  it("경고 후 한 번 더 누르면 날짜 없이 진행된다 (막지는 않는다)", async () => {
    const fetchMock = mockFetchOk({ created: [{ name: "김도연", sheetId: "s1" }] });
    const m = openModal();

    await act(async () => {
      click(m.runBtn());
    });
    await act(async () => {
      click(m.runBtn());
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBody(fetchMock).courseStartISO).toBeUndefined();
  });

  it("경고 후 날짜를 넣으면 확인이 해제되고 바로 전송된다", async () => {
    const fetchMock = mockFetchOk({ created: [{ name: "김도연", sheetId: "s1" }] });
    const m = openModal();

    await act(async () => {
      click(m.runBtn());
    });
    typeInto(m.dateInput(), "2026-08-07");
    expect(m.text()).not.toContain("수강시작일이 비어 있어요");

    await act(async () => {
      click(m.runBtn());
    });
    expect(sentBody(fetchMock).courseStartISO).toBe("2026-08-07");
  });
});

describe("CohortCreateModal — 결과 리포트 가시화", () => {
  it("★날짜 미기록이면 시트에 실제로 남은 O1/O2/B3 이 화면에 뜬다", async () => {
    mockFetchOk({
      created: [{ name: "김도연", sheetId: "s1" }],
      dates: [
        {
          name: "김도연",
          status: "no_input",
          written: [],
          courseStartISO: "",
          graduationISO: "",
          sheet: TEMPLATE_RESIDUE,
        },
      ],
    });
    const m = openModal();

    await act(async () => {
      click(m.runBtn());
    });
    await act(async () => {
      click(m.runBtn());
    });

    const text = m.text();
    expect(text).toContain("수강시작일이 기록되지 않았어요");
    expect(text).toContain("2026-06-12"); // 템플릿 잔재 O1 — 운영자가 즉시 알아본다
    expect(text).toContain("=O1+50"); // O2 는 수식으로 보여야 "템플릿에서 딸려온 것"이 드러난다
    expect(text).toContain("김도연");
  });

  it("정상 기록이면 초록으로 기록된 날짜를 확인시켜 준다", async () => {
    mockFetchOk({
      created: [{ name: "김도연", sheetId: "s1" }],
      dates: [
        {
          name: "김도연",
          status: "written",
          written: ["O1", "O2"],
          courseStartISO: "2026-08-07",
          graduationISO: "2026-09-26",
        },
      ],
    });
    const m = openModal();

    typeInto(m.dateInput(), "2026-08-07");
    await act(async () => {
      click(m.runBtn());
    });

    const text = m.text();
    expect(text).toContain("수강시작일 기록");
    expect(text).toContain("2026-08-07");
    expect(text).toContain("2026-09-26");
    expect(text).not.toContain("수강시작일이 기록되지 않았어요");
  });
});
