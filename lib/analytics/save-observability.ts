/**
 * Layer: analytics (서버 전용) — 저장 경로 관측성 (2026-09-14 저장 무결성 조사 후속).
 *
 * 왜 필요한가: 트레이너 담당 체크가 "저장된 것처럼 보였는데 실제로는 안 된" 사고에서,
 * 로그만으로 아래를 구분할 수 없었다 —
 *   (a) 요청이 서버에 도달했는가·어떤 status 로 끝났는가  → api_timing (기존)
 *   (b) 시트의 어느 행에 무엇을 썼는가                     → sheet_write (이 파일)
 *   (c) DB 미러가 성공/실패/**스킵**됐는가                  → db_mirror_result (이 파일)
 *   (d) 위 셋을 한 요청으로 묶을 수 있는가                  → request_id (api-timing.ts)
 * 특히 (c) 의 **스킵**(picked=null)은 기존에 완전 침묵이라 사고 원인 후보에서 지워낼 수 없었다.
 *
 * 불변조건:
 *   - **PII 원문 금지**. 이메일·이름은 sha256 앞 8자리로만 남긴다. 해시 실패 시에도 원문으로
 *     폴백하지 않는다("hashfail" 마커) — 유출 방지가 관측보다 우선.
 *   - 로깅 실패는 삼킨다. 관측이 응답을 깨면 안 된다.
 *   - 한 줄 = 한 JSON. pm2 가 줄 단위로 수집한다.
 */
import { createHash } from "node:crypto";
import { currentRequestId } from "./api-timing";

/** 짧은 안정 해시 — 같은 입력이면 항상 같은 값(로그 간 조인 가능), 역산 불가. */
export function shortHash(input: string): string {
  try {
    return createHash("sha256").update(String(input ?? ""), "utf8").digest("hex").slice(0, 8);
  } catch {
    // 해시 실패 시 원문을 찍는 대신 고정 마커 — PII 유출 방지 우선.
    return "hashfail";
  }
}

/** 이메일 1건 → 정규화(trim·소문자) 후 해시. 표기가 달라도 같은 해시가 나온다. */
export function hashEmail(email: string): string {
  return `sha256:${shortHash(String(email ?? "").trim().toLowerCase())}`;
}

/** G 열처럼 "이메일 콤마목록"인 셀 → 해시 배열. 원문 join 은 절대 남기지 않는다. */
export function hashEmailList(raw: string): string[] {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((e) => `sha256:${shortHash(e)}`);
}

/** DB 에러 문자열에서 접속문자열 제거 + 길이 제한(로그 폭주 방지). */
export function redactDbError(e: unknown): string {
  // stack 을 쓰지 않는다: stack = message + 프레임이고, 프레임은 절대경로·머신 계정명·
  // 코드 스니펫을 끌고 온다. 정작 DB 진단에 필요한 code/constraint/detail 은
  // node-postgres 가 err.detail 등 별도 필드에 넣어 stack 에도 없다 → 노출만 넓고 효용 0.
  const raw = e instanceof Error ? e.message : String(e ?? "unknown");
  return raw
    .replace(/postgres(ql)?:\/\/\S+/gi, "[DATABASE_URL]")
    // 이메일만 확정 치환한다. 한글 이름은 2~4자 일반명사와 구분 불가하고 경계가 없어
    // 사전 없이 잡으면 정상 로그까지 뭉갠다 → 범위 밖(구조 테스트에 미탐 케이스 명시).
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[EMAIL]")
    .slice(0, 500);
}

function emit(stream: "log" | "warn", payload: Record<string, unknown>): void {
  try {
    const line = JSON.stringify(payload);
    if (stream === "warn") console.warn(line);
    else console.log(line);
  } catch {
    /* swallow — 관측이 응답을 깨지 않는다 */
  }
}

/** (b)+(c) 레지스트리 셀 쓰기 1건 관측. value 원문(이메일·이름 가능)은 남기지 않는다.
 *  `mirrored=false`(picked=null)면 미러 스킵 warn 도 같이 남긴다 — 2026-09-14 이전엔
 *  이 경로가 완전 침묵이라 "시트엔 썼는데 DB엔 없는" 상태를 사후에 식별할 수 없었다. */
