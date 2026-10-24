/**
 * 배지 목록 — belie 승인 31개(2026-10-24, 승인표 아티팩트). 화면·판정이 함께 쓰는 정본.
 * 그림은 public/badges/<img>.png (Microsoft Fluent Emoji 3D, MIT). 등급은 메달 테 색만 정한다.
 * ready=false 는 판정에 필요한 저장 칸이 아직 없어 이번 단계에서 얻을 수 없는 배지(잠김 + 「준비 중」).
 */
export type BadgeGroup = "steady" | "win" | "start" | "coach" | "alumni" | "secret";
export type BadgeTier = "" | "bronze" | "silver" | "gold" | "navy" | "secret";

export interface BadgeDef {
  id: string;
  group: BadgeGroup;
  name: string;
  how: string;
  img: string;
  tier: BadgeTier;
  ready: boolean;
  /** 잠겨 있을 때 바로 할 수 있는 행동(없으면 버튼 없음). */
  cta?: { label: string; href: string };
}

export const BADGE_GROUPS: ReadonlyArray<{ id: BadgeGroup; name: string; hint: string }> = [
  { id: "steady", name: "꾸준함", hint: "쌓일수록 자라요. 쉬어도 줄지 않아요." },
  { id: "win", name: "첫 성과", hint: "실제 영업 결과" },
  { id: "start", name: "첫 걸음", hint: "처음 써 본 기능" },
  { id: "coach", name: "비서와 함께", hint: "비서가 챙기는 습관" },
  { id: "alumni", name: "졸업생", hint: "수료 뒤에도 이어지게" },
  { id: "secret", name: "숨은 배지", hint: "조건은 비밀이에요" },
];

const RECORD = { label: "오늘 연락 기록하기", href: "/db-sheet" };

