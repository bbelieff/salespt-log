/**
 * mask-snapshot-core — 운영 DB 행을 "가짜로 바꾼 사본"으로 만드는 순수 함수(네트워크·DB 없음).
 * 연습장(샌드박스) 설계 = 화석 코드 정비(2026-10-15, belie 승인 "가짜로 바꾼 사본 써").
 * 테스트: tests/ops/mask-snapshot.test.ts
 *
 * 원칙: **기본은 전부 바꾼다(deny-by-default).** 구조 시험에 꼭 필요한 값만 남긴다.
 *  - 남김: 숫자·불리언·null, 날짜·시각 꼴, UUID, 짧은 상태값(아래 KEEP_VALUES — 앱의 enum 값),
 *          행 키 꼴("현수막:r12", "r34", "manual:…" 의 접두), 6자리 이하 숫자 문자열(직렬 날짜·금액).
 *  - 바꿈: 그 밖의 모든 문자열 → `가짜-<해시8>`. **같은 원본은 같은 가짜**(관계·중복 판정 유지).
 *          이메일은 `userNNNNNN@example.test`, 긴 숫자는 같은 길이의 가짜 숫자.
 *  - 비움: 비밀 표(토큰·PIN·보관함 암호문)는 행을 내보내지 않는다(DROP_ROW_TABLES).
 *  - salt 는 실행마다 새로 — 서로 다른 사본끼리도, 원본과도 대조할 수 없게.
 */
import { createHash } from "node:crypto";

export const DROP_ROW_TABLES = new Set(["gcal_tokens", "vault_pins", "company_vault"]);

/** 앱이 쓰는 짧은 상태·분류 값(lib/types z.enum 등). 이 값과 정확히 같으면 그대로 둔다. */
export const KEEP_VALUES = new Set([
  "매입DB", "직접생산", "현수막", "콜·지·기·소",
  "예약", "계약", "완료", "변경", "취소",
  "미컨택", "부재", "단순거절", "재통화", "컨택진행", "상담 후 거절",
  "유입", "연락", "상담", "미팅", "매출", "앱사용량", "공유왕",
  "기타", "전화", "메시지", "일반",
  "active", "paused", "archived", "pending", "all", "arena", "regular",
  "entry", "recurringRule", "recurringOccurrence", "month", "category", "once", "daily", "always",
  "production", "inflow", "contactProgress", "meetingReservation", "contacts", "meetings", "contracts",
  "senior", "apprentice", "todo", "history", "trainee", "trainer", "admin", "captain",
  "login", "bank", "rrn", "other", "수강생", "아레나", "테스트",
  "이월", "ㅇ", "O", "o", "TRUE", "FALSE", "true", "false", "Y", "N",
  "법인", "개인", "일반과세자", "간이과세자", "면세사업자", "자가", "임차",
  "부가세 포함", "부가세 별도", "포함", "별도", "생산중", "종료",
  "meetings", "todos", "sales", "db", "contracts", "carryover", "companyInfo",
]);

const DATE_LIKE = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}(:?\d{2})?)?)?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const ROW_KEY = /^([\w가-힣·]{1,16}:)?r?\d{1,6}$/;
const PERCENT = /^\d{1,3}%$/;

export function makeMasker(salt) {
  if (!salt || salt.length < 16) throw new Error("salt 16자 이상 필요(실행마다 새로)");
  const h = (s) => createHash("sha256").update(salt).update("\u0000").update(s).digest("hex");
  const n6 = (s) => String(parseInt(h(s).slice(0, 8), 16) % 1_000_000).padStart(6, "0");
  const fakeEmail = (e) => `user${n6(e.toLowerCase())}@example.test`;

  function maskString(v) {
    if (v === "" || KEEP_VALUES.has(v)) return v;
    if (DATE_LIKE.test(v) || UUID.test(v) || PERCENT.test(v)) return v;
    if (/^-?[\d,.]+$/.test(v)) {
      const digits = v.replace(/\D/g, "");
      if (digits.length <= 6) return v;
      const fake = (h(v).replace(/\D/g, "") + "0".repeat(digits.length)).slice(0, digits.length);
      let i = 0;
      return v.replace(/\d/g, () => fake[i++]);
    }
    if (ROW_KEY.test(v)) return v;
    const m = v.match(/^(manual):(.+)$/);
    if (m) return `${m[1]}:${maskString(m[2])}`;
    if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v)) return fakeEmail(v);
    return `가짜-${h(v).slice(0, 8)}`;
  }

  /** 보통 키(필드명·열문자)는 그대로, 이메일·긴 숫자·하이픈 번호 꼴 키만 가린다. */
  function maskKey(k) {
    return /@|\d{6}/.test(k) ? maskString(k) : k;
  }

  function maskValue(v) {
    if (v === null || v === undefined) return v;
    if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return v;
    if (v instanceof Date) return v;
    if (typeof v === "string") return maskString(v);
    if (Array.isArray(v)) return v.map(maskValue);
    if (Buffer.isBuffer(v)) return null; // 바이너리(암호문 등) 는 비운다
    if (typeof v === "object") {
      const out = {};
      // 키 자체가 개인정보인 맵(이메일·번호를 키로 쓰는 jsonb)도 있다 — 2026-10-15 첫 실행에서 원본 흔적 검사가 잡음.
      for (const [k, x] of Object.entries(v)) out[maskKey(k)] = maskValue(x);
      return out;
    }
    return null;
  }

  return { maskValue, maskRow: maskValue };
}

/** 내보내기 직전 검사 — 원본 흔적이 하나라도 있으면 throw(파일을 남기지 않게 호출부가 처리). */
export function assertNoPii(text) {
  const problems = [];
  const emails = (text.match(EMAIL) ?? []).filter((e) => !/@example\.test$/i.test(e));
  if (emails.length) problems.push(`이메일 ${emails.length}건`);
  if (/(?<!\d)01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}(?!\d)/.test(text)) problems.push("전화번호 꼴");
  if (/(?<!\d)\d{6}\s*-\s*[1-8]\d{6}(?!\d)/.test(text)) problems.push("주민등록번호 꼴");
  if (/(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/.test(text)) problems.push("사업자등록번호 꼴");
  if (/[가-힣]{2,4}(님|대표|사장)/.test(text)) problems.push("호칭 붙은 이름 꼴");
  if (problems.length) throw new Error(`가짜 사본에 원본 흔적: ${problems.join(", ")} — 내보내지 않음`);
}

/** 원본 흔적이 남은 위치(경로만 — 값은 돌려주지 않는다). 실패 원인을 값 노출 없이 찾기 위함. */
export function piiPaths(value, path = "$") {
  const out = [];
  const hit = (s) => { try { assertNoPii(JSON.stringify(s)); return false; } catch { return true; } };
  if (typeof value === "string") { if (hit(value)) out.push(path); return out; }
  if (Array.isArray(value)) { value.forEach((x, i) => out.push(...piiPaths(x, `${path}[${i}]`))); return out; }
  if (value && typeof value === "object") {
    for (const [k, x] of Object.entries(value)) {
      if (hit(k)) out.push(`${path}.<키>`);
      out.push(...piiPaths(x, `${path}.${/^[\w가-힣]{1,30}$/.test(k) ? k : "<키>"}`));
    }
  }
  return out;
}
