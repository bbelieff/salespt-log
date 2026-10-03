/**
 * Layer: service — 업체정보 TXT 추출 유스케이스 (consultation-log §3-3, ADR-0016).
 *
 * 대상 폴더 = registry O(feedback_folder_id): 아레나 = 업체관리 폴더(생성 시 stamp),
 * 일반 기수 = 피드백업체 폴더(Drive 연동 시 stamp). 빈값이면 명확한 에러.
 * 파일 = `업체정보_{업체명}.txt` 업체당 1본 덮어쓰기.
 */
import type { CompanyInfo } from "@/types";
import {
  SALES_GROWTH_DEFS,
  SALES_HALF_KEYS,
  SALES_YEAR_KEYS,
  parseBaseYear,
  salesGrowthName,
  salesYearTag,
} from "@/util/company-sales";
import { formatMoneyTxt, isMoneyKey, isSignedMoneyKey } from "@/util/company-money";

type Labels = [keyof CompanyInfo, string][];

// 키 → 표시 라벨 (CompanyInfoEditor 와 같은 순서·표기 — components/company-info-defs.ts).
// 순서(belie 2026-09-28): [대표자] → [기업정보] → [재무]. 매출·기대출(사업자)은 [재무] 로 옮겼다.
// 생년월일은 편집기에서 뺐다 — 주민등록번호가 비었을 때만 줄을 쓴다(company-finance-won-grid).
const 대표자_LABELS: Labels = [
  ["대표자이름", "이름"],
  ["주민등록번호", "주민등록번호"],
  ["대표자생년월일", "생년월일"],
  ["신용점수", "신용점수(KCB/NCB)"],
  ["연락처통신사", "연락처/통신사"],
  ["기대출개인", "기대출(개인)"],
  ["자택주소지", "자택주소지"],
  ["대표소유여부", "소유여부"],
  ["대표임차보증금", "임차 보증금"],
  ["대표임차월세", "임차 월세"],
  ["대표임차면적", "임차 면적"],
  ["동종업계경력", "동종업계경력"],
  ["대표기타메모", "기타메모"],
];
const 기업정보_LABELS: Labels = [
  ["개업일", "개업일"],
  ["사업자구분", "사업자구분"],
  ["과세유형", "과세유형"],
  ["사업자등록번호", "사업자등록번호"],
  ["법인등록번호", "법인등록번호"],
  ["업종주생산품목", "업종"],
  ["업태", "업태"],
  ["주생산품목", "주생산품목"],
  ["소재지", "소재지"],
  ["소유여부", "소유여부"],
  ["임차보증금", "임차 보증금"],
  ["임차월세", "임차 월세"],
  ["임차면적", "임차 면적"],
  ["사대보험직원", "4대보험 직원"],
  ["특허및인증", "특허 및 인증"],
  ["업체기타메모", "기타메모"],
];

/** [재무] 라벨 — 매출 칸은 기준 연도(baseYear)가 붙는다. 편집기 표와 같은 줄 순서(상반기·하반기·합계). */
function 재무Labels(baseYear: number): Labels {
  return [
    ["매출기준연도", "매출 기준 연도"],
    ...SALES_YEAR_KEYS.flatMap((k, i): [keyof CompanyInfo, string][] => [
      [SALES_HALF_KEYS[i]![0], `${salesYearTag(i, baseYear)} 상반기`],
      [SALES_HALF_KEYS[i]![1], `${salesYearTag(i, baseYear)} 하반기`],
      [k, `매출 ${salesYearTag(i, baseYear)}`],
    ]),
    ["반기별매출", "이전 반기별 매출 메모"],
    ...SALES_GROWTH_DEFS.map((d): [keyof CompanyInfo, string] => [d.key, `매출증가율 ${salesGrowthName(d.fromAgo)}`]),
    ["매출증가율", "이전 매출증가율 메모"],
    ["기대출사업자", "기대출(사업자)"],
    ["결산연도", "결산연도"],
    ["영업이익", "영업이익"],
    ["당기순이익", "당기순이익"],
    ["이자비용", "이자비용"],
    ["자산총계", "자산총계"],
    ["부채총계", "부채총계"],
    ["자본총계", "자본총계"],
    ["면세수입금액", "면세 수입금액"],
    ["부채비율", "부채비율"],
    ["이자보상배율", "이자보상배율"],
    ["당기순이익률", "당기순이익률"],
  ];
}

