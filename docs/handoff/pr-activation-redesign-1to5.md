# PR 프롬프트 묶음 — activation redesign 기능 PR 1~5

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 방향 A 합의안의 기능 변경 5개(집계쓰기·컨택 경량화·현수막 게시·직접생산 기간폼·미기록 넛지)를 각각 머지·배포까지 수행하는 개발 세션용 PR 프롬프트 묶음.
> - **누가 읽나요**: 사용자 PC의 Claude Code(실행 주체) / 개발자.
> - **어떤 기능·작업과 연결?**: `app/(app)/db`, `app/(app)/contact`, `lib/repo`·`lib/service`, `01 영업관리`·`03 DB관리` 시트, `docs/domains/sheet-structure.md`.
> - **읽고 나면 알 수 있는 것**: 각 PR의 스코프·의존·변경파일·스펙·수용기준 / 공통 작업규약.
> - **관련 문서**: [pr-bottom-nav-4plus1.md](./pr-bottom-nav-4plus1.md)(선행 바 PR), [sheet-structure.md](../domains/sheet-structure.md), [playbooks/deploy-vps.md](../playbooks/deploy-vps.md), [CLAUDE.md](../../CLAUDE.md).

---

## 배경 (왜 이 5개인가)

토론 결론 = **방향 A**: 생산·비용 입력을 매일 동선(컨택관리)에서 빼서 `DB생산` 탭으로 모으고, 컨택관리는 유입→컨택→미팅 흐름만 남겨 첫 미팅(북극성 지표 meeting_booked) 경로를 가볍게 한다. 비용은 8주 통째 집계라 일 단위로 받을 이유가 없고, 현수막·직접생산은 비용이 2단계·기간·사후 성격이라 컨택 흐름에서 분리하는 게 정합적.

**실행 순서(의존)**: `바 PR`(별도, 선행) → **PR1** → (**PR2** · **PR3** · **PR4**) → **PR5**. 각 PR은 작고 원자적(§3-6). 한 번에 하나씩 머지·배포·health 확인 후 다음으로.

---

## 공통 작업 규약 (PR1~5 전부 동일 — 각 PR에서 반복하지 않음)

- **브랜치**: 접두어 + kebab-case (§6.5). 이슈번호·타임스탬프 금지.
- **워크트리**: 메인 직접 수정 금지, 새 워크트리에서 작업 (§3-4).
- **계획**: `docs/plans/active/<slug>.md` 생성 → 완료 시 `completed/`로 이동 (§3-3).
- **PR 전 체크리스트(하나라도 빨강이면 PR 금지·우회 금지, §4)**:
  `npm run typecheck` · `npm run lint` · `npm run test:structural` · `npm run test` · 파일 ≤500줄(`scripts/check.sh`) · `scripts/doc-drift.sh`(신규 심볼 SSOT 등재) · pre-commit 훅 통과.
- **시각/데이터 검증**: UI 변경은 모바일+넓은폭 스크린샷, 시트 쓰기 변경은 실제 시트 read로 before/after 확인(§3-5). 시트 bulk-write는 **§2.5 보존가드**(FORMULA pre-read 후 사용자 raw 값 skip) 의무.
- **커밋**: 단일 커밋, conventional 제목 + 본문 `Changelog:`(토스 문체, 수강생용 한 줄). squash 머지.
- **배포(§6.8)**: 머지 직전 `git rev-parse origin/master`(롤백 타겟) → push → `gh run list --workflow="Deploy to VPS" -L1` 끝까지 관찰 → success면 `https://salesptlog.online` 200 확인. build/health 실패 시 **즉시 `git revert` + push** 후 재확인. 실패·롤백은 `docs/incidents/`에 기록.
- **Cowork 금지(§6.7)**: 샌드박스에선 git 쓰기·배포 불가 → 반드시 사용자 PC의 Claude Code에서 실행.
- **레거시 보존(사용자 지침)**: 기존 디자인·컴포넌트·아이콘 최대한 유지, "재배치/최소수정" 원칙. 요청 안 된 리팩터 금지(§6).

---

## PR1 — DB생산 집계쓰기 (+ CrossTabHintModal 제거) ★아키텍처 핵심

