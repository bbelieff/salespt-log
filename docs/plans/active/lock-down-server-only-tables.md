---
slug: lock-down-server-only-tables
status: active
created: 2026-10-15
updated: 2026-11-10
branch: chore/lock-down-server-tables-v2
---

> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: 서버 전용 표(보관함·PIN·구글 토큰·sheet_rows·알림 구독 등)에 Supabase 공개 역할 권한 회수와 행 단위 보안(RLS)을 거는 마이그레이션 0019.
> - **누가 읽나요**: 개발자, 운영자(belie — 적용 승인)
> - **어떤 기능·작업과 연결?**: `lib/repo/db/migrations/0019_lock_down_server_only_tables.sql`, `.github/workflows/db-migrate.yml`
> - **읽고 나면 알 수 있는 것**: 왜 필요한가 / 앱 동작이 바뀌나 / 적용·되돌리는 법
> - **관련 문서**: 0005·0008·0014~0018 마이그레이션(같은 방식), 초안 PR #1158

# 0019 — 서버 전용 표 잠그기

- **왜**: 0005·0008·0014~0018 이 만든 표는 `anon`·`authenticated` 권한 회수 + RLS 가 있는데, 앱이 실행 중에 만든 표(company_vault·vault_pins·sheet_rows·users·cohorts·gcal_*·bug_reports 등)와 0009·0013 의 알림 표(push_subscriptions 등)는 없다. 앱은 서버의 표 주인 연결로만 읽고 쓰므로, 브라우저용 공개 키 경로를 닫아도 앱 동작은 같다(같은 방식의 0008·0014 표가 이미 운영 중).
- **무엇**: 대상 15개 표 중 있는 것만(to_regclass) `revoke all from public/anon/authenticated` + `enable row level security`. FORCE 는 쓰지 않는다. 보관함 두 표는 `create table if not exists` 로 정식 이력에 올린다. **데이터 변경 없음.**
- **#1158 대비 바뀐 점(2026-11-10)**: 번호 0009 → 0019(0009_web_push 와 겹침 해소), 대상에 push_subscriptions·push_preferences·push_deliveries·push_reports·bug_reports 추가.
- **검증**: pglite 시험(두 번 적용·없는 표 건너뜀·RLS 켜짐·주인 읽기). 10월 연습장(가짜 사본) 2회 적용·sheet_rows 8,495행 읽기 확인.
- [ ] 머지 → db-migrate installed dry-run(대기 목록 = 0019 하나인지) → execute → 앱 health·로그인·저장 확인.
- **되돌리기**: `alter table ... disable row level security`(권한은 원래 PUBLIC 기본만). 파일은 적용 뒤 불변.
