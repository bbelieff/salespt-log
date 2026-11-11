> **📄 이 문서는 무엇인가요?**
> - **한 줄 요약**: Supabase 보안 경고 — 열려 있던 지출 표 9개를 서버 전용으로 잠금(0021).
> - **누가 읽나요**: 개발자·운영(belie)
> - **어떤 기능·작업과 연결?**: `0021_lock_down_expense_tables.sql` · 0019 후속
> - **관련 문서**: `lib/repo/db/migrations/0019_lock_down_server_only_tables.sql`

# 2026-11-11 fix: 지출 표 잠금

- Supabase 메일(11/8 기준) 확인 → 11/11 보안 점검 재실행: 0019 이후에도 지출 표 9개가 rls_disabled_in_public.
- 원인: 지출 장부 표는 앱 실행 중 자체 스키마 기록으로 만들어져 0019 목록에서 빠짐.
- belie 승인 「진행해」. 방식은 0019·expense-idempotency 와 동일(RLS on, anon/authenticated 회수, FORCE 없음).
- 복구: disable row level security.
