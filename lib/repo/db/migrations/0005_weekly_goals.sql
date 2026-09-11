-- #947: additive, no student records or sheet formulas changed.
-- Apply with the existing db:migrate runner; deploying a file is not applied evidence.
create table if not exists weekly_goals (
  email text not null,
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
  primary key (email, cohort, course_start, week_start)
);

-- Kept separate so a public goal query never reads internal trainer notes.
create table if not exists weekly_goal_private (
  email text not null,
  cohort text not null,
  course_start date not null,
  week_start date not null,
  special_notes text not null default '' check (length(special_notes) <= 10000),
  prior_outcome text not null default '' check (length(prior_outcome) <= 10000),
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (email, cohort, course_start, week_start)
);

-- No browser/Supabase anonymous grants. Only the existing server connection uses these tables.
revoke all on weekly_goals, weekly_goal_private from public;
alter table weekly_goals enable row level security;
alter table weekly_goal_private enable row level security;
