// @vitest-environment jsdom
/**
 * MeetingLinkDialog — 영업기록 연결 전 비교 팝업(contract-meeting-link, 2026-09-29). 합성 데이터만.
 * 최근 저장 쪽을 기본으로 고르고, 칸마다 바꾼 선택이 연결 요청에 그대로 실린다.
 */
import * as React from "react";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  preview: vi.fn(),
  mutation: { mutateAsync: vi.fn(async () => ({ ok: true, row: 7, failures: [] })), isPending: false, error: null },
}));
vi.mock("@/query/contract-link-hooks", () => ({
  fetchMeetingLinkPreview: (...a: unknown[]) => hooks.preview(...a),
  useLinkMeeting: () => hooks.mutation,
}));

import MeetingLinkDialog from "@/components/payment/MeetingLinkDialog";

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
let el: HTMLDivElement | undefined;
afterEach(() => { act(() => root?.unmount()); el?.remove(); root = undefined; el = undefined; });
beforeEach(() => {
  hooks.mutation.mutateAsync.mockClear();
  hooks.preview.mockResolvedValue({
    contract: { row: 7, 계약일: "2026-09-01", 업체명: "예시상사", 수임비: 1_000_000, 업체정보: { 업태: "제조", 소재지: "" } },
    meeting: { id: "m1", 미팅날짜: "2026-09-05", 업체명: "예시상사", 상태: "완료", 수임비: 1_500_000, 업체정보: { 업태: "도매", 소재지: "서울" } },
    updatedAt: { contract: "2026-09-10T00:00:00.000Z", contractInfo: "2026-09-10T00:00:00.000Z", meeting: "2026-09-20T00:00:00.000Z" },
  });
});

async function render(props: Partial<React.ComponentProps<typeof MeetingLinkDialog>> = {}) {
  el = document.createElement("div"); document.body.append(el); root = createRoot(el);
  const onLinked = vi.fn();
  await act(async () => {
    root?.render(h(MeetingLinkDialog, { row: 7, meetingId: "m1", onClose: vi.fn(), onLinked, ...props }));
  });
  return { node: el, onLinked };
}
const radio = (node: Element, name: string, idx: number) =>
  node.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)[idx]!;
const clickText = async (node: Element, text: string) => {
  const b = [...node.querySelectorAll("button")].find((x) => x.textContent === text)!;
  await act(async () => { b.click(); });
};

describe("MeetingLinkDialog", () => {
  it("영업기록이 더 최근이면 수임비·업체정보 기본값이 영업기록 쪽, 빈 칸은 채운다", async () => {
    const { node, onLinked } = await render();
    expect(node.textContent).toContain("2026.09.01");
    expect(node.textContent).toContain("2026.09.05");
    expect(radio(node, "link-fee", 1).checked).toBe(true); // meeting
    expect(radio(node, "link-info-업태", 1).checked).toBe(true);
    await clickText(node, "연결하기");
    expect(hooks.mutation.mutateAsync).toHaveBeenCalledWith({
      row: 7, meetingId: "m1", 업체명: "예시상사", 수임비: 1_500_000, 업체정보: { 업태: "도매", 소재지: "서울" },
    });
    expect(onLinked).toHaveBeenCalledWith([]);
  });

  it("칸마다 고른 쪽이 연결 요청에 실린다", async () => {
    const { node } = await render();
    await act(async () => { radio(node, "link-info-업태", 0).click(); radio(node, "link-fee", 0).click(); });
    await clickText(node, "연결하기");
    expect(hooks.mutation.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      수임비: 1_000_000, 업체정보: { 업태: "제조", 소재지: "서울" },
    }));
  });

  it("일정·계약 진입이면 [따로 등록] 을 보여 준다", async () => {
    const onSkip = vi.fn();
    const { node } = await render({ onSkip });
    await clickText(node, "따로 등록");
    expect(onSkip).toHaveBeenCalled();
    expect(hooks.mutation.mutateAsync).not.toHaveBeenCalled();
  });
});
