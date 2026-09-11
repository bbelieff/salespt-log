// Approved scope: revoke ONLY this table's two browser grantees; never automatic on preflight.
import { inspectRelation, assertRelation, historyDiagnostic } from "./weekly-goals-migrate-catalog.mjs";
import { DATABASE_LIMITS, LOCK_KEY } from "./weekly-goals-migrate.mjs";
const fail = () => { throw new Error("HISTORY_REPAIR_BLOCKED"); };
async function snapshot(client) {
  const relation = await inspectRelation(client, "schema_migrations");
  try { assertRelation("schema_migrations", relation); }
  catch (error) { if (error.code !== "UNSAFE_HISTORY_SECURITY") fail(); }
  const d = await historyDiagnostic(client, relation);
  if (!d.available || d.rls !== false || d.forceRls !== false || d.policies !== 0 ||
      d.anyColumnAcl !== false || d.unknownGrantees.total !== 0 || d.server.owner !== true ||
      Object.values(d.grantees.PUBLIC.privileges).some(v => v !== false) ||
      ["anon", "authenticated"].some(r => d.grantees[r].present !== true ||
        d.grantees[r].columnGrants !== false)) fail();
  // Fixed aggregate query: neither row contents nor arbitrary grantee/owner names leave this module.
  const { rows } = await client.query(`select count(*)::int as count,
    md5(coalesce(string_agg(jsonb_build_array(version,checksum,applied_at)::text,E'\\n' order by version),'')) as digest
    from public.schema_migrations`);
  const acl = await client.query(`select c.relowner,c.relrowsecurity,c.relforcerowsecurity,
    (select coalesce(jsonb_agg(to_jsonb(a) order by a.grantor,a.grantee,a.privilege_type),'[]'::jsonb)
      from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      where a.grantee not in (select oid from pg_roles where rolname in ('anon','authenticated'))) as preserved_acl,
    (select coalesce(jsonb_agg(jsonb_build_array(r.oid,p.privilege,
       has_table_privilege(r.oid,c.oid,p.privilege)) order by r.oid,p.privilege),'[]'::jsonb)
       from pg_roles r cross join unnest($1::text[]) p(privilege)
       where r.oid=c.relowner or r.rolname in (current_user,'service_role')) as preserved_permissions
    from pg_class c where c.oid=to_regclass('public.schema_migrations')`,
  [["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]]);
  if (rows.length !== 1 || !Number.isSafeInteger(rows[0].count) || typeof rows[0].digest !== "string" || acl.rows.length !== 1) fail();
  return { d, count: rows[0].count, digest: rows[0].digest, preserved: JSON.stringify(acl.rows[0]) };
}
export async function repairHistoryAcl(client, assertRuntimeUnchanged) {
  if (typeof assertRuntimeUnchanged !== "function") fail();
  await client.query("begin");
  try {
    await client.query(`set local lock_timeout = '${DATABASE_LIMITS.lock_timeout}ms'`);
    await client.query(`set local statement_timeout = '${DATABASE_LIMITS.statement_timeout}ms'`);
    await client.query("select pg_advisory_xact_lock($1)", [LOCK_KEY]);
    await client.query("lock table public.schema_migrations in access exclusive mode");
    const before = await snapshot(client);
    await assertRuntimeUnchanged();
    const exposed = ["anon", "authenticated"].some(r =>
      Object.values(before.d.grantees[r].privileges).some(v => v === true) || before.d.grantees[r].effectiveColumnAccess);
    if (exposed) await client.query("revoke all privileges on table public.schema_migrations from anon, authenticated restrict");
    const after = await snapshot(client);
    if (["anon", "authenticated"].some(r => Object.values(after.d.grantees[r].privileges).some(v => v !== false) ||
        after.d.grantees[r].effectiveColumnAccess !== false) ||
        before.count !== after.count || before.digest !== after.digest || before.preserved !== after.preserved) fail();
    assertRelation("schema_migrations", await inspectRelation(client, "schema_migrations"));
    await assertRuntimeUnchanged();
    await client.query("commit");
    return { mode: exposed ? "HISTORY_ACL_REPAIRED" : "HISTORY_ACL_ALREADY_SAFE",
      table: "public.schema_migrations", ledgerCount: after.count, ledgerDigestMatches: true,
      ownerServiceServerPermissionsPreserved: true, browserEffectiveAccess: false };
  } catch (error) { await client.query("rollback").catch(() => {}); throw error; }
}
