-- 컨택 대본·문자양식 (docs/plans/active/contact-script.md, belie 2026-11-05). Additive only: one new table.
-- 로그인 계정(이메일)마다 한 줄. 줄이 없으면 화면은 기본 대본(lib/config/contact-script.ts)을 보여 준다.
create table if not exists public.contact_scripts (
  email text primary key,
  script text not null,
  sms text not null,
  updated_at timestamptz not null default now()
);
revoke all on public.contact_scripts from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then revoke all on public.contact_scripts from anon; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on public.contact_scripts from authenticated; end if;
end $$;
alter table public.contact_scripts enable row level security;
