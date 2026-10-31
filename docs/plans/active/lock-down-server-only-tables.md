> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 앱이 실행 중에 직접 만든 서버 전용 표(보관함·PIN·구글 토큰·sheet_rows 등)에 Supabase 공개 역할 권한 회수와 행 단위 보안(RLS)을 거는 마이그레이션 0009 (화석 조사 B6).
> - **누가 읽나요**: 개발자, 운영자(belie — 적용 승인)
> - **어떤 기능·작업과 연결?**: `lib/repo/db/migrations/0009_lock_down_server_only_tables.sql`, `.github/workflows/db-migrate.yml`
> - **읽고 나면 알 수 있는 것**: 왜 필요한가 / 앱 동작이 바뀌나 / 적용·되돌리는 법
> - **관련 문서**: 0005·0008 마이그레이션(같은 방식), `docs/plans/active/masked-sandbox-snapshot.md`

---
slug: lock-down-server-only-tables
status: active
created: 2026-10-15
branch: chore/lock-down-server-only-tables
---

# 0009 — 서버 전용 표 잠그기

- **왜**: 0005·0008 이 만든 표는 `anon`·`authenticated` 권한 회수 + RLS 가 있는데, 앱이 실행 중에 만든 표(company_vault·vault_pins 2026-10-09, sheet_rows·users·cohorts·gcal_* 파일럿 시절 등)는 없다. 앱은 서버의 표 주인 연결로만 읽고 쓰므로, 브라우저용 공개 키 경로를 닫아도 앱 동작은 같다.
- **무엇**: 대상 10개 표 중 있는 것만(to_regclass) `revoke all from public/anon/authenticated` + `enable row level security`. FORCE 는 쓰지 않는다(주인 연결 우회 유지). 보관함 두 표는 `create table if not exists` 로 정식 이력에 올린다. **데이터 변경 없음.**
- **연습장 검증(가짜 사본)**: 두 번 적용해도 오류 없음, 6개 표 RLS 켜짐, 주인 연결로 sheet_rows 8,495행 그대로 읽힘.
- **적용(별도 — belie 승인 후)**: GitHub Actions `db-migrate` 를 dry-run 으로 먼저 → 적용 → 앱 health·저장 확인. 이 PR 머지만으로는 적용되지 않는다(배포는 마이그레이션을 돌리지 않음).
- **되돌리기**: `alter table ... disable row level security`(권한은 원래 PUBLIC 기본만 있었다). 파일은 적용 뒤 불변.
- **다음**: 적용 확인 후 앱 코드의 실행 중 표 만들기(company-vault.ts doEnsure 등)를 존재 확인으로 줄인다.