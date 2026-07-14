/**
 * 연락처 포맷 — **순수 함수**(의존성 0). 앱 전체 연락처 표시·입력의 단일 원천.
 *
 * 저장 방침(belie 확정): **하이픈 포함 문자열 저장 OK**. 데이터 안전성 측면에서도 옳다 —
 * 시트 쓰기는 전 경로 `USER_ENTERED` 라 **숫자만 문자열("01012345678")은 Sheets 가 숫자로
 * 파싱해 선행 0 을 날린다**. 하이픈이 있으면 텍스트로 안전하게 유지된다.
 *
 * 그래서 읽기 쪽엔 **선행 0 이 소실된 레거시**("1012345678")가 섞여 있다 → normalizePhoneDigits
 * 가 9·10자리 무-선행0 을 0 패딩해 복원한다(안 하면 "101-2345-678" 같은 오포맷).
 *
 * ⚠️ **합본 필드 주의**: `CompanyInfo.연락처통신사` 는 "010-1234-5678(SKT)" 처럼 **전화+통신사
 * 합본 자유문자열**이다. 전체 마스킹하면 괄호부가 파괴된다 → formatPhone 은 **선행 숫자 런만
 * 포맷하고 뒤 텍스트는 그대로 보존**한다.
 *
 * 기존 데이터 마이그레이션은 하지 않는다(표시 정규화로 흡수 — belie 확정).
 */

/**
 * 전화 숫자만 추출 + **선행 0 복원**.
 * 시트가 숫자로 먹어 0 이 날아간 레거시(9·10자리, 0 으로 시작 안 함)를 0 패딩.
 */
export function normalizePhoneDigits(raw: string | number | null | undefined): string {
  let d = String(raw ?? "").replace(/[^\d]/g, "");
  if (d && !d.startsWith("0") && (d.length === 9 || d.length === 10)) d = "0" + d;
  return d;
}

/** 숫자열 → 하이픈 폼(완성형). 규칙 밖 길이(부분 입력 등)는 숫자 그대로 반환. */
function hyphenate(d: string): string {
  if (!d) return "";
  if (d.startsWith("02")) {
    if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`; // 02-123-4567
    if (d.length === 10) return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`; // 02-1234-5678
    return d;
  }
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`; // 010-1234-5678
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`; // 031-123-4567
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`; // 1588-1234
  return d; // 부분·비정형 → 원본 숫자
}

/**
 * **표시용** — 저장값(레거시 포함)을 하이픈 폼으로 정규화.
 * **선행 숫자 런만** 포맷하고 뒤 텍스트(예: "(SKT)")는 보존 → 합본 필드 안전.
 * 숫자가 없으면 원본 그대로.
 */
export function formatPhone(raw: string | number | null | undefined): string {
  const s = String(raw ?? "");
  const m = s.match(/^([\d\-.\s]*)([\s\S]*)$/);
  const lead = m?.[1] ?? "";
  const rest = m?.[2] ?? "";
  const digits = normalizePhoneDigits(lead);
  if (!digits) return s; // 숫자 없음 → 원본 보존
  const gap = lead.match(/\s+$/)?.[0] ?? ""; // 접미 앞 공백 보존
  return hyphenate(digits) + gap + rest;
}

/**
 * **입력 마스크** — 타이핑 중 진행형 하이픈. 숫자만 취해 최대 11자리(02 는 10자리).
 * 순수 전화 필드용(합본 필드는 formatPhone 표시 정규화로 처리).
 */
/** 숫자열 → 진행형 하이픈. 선행 0 복원은 호출부(maskPhoneInput)가 이미 수행. */
function maskDigits(d: string): string {
  if (!d) return "";

  // 02 (서울) — 2-3-4(9자리) / 2-4-4(10자리)
  if (d.startsWith("02")) {
    d = d.slice(0, 10);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  }

  // 휴대폰(01x) — 3-4-4(11자리). 지역번호(3-3-4)와 분절이 달라 접두로 분기해야
  // 타이핑 중 "010-123-45" 같은 오분절이 안 생긴다.
  if (d.startsWith("01")) {
    d = d.slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }

  // 그 외 지역번호(031·051…) — 3-3-4(10자리)
  if (d.startsWith("0")) {
    d = d.slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
    if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }

  // 0 으로 시작 안 함 = 15xx/16xx/18xx 대표번호 등. 8자리 4-4(hyphenate 와 동일),
  // 그 외는 **원본 숫자 유지**(임의 분절로 번호를 바꾸지 않는다).
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return d.slice(0, 11);
}

/**
 * **입력 마스크 — 비파괴**. 타이핑 중 진행형 하이픈을 붙이되:
 *  - **선행 전화 런만** 마스킹하고 **뒤 텍스트는 그대로 보존** — 연락처 칸에는 메모·2번째 번호·
 *    통신사가 함께 적혀 있을 수 있다("010-1234-5678 (김대표)", "010-1111-2222 / 010-3333-4444").
 *    숫자만 남기고 잘라내면 **시트의 원문이 영구 삭제**된다.
 *  - **선행 0 복원**(normalizePhoneDigits) — 시트가 숫자로 먹어 0 이 날아간 레거시("1012345678")를
 *    "101-234-5678"(전혀 다른 번호)로 굳히지 않는다.
 */
export function maskPhoneInput(raw: string | null | undefined): string {
  const s = String(raw ?? "");
  const m = s.match(/^([\d\-.\s]*)([\s\S]*)$/);
  const lead = m?.[1] ?? "";
  const rest = m?.[2] ?? "";
  const gap = lead.match(/\s+$/)?.[0] ?? ""; // 접미 앞 공백 보존
  const masked = maskDigits(normalizePhoneDigits(lead));
  return rest ? `${masked}${gap}${rest}` : masked;
}
