/**
 * Layer: analytics (순수 계산 — util 의 행정구역 표만 읽음). 맞춤공고 매칭용 업체 특성 — 업체정보 글에서 계산(2026-10-25 belie 승인 목업).
 *
 * 저장 원칙: 자동 값은 저장하지 않는다. 소재지·업태·업종·특허및인증 글에서 읽을 때마다 계산하고,
 * 수강생이 직접 고른 값만 CompanyInfo 확장5(지역시도·지역시군구·대분류·제외업종·공고특성)에 남는다.
 * 그래서 서류를 다시 읽혀 소재지가 바뀌면 자동 값은 따라 바뀌고, 손으로 고른 값은 그대로다.
 */
import { parseRegion, type Region, type Sido, SIDO } from "@/util/admin-regions";

export const 대분류_목록 = ["제조업", "건설업", "운수업", "도소매업", "음식·숙박업", "정보통신", "그 밖의 서비스업"] as const;
export type 대분류 = (typeof 대분류_목록)[number];

/** 공고 특성 칩(여러 개). 벤처·이노비즈·메인비즈는 「특허 및 인증」 글에 적혀 있으면 자동으로 켠다. */
export const 공고특성_목록 = [
  "여성기업", "장애인기업", "수출(직접)", "수출(간접)", "재창업", "피해·위기 기업", "사회적기업·협동조합", "벤처", "이노비즈", "메인비즈",
] as const;
export type 공고특성 = (typeof 공고특성_목록)[number];

interface GrantSource {
  소재지?: string;
  업태?: string;
  업종주생산품목?: string;
  주생산품목?: string;
  특허및인증?: string;
  사대보험직원?: string;
  지역시도?: string;
  지역시군구?: string;
  대분류?: string;
  제외업종?: string;
  공고특성?: string;
}

/** 업태·업종 글 → 대분류. 앞에 있는 낱말(업태)이 먼저. 못 고르면 "". */
const 대분류_낱말: ReadonlyArray<[대분류, RegExp]> = [
  ["제조업", /제조|가공|생산|공장/],
  ["건설업", /건설|건축|토목|인테리어|공사|전기공사|설비/],
  ["운수업", /운수|운송|화물|택배|물류|여객|택시|퀵/],
  ["음식·숙박업", /음식|요식|식당|카페|커피|주점|제과|베이커리|숙박|모텔|펜션|호텔|외식/],
  ["정보통신", /정보통신|소프트웨어|프로그램|앱|플랫폼|IT|출판|영상|방송|통신|데이터|웹/i],
  ["도소매업", /도매|소매|도소매|판매|유통|무역|쇼핑몰|전자상거래|통신판매/],
  ["그 밖의 서비스업", /서비스|교육|학원|미용|뷰티|헬스|컨설팅|광고|디자인|수리|세탁|부동산|임대|의료|병원/],
];

export function deriveIndustry(업태 = "", 업종 = "", 아이템 = ""): 대분류 | "" {
  for (const text of [업태, 업종, 아이템]) {
    const t = String(text ?? "").trim();
    if (!t) continue;
    for (const [name, re] of 대분류_낱말) if (re.test(t)) return name;
  }
  return "";
}

/** 정책자금에서 흔히 빼는 업종 낱말 — 있으면 「제외 업종」을 미리 켠다(바꿀 수 있음). */
const 제외_낱말 = /유흥|단란|무도|도박|사행|카지노|부동산\s*(임대|매매|개발|공급)|임대업|대부|금융|보험|담배|성인/;
export function deriveExcluded(업태 = "", 업종 = "", 아이템 = ""): boolean {
  return 제외_낱말.test(`${업태} ${업종} ${아이템}`);
}

/** 「특허 및 인증」·기타 글에서 공고 특성 이름이 보이면 자동으로 켠다. */
export function deriveFeatures(특허및인증 = ""): 공고특성[] {
  const t = String(특허및인증 ?? "");
  const out: 공고특성[] = [];
  if (/벤처/.test(t)) out.push("벤처");
  if (/이노비즈|inno-?biz/i.test(t)) out.push("이노비즈");
  if (/메인비즈|main-?biz/i.test(t)) out.push("메인비즈");
  if (/여성기업/.test(t)) out.push("여성기업");
  if (/장애인기업/.test(t)) out.push("장애인기업");
  if (/사회적기업|협동조합/.test(t)) out.push("사회적기업·협동조합");
  return out;
}

export function splitFeatures(raw = ""): 공고특성[] {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is 공고특성 => (공고특성_목록 as readonly string[]).includes(s));
}

/** 「4명 + 프리2명」 같은 글에서 앞 숫자(4대보험 직원 수). 못 읽으면 null. */
export function employeeCount(text = ""): number | null {
  const m = String(text ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** 소상공인 판정 — 제조·건설·운수(+광업) 10명 미만, 그 외 5명 미만. 대분류나 직원 수를 모르면 null. */
export function isSmallBusiness(industry: 대분류 | "", employees: number | null): boolean | null {
  if (!industry || employees === null) return null;
  const limit = industry === "제조업" || industry === "건설업" || industry === "운수업" ? 10 : 5;
  return employees < limit;
}

export interface GrantProfile {
  region: Region;
  regionAuto: boolean;
  industry: 대분류 | "";
  industryAuto: boolean;
  excluded: boolean;
  excludedAuto: boolean;
  /** 켜진 특성(직접 고른 것 + 자동). */
  features: 공고특성[];
  /** 자동으로 켜진 특성(직접 고른 목록에 없는 것). */
  autoFeatures: 공고특성[];
  smallBusiness: boolean | null;
  /** 헤더 「공고필터 n/3」 — 지역·대분류·규모 판정이 되는가. */
  ready: number;
}

/** 저장값(직접 고른 것) 우선, 비어 있으면 업체정보 글에서 계산. */
export function grantProfile(ci: GrantSource): GrantProfile {
  const manualSido = (SIDO as readonly string[]).includes(String(ci.지역시도 ?? "").trim()) ? (String(ci.지역시도).trim() as Sido) : "";
  const parsed = parseRegion(ci.소재지 ?? "");
  const region: Region = manualSido ? { 시도: manualSido, 시군구: String(ci.지역시군구 ?? "").trim() } : parsed;
  const manualIndustry = (대분류_목록 as readonly string[]).includes(String(ci.대분류 ?? "").trim()) ? (String(ci.대분류).trim() as 대분류) : "";
  const industry = manualIndustry || deriveIndustry(ci.업태, ci.업종주생산품목, ci.주생산품목);
  const ex = String(ci.제외업종 ?? "").trim();
  const excludedAuto = ex !== "예" && ex !== "아니오";
  const excluded = excludedAuto ? deriveExcluded(ci.업태, ci.업종주생산품목, ci.주생산품목) : ex === "예";
  const manual = splitFeatures(ci.공고특성);
  const auto = deriveFeatures(ci.특허및인증).filter((f) => !manual.includes(f));
  const features = 공고특성_목록.filter((f) => manual.includes(f) || auto.includes(f));
  const smallBusiness = isSmallBusiness(industry, employeeCount(ci.사대보험직원));
  const ready = (region.시도 ? 1 : 0) + (industry ? 1 : 0) + (smallBusiness !== null ? 1 : 0);
  return { region, regionAuto: !manualSido, industry, industryAuto: !manualIndustry, excluded, excludedAuto, features, autoFeatures: auto, smallBusiness, ready };
}
