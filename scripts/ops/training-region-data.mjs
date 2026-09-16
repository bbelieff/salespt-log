export async function applyTrainingRegions(client, rows, execute = false) {
  let blank = 0, already = 0, changed = 0;
  for (const r of rows) {
    const key = [r.keyHash,r.cohort];
    const q = await client.query("SELECT team FROM public.users WHERE encode(sha256(convert_to(concat_ws(chr(31),email,cohort,name,spreadsheet_id),'UTF8')),'hex')=$1 AND cohort=$2 AND role='trainee'" + (execute ? " FOR UPDATE" : ""), key);
    if (q.rowCount !== 1) throw new Error("REGISTRY_IDENTITY_MISMATCH");
    if (q.rows[0].team === r.region) { already++; continue; }
    if ((q.rows[0].team ?? "") !== "") throw new Error("EXISTING_REGION_CONFLICT");
    blank++;
    if (execute) {
      const updated = await client.query("UPDATE public.users SET team=$3 WHERE encode(sha256(convert_to(concat_ws(chr(31),email,cohort,name,spreadsheet_id),'UTF8')),'hex')=$1 AND cohort=$2 AND role='trainee' AND COALESCE(team,'')=''", [...key, r.region]);
      if (updated.rowCount !== 1) throw new Error("CONCURRENT_REGION_CHANGE");
      changed++;
    }
  }
  return { mode: execute ? "APPLIED" : "READ_ONLY", checked: rows.length, blank, already, changed };
}
