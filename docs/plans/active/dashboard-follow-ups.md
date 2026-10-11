> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 대시보드 「오늘 챙길 일」 카드(#3 재컨택 할 일+D-day · #4 멈춘 업체 알림) 목업·구현 계획과 수용 기준.
> - **누가 읽나요**: 개발자/PM
> - **어떤 기능·작업과 연결?**: `components/dashboard/DashboardFollowUps.tsx`, `lib/analytics/dashboard-follow-ups.ts`, `lib/query/{contact,contract-payment,db-sheet}-hooks.ts`, `components/ui/LoadingProvider.tsx`
> - **읽고 나면 알 수 있는 것**: 무엇을 세는지 · 어디로 이동하는지 · 목업을 어떻게 여는지
> - **관련 문서**: [components.md §9](../../design/components.md#9-dashboard) · [data-model.md DB관리시트](../../domains/data-model.md)

# 대시보드 「오늘 챙길 일」 (2026-10-12)

## 범위
- 포함: #3 할 일 D-day(밀림·오늘·7일 안), 결과 안 적은 지난 미팅, 다시 연락할 DB, #4 멈춘 업체(다음 할 일 없이 7일 이상, 이월 포함).
- 제외: #2, #5(수납 지연 줄·회차별 정산 — 반려). 서버·API·DB·시트 변경 없음.
- belie 기본안: 카드 위치 = 생산성 카드와 전체 진행건 사이, 멈춤 기준 7일·이월 포함.

## 검토 반영(스펙 리뷰 major 전부)
1. 보조 조회(월 미팅·DB관리시트)는 `meta.background` → 전역 오버레이 제외, 카드 스켈레톤만. 계약·할 일 뒤에 시작, 5분 신선.
2. 예정일자가 비었거나 틀린 할 일 제외. 계약을 못 찾은 할 일은 칩·총건수에서 빼고 회색 안내만(`/payment?focus=` 단독 폴백 삭제).
3. 다시 연락: 다음 연락일 이후 상담 기록이 있으면 제외.
4. 멈춤 = 「다음 할 일 없이 마지막 일정 7일 이상」, 문구 「마지막 일정 M/D」(완료 시각 필드 없음 — 완료 Todo 는 예정일로 셈). 업체 단위(가장 오래 멈춘 진행 1건), 기관명이 어느 진행과도 맞지 않는 미완료 할 일이 있는 계약 제외.
5. 무효화: 미팅 뮤테이션 5종 → `['month']` + `cpKey`(죽은 `['payments']` 교체), 계약 핵심필드 수정·행 삭제 → `['todos']` + `['month']`.
6. 결과 4종 목록은 `isDbSheetFollowUpResult`(Set) 한 곳, 별칭 `@/util/*`.
7. DB관리시트 503 「지원하지 않음」은 DB 칩만 숨김(문구 짝은 `tests/components/db-sheet-hooks.test.ts`가 지킴).
8. `tests/browser/weekly-goals-browser.mjs`에 새 조회 route 추가.
9. 목업이 실제 도착 화면(PaymentPage·SchedulePage·DbSheetPage)까지 그린다.
10. PC 목록은 위쪽 공간이 모자라면 아래로 편다. components.md 카드 7종.

## 목업
- `npm run build`(폰트) 후 `node tests/browser/dashboard-followups-server.mjs` → 출력 주소.
- `/?scenario=some|many|empty|error|unsupported`, `?slow=1`. 목록 한 줄을 누르면 실제 도착 화면이 열린다.

## 수용 기준
- [ ] 카드가 생산성과 전체 진행건 사이에 1개. page.tsx 변경은 삽입 1줄·import·주석.
- [ ] 0건 칩 미렌더, 총건수 = 7일 안 제외 5종 합, 문구 우선순위.
- [ ] 전부 성공·0건이면 칭찬 한 줄, 일부 실패면 안내 + 다시 시도.
- [ ] 도착: 할 일 강조 링 · 미팅 3초 링 · DbDetail 열림(목업 375/1280 확인).
- [ ] 375px 칩 ≥44px·가로 넘침 없음, PC 목록 펼침 전후 그리드 높이 동일.
- [ ] check.sh 초록.

## 위험·한계(실측·판독)
- 조회 부하: 대시보드 방문마다 `/api/db-sheet` 1회 + 월 미팅 1~3회가 는다. `/api/db-sheet`는 `findUserByEmail(fresh)`로 레지스트리를 캐시 없이 읽고(REGISTRY_DB_READ 꺼짐·DB 없음이면 Sheets 폴백), 월 조회는 전체 미팅·할 일을 읽어 월로 거른다. 완화: 5분 신선·계약/할 일 뒤 시작·무효화로만 갱신. 배포 후 withApiTiming p95 측정은 미실시 — 느리면 경량 엔드포인트 별도 카드.
- 할 일에 완료 시각이 없어 완료 Todo 는 예정일을 「마지막 일정」으로 쓴다.
- 첫 화면 목표 노출(weekly-goals 2026-09-11): 카드가 주간 목표 위에 놓여 목표가 아래로 밀린다. 목업 실측 카드 높이 — PC 1280/1600: 95px(칩 1줄), 0건 39px · 375px: 177px(칩 2줄), 0건 46px · 360px: 칩 6종 모두면 3줄. weekly-goals-browser.mjs 는 route 만 추가했고 실행은 못 함(QA_TOOLS_DIR playwright 없음) → belie 결정 대상.

## 승인 기록
- 목업 기준 SHA: (커밋 후 기입) · belie 승인: (대기)
