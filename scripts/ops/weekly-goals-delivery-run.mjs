#!/usr/bin/env node
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { verifyArtifact } from "./weekly-goals-delivery.mjs";
import { main } from "./weekly-goals-migrate.mjs";
import { MigrationGateError } from "./weekly-goals-migrate-catalog.mjs";

export async function runDelivery(args) {
  const [mode, sha, manifestChecksum, sqlChecksum, ...extra] = args;
  if (!["verify", "preflight", "execute"].includes(mode) || extra.length) throw new Error("DELIVERY_ARGUMENTS_INVALID");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const verified = await verifyArtifact(root, sha, manifestChecksum, sqlChecksum);
  if (mode === "verify") return { mode: "ARTIFACT_VERIFIED", sha, manifestChecksum, sqlChecksum };
  if (process.cwd() !== "/opt/salespt-log") throw new Error("DELIVERY_APP_CWD_MISMATCH");
  const report = await main([mode === "execute" ? "--execute" : "--preflight"], { files: verified.files, appRoot: "/opt/salespt-log" });
  const result = { sha, manifestChecksum, sqlChecksum, ...report };
  // Outside the payload; artifact verifier continues rejecting any extra payload files.
  await writeFile(resolve(root, `../${mode}-result.json`), JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runDelivery(process.argv.slice(2)).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(error instanceof MigrationGateError ? error.message : "DELIVERY_FAILED_DETAILS_WITHHELD");
    process.exitCode = 1;
  });
}
