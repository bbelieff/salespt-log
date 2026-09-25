/**
 * PC 데스크탑 셸(좌측 사이드바 + 실무/수납 소탭) 구조 테스트 (PCSHELL-20260923).
 *
 * 배경: 이 레포의 sm:/md:/lg:/xl: 은 폰 폭(390~480px)이다. 데스크탑 전용은
 * pc:/wide: 로만 가른다. lg: 같은 걸 쓰면 아이폰에서 깨진다.
 *
 * 여기서 못 박는 것:
 *   ① DesktopNav 루트는 폰에서 hidden, pc(1024px+)에서만 flex
 *   ② TabBar 루트에 pc:hidden (PC 에서는 사이드바가 대신한다)
 *   ③ 4단계는 TabBar.NAV_STEPS 단일 원천 — 사이드바가 자체 정의를 두지 않는다
 *   ④ 소탭 중 업무매뉴얼만 새 탭(target=_blank), 정책자금뉴스는 내부 링크
 *   ⑤ 새 코드에 화면 폭 분기(window.innerWidth·matchMedia)가 없다
 *   ⑥ 새 데스크탑 스타일에 sm:/md:/lg:/xl: 가 하나도 없다
 *   ⑦ layout 권한 가드·게이트 순서가 그대로다 (return 안쪽 구조 교체만)
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const desktopNav = readFileSync("components/desktop/DesktopNav.tsx", "utf8");
const tabBar = readFileSync("components/TabBar.tsx", "utf8");
const layout = readFileSync("app/(app)/layout.tsx", "utf8");
const news = readFileSync("app/(app)/payment/news/page.tsx", "utf8");
const links = readFileSync("lib/config/links.ts", "utf8");

/** 첫 번째 <nav className="..."> 의 클래스 토큰 목록. */
function navTokens(src: string): string[] {
  const m = src.match(/<nav[^>]*className="([^"]*)"/);
  expect(m).not.toBeNull();
  return (m?.[1] ?? "").split(/\s+/);
}

describe("① DesktopNav 루트 표시 규칙 — 둘 다 렌더하고 CSS 로 가른다", () => {
  it("폰에서는 hidden, pc(1024px+)에서만 flex", () => {
    const tokens = navTokens(desktopNav);
    expect(tokens).toContain("hidden");
    expect(tokens).toContain("pc:flex");
  });

  it("주 메뉴 landmark 가 있다", () => {
    expect(desktopNav).toContain('aria-label="주 메뉴"');
  });
});

describe("② TabBar — PC 에서는 숨는다 (사이드바가 대신)", () => {
  it("루트 <nav> 에 pc:hidden 이 있고 fixed bottom-0 은 그대로다", () => {
    const tokens = navTokens(tabBar);
    expect(tokens).toContain("pc:hidden");
    expect(tokens).toContain("fixed");
    expect(tokens).toContain("bottom-0");
  });
});

describe("③ 4단계 SSOT — TabBar.NAV_STEPS 하나만", () => {
  it("TabBar 가 NAV_STEPS 를 LEFT+RIGHT 순서로 export 한다", () => {
    expect(tabBar).toContain("export const NAV_STEPS");
    expect(tabBar).toContain("[...LEFT, ...RIGHT]");
  });

  it("DesktopNav 는 import 해서 돌리고 자체 단계 정의를 두지 않는다", () => {
    expect(desktopNav).toContain('from "@/components/TabBar"');
    expect(desktopNav).toContain("NAV_STEPS");
    // 단계 라벨을 하드코딩하면 두 벌이 되어 어긋난다 — 라벨은 NAV_STEPS 에서만 온다.
    expect(desktopNav).not.toContain("DB생산");
    expect(desktopNav).not.toContain("컨택관리");
  });

  it("활성 판정은 각 단계의 match 로 — 활성 행은 aria-current=page", () => {
    expect(desktopNav).toContain(".match(pathname)");
    expect(desktopNav).toContain('aria-current={active ? "page" : undefined}');
  });
});

describe("④ 소탭 3개 — 새 탭 약속 (↗은 새 탭에만)", () => {
  it("구글드라이브: 폴더 있으면 새 탭, 없으면 /payment 로 보내고 연결 필요 표시", () => {
    expect(desktopNav).toContain("https://drive.google.com/drive/folders/");
    expect(desktopNav).toContain("feedbackFolderId");
    expect(desktopNav).toContain("연결 필요");
  });

  it("정책자금뉴스는 내부 링크(/payment/news) — 새 탭이 아니다", () => {
    expect(desktopNav).toContain("/payment/news");
    // ⚠ `WORK_MANUAL_URL` 의 첫 등장은 맨 위 **import 문**이다. 앵커를 찾으려면
    //    `href={WORK_MANUAL_URL}` 로 집어야 한다(그냥 indexOf 하면 import 가 잡혀 순서가 뒤집힌다).
    //    `/payment/news` 의 첫 등장도 링크가 아니라 위쪽 `newsActive` 계산 줄이다.
    //    그 지점부터 자르면 **드라이브 앵커의 target= 이 구간에 끼어든다** — 링크 자체를 집는다.
    const newsLinkIdx = desktopNav.indexOf('href={"/payment/news"');
    const manualAnchorIdx = desktopNav.indexOf("href={WORK_MANUAL_URL}");
    expect(newsLinkIdx).toBeGreaterThan(-1);
    expect(manualAnchorIdx).toBeGreaterThan(newsLinkIdx);
    expect(desktopNav.slice(newsLinkIdx, manualAnchorIdx)).not.toContain("target=");
  });

  it("업무매뉴얼만 새 탭 — WORK_MANUAL_URL 앵커에 target=_blank + 약속 문구", () => {
    const manualAnchorIdx = desktopNav.indexOf("href={WORK_MANUAL_URL}");
    expect(manualAnchorIdx).toBeGreaterThan(-1);
    const tail = desktopNav.slice(manualAnchorIdx, manualAnchorIdx + 400);
    expect(tail).toContain('target="_blank"');
    expect(tail).toContain("noopener");
    expect(desktopNav).toContain('aria-label="업무매뉴얼 (새 탭에서 열림)"');
  });
});