export const BADGES: readonly BadgeDef[] = [
  { id: "first-activity", group: "steady", name: "첫 영업활동", how: "처음으로 영업활동을 기록", img: "rocket", tier: "", ready: true, cta: RECORD },
  { id: "days-3", group: "steady", name: "물주기 · 3일", how: "누적 영업활동 3일", img: "droplet", tier: "", ready: true, cta: RECORD },
  { id: "days-7", group: "steady", name: "햇살 · 7일", how: "누적 영업활동 7일", img: "sun", tier: "bronze", ready: true, cta: RECORD },
  { id: "days-10", group: "steady", name: "새싹 · 10일", how: "누적 영업활동 10일", img: "seedling", tier: "bronze", ready: true, cta: RECORD },
  { id: "days-30", group: "steady", name: "화분 · 30일", how: "누적 영업활동 30일", img: "potted_plant", tier: "silver", ready: true, cta: RECORD },
  { id: "days-100", group: "steady", name: "나무 · 100일", how: "누적 영업활동 100일", img: "deciduous_tree", tier: "gold", ready: true, cta: RECORD },
  { id: "week-goal-1", group: "steady", name: "주 목표 첫 달성", how: "내가 고른 주 목표(2·3·5일)를 처음 채움", img: "check_mark_button", tier: "", ready: false },
  { id: "week-goal-4", group: "steady", name: "주 목표 4번", how: "주 목표를 4번 채움(연속 아님)", img: "glowing_star", tier: "silver", ready: false },
  { id: "first-consult", group: "win", name: "첫 상담", how: "상담기록(컨택진행·상담 후 거절)을 처음 저장", img: "speech_balloon", tier: "silver", ready: true, cta: { label: "DB관리시트 열기", href: "/db-sheet" } },
  { id: "first-meeting", group: "win", name: "첫 미팅 완료", how: "미팅 결과를 처음 「완료」로 저장", img: "handshake", tier: "silver", ready: true, cta: { label: "미팅 일정 보기", href: "/schedule" } },
  { id: "first-contract", group: "win", name: "첫 계약", how: "계약을 처음 기록", img: "money_bag", tier: "gold", ready: true, cta: { label: "진행건 보기", href: "/payment" } },
  { id: "first-payment", group: "win", name: "첫 수납", how: "수납액을 처음 기록", img: "coin", tier: "gold", ready: true, cta: { label: "진행건에 수납 적기", href: "/payment" } },
  { id: "contracts-5", group: "win", name: "계약 5건", how: "누적 계약 5건", img: "trophy", tier: "gold", ready: true, cta: { label: "진행건 보기", href: "/payment" } },
  { id: "first-db", group: "start", name: "첫 DB 등록", how: "DB생산에 첫 업체를 등록", img: "card_index_dividers", tier: "", ready: true, cta: { label: "DB생산 열기", href: "/db" } },
  { id: "first-dbsheet", group: "start", name: "첫 DB관리 정리", how: "DB관리시트에 첫 업체를 올림", img: "clipboard", tier: "", ready: true, cta: { label: "DB관리시트 열기", href: "/db-sheet" } },
  { id: "first-contact", group: "start", name: "첫 연락 기록", how: "연락 결과를 처음 저장(부재 포함)", img: "telephone_receiver", tier: "", ready: true, cta: RECORD },
  { id: "first-booking", group: "start", name: "첫 미팅 예약", how: "미팅을 처음 예약", img: "spiral_calendar", tier: "", ready: true, cta: { label: "미팅 예약하기", href: "/schedule" } },
  { id: "first-todo", group: "start", name: "첫 할 일", how: "진행건에 할 일을 처음 등록", img: "memo", tier: "", ready: true, cta: { label: "진행건에 할 일 적기", href: "/payment" } },
  { id: "first-goal", group: "start", name: "첫 주간목표", how: "주간목표를 처음 세움", img: "bullseye", tier: "", ready: true, cta: { label: "주간목표 세우기", href: "/dashboard" } },
  { id: "first-company", group: "start", name: "업체정보 준비", how: "DB관리시트 업체 1곳의 업종·매출·지역을 모두 채움", img: "office_building", tier: "", ready: true, cta: { label: "DB관리시트 열기", href: "/db-sheet" } },
  { id: "push-on", group: "start", name: "알림 켜기", how: "이 기기에서 알림을 켬", img: "bell", tier: "", ready: true, cta: { label: "알림 켜기", href: "/settings/notifications" } },
  { id: "home-screen", group: "start", name: "홈 화면에 추가", how: "홈 화면 아이콘으로 처음 열기", img: "mobile_phone", tier: "", ready: false },
  { id: "seed-first", group: "coach", name: "씨앗에서 시작", how: "오늘의 씨앗 알림으로 연락을 처음 저장", img: "herb", tier: "", ready: false },
  { id: "ask-answer", group: "coach", name: "비서에게 답하기", how: "비서의 빈칸 질문에 처음 답함", img: "light_bulb", tier: "", ready: false },
  { id: "no-miss-week", group: "coach", name: "약속 지킨 주", how: "한 주 동안 놓친 약속(지난 다음 연락일)이 0건", img: "shield", tier: "silver", ready: false },
  { id: "graduate", group: "alumni", name: "수료", how: "과정을 수료", img: "graduation_cap", tier: "navy", ready: true },
  { id: "alumni-first", group: "alumni", name: "수료 후 첫 기록", how: "수료 뒤 처음 영업활동을 남김", img: "sunrise", tier: "", ready: true },
  { id: "alumni-30", group: "alumni", name: "졸업생 30일", how: "수료 뒤 누적 영업활동 30일", img: "gem_stone", tier: "gold", ready: true },
  { id: "secret-morning", group: "secret", name: "아침형 영업인", how: "9시 전 연락 기록 5번", img: "alarm_clock", tier: "secret", ready: false },
  { id: "secret-grit", group: "secret", name: "끈기", how: "부재 3번 뒤 같은 업체와 상담 성사", img: "party_popper", tier: "secret", ready: true },
  { id: "secret-fullday", group: "secret", name: "완주한 하루", how: "하루에 연락·미팅·계약을 모두 기록", img: "sparkles", tier: "secret", ready: true },
];
