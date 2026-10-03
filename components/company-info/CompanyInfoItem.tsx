/**
 * CompanyInfoItem — 업체정보 편집기의 항목 하나 그리기(company-info-defs.ts 의 EditorItem).
 * CompanyInfoEditor 에서 분리(company-finance-won-grid, belie 2026-09-28 — 편집기 500줄 캡).
 *
 * - field/row/pair: 보통 칸. pair = 두 칸을 늘 한 줄(375px 폰에서도) — 이름·주민등록번호, 신용점수·연락처.
 * - 주민등록번호가 비었고 (화면에서 뺀) 생년월일을 읽을 수 있으면 "880124-" 를 **보여 주기만** 한다
 *   (설명에 "자동으로 채운 값"). 저장은 사용자가 무엇이든 고칠 때 apply() 가 한다 — 열기만 해선 안 함.
 *   그 값을 통째로 지우면 생년월일도 함께 지운다(비운 채로 남게).
 * - money: 백만원 금액 칸 + 옛 자유 글 「백만원으로 바꾸기」. ratio: 자동 계산 비율(읽기 전용).
 * - bizType·ownership: 선택형 칸. sales: 연도별 매출 표. hidden: 그리지 않는다.
 * wide = 2열 그리드에서 전폭(sm:col-span-2). inline(PC 좁은 단)은 1열이라 전폭 개념 없음.
 */
"use client";

import type { CompanyInfo } from "@/types";
import { isCorporation } from "@/util/company-choice";
import { birthToRrnFront } from "@/util/rrn-front";
import { resolveBaseYear } from "@/util/company-sales";
import { computeRatios, legacyMoneyConvertPatch, type RatioKey } from "@/service/company-finance";
import { RRN_DERIVED_HINT, type EditorItem, type FieldDef } from "@/components/company-info-defs";
import CompanyInfoField from "./CompanyInfoField";
import { BizTypeField, OwnershipField } from "./CompanyInfoChoiceFields";
import { MoneyField, RatioField } from "./CompanyInfoFinanceFields";
import CompanyInfoSalesFields from "./CompanyInfoSalesFields";

type CI = CompanyInfo;

interface Props {
  it: EditorItem;
  draft: CI;
  inline: boolean;
  /** 입력칸 id 앞부분 — 패널·모달이 같은 칸을 동시에 그리므로 위치까지 넣은 고유값. */
  idBase: string;
  /** 매출 기준 연도가 비었을 때 쓰는 오늘(편집기를 연 날). */
  today: Date;
  onField: (k: keyof CI, v: string) => void;
  onPatch: (p: Partial<CI>) => void;
}

export default function CompanyInfoItem({ it, draft, inline, idBase, today, onField, onPatch }: Props) {
  const wide = inline ? "block" : "block sm:col-span-2";
  const idOf = (k: keyof CI) => `${idBase}-${String(k)}`;
  const field = (d: FieldDef, className: string) => {
    const k = d[0];
    let value = String(draft[k] ?? "");
    let def = d;
    let onChange = onField;
    if (k === "주민등록번호" && value.trim() === "") {
      const derived = birthToRrnFront(draft.대표자생년월일);
      if (derived) {
        value = derived;
        def = [d[0], d[1], RRN_DERIVED_HINT, d[3], d[4]];
        // 보여 주기만 하던 값을 통째로 지우면 생년월일도 함께 지운다 — 안 그러면 곧바로 다시 채워진다.
        onChange = (key, v) => (v.trim() === "" ? onPatch({ 주민등록번호: "", 대표자생년월일: "" }) : onField(key, v));
      }
    }
    return <CompanyInfoField key={String(k)} def={def} value={value} onChange={onChange} id={idOf(k)} className={className} />;
  };

  switch (it.kind) {
    case "field": {
      const [k, , , span] = it.def;
      // 법인등록번호 = 법인일 때만 보인다. 이미 값이 있으면(옛 자유 글 구분·자동입력) 늘 보인다 — 숨은 데이터 방지.
      if (it.onlyCorporation && !isCorporation(draft.사업자구분) && !String(draft[k] ?? "").trim()) return null;
      return field(it.def, span === 2 ? wide : "block");
    }
    case "hidden":
      return null;
    case "pair":
      // 두 칸을 늘 한 줄 — wideSecond 면 2:3(신용점수 | 연락처/통신사). 좁은 칸의 긴 라벨이 두 줄로
      // 접혀도 입력칸 높이가 맞도록 아래 정렬(items-end).
      return (
        <div className={`${wide} grid min-w-0 items-end gap-1.5 ${it.wideSecond ? "grid-cols-5" : "grid-cols-2"}`}>
          {field(it.defs[0], it.wideSecond ? "col-span-2 min-w-0" : "block min-w-0")}
          {field(it.defs[1], it.wideSecond ? "col-span-3 min-w-0" : "block min-w-0")}
        </div>
      );
    case "row":
      // 좁은 폰(360px 미만)은 세로로 쌓이고, 그 이상은 한 줄 — 가로 넘침 없음.
      return (
        <div className={`${wide} grid min-w-0 grid-cols-1 gap-1.5 xs:grid-cols-3`}>
          {it.defs.map((d) => field(d, "block min-w-0"))}
        </div>
      );
    case "bizType":
      return <BizTypeField draft={draft} onPatch={onPatch} id={idOf("사업자구분")} />;
    case "ownership":
      return <OwnershipField spec={it.spec} draft={draft} onPatch={onPatch} idBase={idBase} className={wide} />;
    case "money": {
      const [k, label] = it.def;
      return (
        <MoneyField
          def={it.def}
          value={String(draft[k] ?? "")}
          signed={Boolean(it.signed)}
          onChange={onField}
          onConvert={() => {
            const p = legacyMoneyConvertPatch(draft, String(k), label);
            if (p) onPatch(p as Partial<CI>);
          }}
          id={idOf(k)}
        />
      );
    }
    case "ratio": {
      const k = it.def[0] as RatioKey;
      const computed = computeRatios(draft, resolveBaseYear(draft.매출기준연도, today))[k];
      return <RatioField def={it.def} computed={computed} stored={String(draft[k] ?? "")} id={idOf(k)} />;
    }
    case "sales":
      return (
        <CompanyInfoSalesFields
          draft={draft}
          onField={onField}
          onPatch={onPatch}
          idBase={idBase}
          today={today}
          className={inline ? "" : "sm:col-span-2"}
        />
      );
  }
}
