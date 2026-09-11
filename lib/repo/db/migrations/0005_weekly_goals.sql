-- #947: additive, no student records or sheet formulas changed.
-- Apply this exact file with scripts/ops/weekly-goals-migrate.mjs after RELEASE.
-- student_id is the server-resolved spreadsheet identity, never a client-provided key.
create table if not exists public.weekly_goals (
  student_id text not null,
  cohort text not null,
  course_start date not null,
  week_start date not null,
  production integer check (production >= 0),
  inflow integer check (inflow >= 0),
  contacts integer check (contacts >= 0),
  meetings integer check (meetings >= 0),
  contracts integer check (contracts >= 0),
  task text not null default '' check (length(task) <= 10000),
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (student_id, cohort, course_start, week_start)
);

-- Kept separate so a public goal query never reads internal trainer notes.
create table if not exists public.weekly_goal_private (
  student_id text not null,
  cohort text not null,
  course_start date not null,
  week_start date not null,
  special_notes text not null default '' check (length(special_notes) <= 10000),
  prior_outcome text not null default '' check (length(prior_outcome) <= 10000),
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (student_id, cohort, course_start, week_start)
);

-- No browser/Supabase anonymous grants. Only the existing server connection uses these tables.
revoke all on public.weekly_goals, public.weekly_goal_private from public;
-- Older Supabase defaults grant these roles directly, independently of PUBLIC.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.weekly_goals, public.weekly_goal_private from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.weekly_goals, public.weekly_goal_private from authenticated;
  end if;
end $$;
alter table public.weekly_goals enable row level security;
alter table public.weekly_goal_private enable row level security;