/** 숫자만 적힌 임차 칸에 단위를 붙인다(편집기 칸 옆 "원"·"㎡" 와 같은 뜻). 옛 "1,000만" 은 그대로. */
const UNIT_OF: Partial<Record<keyof CompanyInfo, string>> = {
  임차보증금: "원",
  임차월세: "원",
  임차면적: "㎡",
  대표임차보증금: "원",
  대표임차월세: "원",
  대표임차면적: "㎡",
};
function withUnit(k: keyof CompanyInfo, v: string): string {
  // [재무] 금액 = 백만원 숫자 → "250.1백만원 (약 2.5억)". 옛 자유 글은 그대로.
  if (isMoneyKey(k)) return formatMoneyTxt(v, isSignedMoneyKey(k));
  const unit = UNIT_OF[k];
  return unit && /^[\d,.]+$/.test(v.trim()) ? `${v.trim()}${unit}` : v;
}

// ── 정렬형 포맷 (§3-3 확정) — 탭 금지, EAW 공백 패딩 ─────────────
/** East Asian Width 환산 표시폭 — 한글·CJK=2칸, 그 외=1칸. */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    w +=
      (c >= 0x1100 && c <= 0x115f) || // 한글 자모
      (c >= 0x2190 && c <= 0x21ff) || // → 등 화살표(매출증가율 라벨) — 한글 고정폭에서 2칸 (EAW Ambiguous)
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
// 값 시작 열 = 가장 긴 라벨("이전 반기별 매출 메모"=21칸) + 2칸 여유 — 전 줄 공통.
// 매출 라벨의 연도 숫자는 해마다 바뀌어도 폭(4자리)이 같아 열이 흔들리지 않는다.
const LABEL_CELL = Math.max(
  ...[...대표자_LABELS, ...기업정보_LABELS, ...재무Labels(2000)].map(([, l]) => displayWidth(l)),
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

/** 매출 라벨 기준 연도 — 업체의 매출기준연도, 없으면 추출시각("2026-09-28 10:00", KST) 연도, 그것도 없으면 오늘. */
function baseYearOf(ci: CompanyInfo, extractedAt: string): number {
  const saved = parseBaseYear(ci.매출기준연도);
  if (saved !== null) return saved;
  const m = extractedAt.match(/^(\d{4})-/);
  return m ? Number(m[1]) : new Date().getFullYear();
}

/**
 * 사람이 읽는 TXT 본문 (정렬형, 2026-06-11 확정) — 순수(테스트 대상).
 * 머리(구분선+업체명+추출시각) → [대표자] → [기업정보] → [재무](값 있을 때만). 커스텀은 그룹 끝
 * (저장 키는 커스텀.업체·커스텀.대표자 그대로 — [기업정보] = 커스텀.업체).
 * 메모장(고정폭)에서 값들이 한 세로선에 정렬되도록 EAW 공백 패딩.
 */
export function formatCompanyInfoTxt(
  업체명: string,
  ci: CompanyInfo,
  extractedAt: string,
): string {
  const c = ci as unknown as Record<string, string>;
  // 생년월일 줄은 주민등록번호가 비었을 때만(같은 뜻 — 편집기에서도 뺐다).
  const skip = (k: keyof CompanyInfo) => k === "대표자생년월일" && String(c.주민등록번호 ?? "").trim() !== "";
  const section = (
    title: string,
    labels: Labels,
    g?: "업체" | "대표자",
  ) => [
    `[${title}]`,
    ...labels.flatMap(([k, label]) => (skip(k) ? [] : fieldLines(label, withUnit(k, String(c[k] ?? ""))))),
    ...Object.entries((g && ci.커스텀?.[g]) || {}).flatMap(([label, v]) =>
      fieldLines(label, v),
    ),
  ];
  // [재무] 는 새 그룹 — 한 칸도 안 채운 업체의 TXT 에 빈 머리글만 남기지 않는다(기준 연도만 있으면 없는 것으로).
  const financeLabels = 재무Labels(baseYearOf(ci, extractedAt));
  const 재무 = section("재무", financeLabels);
  const 재무있음 = financeLabels.some(([k]) => k !== "매출기준연도" && String(c[k] ?? "").trim() !== "");
  return [
    RULE,
    "세일즈PT 업체정보",
    ...fieldLines("업체명", 업체명),
    ...fieldLines("추출시각", extractedAt),
    RULE,
    "",
    ...section("대표자", 대표자_LABELS, "대표자"),
    "",
    ...section("기업정보", 기업정보_LABELS, "업체"),
    ...(재무있음 ? ["", ...재무] : []),
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
