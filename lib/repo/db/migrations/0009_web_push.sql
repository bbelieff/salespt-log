-- web-push-notifications (docs/plans/active/web-push-notifications.md §4). Additive only:
-- three new tables, no existing table or student record changes. Apply with scripts/db-migrate.mjs.
-- email = login email (lower-case), never a client-provided key.
create table if not exists public.push_subscriptions (
  id uuid primary key,
  email text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  platform text not null check (platform in ('android','ios_pwa','desktop','other')),
  browser text not null default '',
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_count int not null default 0,
  disabled_at timestamptz
);
create index if not exists push_subscriptions_email_idx on public.push_subscriptions (email) where disabled_at is null;

create table if not exists public.push_preferences (
  email text primary key,
  enabled boolean not null default true,
  morning_enabled boolean not null default true,
  morning_time text not null default '08:45' check (morning_time ~ '^((0[7-9]|10):(00|15|30|45)|11:00)$'),
  evening_enabled boolean not null default true,
  evening_time text not null default '18:00' check (evening_time ~ '^((1[7-9]|20):(00|15|30|45)|21:00)$'),
  weekdays smallint not null default 31 check (weekdays between 1 and 127),
  kinds text[] not null default '{overdue,today,meeting,initial,recontact,stalled}',
  show_company_names boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_deliveries (
  id uuid primary key,
  idempotency_key text not null unique,
  email text not null,
  slot text not null check (slot in ('morning','evening','test')),
  local_date date not null,
  message_id text not null default '',
  item_count int not null default 0,
  status text not null default 'pending' check (status in ('pending','sent','skipped_zero','failed')),
  devices_sent int not null default 0,
  devices_failed int not null default 0,
  created_at timestamptz not null default now(),
  opened_at timestamptz
);
create index if not exists push_deliveries_email_date_idx on public.push_deliveries (email, local_date);
