---
slug: registry-cache-columns
status: active
created: 2026-05-13
worktree: ../wt/admin-perf
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: registry users 시트에 cached 컬럼 4개(I~L) 추가 — `/admin/users` + `/api/me` 가 시트 fetch 0회로 동작.
> - **누가 읽나요**: 개발자 (Sheets quota 영구 해소 작업 시)
> - **어떤 기능·작업과 연결?**: `lib/repo/users.ts`, `lib/service/me.ts`, `lib/types/index.ts`, `lib/repo/users-prep.ts`, `lib/service/auth.ts`, `/admin/users` UI
> - **읽고 나면 알 수 있는 것**:
>   - 왜 시트 read 0회가 목표인지 (quota 영구 압박)
>   - registry SSOT + 개인 시트 SSOT 의 hybrid 동기화 정책
>   - 옛 row (cached 빈값) 의 점진 마이그레이션 패턴
> - **관련 문서**: [admin-bundle-cache-10min.md](./admin-bundle-cache-10min.md) (PR A), [sheet-structure.md](../../domains/sheet-structure.md)

# feat: Registry cached columns — /admin/users 시트 read 0회

## 배경

PR A (`cachedReadBundle` revalidate 60s → 600s) 로 Sheets quota 압박을 90% 줄였지만 여전히 잠재 위험:
- cache miss 시 첫 진입에서 23 trainee × 1 시트 read = 23 reads 동시 발사
- 분당 60 reads/user 한도 — admin 동시 페이지 진입 + 정렬 작업 등에서 초과 가능
- **영구 해소** = `enrichUsersWithDates` 가 시트 fetch 자체 안 함

## 목표

`/api/me` + `/admin/users` 가 **registry 1회 read 만으로** 처리.
시트 fetch 0회가 평시 목표.

## 설계

### registry users 시트 컬럼 확장 (A~H → A~L)

| 컬럼 | 이름 | 의미 |
|---|---|---|
| A | email | (기존) |
| B | cohort | (기존) |
| C | name | (기존) |
| D | spreadsheetId | (기존) |
| E | role | (기존) |
| F | status | (기존) |
| G | assignedTrainer | (기존) |
| H | team | (기존, PR B-1 직전) |
| **I** | **cohort_label** | 시트 B3 값 캐시 (예: "PRM 7기") |
| **J** | **name_label** | 시트 C3 값 캐시 (예: "김상목") |
| **K** | **course_start_iso** | 시트 O1 ISO date (YYYY-MM-DD) |
| **L** | **graduation_iso** | 시트 O2 ISO date (YYYY-MM-DD) |

### 동기화 정책 — A 채택 (명시 버튼)

운영자 결정:
- ✅ admin 이 `/admin/users` 헤더 [🔄 시트→Registry 동기화] 버튼 → 일괄 update
- ❌ 자동 lazy diff (race condition 위험)
- ❌ cron (Vercel/PM2 cron 도입 부담)

신규 prep/claim 시점에 자동 stamp + admin 의 명시적 sync 로 옛 row + 변경 row 처리.

### 점진 마이그레이션

PR B-1 머지 후 즉시 효과 없음 — cached 컬럼 빈값. enrichUsersWithDates 가 fallback 으로 시트 fetch.
PR B-2 (stamp): 신규 row 부터 stamp 된 후 cached 사용.
PR B-3 (sync): admin 한 번 클릭으로 모든 옛 row 마이그레이션 → 시트 read 0회 도달.

## PR 분리 (3단계 순차)

### PR B-1 — Schema 확장 (이 PR, ~45분)
- `docs/plans/active/registry-cache-columns.md` (이 문서)
- `lib/types/index.ts`: User Zod 에 `cohortLabel?, nameLabel?, courseStartISO?, graduationISO?` 추가 (모두 optional default "")
- `lib/repo/users.ts`:
  - HEADER_RANGE: `A1:H1` → `A1:L1`
  - DATA_RANGE: `A2:H` → `A2:L`
  - parseRow: r[8]~r[11] 읽기 (String 정규화)
  - ensureRegistryHeader: 헤더 4개 추가
- `lib/service/me.ts`: `enrichUsersWithDates` 분기 — cached 있으면 사용, 없으면 fallback
- `lib/repo/users-claim.ts`: append row 길이 12 로 확장 (빈 cached 4개)
- `lib/repo/users-prep.ts`: 동일
- SSOT 문서: sheet-structure.md, data-model.md, components.md (TraineeCard prop)
- **행위 변경 없음** — cached 빈값이라 fallback. 안전.

### PR B-2 — Stamp 흐름 (~30분)
- `addTraineePrepRow`: spreadsheetId 받으면 B3/C3/O1/O2 fetch → registry I~L stamp
- `claimAccount` (신규 row append 분기): 동일 stamp

### PR B-3 — Migration + 동기화 UI (~30분)
- `/api/admin/migrate-registry-cache` 신규 endpoint (admin only)
- `/admin/users` 헤더 [🔄 동기화] 버튼
- 모든 trainee row 의 cached 컬럼 일괄 update

## Acceptance Criteria

### PR B-1
- [ ] `lib/types/index.ts` User Zod 확장
- [ ] registry DATA_RANGE/HEADER_RANGE A2:L
- [ ] parseRow 가 r[8]~r[11] 을 cohortLabel/nameLabel/courseStartISO/graduationISO 로 매핑
- [ ] enrichUsersWithDates 가 cached 컬럼 채워져 있으면 시트 fetch 안 함
- [ ] 빈 cached 컬럼은 fallback (옛 흐름)
- [ ] typecheck/lint/structural/doc-drift 통과
- [ ] 머지 후 사이트 정상 (cached 빈값 → fallback 으로 옛 동작)

### PR B-2
- [ ] 신규 prep row 등록 시 cached 4컬럼 stamp
- [ ] 신규 claim row append 시 cached 4컬럼 stamp
- [ ] 기존 row 영향 없음

### PR B-3
- [ ] migrate endpoint 호출 시 모든 trainee row 의 시트 fetch + I~L update
- [ ] admin UI 헤더 [🔄 동기화] 버튼 + confirm + 결과 alert
- [ ] migration 후 모든 row 의 cached 채워짐 → enrichUsersWithDates 가 시트 fetch 0회

## 운영 안전 가드

- registry 시트 백업 (Google Sheets 버전 기록 확인 후 작업)
- PR B-3 migrate 는 멱등 — 다시 실행해도 안전 (덮어쓰기)
- 트레이너가 시트 B3 직접 수정 시: admin 이 [🔄 동기화] 1회 클릭으로 반영

## 함정 (오늘 사고 박제)

- ❌ Sheets API `UNFORMATTED_VALUE` — number/Date/boolean 반환 가능. 모든 read 후 `String()` 정규화.
- ❌ 시트 헤더 trailing space — trim 후 비교.
- ❌ 순환 의존 (Sections ↔ TraineeCard) — 타입·헬퍼는 Types 모듈로 분리.
