// Catalog-only checks: never read student rows, create objects, or modify privileges.
export const TARGETS = ["weekly_goals", "weekly_goal_private"];
const PRIMARY_KEY = "PRIMARY KEY (student_id, cohort, course_start, week_start)";
const common = [
  ["student_id", "text", true, null], ["cohort", "text", true, null],
  ["course_start", "date", true, null], ["week_start", "date", true, null],
];
const tail = [["revision", "integer", true, null], ["updated_at", "timestamp with time zone", true, "now()"]];
const metrics = ["production", "inflow", "contacts", "meetings", "contracts"];
const textColumn = (name) => [name, "text", true, "''::text"];
const expectedColumns = {
  weekly_goals: [...common, ...metrics.map((n) => [n, "integer", false, null]), textColumn("task"), ...tail],
  weekly_goal_private: [...common, textColumn("special_notes"), textColumn("prior_outcome"), ...tail],
  schema_migrations: [["version", "text", true, null], ["checksum", "text", true, null],
    ["applied_at", "timestamp with time zone", true, "now()"]],
};
const expectedConstraints = {
  weekly_goals: [PRIMARY_KEY, "CHECK ((revision > 0))", "CHECK ((length(task) <= 10000))",
    ...metrics.map((n) => `CHECK ((${n} >= 0))`)],
  weekly_goal_private: [PRIMARY_KEY, "CHECK ((revision > 0))", "CHECK ((length(special_notes) <= 10000))",
    "CHECK ((length(prior_outcome) <= 10000))"],
  schema_migrations: ["PRIMARY KEY (version)"],
};
export class MigrationGateError extends Error {
  constructor(code) { super(`[weekly-goals-migrate] ${code}`); this.code = code; }
}
const fail = (code) => { throw new MigrationGateError(code); };
const PRIVILEGES = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];
const CODES = new Set(["CONFLICTING_RELATION", "CONFLICTING_INDEXES", "CONFLICTING_COLUMNS",
  "CONFLICTING_CONSTRAINTS", "HISTORY_VISIBILITY_NOT_FULL", "UNSAFE_HISTORY_SECURITY",
  "UNSAFE_TABLE_SECURITY", "SERVER_CONNECTION_CANNOT_STORE", "INVALID_ARGUMENTS_USE_PREFLIGHT_OR_EXECUTE",
  "EXACT_MIGRATION_MISSING_OR_DUPLICATED", "SQL_CHECKSUM_NOT_APPROVED", "APPLIED_HISTORY_CHECKSUM_MISMATCH",
  "EXACT_HISTORY_CHECKSUM_MISMATCH", "UNTRACKED_TARGET_RELATION", "APP_ROOT_CWD_MISMATCH", "DATABASE_URL_NOT_CONFIGURED"]);
const boolean = (value) => typeof value === "boolean" ? value : null;
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
function safeHistoryDiagnostic(value) {
  const grants = (role) => {
    const source = value?.grantees?.[role];
    return { present: boolean(source?.present),
      privileges: Object.fromEntries(PRIVILEGES.map((p) => [p, boolean(source?.privileges?.[p])])),
      columnGrants: boolean(source?.columnGrants), effectiveColumnAccess: boolean(source?.effectiveColumnAccess) };
  };
  return { table: "public.schema_migrations", available: value?.available === true,
    rls: boolean(value?.rls), forceRls: boolean(value?.forceRls), policies: count(value?.policies),
    unexpectedAcl: boolean(value?.unexpectedAcl), anyColumnAcl: boolean(value?.anyColumnAcl),
    grantees: Object.fromEntries(["PUBLIC", "anon", "authenticated"].map((r) => [r, grants(r)])),
    unknownGrantees: { category: "NON_OWNER_NON_SERVICE_NON_BROWSER",
      table: count(value?.unknownGrantees?.table), column: count(value?.unknownGrantees?.column),
      total: count(value?.unknownGrantees?.total) },
    server: { owner: boolean(value?.server?.owner), superuser: boolean(value?.server?.superuser),
      roleBypassRls: boolean(value?.server?.roleBypassRls), effectiveRlsBypass: boolean(value?.server?.effectiveRlsBypass),
      privileges: Object.fromEntries(PRIVILEGES.map((p) => [p, boolean(value?.server?.privileges?.[p])])) } };
}
// Never serialize Error/message/stack/cause, arbitrary roles, raw catalogs or caller-provided fields.
export function formatMigrationFailure(error, fallback) {
  if (!(error instanceof MigrationGateError) || !CODES.has(error.code)) return fallback;
  const result = { error: error.code };
  if (["UNSAFE_HISTORY_SECURITY", "HISTORY_VISIBILITY_NOT_FULL"].includes(error.code)) {
    result.diagnostic = safeHistoryDiagnostic(error.diagnostic);
  }
  return JSON.stringify(result);
}

