#!/usr/bin/env node
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { verifyArtifact } from "./trainer-recruitment-delivery.mjs";
import { main } from "./trainer-recruitment-migrate.mjs";
import { formatMigrationFailure } from "./weekly-goals-migrate-catalog.mjs";
import { compareRuntime } from "./weekly-goals-runtime.mjs";

export async function runDelivery(args) {
  const [mode, sha, manifestChecksum, sqlChecksum, ...extra] = args;
  if (!["verify", "preflight", "execute", "compare-runtime"].includes(mode) || extra.length) throw new Error("DELIVERY_ARGUMENTS_INVALID");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const verified = await verifyArtifact(root, sha, manifestChecksum, sqlChecksum);
  if (mode === "verify") return { mode: "ARTIFACT_VERIFIED", sha, manifestChecksum, sqlChecksum };
  if (process.cwd() !== "/opt/salespt-log") throw new Error("DELIVERY_APP_CWD_MISMATCH");
  let report;
  if (mode === "compare-runtime") report = (await compareRuntime()).report;
  else {
    if (mode === "execute") await compareRuntime();
    report = await main([mode === "execute" ? "--execute" : "--preflight"], { files: verified.files, appRoot: "/opt/salespt-log" });
  }
  const result = { sha, manifestChecksum, sqlChecksum, ...report };
  // Outside the payload; artifact verifier continues rejecting any extra payload files.
  await writeFile(resolve(root, `../${mode}-result.json`), JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
  return result;
}
export async function runDeliveryCLI(args) {
  try { console.log(JSON.stringify(await runDelivery(args), null, 2)); return 0; }
  catch (error) { console.error(formatMigrationFailure(error, "DELIVERY_FAILED_DETAILS_WITHHELD")); return 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runDeliveryCLI(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
