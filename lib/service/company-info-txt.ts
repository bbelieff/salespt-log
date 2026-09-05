/**
 * Layer: service — 업체정보 TXT 추출 유스케이스 (consultation-log §3-3, ADR-0016).
 *
 * 대상 폴더 = registry O(feedback_folder_id): 아레나 = 업체관리 폴더(생성 시 stamp),
 * 일반 기수 = 피드백업체 폴더(Drive 연동 시 stamp). 빈값이면 명확한 에러.
 * 파일 = `업체정보_{업체명}.txt` 업체당 1본 덮어쓰기.
 */
import type { CompanyInfo } from "@/types";

// 키 → 표시 라벨 (CompanyInfoEditor 와 동일 표기, field-grid 2026-06-11 확정).
// [업체] 14 (매출 최신순 금년→Y-1→Y-2→Y-3) + [대표자] 9.
const 업체_LABELS: [keyof CompanyInfo, string][] = [
  ["개업일", "개업일"],
  ["사업자구분", "사업자구분"],
  ["사업자등록번호", "사업자등록번호"],
  ["사대보험직원", "4대보험 직원"],
  ["소재지", "소재지"],
  ["소유여부", "소유여부"],
  ["업종주생산품목", "업종/주생산품목"],
  ["금년도매출", "금년도 매출"],
  ["과년도매출", "과년도 매출 Y-1"],
  ["과년도매출Y2", "과년도 매출 Y-2"],
  ["과년도매출Y3", "과년도 매출 Y-3"],
  ["기대출사업자", "기대출(사업자)"],
  ["특허및인증", "특허 및 인증"],
  ["업체기타메모", "기타메모"],
];
const 대표자_LABELS: [keyof CompanyInfo, string][] = [
  ["대표자이름", "이름"],
  ["대표자생년월일", "생년월일"],
  ["신용점수", "신용점수(KCB/NCB)"],
  ["연락처통신사", "연락처/통신사"],
  ["기대출개인", "기대출(개인)"],
  ["자택주소지", "자택주소지"],
  ["대표소유여부", "소유여부"],
  ["동종업계경력", "동종업계경력"],
  ["대표기타메모", "기타메모"],
];

// ── 정렬형 포맷 (§3-3 확정) — 탭 금지, EAW 공백 패딩 ─────────────
/** East Asian Width 환산 표시폭 — 한글·CJK=2칸, 그 외=1칸. */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    w +=
      (c >= 0x1100 && c <= 0x115f) || // 한글 자모
      (c >= 0x25a0 && c <= 0x25ff) || // ●▲ 등 도형 — 한글 고정폭에서 2칸 (EAW Ambiguous)
      (c >= 0x2e80 && c <= 0xa4cf) || // CJK 부수~한자
      (c >= 0xac00 && c <= 0xd7a3) || // 한글 음절
      (c >= 0xf900 && c <= 0xfaff) || // CJK 호환 한자
      (c >= 0xfe30 && c <= 0xfe4f) ||
      (c >= 0xff00 && c <= 0xff60) || // 전각
      (c >= 0xffe0 && c <= 0xffe6)
        ? 2
        : 1;
  }
  return w;
}

const BULLET = "● ";
// 값 시작 열 = 가장 긴 라벨("신용점수(KCB/NCB)"=17칸) + 2칸 여유 — 전 줄 공통.
const LABEL_CELL = Math.max(
  ...[...업체_LABELS, ...대표자_LABELS].map(([, l]) => displayWidth(l)),
  displayWidth("업체명"),
  displayWidth("추출시각"),
) + 2;
const VALUE_COL = displayWidth(BULLET) + LABEL_CELL;
const RULE = "=".repeat(VALUE_COL + 18);

/** 한 필드 → 정렬 줄(들). 멀티라인 값은 "- " 목록 + 값 시작 열 들여쓰기. 빈값은 []. */
function fieldLines(label: string, value: string): string[] {
  const v = value.trim();
  if (!v) return []; // 빈 필드 줄 생략
  const pad = " ".repeat(Math.max(1, LABEL_CELL - displayWidth(label)));
  const head = `${BULLET}${label}${pad}`;
  const parts = v.split("\n").map((x) => x.trim()).filter(Boolean);
  if (parts.length <= 1) return [`${head}${parts[0] ?? ""}`];
  const indent = " ".repeat(VALUE_COL);
  return parts.map((p, i) => (i === 0 ? `${head}- ${p}` : `${indent}- ${p}`));
}

/**
 * 사람이 읽는 TXT 본문 (정렬형, 2026-06-11 확정) — 순수(테스트 대상).
 * 머리(구분선+업체명+추출시각) → [업체] → [대표자]. 커스텀은 그룹 끝.
 * 메모장(고정폭)에서 값들이 한 세로선에 정렬되도록 EAW 공백 패딩.
 */
export function formatCompanyInfoTxt(
  업체명: string,
  ci: CompanyInfo,
  extractedAt: string,
): string {
  const c = ci as unknown as Record<string, string>;
  const section = (
    title: string,
    labels: [keyof CompanyInfo, string][],
    g: "업체" | "대표자",
  ) => [
    `[${title}]`,
    ...labels.flatMap(([k, label]) => fieldLines(label, String(c[k] ?? ""))),
    ...Object.entries(ci.커스텀?.[g] ?? {}).flatMap(([label, v]) =>
      fieldLines(label, v),
    ),
  ];
  return [
    RULE,
    "세일즈PT 업체정보",
    ...fieldLines("업체명", 업체명),
    ...fieldLines("추출시각", extractedAt),
    RULE,
    "",
    ...section("업체", 업체_LABELS, "업체"),
    "",
    ...section("대표자", 대표자_LABELS, "대표자"),
  ].join("\n");
}

/**
 * Drive 권한 계열 원인 분류 — 순수(테스트 대상). null = 권한 문제 아님.
 * (fix/txt-export-admin-oauth: 토큰 미설정 throw·만료·SA quota 를 한글 안내로 치환)
 */
export function classifyDriveAuthError(
  msg: string,
): "token_missing" | "token_invalid" | "quota" | null {
  if (msg.includes("ADMIN_DRIVE_REFRESH_TOKEN")) return "token_missing";
  if (/invalid_grant|invalid_rapt|unauthorized_client/i.test(msg)) return "token_invalid";
  if (/storage quota|do not have storage/i.test(msg)) return "quota";
  return null;
}

/** TXT 파일명 — 업체당 1본 키. */
export function companyInfoTxtFileName(업체명: string): string {
  return `업체정보_${업체명.trim()}.txt`;
}