export function logRegistryCellWrite(
  tab: string,
  colLetter: string,
  sheetRow: number,
  value: string,
  mirrored: boolean,
): void {
  // 방출은 logSheetWrite 한 곳에만 있다 — 여기서 emit 을 다시 부르면 t:"sheet_write"
  // 방출점이 둘이 되어 조용히 형식이 갈린다(2026-09-14 교차검수 지적).
  logSheetWrite({
    tab,
    colLetter,
    sheetRow,
    valueLen: value.length,
    valueHash: shortHash(value),
    ...(colLetter === "G" ? { emailsHash: hashEmailList(value) } : {}),
  });
  if (!mirrored) {
    logMirrorSkipped({ reason: "picked_null", label: `users cells ${colLetter}`, sheetRow });
  }
}

/** (b) 시트 쓰기 1건. value 원문은 남기지 않고 길이+해시만. */
export function logSheetWrite(args: {
  tab: string;
  colLetter: string;
  sheetRow: number;
  valueLen: number;
  valueHash: string;
  /** 이메일 목록 컬럼(G)일 때만. */
  emailsHash?: string[];
}): void {
  emit("log", {
    t: "sheet_write",
    request_id: currentRequestId(),
    tab: args.tab,
    cell: `${args.colLetter}${args.sheetRow}`,
    col: args.colLetter,
    sheet_row: args.sheetRow,
    value_len: args.valueLen,
    value_hash: args.valueHash,
    ...(args.emailsHash ? { emails_hash: args.emailsHash } : {}),
  });
}

/** (c) 미러 성공/실패. fire-and-forget 내부에서 호출되므로 requestId 를 명시로 받는다
 *  — 재시도 setTimeout 이후에는 ALS 조회를 믿지 않고 캡처값을 쓴다. */
export function logMirrorResult(args: {
  requestId: string;
  label: string;
  outcome: "ok" | "error";
  attempts: number;
  /** 이미 redactDbError 를 통과한 문자열만 받는다. */
  error?: string;
}): void {
  emit(args.outcome === "error" ? "warn" : "log", {
    t: "db_mirror_result",
    request_id: args.requestId,
    outcome: args.outcome,
    label: args.label,
    attempts: args.attempts,
    ...(args.error ? { error: args.error } : {}),
  });
}

/** (c) 미러 스킵 — 기존에 완전 침묵이던 경로. 반드시 warn 으로 남긴다.
 *   picked_null: 시트 행 parse 실패로 자연키를 못 만들어 미러 자체를 건너뜀.
 *   db_disabled: DATABASE_URL 미설정(정상 동작이나 DB 정합은 backfill 이 담당). */
/** db_disabled 는 프로세스 전역 환경 사실(DATABASE_URL 유무)이라 라벨과 무관하다 →
 *  라벨별이 아닌 **프로세스당 1회**만 남긴다. 라벨별 1회로 하면 탭·컬럼이 늘 때마다
 *  로그가 부활해 지적 취지를 반만 해결한다. picked_null 은 행별 사건이라 매번 남긴다.
 *  ⚠️ pm2 cluster 에서는 프로세스당 1줄 = 워커 수만큼 줄이 나온다. */
let dbDisabledAlreadyLogged = false;

/** 테스트 전용 — 모듈 전역 억제 플래그를 되돌린다. 프로덕션 코드에서 호출 금지.
 *  vi.resetModules 만으로는 같은 파일 안 테스트끼리의 오염이 결정적으로 풀리지 않는다. */
export function resetSaveObservabilityForTests(): void {
  dbDisabledAlreadyLogged = false;
}

export function logMirrorSkipped(args: {
  reason: "picked_null" | "db_disabled";
  label?: string;
  sheetRow?: number;
  requestId?: string;
}): void {
  if (args.reason === "db_disabled") {
    if (dbDisabledAlreadyLogged) return;
    dbDisabledAlreadyLogged = true;
  }
  emit("warn", {
    t: "db_mirror_result",
    request_id: args.requestId ?? currentRequestId(),
    outcome: "skipped",
    reason: args.reason,
    ...(args.label ? { label: args.label } : {}),
    ...(typeof args.sheetRow === "number" ? { sheet_row: args.sheetRow } : {}),
  });
}
