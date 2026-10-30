/**
 * Layer: types — 트레이닝일지(노션 기수 DB) 읽기 전용 화면 모델 (2026-10-30 belie).
 * 노션 블록을 그대로 내보내지 않고 화면이 그릴 만큼만 줄인 모양. 계획: docs/plans/active/training-log-own-only.md
 */

/** 글자 조각 — 노션 rich_text 의 필요한 속성만. */
export interface LogText {
  text: string;
  href?: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  code?: boolean;
  /** 노션 배경색(노랑 형광펜 등) — 색 종류는 버리고 강조만 남긴다. */
  highlight?: boolean;
}

export type LogBlockType =
  | "p" | "h1" | "h2" | "h3" | "ul" | "ol" | "todo" | "toggle" | "quote" | "callout"
  | "divider" | "table" | "image" | "code" | "file" | "link";

export interface LogBlock {
  type: LogBlockType;
  text: LogText[];
  checked?: boolean;
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
