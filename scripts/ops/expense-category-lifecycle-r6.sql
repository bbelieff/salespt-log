-- EXPENSE-CATEGORY-LIFECYCLE-R6. This file is executed only by the gated companion runner.
-- @phase A_TX
alter table expense_categories add column if not exists is_system boolean not null default false;
alter table expense_categories add column if not exists system_key text;
alter table expense_categories add column if not exists deleted_at timestamptz;
alter table expense_categories add column if not exists deleted_by text;
alter table expense_categories drop constraint if exists expense_categories_system_shape_ck;
alter table expense_categories add constraint expense_categories_system_shape_ck check (((is_system is true) and system_key is not null and system_key='unclassified' and name='미분류' and name_normalized='미분류' and archived_at is null and deleted_at is null and deleted_by is null) or ((is_system is false) and system_key is null)) not valid;
alter table expense_categories drop constraint if exists expense_categories_tombstone_ck;
alter table expense_categories add constraint expense_categories_tombstone_ck check ((deleted_at is null and deleted_by is null) or (deleted_at is not null and deleted_by is not null)) not valid;
alter table expense_category_audits add column if not exists target_category_id uuid references expense_categories(id);
alter table expense_category_audits add column if not exists operation_key uuid;
alter table expense_category_audits add column if not exists request_hash text;
alter table expense_category_audits add column if not exists terminal_deleted boolean not null default false;
alter table expense_category_audits add column if not exists prior_category_state jsonb;
alter table expense_category_audits add column if not exists moved_entry_count int not null default 0;
alter table expense_category_audits add column if not exists moved_rule_count int not null default 0;
alter table expense_category_audits add column if not exists moved_occurrence_count int not null default 0;
alter table expense_category_audits drop constraint if exists expense_category_audits_action_check;
alter table expense_category_audits add constraint expense_category_audits_action_check check(action in ('created','renamed','archived','restored','system_bootstrapped','deleted','reclassified','legacy_migrated')) not valid;
create table if not exists expense_category_audit_items(audit_id uuid not null references expense_category_audits(id),entity_kind text not null check(entity_kind in ('entry','recurring_rule','recurring_occurrence')),entity_id uuid not null,previous_category_id uuid not null,previous_category_name text not null,previous_is_override boolean,primary key(audit_id,entity_kind,entity_id));
create table if not exists expense_schema_migrations(key text primary key,state text not null check(state in ('applying','ready','rollback_required')),script_sha256 text not null,scopes_sha256 text not null,completed_at timestamptz,details jsonb not null default '{}');
insert into expense_schema_migrations(key,state,script_sha256,scopes_sha256,details) values('expense_category_lifecycle_r6','applying','{{script_sha}}','{{scopes_sha}}','{"phase":"A"}') on conflict(key) do update set state='applying',script_sha256=excluded.script_sha256,scopes_sha256=excluded.scopes_sha256,completed_at=null,details=excluded.details;

-- @phase A_CONCURRENT
create unique index concurrently if not exists expense_categories_system_key_uq on expense_categories(spreadsheet_id,system_key) where system_key is not null;
create unique index concurrently if not exists expense_categories_active_name_uq on expense_categories(spreadsheet_id,name_normalized) where deleted_at is null and archived_at is null;
create index concurrently if not exists expense_categories_scope_lifecycle_idx on expense_categories(spreadsheet_id,deleted_at,archived_at);
create unique index concurrently if not exists expense_category_terminal_audit_uq on expense_category_audits(spreadsheet_id,category_id) where action in ('deleted','legacy_migrated') and terminal_deleted;
create unique index concurrently if not exists expense_category_operation_key_uq on expense_category_audits(spreadsheet_id,operation_key) where operation_key is not null;

-- @phase B
select spreadsheet_id,count(*)::int as legacy_unclassified_candidates from expense_categories where name_normalized='미분류' and system_key is null group by spreadsheet_id having count(*)>1;
select spreadsheet_id,name_normalized,count(*)::int as active_name_duplicates from expense_categories where deleted_at is null and archived_at is null group by spreadsheet_id,name_normalized having count(*)>1;
select distinct spreadsheet_id from expense_categories order by spreadsheet_id;