describe("⑤ 화면 폭으로 분기하지 않는다 — CSS 클래스로만 가른다", () => {
  const touched = [desktopNav, news, tabBar, layout];
  it("window.innerWidth 를 읽지 않는다", () => {
    for (const src of touched) expect(src).not.toContain("innerWidth");
  });

  it("useMediaQuery·matchMedia 를 쓰지 않는다", () => {
    for (const src of touched) {
      expect(src).not.toContain("useMediaQuery");
      expect(src).not.toContain("matchMedia");
    }
  });
});

describe("⑥ 새 데스크탑 스타일에 폰 prefix(sm:/md:/lg:/xl:)가 없다", () => {
  it("DesktopNav·뉴스 페이지에 pc:/wide: 만 쓴다", () => {
    for (const src of [desktopNav, news]) {
      expect(src).not.toMatch(/[\s"'](sm|md|lg|xl):/);
    }
  });
});

describe("⑦ (app) layout — 구조만 바뀌고 가드·게이트는 그대로", () => {
  it("DesktopNav 가 DirtyProvider 안에서 렌더된다 (사이드바도 미저장 가드 대상)", () => {
    expect(layout).toContain('import DesktopNav from "@/components/desktop/DesktopNav"');
    expect(layout).toContain("<DesktopNav />");
    const dirtyOpen = layout.indexOf("<DirtyProvider>");
    const dirtyClose = layout.indexOf("</DirtyProvider>");
    expect(dirtyOpen).toBeGreaterThan(-1);
    // 이동을 일으키는 둘(사이드바·탭바)이 같은 컨텍스트 안에 있어야 미저장 가드가 걸린다.
    for (const el of ["<DesktopNav />", "<TabBar />"]) {
      expect(dirtyOpen).toBeLessThan(layout.indexOf(el));
      expect(dirtyClose).toBeGreaterThan(layout.indexOf(el));
    }
    // 게이트 3종은 master 그대로 DirtyProvider **밖**이다 — 여기로 끌어들이지 않는다.
    expect(dirtyClose).toBeLessThan(layout.indexOf("<IdentityGuard />"));
  });

  it("★모바일 탭바 공간은 유지하고 데스크탑의 불필요한 예약 공간은 제거한다", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(layout).toContain('<main className="app-shell-main">');
    expect(css).toMatch(/\.app-shell-main\s*\{\s*padding-bottom:\s*var\(--app-tabbar-height\)/);
    expect(css).toMatch(/\.desktop-shell \.app-shell-main\s*\{\s*padding-bottom:\s*0/);
    expect(layout).not.toContain("pc:[--app-tabbar-height:");
    expect(layout).toContain("pc:flex");
  });

  it("게이트 3종 순서가 그대로다 — AnnouncementsGate·PullToRefresh·IdentityGuard", () => {
    const a = layout.indexOf("<AnnouncementsGate />");
    const p = layout.indexOf("<PullToRefresh />");
    const g = layout.indexOf("<IdentityGuard />");
    expect(a).toBeGreaterThan(-1);
    expect(a).toBeLessThan(p);
    expect(p).toBeLessThan(g);
  });

  it("★권한 가드는 한 글자도 안 바뀌었다 — 리다이렉트·대기화면 그대로", () => {
    expect(layout).toContain('redirect("/")');
    expect(layout).toContain('redirect("/trainer")');
    expect(layout).toContain("shouldRedirectToClaim");
    expect(layout).toContain('redirect("/claim")');
    expect(layout).toContain("<PendingApprovalScreen");
  });
});

describe("⑧ 관리자 항목 — 서버가 준 값(useMe)으로만 판정", () => {
  it("isAdminEmail 같은 서버 전용 판정을 클라이언트에서 하지 않는다", () => {
    expect(desktopNav).toContain("useMe()");
    expect(desktopNav).not.toContain("isAdminEmail");
  });
});

describe("⑨ 링크 상수 — 추가만, 기존 줄 무수정", () => {
  it("POLICY_NEWS_URL·POLICY_NEWS_EMBED 가 있고 기존 WORK_MANUAL_URL 이 그대로다", () => {
    // 주소는 master 가 이미 갖고 있던 값 — 날짜를 박으면 다음 날 404 가 된다(links.ts 주석).
    expect(links).toContain('POLICY_NEWS_URL = "https://salesptlog.online/news/latest"');
    expect(links).toContain("POLICY_NEWS_EMBED = false");
    expect(links).toContain("WORK_MANUAL_URL");
  });

  it("뉴스 페이지가 상수를 쓰고, EMBED=false 일 때 iframe 을 켜지 않는다", () => {
    expect(news).toContain("POLICY_NEWS_URL");
    expect(news).toContain("POLICY_NEWS_EMBED");
    expect(news).toContain('title="정책자금 데일리"');
    expect(news).toContain('loading="lazy"');
    expect(news).toContain("아직 새 창에서 열립니다");
  });
});
