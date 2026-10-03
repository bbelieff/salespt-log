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
let getHandler: ((url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>) | undefined;

const ok = () => ({ ok: true, json: async () => ({ ok: true }) });

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.startsWith("/api/company-info?") && (!init?.method || init.method === "GET")) {
    if (getHandler) return getHandler(url);
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

const SYNTHETIC_TARGET = { 계약일: "2026-07-10", 업체명: "합성상사" };

function PaymentHarness({ target = SYNTHETIC_TARGET }: { target?: typeof SYNTHETIC_TARGET }) {
  const { onCiChange, ciDraft, ciState, flushCi } = useContractCompanyInfo(target);
  return h(
    React.Fragment,
    null,
    h(CompanyInfoEditor, {
      value: ciDraft ?? CompanyInfo.parse({}),
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
  getHandler = undefined;
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

  it("디바운스 중 상세가 언마운트돼도 마지막 입력을 즉시 저장한다", async () => {
    render(h(PaymentHarness));
    setInput("대표자이름", "최종값");
    await act(async () => root?.unmount());
    await settle();
    expect(posts).toHaveLength(1);
    expect(posts[0]!.업체정보.대표자이름).toBe("최종값");
  });

  it("첫 저장 비행 중 마지막 입력 뒤 언마운트돼도 직렬로 마지막 값을 저장한다", async () => {
    deferFirstPost = true;
    render(h(PaymentHarness));
    setInput("대표자이름", "첫값");
    await advanceAutosave();
    setInput("대표자이름", "최종값");
    await act(async () => root?.unmount());
    await act(async () => resolveFirstPost?.());
    await settle();
    expect(posts).toHaveLength(2);
    expect(posts[1]!.업체정보.대표자이름).toBe("최종값");
  });

  it("cleanup 저장 중 같은 계약을 즉시 다시 열어도 POST를 중복하지 않고 상태가 수렴한다", async () => {
    deferFirstPost = true;
    render(h(PaymentHarness));
    setInput("대표자이름", "재열기 값");
    await act(async () => root?.unmount());
    await settle();
    expect(posts).toHaveLength(1);

    host?.remove();
    host = undefined;
    root = undefined;
    render(h(PaymentHarness));
    expect(document.querySelector('[data-testid="save-state"]')?.textContent).toBe("saving");
    await act(async () => resolveFirstPost?.());
    await settle();
    expect(posts).toHaveLength(1);
    expect(stored.대표자이름).toBe("재열기 값");
    expect(document.querySelector('[data-testid="save-state"]')?.textContent).toBe("idle");
  });

  it("편집 뒤 대상 prop이 바뀌어도 초안은 편집 시점 계약에만 저장한다", async () => {
    const original = { 계약일: "2026-07-10", 업체명: "원계약" };
    const next = { 계약일: "2026-07-11", 업체명: "다음계약" };
    render(h(PaymentHarness, { target: original }));
    setInput("대표자이름", "원계약 값");
    await act(async () => root?.render(h(PaymentHarness, { target: next })));
    await advanceAutosave();
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject(original);
    expect(posts[0]!.업체정보.대표자이름).toBe("원계약 값");
  });

  it("GET 실패를 빈 업체정보 성공으로 보이지 않고, 명시적 재시도로 복구한다", async () => {
    let attempt = 0;
    getHandler = async () => {
      attempt += 1;
      if (attempt === 1) return { ok: false, json: async () => ({ error: "synthetic GET failure" }) };
      return { ok: true, json: async () => ({ 업체정보: CompanyInfo.parse({ 대표자이름: "복구값" }) }) };
    };
    render(h(CompanyInfoContractSection, {
      계약일: "2026-07-10",
      업체명: "합성상사",
      identityKey: "contract-row:synthetic",
      hideSave: true,
    }));
    await settle();
    expect(document.body.textContent).toContain("업체정보를 불러오지 못했어요");
    expect(document.querySelector('input[id$="-대표자이름"]')).toBeNull();
    await act(async () => button("다시 시도").click());
    await settle();
    expect(document.querySelector<HTMLInputElement>('input[id$="-대표자이름"]')?.value).toBe("복구값");
  });

  it("언마운트 flush가 실패해도 같은 계약을 다시 열면 초안을 복구해 재시도한다", async () => {
    failNextPost = true;
    render(h(PaymentHarness));
    setInput("대표자이름", "복구할 최종값");
    await act(async () => root?.unmount());
    await settle();
    expect(posts).toHaveLength(1);
    expect(stored.대표자이름).toBe("");

    host?.remove();
    host = undefined;
    root = undefined;
    render(h(PaymentHarness));
    expect(document.querySelector<HTMLInputElement>('input[id$="-대표자이름"]')?.value).toBe("복구할 최종값");
    expect(document.querySelector('[data-testid="save-state"]')?.textContent).toContain("다시 시도");
    await act(async () => button("합성 재시도").click());
    await settle();
    expect(posts).toHaveLength(2);
    expect(stored.대표자이름).toBe("복구할 최종값");
  });

  it("단독 편집기의 비-2xx 저장은 성공 표시 없이 입력을 유지하고 재시도한다", async () => {
    failNextPost = true;
    render(h(CompanyInfoContractSection, {
      계약일: "2026-07-10",
      업체명: "합성상사",
      identityKey: "contract-row:standalone",
    }));
    await settle();
    const header = document.querySelector<HTMLButtonElement>("[data-company-info-header] > button");
    if (!header) throw new Error("company info header not found");
    await act(async () => header.click());
    setInput("대표자이름", "실패 뒤 유지값");
    await advanceAutosave();
    expect(posts).toHaveLength(1);
    expect(stored.대표자이름).toBe("");
    expect(document.body.textContent).toContain("저장 실패");
    expect(document.querySelector<HTMLInputElement>('input[id$="-대표자이름"]')?.value).toBe("실패 뒤 유지값");
    await act(async () => button("다시 시도").click());
    await settle();
    expect(posts).toHaveLength(2);
    expect(stored.대표자이름).toBe("실패 뒤 유지값");
  });

  it("이전 계약의 늦은 GET 응답이 새 계약 값을 덮지 않는다", async () => {
    let resolveOld: ((value: { ok: boolean; json: () => Promise<unknown> }) => void) | undefined;
    getHandler = async (url) => {
      if (url.includes(encodeURIComponent("이전계약"))) {
        return new Promise((resolve) => { resolveOld = resolve; });
      }
      return { ok: true, json: async () => ({ 업체정보: CompanyInfo.parse({ 대표자이름: "새값" }) }) };
    };
    render(h(CompanyInfoContractSection, {
      계약일: "2026-07-10", 업체명: "이전계약", identityKey: "contract-row:1", hideSave: true,
    }));
    await act(async () => root?.render(h(CompanyInfoContractSection, {
      계약일: "2026-07-11", 업체명: "새계약", identityKey: "contract-row:2", hideSave: true,
    })));
    await settle();
    expect(document.querySelector<HTMLInputElement>('input[id$="-대표자이름"]')?.value).toBe("새값");
    await act(async () => resolveOld?.({
      ok: true,
      json: async () => ({ 업체정보: CompanyInfo.parse({ 대표자이름: "늦은 이전값" }) }),
    }));
    await settle();
    expect(document.querySelector<HTMLInputElement>('input[id$="-대표자이름"]')?.value).toBe("새값");
  });
});
