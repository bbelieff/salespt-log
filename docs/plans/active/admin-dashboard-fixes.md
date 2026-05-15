---
slug: admin-dashboard-fixes
status: active
created: 2026-05-15
worktree: ../wt/admin-dashboard-fixes
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: TopHeader 이름 → 시트 링크, 동기화 버튼 강제 재로드, 대시보드 비용 서버 sum (시트 SUM 셀 의존 제거)
> - **누가 읽나요**: 개발자
> - **어떤 기능·작업과 연결?**: `components/TopHeader.tsx`, `lib/service/me.ts`, `lib/repo/users-cache-migrate.ts`, `lib/repo/dashboard.ts`, `lib/service/dashboard.ts`, `lib/repo/db.ts`
> - **읽고 나면 알 수 있는 것**: 김미란 비용 0 사고의 root cause 와 fix? 동기화 버튼이 왜 효과 없었나? 헤더 시트 링크 어떻게?
> - **관련 문서**: [[docs/domains/data-model.md]] §대시보드 데이터 출처, [[docs/domains/sheet-structure.md]] §03 DB관리

# admin/dashboard 폴리시 — 사고 3건 동시 fix

## Executive Summary
2026-05-15 사용자 보고 3건 동시 해결:
1. **헤더 수강생 이름 → 시트 링크** (UX 개선) — admin/trainer 가 impersonation 중 본인 시트 빠른 접근
2. **[🔄 동기화] 버튼 사실상 무력화** — K/L 캐시가 ISO 형식이면 무조건 skip → 시트 정정해도 반영 안 됨
3. **김미란 대시보드 비용 0** — 시트 F56/K56/U56 SUM 수식 누락 / 잘못된 row 참조 → 대시보드 비용 0 표시

## 변경 사항

### [3] 헤더 이름 → 시트 링크
- `lib/service/me.ts` — `MeProfile` 에 `spreadsheetId: string` 추가, `loadMe` 가 `user.spreadsheetId` 반환
- `components/TopHeader.tsx` — `{cohort} {name} 대표님` span 을 `me.data?.spreadsheetId` 가 있을 때 `<a target="_blank">` 로 wrap. 새 탭 시트 직접 열기

### [2] 동기화 버튼 강제 재로드
- `lib/repo/users-cache-migrate.ts` — `migrateRegistryCache` 의 `alreadyCached` skip 로직 제거. `spreadsheetId` 가 있는 모든 row 는 무조건 re-fetch + K/L overwrite
- **의도**: "동기화" 의 직관적 의미("시트에서 다시 읽어와 갱신") 와 일치. 7기 O2=O1+50 같은 sheet-side 정정도 즉시 반영
- **트레이드오프**: 60~150초 대기 (registry 전체 sheet 수 만큼). admin 만 누르는 rare 작업이라 수용

### [4] 대시보드 비용 — 서버 sum (시트 SUM 셀 의존 제거)
- `lib/repo/dashboard.ts` — `F56` / `K56` / `U56` range 제거, `DashboardSheetData.costByChannel` 필드 제거
- `lib/service/dashboard.ts` — `readPurchases` / `readProductions` / `readBanners` (`@/repo/db`) 를 `readDashboard` 와 병렬 호출 → 서버에서 raw row 합산
  - 매입DB 비용 = `readPurchases.rows[].주문금액` 합
  - 직접생산 비용 = `readProductions.rows[].기간예산` 합
  - 현수막 비용 = `readBanners.rows[].주문금액` 합
- **김미란 케이스 자동 해결**: 시트 F56 SUM 셀 상태와 무관하게 정확한 비용 계산
- **다른 수강생 영향 없음**: 같은 비용 계산 결과 (서버 sum vs 시트 F56 SUM 둘 다 동일 raw row 합)

### docs
- `docs/domains/data-model.md` §대시보드 데이터 출처 — 채널별 비용 출처를 서버 sum 으로 수정
- `docs/domains/sheet-structure.md` §03 DB관리 — F56/K56/U56 표 → 서버 sum 표로 교체 + 사고 경위 주석

## Acceptance Criteria
- [ ] 모든 (app) 페이지 헤더에서 사용자 이름 클릭 → 본인 시트 새 탭으로 열림
- [ ] /admin/users [🔄 동기화] 클릭 후 기수 박스의 개강~종강 일자가 시트 O1/O2 의 최신 값으로 갱신됨
- [ ] 김미란 대시보드의 채널별 비용·총비용·영업이익이 시트 raw 데이터와 일치
- [ ] 다른 수강생 대시보드 비용 회귀 없음 (기존 F56 SUM 정상 동작 시트들과 동일 결과)
- [ ] `scripts/check.sh` 전체 통과

## Log
- 2026-05-15 사용자 보고 3건 batch fix
