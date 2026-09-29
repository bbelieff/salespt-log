> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 실무/수납 업체 보기 목록을 진행건 단위에서 계약(업체) 단위로 되돌린 변경.
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `app/(app)/payment/_lib/company-work-view.ts`, `ContractListTable`, payment page
> - **읽고 나면 알 수 있는 것**: 왜 바꿨나 · 카드에 무엇이 보이나 · 되돌리는 법
> - **관련 문서**: `docs/design/components.md`(ContractListTable)

# 업체 보기 = 업체당 한 카드 (2026-09-29, belie)

- 제보: "케이탑전기진단이 왜 두 개야 — 업체 토글에서는 복수의 진행건을 동시에 가지고 하나만 존재해야지".
  이전 구현(#1060 계열)은 진행 슬롯마다 한 행이었다.
- 변경: `buildCompanyWorkItems` 가 계약마다 한 항목(key = `companyActivityKey` — `row:N`), `works` = 값 있는 진행건
  전부(진행 1→3), `work` = 대표(가장 급한 진행건 — D-day 정렬과 같은 규칙). 카드는 진행건 줄 여러 개 + 수납액 합계 + 진행률 평균.
- 진행기관 보기는 그대로 진행건 단위. 보기 전환·대시보드/업무현황 링크(row·slot)는 계약 키로 옮긴다(`companyKeyOfRow`).
- 되돌리기: squash revert. 데이터 변경 없음.
