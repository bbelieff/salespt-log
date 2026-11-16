/**
 * Layer: config — 관리자 메뉴 묶음(admin-phase1, 2026-11-16).
 *
 * PC 왼쪽 메뉴(AdminSideNav)와 폰 메뉴(AdminMenuList)가 같은 목록을 쓴다.
 * 메뉴 이름(역할 이름 포함)은 여기 한 곳에만 둔다 — 고객마다 이름이 달라질 때 바꿀 자리.
 * 권한 가드는 레이아웃·각 페이지가 맡고, 여기 masterOnly 는 «보여 줄지» 만 정한다.
 */
export interface AdminNavItem {
  href: string;
  label: string;
  /** 마스터에게만 보인다(관리부서 계정엔 숨김). */
  masterOnly?: boolean;
  /** 옆에 붙일 승인 대기 숫자 종류. */
  badge?: "trainees" | "trainers";
}
export interface AdminNavGroup {
  key: "ops" | "people" | "course" | "notice" | "settings";
  label: string;
  icon: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    key: "ops",
    label: "운영 현황",
    icon: "🏠",
    items: [
      { href: "/admin", label: "오늘 할 일" },
      { href: "/admin/reports", label: "오류 신고함" },
    ],
  },
  {
    key: "people",
    label: "사람",
    icon: "👥",
    items: [
      { href: "/admin/users", label: "수강생", badge: "trainees" },
      { href: "/admin/trainers", label: "트레이너", badge: "trainers" },
      { href: "/trainer", label: "트레이너 페이지", masterOnly: true },
    ],
  },
  {
    key: "course",
    label: "과정",
    icon: "📅",
    items: [
      { href: "/admin/cohorts", label: "기수" },
      { href: "/admin/arena", label: "아레나" },
    ],
  },
  {
    key: "notice",
    label: "알림",
    icon: "📢",
    items: [{ href: "/admin/popup", label: "공지 · 업데이트 소식", masterOnly: true }],
  },
  {
    key: "settings",
    label: "설정",
    icon: "⚙️",
    items: [{ href: "/admin/settings", label: "진단", masterOnly: true }],
  },
];

/** 이 계정에 보일 묶음 — 보일 항목이 하나도 없는 묶음은 뺀다. */
export function visibleAdminNavGroups(isMaster: boolean): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => isMaster || !it.masterOnly) })).filter(
    (g) => g.items.length > 0,
  );
}

/** 지금 화면이 이 메뉴인가 — 홈은 `/admin` 일 때만, 나머지는 하위 경로 포함. */
export function isAdminNavActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  if (!href.startsWith("/admin/")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
