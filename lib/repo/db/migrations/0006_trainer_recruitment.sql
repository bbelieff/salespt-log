-- #956 additive trainer qualification. Never modify users or student keys.
create table public.trainer_qualifications (
  email text primary key check (email = lower(btrim(email))),
  name text not null check (length(name) between 1 and 100),
  status text not null check (status in ('pending', 'active', 'rejected', 'revoked', 'cancelled')),
  department text not null default 'T' check (department in ('T', '관리')),
  updated_by text not null,
  updated_at timestamptz not null default now()
);
create table public.trainer_invitations (
  id uuid primary key,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  recipient_email text not null check (recipient_email = lower(btrim(recipient_email))),
  created_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by text,
  revoked_at timestamptz,
  revoked_by text,
  check ((accepted_at is null) = (accepted_by is null)),
  check ((revoked_at is null) = (revoked_by is null))
);
revoke all on public.trainer_qualifications, public.trainer_invitations from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.trainer_qualifications, public.trainer_invitations from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.trainer_qualifications, public.trainer_invitations from authenticated;
  end if;
end $$;
alter table public.trainer_qualifications enable row level security;
alter table public.trainer_invitations enable row level security;
