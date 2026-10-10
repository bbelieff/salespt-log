-- Additive DB management sheet, server-only tenant ownership. Existing migration runner applies this explicitly.
create table public.db_sheet_leads (
 spreadsheet_id text not null, id uuid not null, revision integer not null check(revision > 0),
 data jsonb not null, meeting_id uuid, updated_at timestamptz not null default now(),
 primary key(spreadsheet_id,id), unique(spreadsheet_id,meeting_id)
);
create table public.db_sheet_contacts (
 spreadsheet_id text not null, lead_id uuid not null, contact_date date not null,
 qualified boolean not null default false, result text not null, note text not null,
 primary key(spreadsheet_id,lead_id,contact_date),
 foreign key(spreadsheet_id,lead_id) references public.db_sheet_leads(spreadsheet_id,id)
);
create table public.db_sheet_imports (
 spreadsheet_id text not null, batch_id uuid not null, digest text not null, lead_ids jsonb not null,
 primary key(spreadsheet_id,batch_id)
);
create table public.db_sheet_history (
 spreadsheet_id text not null, lead_id uuid not null, revision integer not null, data jsonb not null,
 recorded_at timestamptz not null default now(), primary key(spreadsheet_id,lead_id,revision),
 foreign key(spreadsheet_id,lead_id) references public.db_sheet_leads(spreadsheet_id,id)
);
revoke all on public.db_sheet_leads,public.db_sheet_contacts,public.db_sheet_imports,public.db_sheet_history from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then
 revoke all on public.db_sheet_leads,public.db_sheet_contacts,public.db_sheet_imports,public.db_sheet_history from anon;
 end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then
 revoke all on public.db_sheet_leads,public.db_sheet_contacts,public.db_sheet_imports,public.db_sheet_history from authenticated;
 end if;
end $$;
alter table public.db_sheet_leads enable row level security;
alter table public.db_sheet_contacts enable row level security;
alter table public.db_sheet_imports enable row level security;
alter table public.db_sheet_history enable row level security;
