/**
 * CompanyInfoEditor 필드 정의 (순수 데이터 — 편집기 500줄 캡 분리, 2026-09-28).
 * 정본 배치: consultation-log-and-calendar.md §3-2 + company-info-restructure · company-finance-won-grid
 * (belie 2026-09-28). 섹션 순서 = [대표자] → [기업정보] → [재무]. TXT 추출(lib/service/company-info-txt.ts)의
 * 라벨·순서와 같게 유지한다.
 *
 * 한 섹션 = EditorItem 목록. 보통 칸(field) 말고 선택형·묶음 칸이 있다:
 *  - bizType   : 사업자구분 · 과세유형 한 칸 선택(두 저장 키를 함께 쓴다)
 *  - ownership : 소유여부 자가/임차 선택 + 임차면 보증금·월세·면적 한 줄
 *  - row       : 칸 셋을 한 줄에(업종·업태·주생산품목 — 360px 미만은 세로)
 *  - pair      : 칸 둘을 늘 한 줄에(이름·주민등록번호 / 신용점수·연락처 — 375px 폰에서도)
 *  - hidden    : 화면엔 없지만 저장값이 있는 칸(생년월일 — 문서 자동입력 비교표 라벨·순서용)
 *  - money     : 백만원 금액 칸(영업이익 등 — "백만원" 단위·"약 …" 도움말·옛 글 안내)
 *  - ratio     : 자동 계산 비율(읽기 전용 — 금액 칸에서 계산해 저장)
 *  - sales     : [재무] 연도별 매출(상반기 | 하반기 | 합계 × 4줄) + 매출증가율(자동)
 */
import type { CompanyInfo } from "@/types";
import {
  SALES_GROWTH_DEFS,
  SALES_HALF_KEYS,
  SALES_YEAR_KEYS,
  salesGrowthName,
  salesYearTag,
  salesYearToken,
} from "@/util/company-sales";

type Key = keyof CompanyInfo;

/** 필드 정의: [키, 라벨, 설명(툴팁), span(1|2), multiline?] */
export type FieldDef = [Key, string, string, 1 | 2, boolean?];

/** 소유여부(자가/임차) 묶음 — 기업정보·대표자가 같은 모양을 쓴다. */
export type OwnershipSpec = {
  key: "소유여부" | "대표소유여부";
  hint: string;
  deposit: Key;
  rent: Key;
  area: Key;
  /** 옛 자유 글을 선택으로 바꿀 때 옮겨 둘 기타메모 칸. */
  memo: "업체기타메모" | "대표기타메모";
};

export type EditorItem =
  | { kind: "field"; def: FieldDef; onlyCorporation?: boolean }
  | { kind: "bizType" }
  | { kind: "ownership"; spec: OwnershipSpec }
  | { kind: "row"; defs: FieldDef[] }
  | { kind: "pair"; defs: [FieldDef, FieldDef]; wideSecond?: boolean }
  | { kind: "hidden"; key: Key; label: string }
  | { kind: "money"; def: FieldDef; signed?: boolean }
  | { kind: "ratio"; def: FieldDef }
  | { kind: "sales" };

const f = (def: FieldDef, onlyCorporation?: boolean): EditorItem =>
  onlyCorporation ? { kind: "field", def, onlyCorporation } : { kind: "field", def };

export const 대표자_OWNERSHIP: OwnershipSpec = {
  key: "대표소유여부",
  hint: "대표자 자택이 자가인지 임차인지 골라요. 임차면 보증금·월세·면적을 적어요",
  deposit: "대표임차보증금",
  rent: "대표임차월세",
  area: "대표임차면적",
  memo: "대표기타메모",
};

export const 기업_OWNERSHIP: OwnershipSpec = {
  key: "소유여부",
  hint: "사업장이 자가인지 임차인지 골라요. 임차면 보증금·월세·면적을 적어요",
  deposit: "임차보증금",
  rent: "임차월세",
  area: "임차면적",
  memo: "업체기타메모",
};

/** 사업자구분·과세유형 한 칸의 라벨·설명. */
export const BIZ_TYPE_LABEL = "사업자구분 · 과세유형";
export const BIZ_TYPE_HINT = "개인/법인과 과세유형을 한 번에 골라요. 사업자등록증에 적힌 대로 고르면 돼요";

/** 임차 한 줄 3칸의 [라벨, 단위, 설명]. */
export const LEASE_PARTS = {
  deposit: ["보증금", "원", "보증금을 원 단위 숫자로. 예: 10,000,000"],
  rent: ["월세", "원", "월 차임을 원 단위 숫자로. 예: 500,000"],
  area: ["면적", "㎡", "빌린 면적을 ㎡ 숫자로. 예: 33 (1평 = 3.3058㎡)"],
} as const;

