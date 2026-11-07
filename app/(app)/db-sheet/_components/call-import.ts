/**
 * 「＋ DB 추가」에 통화 녹음·받아쓴 글을 놓았을 때(plan db-add-one-button) — 화면과 떨어진 규칙.
 * 엑셀·붙여넣기(여러 건)와 같은 창에서 받고, 파일 종류로 갈라 통화면 「채널만 묻고 정리 시작」으로 보낸다.
 */
import { CALL_AUDIO_EXTS, phoneDigits } from "./call-client";

const ext = (name: string) => name.toLowerCase().split(".").pop() ?? "";
const PHONE = /0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/;

/**
 * 통화로 볼 파일인가. 녹음·PDF 는 통화, .txt 는 이름에 전화번호나 「통화·녹음·call」이 있을 때만 통화 —
 * 그 밖의 .txt 는 지금처럼 DB 목록(여러 건)으로 읽는다.
 */
export function isCallImportFile(name: string): boolean {
  const e = ext(name);
  if (CALL_AUDIO_EXTS.includes(e) || e === "pdf") return true;
  return e === "txt" && (PHONE.test(name) || /통화|녹음|call|record/i.test(name));
}

/** 파일 이름 속 전화번호(갤럭시 「통화 010-0000-0000_20261107_1412.m4a」). 없으면 "". */
export const callFilePhone = (name: string) => name.match(PHONE)?.[0] ?? "";

const kstDay = (ms: number) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10);
const WEEK_MS = 7 * 86_400_000;

/**
 * 녹음한 때(belie 2026-11-07 「녹음 파일 날로 유입일」) — 파일 이름의 날짜·시각이 먼저(옮겨 받으면 저장 시각이 바뀐다),
 * 없으면 파일 저장 시각. 미래면 지금. date = 유입일(한국 날짜), calledAt = 통화 시각(서버 규칙상 지난 7일 안일 때만 보낸다).
 */
export function recordedAt(file: { name: string; lastModified: number }, now = Date.now()): { ms: number; date: string; calledAt?: string } {
  const m = file.name.match(/(20\d{2})[-.]?(\d{2})[-.]?(\d{2})(?:[_\-\s T]?(\d{2})[:.]?(\d{2}))?/);
  let ms = file.lastModified;
  if (m) {
    const [, y, mo, d, h = "12", mi = "00"] = m;
    const t = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:00+09:00`);
    if (Number.isFinite(t) && Number(mo) >= 1 && Number(mo) <= 12 && Number(d) >= 1 && Number(d) <= 31 && Number(h) < 24 && Number(mi) < 60) ms = t;
  }
  if (!Number.isFinite(ms) || ms > now) ms = now;
  return { ms, date: kstDay(ms), calledAt: now - ms < WEEK_MS ? new Date(ms).toISOString() : undefined };
}

/** 「오늘 14:12」·「11월 5일 14:12」 — 고른 파일 아래 한 줄. */
export function recordedLabel(ms: number, now = Date.now()): string {
  const time = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));
  if (kstDay(ms) === kstDay(now)) return `오늘 ${time}`;
  if (kstDay(ms) === kstDay(now - 86_400_000)) return `어제 ${time}`;
  return `${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" }).format(new Date(ms))} ${time}`;
}

/** 「3분 12초」. 길이를 모르면 "". */
export function durationLabel(seconds: number | null): string {
  if (!seconds || !Number.isFinite(seconds)) return "";
  const s = Math.round(seconds), m = Math.floor(s / 60);
  return m ? `${m}분 ${s % 60}초` : `${s}초`;
}

/** 목록에 같은 번호가 있으면 그 줄(새 DB 대신 그 업체 통화로 올린다). */
export function leadByPhone<T extends { id: string; phone: string }>(rows: T[], phone: string): T | undefined {
  const want = phoneDigits(phone);
  return want ? rows.find(r => phoneDigits(r.phone) === want) : undefined;
}

export const CALL_IMPORT_CHANNELS = ["현수막", "콜·지·기·소", "직접생산", "매입DB"] as const;
export type CallImportChannel = (typeof CALL_IMPORT_CHANNELS)[number];
