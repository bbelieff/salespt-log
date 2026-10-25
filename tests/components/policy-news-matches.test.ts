/** 정책자금 데일리 「🎯 내 업체에 맞는 공고」(2026-10-26 4c) — 공고별로 맞는 업체, 담음 표시. 합성 데이터. */
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.stubGlobal("React", React);

const state = vi.hoisted(() => ({ grants: undefined as unknown, todos: [] as unknown[] }));
vi.mock("next/link", () => ({ default: (p: { href: string; children: unknown; className?: string }) => createElement("a", { href: p.href, className: p.className }, p.children as never) }));
vi.mock("@/query/grant-match-hooks", () => ({ useGrantMatches: () => ({ data: state.grants }) }));
vi.mock("@/query/todos-hooks", () => ({ useAllTodos: () => ({ data: { todos: state.todos } }) }));
vi.mock("@/query/contract-payment-hooks", () => ({ useContractPayments: () => ({ data: { rows: [{ row: 7, 계약일: "2026-10-01", 업체명: "가상정밀" }] } }) }));

import PolicyNewsMatches from "@/app/(app)/payment/news/PolicyNewsMatches";

const ann = (id: string, title: string) => ({ id, title, agency: "", regionText: "울산", maxAmount: "", deadlineText: "", deadlineDate: "", link: "", lastSeen: "2026-10-23" });
const m = (id: string) => ({ id, verdict: "match", reasons: [], urgent: false });

describe("PolicyNewsMatches", () => {
  it("공고별로 맞는 업체를 묶고, 담은 업체는 「담음」", () => {
    state.grants = { unavailable: false, announcements: { A: ann("A", "가상 자금 A"), B: ann("B", "가상 자금 B") }, companies: {
      "2026-10-01|가상정밀": { hasInfo: true, noRegion: false, matches: [m("A"), m("B")] },
      "2026-10-02|예시상사": { hasInfo: true, noRegion: false, matches: [m("A")] },
    } };
    state.todos = [{ contractRef: "2026-10-01|가상정밀", 분류: "공고:A" }];
    const html = renderToStaticMarkup(createElement(PolicyNewsMatches));
    const text = html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "|");
    expect(text).toContain("내 업체에 맞는 공고 2");
    expect(text).toContain("업체 2");
    expect(html).toContain('href="/payment?row=7"');
    expect(html.match(/담음/g)).toHaveLength(1);
  });
  it("피드가 없거나 맞는 공고가 없으면 아무것도 안 그린다", () => {
    state.grants = { unavailable: true, announcements: {}, companies: {} };
    expect(renderToStaticMarkup(createElement(PolicyNewsMatches))).toBe("");
    state.grants = { unavailable: false, announcements: {}, companies: { x: { hasInfo: true, noRegion: false, matches: [] } } };
    expect(renderToStaticMarkup(createElement(PolicyNewsMatches))).toBe("");
  });
});
