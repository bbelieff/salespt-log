-- #958 additive settings only; requires #956 0006. No seed, existing-table or role changes.
create table public.trainer_access_settings (
  email text primary key references public.trainer_qualifications(email),
  grade text not null check (grade in ('senior', 'regular', 'apprentice')),
  grants jsonb not null,
  version integer not null check (version > 0),
  updated_by text not null check (length(updated_by) between 3 and 254 and updated_by = lower(btrim(updated_by))),
  updated_at timestamptz not null default now(),
  check (email = lower(btrim(email))),
  -- Exact JSON structure including six boolean values; SQL NULL must not bypass checks.
  check ((grants = jsonb_build_object(
    'active', jsonb_build_object('read', grants#>'{active,read}', 'write', grants#>'{active,write}'),
    'arena', jsonb_build_object('read', grants#>'{arena,read}', 'write', grants#>'{arena,write}'),
    'archived', jsonb_build_object('read', grants#>'{archived,read}', 'write', grants#>'{archived,write}')
  ) and jsonb_typeof(grants#>'{active,read}') = 'boolean'
    and jsonb_typeof(grants#>'{active,write}') = 'boolean'
    and jsonb_typeof(grants#>'{arena,read}') = 'boolean'
    and jsonb_typeof(grants#>'{arena,write}') = 'boolean'
    and jsonb_typeof(grants#>'{archived,read}') = 'boolean'
    and jsonb_typeof(grants#>'{archived,write}') = 'boolean') is true),
  check ((grants#>'{active,write}' = 'false'::jsonb or grants#>'{active,read}' = 'true'::jsonb)
    and (grants#>'{arena,write}' = 'false'::jsonb or grants#>'{arena,read}' = 'true'::jsonb)
    and (grants#>'{archived,write}' = 'false'::jsonb or grants#>'{archived,read}' = 'true'::jsonb)),
  check (grade = 'senior' or (grants->'arena' = '{"read":false,"write":false}'::jsonb
    and grants->'archived' = '{"read":false,"write":false}'::jsonb))
);
create table public.trainer_access_audit (
  email text not null references public.trainer_access_settings(email),
  version integer not null check (version > 0),
  grade text not null check (grade in ('senior', 'regular', 'apprentice')),
  grants jsonb not null,
  changed_by text not null check (length(changed_by) between 3 and 254 and changed_by = lower(btrim(changed_by))),
  changed_at timestamptz not null,
  primary key (email, version)
);
revoke all on public.trainer_access_settings, public.trainer_access_audit from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.trainer_access_settings, public.trainer_access_audit from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.trainer_access_settings, public.trainer_access_audit from authenticated;
  end if;
end $$;
alter table public.trainer_access_settings enable row level security;
alter table public.trainer_access_audit enable row level security;
-- Same owner/BYPASSRLS runtime contract as #956. No new remote access/role/policy grants.
