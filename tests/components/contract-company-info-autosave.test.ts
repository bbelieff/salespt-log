// @vitest-environment jsdom
/**
 * Payment 업체정보 자동저장 실제 경로 회귀.
 *
 * 문서 자동입력의 선택 patch와 직접 입력은 모두 CompanyInfoEditor(hideSave)
 * → onChange → useContractCompanyInfo(800ms POST)를 지난다. 모든 값은 합성값이며,
 * OCR·실제 문서·네트워크는 사용하지 않는다.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyInfo } from "@/types";
import CompanyInfoEditor from "@/components/CompanyInfoEditor";
import CompanyInfoContractSection from "@/components/CompanyInfoContractSection";
import { useContractCompanyInfo } from "@/app/(app)/payment/_components/useContractCompanyInfo";
import { CORP_CERT } from "../document-ocr/fixtures";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const ocrText = { value: CORP_CERT };
const runDocumentOcr = vi.fn(async (_file: File, opts?: { onProgress?: (p: unknown) => void }) => {
  opts?.onProgress?.({ stage: "recognizing", ratio: 1, message: "합성 OCR 완료" });
  return { text: ocrText.value, sourceKind: "ocr" as const };
});
vi.mock("@/lib/document-ocr/ocr-client", () => ({
  runDocumentOcr: (...a: unknown[]) => runDocumentOcr(...(a as [File])),
}));

type RequestBody = { 계약일: string; 업체명: string; 업체정보: CompanyInfo };
let root: Root | undefined;
let host: HTMLDivElement | undefined;
let stored = CompanyInfo.parse({});
let posts: RequestBody[] = [];
let failNextPost = false;
let deferFirstPost = false;
let resolveFirstPost: (() => void) | undefined;

const ok = () => ({ ok: true, json: async () => ({ ok: true }) });

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.startsWith("/api/company-info?") && (!init?.method || init.method === "GET")) {
    return { ok: true, json: async () => ({ 업체정보: stored }) };
  }
  if (url === "/api/company-info" && init?.method === "POST") {
    const body = JSON.parse(String(init.body)) as RequestBody;
    posts.push(body);
    if (failNextPost) {
      failNextPost = false;
      return { ok: false, json: async () => ({ error: "synthetic failure" }) };
    }
    if (deferFirstPost && posts.length === 1) {
      return new Promise((resolve) => {
        resolveFirstPost = () => {
          stored = body.업체정보;
          resolve(ok());
        };
      });
    }
    stored = body.업체정보;
    return ok();
  }
  throw new Error(`unexpected fetch: ${url}`);
});

function PaymentHarness() {
  const { onCiChange, ciState, flushCi } = useContractCompanyInfo(() => ({
    계약일: "2026-07-10",
    업체명: "합성상사",
  }));
  return h(
    React.Fragment,
    null,
    h(CompanyInfoEditor, {
      value: CompanyInfo.parse({}),
      identityKey: "contract-row:synthetic",
      txtCompanyName: "합성상사",
      hideSave: true,
      onChange: onCiChange,
      onSave: () => undefined,
    }),
    h("button", { type: "button", onClick: () => void flushCi(false) }, "합성 재시도"),
    h("output", { "data-testid": "save-state" }, ciState.error || (ciState.saving ? "saving" : "idle")),
  );
}

function render(node: React.ReactElement) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(node));
}

async function settle() {
  for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); });
}

async function advanceAutosave() {
  await act(async () => { await vi.advanceTimersByTimeAsync(800); });
  await settle();
}

function button(text: string) {
  const found = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
  if (!found) throw new Error(`button not found: ${text}`);
  return found as HTMLButtonElement;
}

function setInput(key: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`input[id$="-${key}"]`);
  if (!input) throw new Error(`input not found: ${key}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function uploadSyntheticCert() {
  await act(async () => button("문서로 자동입력").click());
  await act(async () => { await vi.dynamicImportSettled(); });
  await settle();
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("document input not found");
  Object.defineProperty(input, "files", {
    value: [new File([new Uint8Array([1, 2, 3])], "synthetic-cert.png", { type: "image/png" })],
    configurable: true,
  });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  await settle();
}

async function chooseExactlyThree() {
  const keep = new Set(["이름", "사업자등록번호", "개업일"]);
  const checks = [...document.querySelectorAll<HTMLInputElement>("table input[type=checkbox]")];
  for (const input of checks) {
    const label = document.querySelector(`label[for="${input.id}"]`)?.textContent ?? "";
    if (input.checked && !keep.has(label)) await act(async () => input.click());
  }
  await act(async () => button("선택 항목 적용").click());
  await settle();
}

async function remountAndRead() {
  await act(async () => root?.unmount());
  host?.remove();
  host = undefined;
  root = undefined;
  render(h(CompanyInfoContractSection, {
    계약일: "2026-07-10",
    업체명: "합성상사",
    identityKey: "contract-row:synthetic",
    hideSave: true,
  }));
  await settle();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  stored = CompanyInfo.parse({});
  posts = [];
  failNextPost = false;
  deferFirstPost = false;
  resolveFirstPost = undefined;
  fetchMock.mockClear();
  runDocumentOcr.mockClear();
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("payment CompanyInfo document/direct autosave", () => {
  it("문서에서 고른 세 칸과 같은 직접 입력은 각각 한 번의 800ms POST이고, 2xx 뒤 재조회도 남긴다", async () => {
    render(h(PaymentHarness));
    await uploadSyntheticCert();
    await chooseExactlyThree();
    await advanceAutosave();

    expect(runDocumentOcr).toHaveBeenCalledTimes(1);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.업체정보).toMatchObject({
      대표자이름: "홍길동",
      사업자등록번호: "123-45-67891",
      개업일: "19.07.15",
    });
    const documentPayload = posts[0]!.업체정보;

    await remountAndRead();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/company-info?계약일=2026-07-10&업체명=%ED%95%A9%EC%84%B1%EC%83%81%EC%82%AC",
    );
    for (const [key, value] of Object.entries({
      대표자이름: "홍길동",
      사업자등록번호: "123-45-67891",
      개업일: "19.07.15",
    })) {
      expect(document.querySelector<HTMLInputElement>(`input[id$="-${key}"]`)?.value).toBe(value);
    }

    await act(async () => root?.unmount());
    host?.remove();
    host = undefined;
    root = undefined;
    stored = CompanyInfo.parse({});
    posts = [];
    render(h(PaymentHarness));
    setInput("대표자이름", "홍길동");
    setInput("사업자등록번호", "123-45-67891");
    setInput("개업일", "19.07.15");
    await advanceAutosave();

    expect(posts).toHaveLength(1);
    expect(posts[0]!.업체정보).toEqual(documentPayload);
  }, 15_000);

  it("취소·OCR만 수행·선택 0개·무변경은 POST를 만들지 않는다", async () => {
    render(h(PaymentHarness));
    await uploadSyntheticCert();
    await act(async () => button("취소").click());
    await advanceAutosave();
    expect(posts).toHaveLength(0);

    await uploadSyntheticCert();
    const checks = [...document.querySelectorAll<HTMLInputElement>("table input[type=checkbox]")];
    for (const input of checks) if (input.checked) await act(async () => input.click());
    expect(button("선택 항목 적용").disabled).toBe(true);
    await advanceAutosave();
    expect(posts).toHaveLength(0);
  });

  it("빠른 연속 변경은 최신 payload 하나만 보내고, 실패 뒤 재시도는 최신 payload를 쓴다", async () => {
    render(h(PaymentHarness));
    setInput("사업자등록번호", "123-45-67891");
    setInput("사업자등록번호", "234-56-78902");
    await advanceAutosave();
    expect(posts).toHaveLength(1);
    expect(posts[0]!.업체정보.사업자등록번호).toBe("234-56-78902");

    failNextPost = true;
    setInput("사업자등록번호", "345-67-89013");
    await advanceAutosave();
    expect(posts).toHaveLength(2);
    expect(document.querySelector('[data-testid="save-state"]')?.textContent).toContain("저장하지 못했어요");
    setInput("사업자등록번호", "456-78-90124");
    await act(async () => button("합성 재시도").click());
    await settle();
    expect(posts).toHaveLength(3);
    expect(posts[2]!.업체정보.사업자등록번호).toBe("456-78-90124");
  });

  it("느린 첫 응답 뒤 최신 변경이 먼저 저장돼도, 늦은 첫 응답은 최신 재조회값을 되돌리지 않는다", async () => {
    deferFirstPost = true;
    render(h(PaymentHarness));
    setInput("사업자등록번호", "123-45-67891");
    await advanceAutosave();
    expect(posts).toHaveLength(1);
    setInput("사업자등록번호", "234-56-78902");
    await advanceAutosave();
    // 첫 요청이 비행 중이면 두 번째는 겹쳐 보내지 않는다.
    expect(posts).toHaveLength(1);

    await act(async () => resolveFirstPost?.());
    await settle();
    expect(posts).toHaveLength(2);
    expect(stored.사업자등록번호).toBe("234-56-78902");
    await remountAndRead();
    expect(document.querySelector<HTMLInputElement>('input[id$="-사업자등록번호"]')?.value).toBe("234-56-78902");
  });
});
