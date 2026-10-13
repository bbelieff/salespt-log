/** D 이메일 열 배포 전 읽기 전용 검사. 셀/헤더 내용·시트 식별자는 출력하지 않는다. */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function headerVerdict(cell, expectedKey = "이메일") {
  const value = String(cell ?? "").trim();
  return value === "" || value === expectedKey ? "ok" : "blocked";
}

export function inspectColumn(values = []) {
  return {
    headerBlocked: headerVerdict(values[0]?.[0]) === "blocked",
    filledCells: values.slice(1).filter((row) => String(row[0] ?? "").trim() !== "").length,
  };
}

export function censusBlocked(totals, errors, targetCount) {
  return targetCount === 0 || errors > 0 || totals.some((s) => s.filledCells > 0 || s.headerBlocked > 0);
}

function loadEnvFile() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const result = {};
    for (const line of readFileSync(file, "utf8").replace(/\r/g, "").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      result[match[1]] = value;
    }
    return result;
  }
  return {};
}

async function main() {
  const fileEnv = loadEnvFile();
  const env = (key) => process.env[key] || fileEnv[key] || "";
  const email = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const key = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
  const registryId = env("SHEETS_REGISTRY_ID");
  if (!email || !key || !registryId) {
    console.error("자격 누락(.env.local). 값은 출력하지 않습니다.");
    return 1;
  }
  const { google } = await import("googleapis");
  const auth = new google.auth.JWT(email, undefined, key, ["https://www.googleapis.com/auth/spreadsheets.readonly"]);
  const sheets = google.sheets({ version: "v4", auth });
  const columns = [
    { name: "04 CE", range: "'04 업체관리(앱자동작성용)'!CE1:CE" },
    { name: "06 BM", range: "'06 업체정보'!BM1:BM" },
  ];
  const registry = await sheets.spreadsheets.values.get({ spreadsheetId: registryId, range: `'${env("SHEETS_REGISTRY_TAB") || "users"}'!A2:F` });
  const targets = [...new Set((registry.data.values ?? [])
    .filter((row) => String(row[4] ?? "").trim() === "trainee")
    .map((row) => String(row[3] ?? "").trim()).filter(Boolean))];
  console.log(`census 대상 ${targets.length} 시트 · READ-ONLY · 숫자만 출력`);
  const totals = columns.map(() => ({ filledSheets: 0, filledCells: 0, headerBlocked: 0, noColumn: 0 }));
  let errors = 0;
  const httpErrors = {};
  for (const spreadsheetId of targets) {
    for (const [index, column] of columns.entries()) {
      try {
        const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: column.range, valueRenderOption: "FORMULA" });
        const result = inspectColumn(response.data.values);
        totals[index].filledCells += result.filledCells;
        totals[index].filledSheets += Number(result.filledCells > 0);
        totals[index].headerBlocked += Number(result.headerBlocked);
      } catch (error) {
        if (/exceeds grid limits|Unable to parse range/i.test(String(error?.message ?? ""))) totals[index].noColumn++;
        else {
          errors++;
          const status = Number(error?.response?.status ?? error?.code);
          const category = Number.isFinite(status) ? String(status) : "network";
          httpErrors[category] = (httpErrors[category] ?? 0) + 1;
        }
      }
      await new Promise((done) => setTimeout(done, 1100));
    }
  }
  for (const [index, column] of columns.entries()) {
    const result = totals[index];
    console.log(`${column.name}: 값 있는 시트 ${result.filledSheets} · 값 있는 셀 ${result.filledCells} · 헤더 다름 시트 ${result.headerBlocked} · 열/탭 없음 ${result.noColumn}`);
  }
  console.log(`읽기 오류 ${errors} · HTTP 분류 ${JSON.stringify(httpErrors)}`);
  const blocked = censusBlocked(totals, errors, targets.length);
  console.log(blocked ? "판정: 배포 보류" : "판정: CE·BM 검사 통과 (registry 대상 대조 별도 필수)");
  return blocked ? 2 : 0;
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().then((code) => { process.exitCode = code; }).catch(() => {
    console.error("census 초기화/레지스트리 읽기 실패. 자격정보·원문 오류는 출력하지 않습니다.");
    process.exitCode = 1;
  });
}