-- @phase C
select pg_advisory_xact_lock(hashtextextended('{{scope}}:expense-unclassified-r6',0));
do $r6$ begin if (select count(*) from expense_categories where spreadsheet_id='{{scope}}' and name_normalized='미분류' and system_key is null)>1 then raise exception 'multiple legacy unclassified candidates' using errcode='P0001'; end if; end $r6$;
with candidate as (select id,jsonb_build_object('name',name,'nameNormalized',name_normalized,'archivedAt',archived_at,'deletedAt',deleted_at,'deletedBy',deleted_by) prior from expense_categories where spreadsheet_id='{{scope}}' and name_normalized='미분류' and system_key is null order by (archived_at is null) desc,created_at,id limit 1), promoted as (update expense_categories c set name='미분류',name_normalized='미분류',is_system=true,system_key='unclassified',archived_at=null,deleted_at=null,deleted_by=null,updated_at=transaction_timestamp(),updated_by_email='{{actor}}' from candidate where c.id=candidate.id returning c.*,candidate.prior) insert into expense_category_audits(id,category_id,spreadsheet_id,action,previous_name,next_name,terminal_deleted,prior_category_state,actor_email,created_at) select gen_random_uuid(),id,spreadsheet_id,'legacy_migrated',prior->>'name','미분류',false,prior,'{{actor}}',transaction_timestamp() from promoted on conflict do nothing;
with missing as (select '{{scope}}'::text spreadsheet_id where not exists(select 1 from expense_categories where spreadsheet_id='{{scope}}' and system_key='unclassified')), inserted as (insert into expense_categories(id,spreadsheet_id,name,name_normalized,is_system,system_key,created_by_email,updated_by_email) select gen_random_uuid(),spreadsheet_id,'미분류','미분류',true,'unclassified','{{actor}}','{{actor}}' from missing returning *) insert into expense_category_audits(id,category_id,spreadsheet_id,action,next_name,prior_category_state,actor_email) select gen_random_uuid(),id,spreadsheet_id,'system_bootstrapped','미분류','{}'::jsonb,'{{actor}}' from inserted;

-- @phase D
do $r6$ begin if exists(select 1 from expense_categories group by spreadsheet_id having count(*) filter(where system_key='unclassified')<>1) then raise exception 'scope missing unique unclassified'; end if; if exists(select 1 from expense_categories where is_system and (system_key is distinct from 'unclassified' or name is distinct from '미분류' or name_normalized is distinct from '미분류' or archived_at is not null or deleted_at is not null or deleted_by is not null)) then raise exception 'invalid system category'; end if; end $r6$;
alter table expense_categories validate constraint expense_categories_system_shape_ck;
alter table expense_categories validate constraint expense_categories_tombstone_ck;
alter table expense_category_audits validate constraint expense_category_audits_action_check;
do $r6$ declare legacy_name text; begin select conname into legacy_name from pg_constraint where conrelid='expense_categories'::regclass and contype='u' and pg_get_constraintdef(oid) ilike '%spreadsheet_id%' and pg_get_constraintdef(oid) ilike '%name_normalized%' limit 1; if legacy_name is not null then execute format('alter table expense_categories drop constraint %I',legacy_name); end if; end $r6$;
update expense_schema_migrations set state='ready',script_sha256='{{script_sha}}',scopes_sha256='{{scopes_sha}}',completed_at=transaction_timestamp(),details='{"phase":"D","schemaReady":true}' where key='expense_category_lifecycle_r6';