- **브랜치**: `feat/db-production-aggregate-write`
- **의존**: 없음(이 묶음의 출발점). ADR 선행.
- **목표**: `DB생산` 탭에서 raw 추가/수정 시, 앱이 **채널×날짜로 생산수를 집계해 `01 영업관리!E(생산)`에 직접 기입**한다. 이로써 "DB관리에 적고 컨택관리에도 또 생산 입력"하던 이중입력을 제거하고 `CrossTabHintModal`을 삭제한다.
- **결정(ADR `docs/decisions/0020-production-metric-ssot-to-db.md`)**: 생산(E) 지표의 SSOT를 "컨택관리 수기 입력" → "DB생산 raw 집계"로 이동. E는 이제 시스템 파생값(앱이 소유). 근거·영향(보존가드 적용 범위 변화) 명시.
- **집계→날짜 매핑 규칙**: 매입DB=`구매일`, 직접생산=`기간 종료일`, 현수막=`게시일`(PR3 전까지는 기존 동작 유지) 기준으로 해당 날짜 행 E에 합산. 8주 통째 집계라 합계 영향은 없으나 주차 경계 주의(가이드 문구).
- **변경 파일(예상)**: `app/(app)/db/page.tsx`(append/patch 후 집계쓰기 호출, `productionHint`/`CrossTabHintModal` 제거), `components/ui/CrossTabHintModal.tsx`(사용처 0이면 삭제), `lib/service/*`·`lib/repo/*`(영업관리 E 집계·기입 함수, **§2.5 보존가드** 준수), 관련 query hook.
- **SSOT/문서**: ADR-0020, `docs/domains/sheet-structure.md`(E 출처를 'DB생산 집계'로 갱신, 시나리오 매핑 수정), `quality.md` 해당 도메인 등급 갱신.
- **수용 기준**: DB생산 raw 추가→해당 날짜/채널 영업관리 E 자동 반영(시트 확인). 컨택관리 어디에서도 생산 재입력 안내 안 뜸. 기존 사용자 raw 값 보존(가드 테스트).
- **Changelog**: `Changelog: DB만 적으면 생산 숫자가 자동으로 반영돼요. 두 번 적을 필요가 없어졌어요.`

---

## PR2 — 컨택관리 경량화

- **브랜치**: `feat/contact-lighten-remove-production`
- **의존**: PR1(생산 E를 DB생산이 쓰므로 컨택에서 생산 제거 가능).
- **목표**: 컨택관리에서 `생산` 스테퍼 제거. `유입`·`컨택진행`은 보조 입력으로 유지, `미팅 예약하기`를 화면의 단일 주행동(빨강)으로 강조. 생산용 cross-tab 동선(`?focus=production`, `&date=`) 정리.
- **정본 프로토타입**: 컨택 Before/After를 `docs/design/prototypes/contact-lighten.html`로 추가(기존 `contact-daily-input.html` 기반, 생산 칸만 제거·CTA 강조). 합의 시안 = 4스테퍼 → 유입·컨택진행(보조) + 미팅예약(주행동).
- **변경 파일(예상)**: `app/(app)/contact/page.tsx`, `app/(app)/contact/_components/*`, `app/(app)/contact/_lib/contactDefaults.ts`·`channel-order.ts`(생산 필드 제거), `/api/daily` 페이로드에서 생산(E) 제거(E는 PR1이 소유).
- **SSOT/문서**: `docs/design/components.md`(컨택 입력 컴포넌트 갱신), `sheet-structure.md`(컨택 직접쓰기 컬럼에서 E 제외 반영). 라벨/시안 변경이라 ADR 불필요(고정 스펙 위반 아님) — 단 components.md 등재.
- **수용 기준**: 컨택관리에 생산 칸 없음. 유입/컨택진행 입력 정상, 미팅예약이 시각적 1순위. 영업관리 E는 컨택에서 더 이상 안 써짐(중복 쓰기 0). 기존 미팅 생성 흐름 회귀 없음.
- **Changelog**: `Changelog: 컨택관리 화면이 미팅 잡기 중심으로 깔끔해졌어요.`

---

## PR3 — 현수막 게시 2단계 (주문 → 게시)

- **브랜치**: `feat/banner-post-twostep`
- **의존**: PR1(생산 집계쓰기 기반).
- **목표**: 현수막을 `① 주문 등록(비용)` → `② 게시(가동)` 2단계로. 기존 `미팅 예약→완료` 상태 패턴 재사용. **게시 시점부터** 그 현수막이 생산(E)으로 카운트되도록 집계.
- **결정(ADR `docs/decisions/0021-banner-posting-state.md`)**: `03 DB관리` 현수막 섹션에 상태(주문대기/게시) 개념 신설(컬럼 또는 게시일 채움 여부로 판정). 04 업체관리 J(상태)와 동일 사고. 근거·집계 영향.
- **정본 프로토타입**: `docs/design/prototypes/db-banner-twostep.html`(주문 등록 + 대기 카드 + 게시 완료 버튼 + 가동중 카드). 기존 DB `RowList`/`RowForm` 스타일 재사용.
- **변경 파일(예상)**: `app/(app)/db/_lib/channels.ts`(현수막 필드/상태), `app/(app)/db/_components/RowList.tsx`·`RowForm.tsx`(게시 액션), `app/(app)/db/page.tsx`, `lib/repo`·`lib/service`(게시 처리 + 게시일 기준 E 집계, §2.5 가드).
- **SSOT/문서**: ADR-0021, `sheet-structure.md §5`(현수막 상태/게시 규칙), components.md.
- **수용 기준**: 주문 등록=대기 카드(비용만 적재, 생산 0). 게시 완료→게시일에 생산(E) 카운트. 기존 현수막 데이터 마이그레이션/회귀 안전.
- **Changelog**: `Changelog: 현수막은 주문하고, 실제 게시한 날 생산으로 잡히게 정리했어요.`

