/**
 * UI/UX 점검 1차(데이터 안전) 회귀 테스트 — docs/plans/completed/ux-batch1-data-safety.md.
 *
 * 못 박는 것:
 *   ① 새 미팅 카드는 적어 둔 내용이 있을 때만 삭제 전에 묻는다(빈 카드는 바로 지운다)
 *   ② 새소식 팝업은 배경 탭으로 닫히지(=읽음 처리) 않는다
 *   ③ /login 별칭은 바깥 주소로 보내지 않고, 오류면 안내 플래그를 붙인다
 *   ④ 적던 내용이 말없이 사라지던 창 4곳에 확인·돌아가기가 있다
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { newSlotHasInput, type NewSlot } from "@/app/(app)/contact/_components/MeetingSlotItem";
import { loginRedirectTarget } from "@/util/login-return";

const slot = (p: Partial<NewSlot> = {}): NewSlot => ({
  tempId: "t1", channel: "인바운드" as NewSlot["channel"], 미팅날짜: "2026-11-10", 미팅시간: "",
  업체명: "", 장소: "", 예약비고: "", ...p,
});

describe("newSlotHasInput — 새 미팅 카드 삭제 확인 여부", () => {
  it("빈 카드(날짜 기본값만)는 묻지 않는다", () => {
    expect(newSlotHasInput(slot())).toBe(false);
    expect(newSlotHasInput(slot({ 업체명: "   " }))).toBe(false);
  });
  it("시간·업체명·장소·비고·업체정보 중 하나라도 있으면 묻는다", () => {
    expect(newSlotHasInput(slot({ 미팅시간: "14:00" }))).toBe(true);
    expect(newSlotHasInput(slot({ 업체명: "샘플상사" }))).toBe(true);
    expect(newSlotHasInput(slot({ 장소: "본사" }))).toBe(true);
    expect(newSlotHasInput(slot({ 예약비고: "메모" }))).toBe(true);
    expect(newSlotHasInput(slot({ 업체정보: {} as NewSlot["업체정보"] }))).toBe(true);
  });
  it("삭제 핸들러가 실제로 이 판정으로 확인을 묻는다", () => {
    const page = readFileSync("app/(app)/contact/page.tsx", "utf8");
    const fn = page.slice(page.indexOf("const removeNewSlot"), page.indexOf("const handleRemoveSavedMeeting"));
    expect(fn).toMatch(/newSlotHasInput\(target\) && !window\.confirm\(/);
    expect(fn.indexOf("window.confirm")).toBeLessThan(fn.indexOf("setNewSlots"));
  });
});

describe("loginRedirectTarget — /login 별칭", () => {
  it("아무것도 없으면 첫 화면", () => {
    expect(loginRedirectTarget({})).toBe("/");
  });
  it("오류면 안내 플래그를 붙인다(오류 코드 원문은 옮기지 않는다)", () => {
    expect(loginRedirectTarget({ error: "OAuthCallbackError" })).toBe("/?loginError=1");
  });
  it("Auth.js 의 절대 callbackUrl 은 경로만 꺼내 검증한다", () => {
    expect(loginRedirectTarget({ callbackUrl: "https://example.test/dashboard?d=1" }))
      .toBe("/?returnTo=%2Fdashboard%3Fd%3D1");
  });
  it("허용 목록 밖·프로토콜 상대 주소는 버린다", () => {
    expect(loginRedirectTarget({ callbackUrl: "//evil.test/x" })).toBe("/");
    expect(loginRedirectTarget({ returnTo: "/api/secret" })).toBe("/");
  });
  it("returnTo 가 callbackUrl 보다 우선", () => {
    expect(loginRedirectTarget({ returnTo: "/payment", callbackUrl: "/dashboard" })).toBe("/?returnTo=%2Fpayment");
  });
  it("페이지가 실제로 있고, 로그인 화면이 플래그를 받는다", () => {
    expect(readFileSync("app/login/page.tsx", "utf8")).toContain("loginRedirectTarget");
    expect(readFileSync("app/page.tsx", "utf8")).toContain("loginError={!!params?.loginError}");
    expect(readFileSync("components/auth/LoginScene.tsx", "utf8")).toMatch(/loginError && \(\s*<p role="alert"/);
  });
});

describe("★소스 가드 — 적던 내용·읽음 처리 보호", () => {
  it("새소식 팝업 배경에는 닫기(onConfirm)가 걸려 있지 않다", () => {
    const src = readFileSync("components/announcements/NoticePopup.tsx", "utf8");
    const backdrop = src.slice(src.indexOf('className="fixed inset-0'), src.indexOf("<h3"));
    expect(backdrop).not.toContain("onConfirm");
    expect(backdrop).not.toContain("stopPropagation");
  });
  it("DB 가져오기 Esc 는 입력·배치 결과가 있으면 묻는다", () => {
    const src = readFileSync("app/(app)/db-sheet/_components/ImportDialog.tsx", "utf8");
    expect(src).toMatch(/e\.key==='Escape'[^\n]*\(text\.trim\(\)\|\|sheetInput\.trim\(\)\|\|review\)&&!window\.confirm\(/);
  });
  it("통화 정리 확인의 「나중에」·뒤로는 고친 게 있으면 묻는다", () => {
    const src = readFileSync("app/(app)/db-sheet/_components/CallConfirmScreen.tsx", "utf8");
    expect(src).toMatch(/s !== untouched\.current && !window\.confirm\(/);
    expect(src).toContain("onClick={leave}>나중에");
    expect(src).not.toMatch(/onClick=\{onClose\}/);
  });
  it("해지 창은 적은 게 있으면 배경으로 닫히지 않는다", () => {
    const src = readFileSync("app/(app)/payment/_components/TerminationModal.tsx", "utf8");
    expect(src).toContain('onClick={사유.trim() || mode !== "none" || 숨김 ? undefined : onClose}');
  });
  it("일반 일정 안내창에 「돌아가기」가 있다", () => {
    const src = readFileSync("app/(app)/calendar/_components/GeneralEventModal.tsx", "utf8");
    expect(src).toContain("onClick={() => setHint(false)}");
    expect(src).toContain("돌아가기");
  });
});