-- @phase ROLLBACK_SCOPE
select pg_advisory_xact_lock(hashtextextended('{{scope}}:expense-unclassified-r6',0));
do $r6$ begin if exists(select 1 from expense_categories c join expense_category_audits a on a.spreadsheet_id=c.spreadsheet_id and a.action='deleted' and a.terminal_deleted where c.spreadsheet_id='{{scope}}' and exists(select 1 from expense_categories n where n.spreadsheet_id=c.spreadsheet_id and n.name_normalized=c.name_normalized and n.id<>c.id and n.deleted_at is null and n.archived_at is null)) then raise exception 'rollback blocked by active name reuse'; end if; end $r6$;
with first_item as (select distinct on (i.entity_id) i.* from expense_category_audit_items i join expense_category_audits a on a.id=i.audit_id where a.spreadsheet_id='{{scope}}' and i.entity_kind='entry' order by i.entity_id,a.created_at,a.id) update expense_entries e set category_id=f.previous_category_id,category_name_at_entry=f.previous_category_name,updated_at=transaction_timestamp(),updated_by_email='{{actor}}' from first_item f where e.id=f.entity_id and e.spreadsheet_id='{{scope}}';
with first_item as (select distinct on (i.entity_id) i.* from expense_category_audit_items i join expense_category_audits a on a.id=i.audit_id where a.spreadsheet_id='{{scope}}' and i.entity_kind='recurring_rule' order by i.entity_id,a.created_at,a.id) update expense_recurring_rules r set category_id=f.previous_category_id,category_name_at_rule=f.previous_category_name,updated_at=transaction_timestamp(),updated_by_email='{{actor}}' from first_item f where r.id=f.entity_id and r.spreadsheet_id='{{scope}}';
with first_item as (select distinct on (i.entity_id) i.* from expense_category_audit_items i join expense_category_audits a on a.id=i.audit_id where a.spreadsheet_id='{{scope}}' and i.entity_kind='recurring_occurrence' order by i.entity_id,a.created_at,a.id) update expense_recurring_occurrences o set category_id=f.previous_category_id,category_name_at_occurrence=f.previous_category_name,is_override=f.previous_is_override,updated_at=transaction_timestamp(),updated_by_email='{{actor}}' from first_item f where o.id=f.entity_id and o.spreadsheet_id='{{scope}}';
update expense_categories c set name=a.prior_category_state->>'name',name_normalized=a.prior_category_state->>'nameNormalized',archived_at=(a.prior_category_state->>'archivedAt')::timestamptz,deleted_at=null,deleted_by=null,updated_at=transaction_timestamp(),updated_by_email='{{actor}}' from expense_category_audits a where a.category_id=c.id and a.spreadsheet_id='{{scope}}' and a.action='deleted' and a.terminal_deleted;
update expense_categories c set name=a.prior_category_state->>'name',name_normalized=a.prior_category_state->>'nameNormalized',is_system=false,system_key=null,archived_at=(a.prior_category_state->>'archivedAt')::timestamptz,deleted_at=(a.prior_category_state->>'deletedAt')::timestamptz,deleted_by=a.prior_category_state->>'deletedBy',updated_at=transaction_timestamp(),updated_by_email='{{actor}}' from expense_category_audits a where a.category_id=c.id and a.spreadsheet_id='{{scope}}' and a.action='legacy_migrated';
delete from expense_category_audit_items where audit_id in(select id from expense_category_audits where spreadsheet_id='{{scope}}' and action in('deleted','reclassified'));
delete from expense_category_audits where spreadsheet_id='{{scope}}' and action in('deleted','reclassified','legacy_migrated');
do $r6$ begin if exists(select 1 from expense_categories c join expense_category_audits a on a.category_id=c.id and a.action='system_bootstrapped' where c.spreadsheet_id='{{scope}}' and (exists(select 1 from expense_entries e where e.category_id=c.id) or exists(select 1 from expense_recurring_rules r where r.category_id=c.id) or exists(select 1 from expense_recurring_occurrences o where o.category_id=c.id))) then raise exception 'rollback blocked by used bootstrapped unclassified'; end if; end $r6$;
with removed as (delete from expense_category_audits where spreadsheet_id='{{scope}}' and action='system_bootstrapped' returning category_id) delete from expense_categories c using removed r where c.id=r.category_id;
update expense_schema_migrations set state='rollback_required',details=jsonb_build_object('scope','{{scope}}','reason','operator rollback requested') where key='expense_category_lifecycle_r6';
