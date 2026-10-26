-- 비서 사서함 (docs/plans/active/web-push-notifications.md §16, belie 2026-10-26). Additive only: one new table.
-- One row per (email, slot, local_date): the morning/evening summary as it was at that time, kept 90 days.
-- Made for every eligible trainee, notifications on or off. item_count=0 rows mark "made, nothing to show".
create table if not exists public.push_reports (
  id uuid primary key,
  email text not null,
  slot text not null check (slot in ('morning','evening')),
  local_date date not null,
  sent_at text not null,
  headline text not null,
  sections jsonb not null,
  item_count int not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (email, slot, local_date)
);
create index if not exists push_reports_email_date on public.push_reports (email, local_date desc);
create index if not exists push_reports_date on public.push_reports (local_date);
