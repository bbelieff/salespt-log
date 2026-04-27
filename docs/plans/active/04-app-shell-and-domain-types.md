---
slug: app-shell-and-domain-types
status: active
created: 2026-04-27
worktree: ../wt/app-shell
pr: feat/app-shell-and-domain-types
---

# PR 1 — 5탭 앱 셸 + 도메인 타입/시트 주소 동기화

## Intent (왜)
프로토타입 3종(컨택/일정·계약/캘린더 v3)이 확정되어 Stage 5(Next.js 구현)로 들어간다.
기존 `lib/types`·`lib/config`는 재설계 이전 모델(production/contact/meeting/contract 4지표,
dashboard/contracts/db/daily 시트)이라 그대로 위에 UI를 얹으면 첫 컴파일부터 어긋난다.

이 PR은 **위 셸 + 아래 모델**을 동시에 새 설계와 정렬한다.
PR 2(컨택탭), PR 3(일정·계약+캘린더)이 깨끗한 모델 위에 얹기만 하면 되도록.

## Acceptance Criteria
- [ ] `lib/types/index.ts`: Channel(4), MetricKey(4), MeetingState(5), Meeting, PaymentRow Zod 모델
- [ ] `lib/config/SHEET_RANGES`: 대시보드/영업관리/업체관리/수납관리/회고노트 주소
- [ ] 옛 `lib/repo/daily.ts` 제거 (PR 2/3에서 meetings.ts/payments.ts 신설)
- [ ] `lib/repo/users.ts` + `sheets-client.ts`: 새 타입과 호환되게만 유지 (회귀 X)
- [ ] `lib/service/gamification.ts`: 새 4지표 시그니처로 리팩 (구현은 stub OK)
- [ ] `app/(app)/layout.tsx` + 5개 탭 placeholder 페이지 (컨택관리/일정·계약/캘린더/수납/DB관리)
- [ ] `components/TabBar.tsx`: prototypes의 5탭 SVG 그대로 — 활성 탭 자동 감지
- [ ] `npm run check` 통과 (typecheck · lint · structural · tests · 파일크기)
- [ ] 구조 테스트 갱신: dashboard read-only 가드는 새 시트 이름(`성과관리` 또는 `대시보드`)에도 작동
- [ ] 관련 docs status 업데이트 없음 (이 PR은 docs 변경 없음 — 코드만 docs에 맞춤)

## Out of Scope (PR 2/3에서)
- 실제 Sheets I/O (meetings.ts, payments.ts, sales.ts)
- 컨택관리 탭 UI 구현 (4채널×4지표, 미팅 슬롯)
- 일정·계약/캘린더 탭 UI 구현
- 인증/로그인 (이미 plan 01-auth-onboarding 있음 — 별도 트랙)

## Context
- [[docs/design/prototypes/README.md]] — 확정 시안 3종
- [[docs/design/prototypes/calendar-monthly.html]] — 5탭 SVG 정본
- [[docs/design/components.md]] §5 Bottom Navigation — 5탭 고정 규칙
- [[docs/domains/data-model.md]] — Meeting 5상태, Channel 4종
- [[docs/domains/sheet-structure.md]] — 시트 탭 구조 (영업관리/업체관리/수납관리/대시보드)
- CLAUDE.md §2 의존성 단방향, §2.5 시트 격리

## Steps
1. `lib/types/index.ts` 새 모델로 교체 (Channel, MetricKey, MeetingState, Meeting, PaymentRow, User)
2. `lib/config/index.ts` SHEET_RANGES 갱신 (대시보드/영업관리/업체관리/수납관리/회고노트)
3. `lib/repo/daily.ts` 삭제, users.ts/sheets-client.ts는 유지
4. `lib/service/gamification.ts` 새 시그니처로 stub 리팩
5. `tests/structural/layers.test.ts` dashboard 가드 점검 (시트 이름 변경 반영)
6. `components/TabBar.tsx` 작성 (5탭 SVG, usePathname으로 활성 자동)
7. `app/(app)/layout.tsx` + 5개 탭 placeholder
8. `npm run check` 통과 확인
9. plan을 `completed/`로 이동하면서 커밋

## Log
- 2026-04-27: plan 작성, 워크트리 생성