---

## PR4 — 직접생산 기간폼 (사후기록)

- **브랜치**: `feat/direct-production-period-form`
- **의존**: PR1.
- **목표**: 직접생산 입력의 `날짜`(단일) → `기간(시작~끝)`으로 교체. 기간예산·생산개수·개당단가(자동 = 예산÷개수)는 기존 메타 그대로. 기간이 끝난 뒤 적는 **사후기록** 형태. 생산(E) 집계는 기간 종료일 기준(주 경계 시 기간을 주 단위로 끊도록 안내).
- **정본 프로토타입**: `docs/design/prototypes/direct-production-period-form.html`(기존 추가폼 UI 그대로, 날짜→기간 2칸 + 사후기록 안내).
- **변경 파일(예상)**: `app/(app)/db/_lib/channels.ts`(direct fields: `날짜`→`기간시작`·`기간종료`), `RowForm.tsx`, `summarizeCost`(direct 합산 유지), `lib/repo`·`lib/service`(시트 매핑: 03 DB관리 직접생산 섹션 날짜 컬럼 → 기간, E 집계 종료일 기준).
- **SSOT/문서**: `sheet-structure.md §5`(직접생산 컬럼 기간으로 갱신). 시트 컬럼 의미 변경이라 데이터 마이그레이션/하위호환 메모. ADR 불필요(고정 스펙 위반 아님) — sheet-structure 갱신으로 충분.
- **수용 기준**: 직접생산 기간·예산·생산개수 입력 → 개당단가 자동, 합계 정상, E 종료일 반영. 기존 단일 날짜 데이터 호환 처리.
- **Changelog**: `Changelog: 직접생산은 기간을 정해 비용과 생산 수를 한 번에 적을 수 있어요.`

---

## PR5 — 미기록 넛지

- **브랜치**: `feat/db-cost-missing-nudge`
- **의존**: PR1·PR4(비용/기간 구조 확정 후).
- **목표**: 사후 비용 누락을 막는 넛지. `DB생산` 탭 상단에 "어제/지난 기간 비용이 아직 비어 있어요 — 입력" 배너. (토론 결론: 방향 A의 유일 약점=누락 → 필수 보강. 과거 비용 0 대시보드 사고 재발 방지.)
- **감지 규칙**: 직접생산 기간 종료 후 비용 미입력 / 매입·현수막 raw에 비용 0 등 휴리스틱(서비스 레이어). 과알림 방지(이미 채운 항목 제외). localStorage로 하루 1회 등 빈도 제어(시트 쓰기 금지).
- **정본 프로토타입**: `docs/design/prototypes/db-cost-nudge.html`(상단 warning 배너 + 입력 CTA).
- **변경 파일(예상)**: `app/(app)/db/page.tsx`(배너), `lib/service/*`(누락 감지), 필요 시 작은 배너 컴포넌트(components.md 등재).
- **SSOT/문서**: components.md(배너 컴포넌트), `quality.md`. ADR 불필요.
- **수용 기준**: 비용 누락 조건에서 배너 노출, 채우면 사라짐. 오탐 적음. 시트 쓰기 추가 없음(클라 빈도제어).
- **Changelog**: `Changelog: 빠뜨린 비용이 있으면 알려줘서 영업이익이 정확해져요.`

---

## 실행 메모

- 각 PR은 **하나씩** 머지→배포→health 확인 후 다음으로(동시 진행 금지, 시트·집계 충돌 방지).
- ADR 번호(0020·0021)는 머지 시점 최신 번호 확인 후 +1로 조정.
- 시트 컬럼/의미를 바꾸는 PR3·PR4는 **전 수강생 시트**(아레나 시즌1 운영중)에 영향 → 마이그레이션·하위호환을 plan에 명시하고 소수 시트로 먼저 검증.
