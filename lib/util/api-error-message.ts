/**
 * API 오류 코드를 사람이 읽는 말로 바꾼다.
 *
 * ★ 왜 필요한가 (2026-09-20)
 *   관리자 화면이 서버 응답의 `error` 를 «그대로» 찍고 있었다. 그래서 담당 배정이
 *   실패하면 화면에 「not_trainer」 라고만 떴다. 총괄이 「낫트레이너 이거 뭔말이야」
 *   라고 물었다 — 화면이 무슨 일이 났는지도, 뭘 해야 하는지도 말해 주지 않았다.
 *
 *   코드는 서버끼리 쓰는 말이다. 사람에게는 «무엇이 안 됐는지» 와 «그래서 뭘 하면
 *   되는지» 를 준다. 모르는 코드는 숨기지 말고 괄호로 같이 보여 준다 — 문의할 때
 *   그 코드가 있어야 원인을 찾는다.
 */

const MESSAGES: Record<string, string> = {
  // 권한·로그인
  unauthenticated: "로그인이 풀렸어요. 새로고침해서 다시 로그인해 주세요.",
  forbidden: "이 작업을 할 권한이 없어요.",
  self_only: "본인 것만 바꿀 수 있어요.",

  // 대상을 못 찾음
  not_trainee:
    "그 이메일로 등록된 수강생이 없어요. 관리자 화면에서 이메일이 정확한지 확인해 주세요.",
  not_trainer:
    "그 계정은 지금 트레이너가 아니에요. 트레이너 관리에서 트레이너로 추가하거나, 비활성 상태면 활성으로 바꾼 뒤에 다시 배정해 주세요.",
  not_found: "찾는 자료가 없어요.",
  target_not_registered: "그 대상은 아직 등록되지 않았어요.",
  pr_not_found: "그 기록을 찾지 못했어요.",
  no_members: "대상이 한 명도 없어요.",
  arena_roster_missing: "명단을 찾지 못했어요.",

  // 연결·설정
  no_sheet: "연결된 시트가 없어요. 시트를 먼저 연결해 주세요.",
  not_connected: "아직 연결되지 않았어요. 연결을 먼저 마쳐 주세요.",
  invalid_spreadsheet_id: "시트 주소가 올바르지 않아요. 주소를 다시 붙여넣어 주세요.",
  cohort_not_configured: "이 기수는 아직 설정되지 않았어요.",
  arena_not_configured: "아직 설정되지 않았어요.",
  db_disabled: "지금은 이 기능이 꺼져 있어요.",

  // 입력값
  invalid_input: "입력한 내용을 확인해 주세요.",
  invalid_request: "요청이 올바르지 않아요. 새로고침하고 다시 해 주세요.",
  invalid_body: "요청이 올바르지 않아요. 새로고침하고 다시 해 주세요.",
  invalid_query: "요청이 올바르지 않아요. 새로고침하고 다시 해 주세요.",
  invalid: "입력한 내용을 확인해 주세요.",
  invalid_date: "날짜 형식을 확인해 주세요.",
  invalid_label: "이름을 확인해 주세요.",
  invalid_season: "기간을 확인해 주세요.",
  invalid_token: "링크가 만료됐거나 올바르지 않아요. 새 링크를 받아 주세요.",

  // 순서·상태
  must_reserve_first: "먼저 유보로 바꾼 뒤에 할 수 있어요.",
  not_pending: "이미 처리된 건이에요.",

  // 속도
  too_many: "너무 빨리 여러 번 눌렀어요. 잠시 뒤에 다시 해 주세요.",
};

/**
 * 실패 응답 본문과 HTTP 상태로 화면에 띄울 한 문장을 만든다.
 *
 * `invalid` 가 함께 오면 어떤 값이 문제였는지 덧붙인다 — 트레이너를 여러 명
 * 배정할 때 «누구» 때문에 막혔는지가 사용자에게 제일 중요한 정보다.
 */
export function apiErrorMessage(body: unknown, status?: number): string {
  const data = (body ?? {}) as {
    error?: unknown;
    invalid?: unknown;
    message?: unknown;
    hint?: unknown;
  };

  // 서버가 이미 사람 말을 보냈으면 그대로 쓴다(`hint` 는 기존 API 들이 쓰던 이름).
  for (const spoken of [data.message, data.hint]) {
    if (typeof spoken === "string" && spoken.trim()) return spoken.trim();
  }

  const code = typeof data.error === "string" ? data.error.trim() : "";
  const invalid = typeof data.invalid === "string" ? data.invalid.trim() : "";
  const known = code ? MESSAGES[code] : undefined;

  const base =
    known ??
    (code
      ? `처리하지 못했어요. (코드: ${code})`
      : status
        ? `처리하지 못했어요. (HTTP ${status})`
        : "처리하지 못했어요.");

  return invalid ? `${base} (문제된 값: ${invalid})` : base;
}

/** 테스트와 문서화를 위해 노출한다. 화면에서 직접 읽지 않는다. */
export const API_ERROR_MESSAGES = MESSAGES;