async function historyDiagnostic(client, relation) {
  const { rows } = await client.query(`with target as (
    select c.oid,c.relowner,c.relacl from pg_class c where c.oid=to_regclass('public.schema_migrations')
  ), table_acl as (
    select a.* from target c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
  ), column_acl as (
    select x.* from target c join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
      cross join lateral aclexplode(a.attacl) x
  ), unknown_acl as (
    select a.grantee,a.kind from (
      select grantee,'table' as kind from table_acl union all select grantee,'column' from column_acl
    ) a cross join target c where a.grantee<>0 and a.grantee<>c.relowner
      and a.grantee not in (select oid from pg_roles where rolname in ('service_role','anon','authenticated'))
  ), labels as (
    select label from (values ('PUBLIC'),('anon'),('authenticated'),('SERVER')) v(label)
  )
  select l.label,p.privilege,
    (l.label='PUBLIC' or r.oid is not null) as present,
    case when l.label='PUBLIC' then exists(select 1 from table_acl a where a.grantee=0 and a.privilege_type=p.privilege)
      when r.oid is not null then has_table_privilege(r.oid,c.oid,p.privilege) else null end as allowed,
    exists(select 1 from column_acl a where a.grantee=case when l.label='PUBLIC' then 0 else r.oid end) as column_grants,
    case when l.label='PUBLIC' then exists(select 1 from column_acl a where a.grantee=0)
      when r.oid is not null then has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
      else null end as effective_column_access,
    (select count(distinct grantee)::int from unknown_acl where kind='table') as unknown_table,
    (select count(distinct grantee)::int from unknown_acl where kind='column') as unknown_column,
    (select count(distinct grantee)::int from unknown_acl) as unknown_total,
    (r.oid=c.relowner) as owner,r.rolsuper as superuser,r.rolbypassrls as bypass_rls
  from target c cross join labels l
    cross join unnest($1::text[]) p(privilege)
    left join pg_roles r on r.rolname=case when l.label='SERVER' then current_user else l.label end`, [PRIVILEGES]);
  const role = (label) => {
    const selected = rows.filter((r) => r.label === label);
    return { present: selected[0]?.present, columnGrants: selected[0]?.column_grants,
      effectiveColumnAccess: selected[0]?.effective_column_access,
      privileges: Object.fromEntries(PRIVILEGES.map((p) => [p, selected.find((r) => r.privilege === p)?.allowed])) };
  };
  const server = rows.find((r) => r.label === "SERVER");
  return safeHistoryDiagnostic({ available: rows.length === 28, rls: relation.rls, forceRls: relation.force_rls,
    policies: relation.policies, unexpectedAcl: relation.unexpected_acl,
    anyColumnAcl: relation.columns.some((c) => c.column_acl),
    grantees: Object.fromEntries(["PUBLIC", "anon", "authenticated"].map((r) => [r, role(r)])),
    unknownGrantees: { table: rows[0]?.unknown_table, column: rows[0]?.unknown_column, total: rows[0]?.unknown_total },
    server: { owner: server?.owner, superuser: server?.superuser, roleBypassRls: server?.bypass_rls,
      effectiveRlsBypass: relation.server_rls_bypass, privileges: role("SERVER").privileges } });
}

