/**
 * Layer: types — 트레이닝일지(노션 기수 DB) 읽기 전용 화면 모델 (2026-10-30 belie).
 * 노션 블록을 그대로 내보내지 않고 화면이 그릴 만큼만 줄인 모양. 계획: docs/plans/active/training-log-own-only.md
 */

/** 노션 색 9종(기본색 제외). 글자색·배경색·블록 색이 같은 이름을 쓴다. */
export const LOG_COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] as const;
export type LogColor = (typeof LOG_COLORS)[number];

/** 글자 조각 — 노션 rich_text 의 필요한 속성만. */
export interface LogText {
  text: string;
  href?: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  code?: boolean;
  /** 노션 글자색. */
  color?: LogColor;
  /** 노션 배경색(형광펜). */
  bg?: LogColor;
  /** 날짜·사람·페이지 멘션, 수식 — 노션처럼 살짝 구분해 그린다. */
  mention?: boolean;
}

export type LogBlockType =
  | "p" | "h1" | "h2" | "h3" | "h4" | "ul" | "ol" | "todo" | "toggle" | "quote" | "callout"
  | "divider" | "table" | "image" | "code" | "file" | "link" | "columns" | "column";

export interface LogBlock {
  type: LogBlockType;
  text: LogText[];
  checked?: boolean;
  /** 블록 전체 글자색·배경색(노션 블록 메뉴의 「색」). */
  color?: LogColor;
  bg?: LogColor;
  /** callout 아이콘 — 이모지 글자 또는 그림 주소. */
  icon?: string;
  iconUrl?: string;
  /** toggle 이 제목 토글이면 그 단계(1~4) — 제목 크기로 그린다. */
  level?: 1 | 2 | 3 | 4;
  /** code 언어 이름. */
  lang?: string;
  /** table 머리줄·머리칸. */
  headRow?: boolean;
  headCol?: boolean;
  /** column 너비 비율(노션 width_ratio). 없으면 고르게. */
  ratio?: number;
  /** image·file·link 주소. 노션 파일 주소는 1시간 뒤 만료. */
  url?: string;
  /** table — 행 → 칸 → 글자 조각. */
  rows?: LogText[][][];
  children?: LogBlock[];
}

/** 목록 한 줄 — 내 일지 한 편. */
export interface TrainingLogItem {
  id: string;
  title: string;
  /** 제목의 「N주차」. 없으면 null. */
  week: number | null;
  createdTime: string;
}

export interface TrainingLogDetail extends TrainingLogItem {
  blocks: LogBlock[];
}

/** 목록 응답 — 왜 비었는지 화면이 말할 수 있게 상태를 함께 준다. */
export type TrainingLogList =
  | { status: "ok"; items: TrainingLogItem[] }
  | { status: "not_configured" | "no_cohort" | "no_database" | "unavailable"; items: [] };
