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
  if (history) assertRelation("schema_migrations", history);
  const applied = history ? (await client.query(
    "select version, checksum, applied_at from public.schema_migrations order by version")).rows : [];
  const targets = {};
  for (const name of TARGETS) targets[name] = await inspectRelation(client, name);
  return { historyExists: !!history, applied, targets };
}