export const RRN_HINT = "앞 6자리(생년월일)만 저장해요. 뒷자리는 비워 두고 저장하지 않아요.";
/** 주민등록번호가 비어 생년월일에서 보여 주는 값일 때의 설명. */
export const RRN_DERIVED_HINT = `생년월일에서 자동으로 채운 값이에요. 무엇이든 고치면 함께 저장돼요. 지우면 생년월일도 함께 지워져요. ${RRN_HINT}`;

// [대표자] — 생년월일은 화면에서 뺐다(주민등록번호 앞자리와 같은 뜻). 저장값은 그대로 두고 TXT·자동입력만 쓴다.
export const 대표자_ITEMS: EditorItem[] = [
  {
    kind: "pair",
    defs: [
      ["대표자이름", "이름", "이름", 1],
      ["주민등록번호", "주민등록번호", RRN_HINT, 1],
    ],
  },
  { kind: "hidden", key: "대표자생년월일", label: "생년월일" },
  {
    kind: "pair",
    defs: [
      ["신용점수", "신용점수(KCB/NCB)", "919/855", 1],
      ["연락처통신사", "연락처/통신사", "010-0000-0000(통신사)", 2],
    ],
    wideSecond: true,
  },
  f(["기대출개인", "기대출 개인", "캐피탈 38백만\n카드론 10백만\n00은행 20백만", 2, true]),
  f(["자택주소지", "자택주소지", "주소지", 2]),
  { kind: "ownership", spec: 대표자_OWNERSHIP },
  f(["동종업계경력", "동종업계경력", "연차 및 경력기록", 2]),
  f(["대표기타메모", "기타메모", "자유 메모", 2, true]),
];

// [기업정보] — 업종·업태·주생산품목 줄은 등록번호 바로 뒤, 4대보험 직원은 소유여부 뒤(belie 2026-09-28).
export const 기업정보_ITEMS: EditorItem[] = [
  f(["개업일", "개업일", "25.01.24", 1]),
  { kind: "bizType" },
  f(["사업자등록번호", "사업자등록번호", "000-00-00000", 1]),
  f(["법인등록번호", "법인등록번호", "법인만 해당. 000000-0000000", 1], true),
  {
    kind: "row",
    defs: [
      ["업종주생산품목", "업종", "사업자등록증의 종목. 예: 제조/필름", 1],
      ["업태", "업태", "사업자등록증의 업태. 예: 도소매, 제조", 1],
      ["주생산품목", "주생산품목", "주로 만들거나 파는 물건. 예: 포장용 필름", 1],
    ],
  },
  f(["소재지", "소재지", "주소지", 2]),
  { kind: "ownership", spec: 기업_OWNERSHIP },
  f(["사대보험직원", "4대보험 직원", "0명 + 프리0명", 1]),
  f(["특허및인증", "특허 및 인증", "특허, ISO, 연구소, 벤처, 메인/이노비즈 등", 2]),
  f(["업체기타메모", "기타메모", "자유 메모", 2, true]),
];

const UNIT_HINT = "백만원 단위 숫자, 소수 한 자리까지.";
const money = (def: FieldDef, signed?: boolean): EditorItem =>
  signed ? { kind: "money", def, signed } : { kind: "money", def };
const ratio = (def: FieldDef): EditorItem => ({ kind: "ratio", def });

/** [재무] — 연도별 매출 묶음(sales) 다음 기대출(사업자), 그다음 재무제표·부가세 금액(백만원)과 자동 비율. */
export const 재무_ITEMS: EditorItem[] = [
  { kind: "sales" },
  f(["기대출사업자", "기대출 사업자", "신보 100백만\n재단 50백만\n중진공 150백만", 2, true]),
  f(["결산연도", "결산연도", "재무제표 기준 연도. 예: 2025", 1]),
  money(["영업이익", "영업이익", `재무제표 영업이익. ${UNIT_HINT} 손실이면 앞에 -. 예: 32`, 1], true),
  money(["당기순이익", "당기순이익", `재무제표 당기순이익. ${UNIT_HINT} 손실이면 앞에 -. 예: 21`, 1], true),
  money(["이자비용", "이자비용", `재무제표 이자비용 — 이자보상배율 계산에 써요. ${UNIT_HINT}`, 1]),
  money(["자산총계", "자산총계", `재무제표 자산총계. ${UNIT_HINT}`, 1]),
  money(["부채총계", "부채총계", `재무제표 부채총계. ${UNIT_HINT}`, 1]),
  money(["자본총계", "자본총계", `재무제표 자본총계. ${UNIT_HINT} 자본잠식이면 앞에 -.`, 1], true),
  money(["면세수입금액", "면세 수입금액", `부가세 과세표준증명원의 면세 수입금액. ${UNIT_HINT}`, 1]),
  ratio(["부채비율", "부채비율", "부채총계 ÷ 자본총계 × 100. 금액 칸에서 자동으로 계산돼요", 1]),
  ratio(["이자보상배율", "이자보상배율", "영업이익 ÷ 이자비용. 1 미만이면 이자를 못 버는 상태예요. 이자비용이 0이면 「이자비용 없음」. 자동으로 계산돼요", 1]),
  ratio(["당기순이익률", "당기순이익률", "당기순이익 ÷ 결산연도 매출(연도별 매출 합계) × 100. 자동으로 계산돼요", 1]),
];

