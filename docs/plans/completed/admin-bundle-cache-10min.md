---
slug: admin-bundle-cache-10min
status: active
created: 2026-05-13
worktree: ../wt/bundle-cache-10min
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: `cachedReadBundle` revalidate 60s → 600s 로 늘려 Sheets API quota 압박 해소.
> - **누가 읽나요**: 개발자 (성능/quota 작업 시)
> - **어떤 기능·작업과 연결?**: `lib/service/me.ts`, `/admin/users`, `enrichUsersWithDates`
> - **읽고 나면 알 수 있는 것**:
>   - Sheets API quota 한도 (60 reads/min/user)
>   - cache TTL trade-off (반영 지연 vs quota 절약)
>   - 즉시 반영 필요할 때 명시적 invalidate 방법
> - **관련 문서**: [setup-sheets.md](../../playbooks/setup-sheets.md), [admin-team-collapse-persist.md](./admin-team-collapse-persist.md)

# perf(admin/users): 시트 bundle 캐시 60s → 10분

## 배경 (2026-05-13 사고)

증상:
- `/admin/users` 진입 또는 팀 input 저장 시 HTTP 500 (Sheets API 429 Quota exceeded).
- "Quota exceeded for quota metric 'Read requests' and limit 'Read requests per minute per user'".

원인:
- `/admin/users` 가 `force-dynamic` — 매 요청마다 server component 재실행.
- `enrichUsersWithDates` 가 23 trainee × 개별 시트 read.
- 기존 cache 60s 라서 새로고침/restart 직후 동시 23 read 발사.
- Sheets API 한도: **분당 60 reads / user** → 새로고침 3번 = 69 초과.

## 변경

`lib/service/me.ts` 의 `cachedReadBundle`:
- `revalidate: 60` → `revalidate: 600` (10분)
- 시트 B3/C3/O1/O2 (cohort/name/courseStart/graduation) 데이터는 admin prep 후 거의 변경 없음
- trade-off: 시트 직접 수정 시 최대 10분 지연 반영 (실용상 무관)

## 효과 추정

| 시나리오 | Before (60s) | After (600s) |
|---|---|---|
| admin 1분간 페이지 1회 진입 | 23 reads | 23 reads (변화 없음) |
| admin 1분간 5회 진입 | 23 reads | 23 reads (모두 cache hit) |
| admin 10분간 10회 진입 | 230 reads | 23 reads |
| PM2 restart 후 1회 진입 | 23 reads | 23 reads (cache 비워짐) |

평균 운영 시 **Sheets read quota 사용량 ~85% 감소**.

## 즉시 반영이 필요할 때

```ts
import { revalidateTag } from "next/cache";
revalidateTag("me-bundle");
```

향후 admin 시트 동기화 버튼 추가 시 위 호출 trigger.

## Acceptance

- [x] typecheck PASS
- [x] lint PASS
- [x] test:structural PASS
- [ ] 운영 검증: /admin/users 빠른 새로고침 5회 시 500 안 뜸

## 후속 PR (별도)

장기 fix — **registry 캐시 컬럼 추가**:
- registry I~L 컬럼에 `cohort_label`, `name_label`, `course_start_iso`, `graduation_iso` stamp
- admin prep 시 시트 fetch 해서 registry 에 저장
- `enrichUsersWithDates` 는 registry 만 read → **시트 read 0회** (영구 해소)
- 슬러그: `perf/registry-cache-columns`
