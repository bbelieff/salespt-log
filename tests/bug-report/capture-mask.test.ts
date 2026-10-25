// @vitest-environment jsdom
/** 오류신고 캡처 전 가림 대상 — 전화·이름·계좌 칸과 그런 글자는 가리고, 보통 글자는 그대로 둔다. */
import { describe, expect, it } from "vitest";
import { findPrivateElements } from "@/components/bug-report/capture";
import { scrubText } from "@/components/bug-report/error-log";

function mount(html: string) {
  document.body.innerHTML = html;
  return findPrivateElements(document).map(el => el.getAttribute("data-k"));
}

describe("findPrivateElements", () => {
  it("전화번호·이름·계좌 입력칸과 data-private 를 고른다", () => {
    const keys = mount(`
      <input data-k="tel" type="tel" />
      <input data-k="name" aria-label="대표자 이름" />
      <label for="acc">계좌번호</label><input data-k="acc" id="acc" />
      <input data-k="memo" aria-label="메모" value="내일 다시" />
      <div data-k="priv" data-private>비공개</div>`);
    expect(keys).toEqual(expect.arrayContaining(["tel", "name", "acc", "priv"]));
    expect(keys).not.toContain("memo");
  });
  it("전화번호·이메일 글자가 있는 요소를 고르고 날짜·금액은 두지 않는다", () => {
    const keys = mount(`
      <p data-k="phone">연락처 010-1234-5678</p>
      <p data-k="phone2">01098765432</p>
      <p data-k="mail">a.b@example.com</p>
      <p data-k="date">2026-10-25 · 1,500,000원</p>`);
    expect(keys).toEqual(expect.arrayContaining(["phone", "phone2", "mail"]));
    expect(keys).not.toContain("date");
  });
  it("입력값에 전화번호가 들어 있으면 이름표가 없어도 가린다", () => {
    expect(mount(`<input data-k="x" value="010 2222 3333" />`)).toEqual(["x"]);
  });

  it("표 머리칸이 대표자·전화번호인 열을 통째로 가린다", () => {
    const keys = mount(`<table><thead><tr><th></th><th>사업자명</th><th>대표자</th></tr></thead>
      <tbody><tr><td data-k="c0"></td><td data-k="biz">샘플상사</td><td data-k="owner">김가상</td></tr></tbody></table>`);
    expect(keys).toEqual(["owner"]);
  });
});

describe("scrubText", () => {
  it("오류 메시지의 긴 숫자와 이메일을 지운다", () => {
    expect(scrubText("fail for a@b.co 010-1111-2222")).toBe("fail for [이메일] [숫자]");
  });
});