export async function inspectRelation(client, name) {
  const { rows } = await client.query(`select c.oid, c.relkind, c.relrowsecurity as rls,
    c.relforcerowsecurity as force_rls,
    (select count(*)::int from pg_policy where polrelid=c.oid) as policies,
    (select count(*)::int from pg_trigger where tgrelid=c.oid and not tgisinternal) as triggers,
    (select count(*)::int from pg_rewrite where ev_class=c.oid) as rules,
    (select count(*)::int from pg_inherits where inhrelid=c.oid or inhparent=c.oid) as inheritance,
    (select count(*)::int from pg_index where indrelid=c.oid) as indexes,
    (select count(*)::int from pg_index where indrelid=c.oid and indisprimary and indisunique
      and indisvalid and indisready and indpred is null and indexprs is null) as valid_primary_indexes,
    exists(select 1 from aclexplode(coalesce(c.relacl, acldefault('r',c.relowner))) a
      where a.grantee=0 or (a.grantee<>c.relowner and a.grantee not in
        (select oid from pg_roles where rolname='service_role'))) as unexpected_acl,
    (r.rolsuper or r.rolbypassrls or (c.relowner=r.oid and not c.relforcerowsecurity)) as server_rls_bypass,
    has_table_privilege(current_user,c.oid,'SELECT') and has_table_privilege(current_user,c.oid,'INSERT')
      and has_table_privilege(current_user,c.oid,'UPDATE') as server_dml
    from pg_class c join pg_roles r on r.rolname=current_user
    where c.oid=to_regclass($1)`, [`public.${name}`]);
  if (!rows.length) return null;
  const relation = rows[0];
  const columns = await client.query(`select a.attname as name, format_type(a.atttypid,a.atttypmod) as type,
    a.attnotnull as required, pg_get_expr(d.adbin,d.adrelid) as default_value,
    a.attidentity as identity, a.attgenerated as generated, a.attacl is not null as column_acl
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid=$1 and a.attnum>0 and not a.attisdropped order by a.attnum`, [relation.oid]);
  // PG18 also catalogs NOT NULL as contype=n; attnotnull above checks that across PG versions.
  const constraints = await client.query(`select pg_get_constraintdef(oid) as definition, convalidated as validated
    from pg_constraint where conrelid=$1 and contype<>'n' order by conname`, [relation.oid]);
  const browser = await client.query(`select r.rolname as role,
    has_table_privilege(r.oid,$1::oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_any_column_privilege(r.oid,$1::oid,'SELECT,INSERT,UPDATE,REFERENCES') as access
    from pg_roles r where r.rolname in ('anon','authenticated') order by r.rolname`, [relation.oid]);
  return { ...relation, columns: columns.rows, constraints: constraints.rows, browser: browser.rows };
}

export function assertRelation(name, relation) {
  if (!relation || relation.relkind !== "r" || relation.triggers || relation.rules || relation.inheritance) {
    fail("CONFLICTING_RELATION");
  }
  if (relation.indexes !== 1 || relation.valid_primary_indexes !== 1) fail("CONFLICTING_INDEXES");
  const columns = relation.columns.map((c) => [c.name, c.type, c.required, c.default_value]);
  if (JSON.stringify(columns) !== JSON.stringify(expectedColumns[name]) ||
      relation.columns.some((c) => c.identity || c.generated)) fail("CONFLICTING_COLUMNS");
  const constraints = relation.constraints.map((c) => c.definition).sort();
  if (JSON.stringify(constraints) !== JSON.stringify([...expectedConstraints[name]].sort()) ||
      relation.constraints.some((c) => !c.validated)) fail("CONFLICTING_CONSTRAINTS");
  if (name === "schema_migrations") {
    if (relation.rls || relation.policies) fail("HISTORY_VISIBILITY_NOT_FULL");
    if (relation.unexpected_acl || relation.columns.some((c) => c.column_acl) ||
        relation.browser.some((r) => r.access)) fail("UNSAFE_HISTORY_SECURITY");
    return;
  }
  if (!relation.rls || relation.policies || relation.unexpected_acl ||
      relation.columns.some((c) => c.column_acl) || relation.browser.some((r) => r.access)) fail("UNSAFE_TABLE_SECURITY");
  if (!relation.server_rls_bypass || !relation.server_dml) fail("SERVER_CONNECTION_CANNOT_STORE");
}

export async function inspectState(client) {
  const history = await inspectRelation(client, "schema_migrations");
  if (history) {
    try { assertRelation("schema_migrations", history); }
    catch (error) {
      if (error instanceof MigrationGateError &&
          ["UNSAFE_HISTORY_SECURITY", "HISTORY_VISIBILITY_NOT_FULL"].includes(error.code)) {
        // Metadata only, still inside the caller's read-only transaction. Failure stays failure.
        try { error.diagnostic = await historyDiagnostic(client, history); } catch { /* no driver detail */ }
      }
      throw error; // Never reach the history data SELECT after denial.
    }
  }
  const applied = history ? (await client.query(
    "select version, checksum, applied_at from public.schema_migrations order by version")).rows : [];
  const targets = {};
  for (const name of TARGETS) targets[name] = await inspectRelation(client, name);
  return { historyExists: !!history, applied, targets };
}
