-- 첫걸음(새 수강생 온보딩) 기억 — 계정마다 한 줄 (docs/plans/completed/first-steps-2.md, belie 2026-11-11 「2차도 진행해줘」).
-- Additive only: one new table. 적용은 db-migrate 워크플로로 따로(승인 후). 표가 없으면 앱은 브라우저 기억으로 동작한다.
-- memory: {hidden, never[], finished[], reviewSeen} · done: 끝낸 단계 키(관리자 진행 표시용, 화면이 실제 기록으로 계산해 올린다).
create table if not exists public.first_steps (
  email text primary key,
  memory jsonb not null default '{}'::jsonb,
  done text[] not null default '{}',
  updated_at timestamptz not null default now()
);
revoke all on public.first_steps from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then revoke all on public.first_steps from anon; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on public.first_steps from authenticated; end if;
end $$;
alter table public.first_steps enable row level security;