export type SalesDefs = {
  /** 줄(Y..Y-3)마다 [상반기, 하반기, 합계] — 라벨은 기준 연도 포함("Y(2026) 상반기" · "매출 Y(2026)"). */
  rows: [FieldDef, FieldDef, FieldDef][];
  growth: FieldDef[];
};

/** [재무] 매출 칸 정의 — 라벨의 괄호 연도는 업체의 매출 기준 연도(없으면 오늘 연도) 기준. */
export function salesDefs(baseYear: number): SalesDefs {
  return {
    rows: SALES_YEAR_KEYS.map((yk, i): [FieldDef, FieldDef, FieldDef] => {
      const tag = salesYearTag(i, baseYear);
      const [상, 하] = SALES_HALF_KEYS[i]!;
      return [
        [상, `${tag} 상반기`, `${baseYear - i}년 1~6월 매출(부가세 과세표준증명), 백만원`, 1],
        [하, `${tag} 하반기`, `${baseYear - i}년 7~12월 매출(부가세 과세표준증명), 백만원`, 1],
        [yk, `매출 ${tag}`, `${baseYear - i}년 매출 합계, 백만원. 상·하반기를 적으면 자동으로 더해져요`, 1],
      ];
    }),
    growth: SALES_GROWTH_DEFS.map((d): FieldDef => {
      const from = salesYearToken(d.fromAgo);
      const to = salesYearToken(d.fromAgo - 1);
      return [
        d.key,
        salesGrowthName(d.fromAgo),
        `(${to} 매출 − ${from} 매출) ÷ ${from} 매출 × 100. 연도별 매출 합계에서 자동으로 계산돼요`,
        1,
      ];
    }),
  };
}

/** 옛 한 칸 값 — 편집기에서 숨기고, 값이 있으면 읽기 전용 메모로만 보인다(키·시트 열 유지). */
export const LEGACY_SALES_NOTES: [Key, string][] = [
  ["반기별매출", "이전 반기별 매출 메모"],
  ["매출증가율", "이전 매출증가율 메모"],
];

/**
 * 화면 순서대로 편 [키, 라벨] 목록 — 입력 개수 요약·문서 자동입력 비교표 라벨/순서에 쓴다.
 * 선택형·묶음 칸은 저장 키 단위로 펼친다. 매출 라벨은 기준 연도(baseYear) 기준. 매출기준연도 자체는 넣지 않는다.
 */
export function companyInfoFieldList(baseYear: number): [Key, string][] {
  const out: [Key, string][] = [];
  const s = salesDefs(baseYear);
  const push = (items: EditorItem[]) => {
    for (const it of items) {
      if (it.kind === "field" || it.kind === "money" || it.kind === "ratio") out.push([it.def[0], it.def[1]]);
      else if (it.kind === "row" || it.kind === "pair") for (const d of it.defs) out.push([d[0], d[1]]);
      else if (it.kind === "hidden") out.push([it.key, it.label]);
      else if (it.kind === "bizType") out.push(["사업자구분", "사업자구분"], ["과세유형", "과세유형"]);
      else if (it.kind === "ownership") {
        out.push(
          [it.spec.key, "소유여부"],
          [it.spec.deposit, `임차 ${LEASE_PARTS.deposit[0]}`],
          [it.spec.rent, `임차 ${LEASE_PARTS.rent[0]}`],
          [it.spec.area, `임차 ${LEASE_PARTS.area[0]}`],
        );
      } else {
        for (const d of [...s.rows.flat(), ...s.growth]) out.push([d[0], d[1]]);
      }
    }
  };
  push(대표자_ITEMS);
  push(기업정보_ITEMS);
  push(재무_ITEMS);
  return out;
}
