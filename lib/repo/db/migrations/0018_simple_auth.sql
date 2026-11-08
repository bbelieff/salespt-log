-- 간편인증 서류 조회 (docs/plans/active/simple-auth-scraping.md, belie 2026-11-09). Additive only: two new tables.
-- 한 줄 = 수강생이 고객(업체 대표)에게 보낸 인증 한 건. 사업자별 결과(정형값·DB 연결·반영 여부)는 businesses JSONB.
-- 저장하지 않는 것: 인증서 파일·비밀번호·주민번호 뒷자리(요청에만 쓰고 버림), 4대보험 가입자 개인정보(인원 수만).
-- 원문 PDF 는 simple_auth_originals 에 서버 키로 봉인(sealVault 와 같은 AES-GCM, 다른 용도 키)해 둔다.
create table if not exists public.simple_auth_requests (
  id uuid primary key,
  email text not null,
  spreadsheet_id text not null,
  owner_name text not null,
  phone text not null default '',
  method text not null,
  docs text[] not null,
  status text not null,
  sent_at timestamptz not null default now(),
  deadline timestamptz not null,
  resends integer not null default 0,
  progress integer not null default 0,
  error text,
  businesses jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists simple_auth_requests_owner on public.simple_auth_requests (spreadsheet_id, sent_at desc);

create table if not exists public.simple_auth_originals (
  request_id uuid not null references public.simple_auth_requests(id) on delete cascade,
  biz_no text not null,
  doc_key text not null,
  sealed text not null,
  created_at timestamptz not null default now(),
  primary key (request_id, biz_no, doc_key)
);

revoke all on public.simple_auth_requests from public;
revoke all on public.simple_auth_originals from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then
   revoke all on public.simple_auth_requests from anon; revoke all on public.simple_auth_originals from anon;
 end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then
   revoke all on public.simple_auth_requests from authenticated; revoke all on public.simple_auth_originals from authenticated;
 end if;
end $$;
alter table public.simple_auth_requests enable row level security;
alter table public.simple_auth_originals enable row level security;
