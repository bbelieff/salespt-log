---
slug: money-phone-format
status: active
created: 2026-07-14
owner: belie
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 앱 전체 금액=천단위 콤마, 연락처=자동 하이픈으로 통일 (PR-1 공용 부품 → PR-2 전 화면 sweep).
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: lib/format/*, components/ui/MoneyInput·PhoneInput, 전 금액·연락처 필드
> - **읽고 나면 알 수 있는 것**: 왜 부품을 먼저 만드나 / 시트가 깨지는 지점은 어디인가 / 무엇을 건드리면 안 되나
> - **관련 문서**: docs/plans/completed/db-money-comma.md(선행), docs/design/components.md

# money-phone-format

## 스펙 (belie 확정)
1. 앱 안 **모든 금액**은 천단위 콤마(1,000,000) — **표시 + 입력(타이핑 중 자동 콤마)** 둘 다.
2. 모든 **연락처**는 자동 하이픈(010-0000-0000, 02 지역번호 변형) — **입력 마스크 + 기존 저장값 표시 정규화**.

## ⚠️ 절대 제약
- **시트로 나가는 금액은 숫자 그대로**. 콤마 문자열이 repo 층에 닿으면 시트가 텍스트로 먹어 **수식이 깨진다**(쓰기는 전 경로 `USER_ENTERED`). 현재 유일한 방벽은 Zod `z.number()` → **금액에 `z.coerce.number()` 금지**.
- **연락처는 하이픈 포함 저장 OK**(시트 가독 + 안전). 오히려 숫자만 문자열은 Sheets 가 숫자로 파싱해 **선행 0 이 날아간다**. 기존 데이터 마이그레이션은 **안 함**(표시 정규화로 흡수).

## 실측 인벤토리 (5-way 병렬 조사)
- 공용 유틸 **0개**. `fmtMoney` 계열 **14곳 복붙**, 입력 자동콤마 **4벌 중복**(RowForm·ContractForm·PaymentSlotForm·LinkedFieldsEditor), TerminationModal 반환액만 콤마 미적용.
- 커서 보정(rAF+setSelectionRange)은 2곳에만 존재 → 공용화하며 전 필드로 확산.
- 전화 유틸 **0건**(그린필드). 필드는 `DBLead.연락처`(03 콜지기소) + `CompanyInfo.연락처통신사`(합본).

### 🚫 건드리면 안 되는 것 (오폭 방지)
- **카운트 스테퍼**(`type=number`: MetricStepper, ChannelTabsAndPanel, ShareScores, claim 기수) — 콤마 넣으면 브라우저가 값을 거부해 **0 으로 날아간다**.
- **만원 축약**(`ChannelPerformance.fmtMan` = 원/10,000+"만") · **건수**(fmtCount) — 금액 콤마 유틸과 다른 개념.
- **서술형 자유텍스트**(CompanyInfoEditor 매출·기대출·신용점수, `z.string()`) — "26' 6월 100백만", "919/855" 원문이 깨진다.
- **날짜** `toLocaleString`(company-info-txt) — 정규식 일괄 치환 오폭 주의.
- `연락처통신사`는 **"010-1234-5678(SKT)" 합본** — 전체 마스킹 금지, `formatPhone`(선행 숫자만 포맷·접미 보존)으로 처리.
- `parseInt("1,000,000") === 1` **조용한 절단** → 반드시 strip 후 `Number()`.

## PR-1 (이 PR — 공용 부품, 계약 선행 §3.5)
- `lib/format/money.ts` — `formatMoney`(표시, null→"0") · `formatMoneyInput`(입력, 0→"") · `parseMoney`(strip→Number, **parseInt 금지**).
- `lib/format/phone.ts` — `normalizePhoneDigits`(**선행 0 복원**) · `formatPhone`(표시, **접미 보존**) · `maskPhoneInput`(입력 마스크, 휴대폰 3-4-4 / 지역 3-3-4 / 02 분기).
- `components/ui/MoneyInput.tsx` — 콤마 입력 + **커서 보정**. `onChange: (n: number) => void` 로 **number 방출을 타입 강제**(시트 안전).
- `components/ui/PhoneInput.tsx` — 하이픈 마스크. `onChange: (s: string) => void`.
- 단위테스트 29 — **왕복**(콤마 입력→number 저장→콤마 표시) + 함정 회귀(parseInt 절단·선행0·합본 접미).
- SSOT: `docs/design/components.md` 등재(사용 금지 대상 명시 포함).

## PR-2 (다음 — 전 화면 sweep)
- 14곳 표시 포맷터 + 4벌 입력 구현을 공용 부품으로 치환, TerminationModal 반환액·연락처 필드에 적용.
- 진행 중인 타 트랙 구역(C=02 카드, F=컨택 유입)은 **그들 머지 후 잔여분만**(직렬 큐 리베이스, §3.5).

## Acceptance
- [x] PR-1 부품 + 왕복 테스트 + SSOT 등재
- [ ] PR-2 sweep — 미적용 필드 0
- [ ] 시트 금액 셀이 여전히 **숫자**(수식 정상) — 라이브 확인
