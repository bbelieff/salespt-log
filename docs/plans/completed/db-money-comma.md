---
status: completed
slug: db-money-comma
created: 2026-05-09
worktree: ../wt/db-money-comma
completed: 2026-05-11
archived: 2026-07-12
---

# fix(db): 금액 필드(unit="원") 천 단위 콤마 표시

`app/(app)/db/_components/RowForm.tsx` FieldCell:
- `isMoney = field.type === "number" && field.unit === "원"`
- 표시: `numericValue.toLocaleString("ko-KR")` → `1,000,000`
- input type 은 "text" (type="number" 는 콤마 invalid 처리)
- onChange 시 `replace(/[^\d]/g, "")` 로 콤마 strip → 부모 setField 가 Number 캐스트
- inputMode="numeric" 유지 → 모바일 숫자 키패드

영향 필드 (4 채널 공통):
- 매입DB: 부가세 제외 개당단가, 주문금액(자동수식)
- 직접생산: 기간예산, 개당단가(자동수식)
- 현수막: 부가세 제외 개당단가, 주문금액(자동수식)
