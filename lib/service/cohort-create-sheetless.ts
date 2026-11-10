/**
 * Layer: service — ADR-0038 4단계: 기수 생성 「시트 없이」(DB 명단 사전등록 행만).
 *
 * 기존 생성(create-cohort-members create 모드)은 템플릿 시트를 복제하고 시트 B3·O1/O2 를 찍은 뒤 명단 시트에
 * 사전등록 행을 쓴다. 시트 없는 생성은 그 대신 **DB 명단에 사전등록 행 1줄**(이메일 빈칸, `local:` 번호,
 * 기수·이름·수강 날짜)만 만든다. 본인이 로그인해 (기수, 이름)으로 클레임하면 users-sheetless.ts 가 그 행에
 * 이메일을 채운다.
 *
 * 안전:
 *  · DB 정본 기수만(isDbReadPilot) — 시트 정본 기수에 시트 없는 수강생을 넣으면 화면이 시트를 읽으려다 깨진다.
 *  · 숫자 기수만(아레나는 회사 폴더·명단 시트가 얽혀 별도 단계).
 *  · 수강 시작일 필수 — 시트 O1/O2 가 없으니 날짜의 유일한 출처다.
 *  · 같은 (기수, 이름)이 명단에 이미 있으면(시트 사전등록 행 포함) 건너뛴다. 시트 행과 같은 자연키로 DB 행을
 *    덮으면 시트→DB 백필이 번호를 지워 기록이 떨어져 나간다.
 */
import { randomUUID } from "node:crypto";
import { cachedRegistryRows, invalidateRegistry } from "@/repo/users";
import { upsertUserRow } from "@/repo/db/registry";
import { registryDbReadEnabled } from "@/repo/db/registry-read";
import { nameMatches } from "@/repo/name-match";
import { newSheetlessTenantKey } from "@/util/tenant-key";
import { isDbReadPilot } from "./daily-source";

export type SheetlessCreateResult = {
  created: { name: string; sheetId: string }[];
  skipped: { name: string }[];
  failed: { name: string; reason: string }[];
};

/** 시트 없는 생성을 쓸 수 있는 기수인지 — 안 되면 이유(화면 표시용), 되면 null. */
export function sheetlessCreateBlocker(p: { label: string; type: string; courseStartISO: string; graduationISO: string }): string | null {
  if (!registryDbReadEnabled()) return "명단을 DB 에서 읽는 설정이 꺼져 있어 시트 없이 만들 수 없어요.";
  if (p.type !== "cohort") return "아레나는 아직 시트 없이 만들 수 없어요. 시트 방식으로 만들어 주세요.";
  if (!isDbReadPilot(p.label)) return `${p.label}기는 아직 시트 정본 기수라 시트 없이 만들 수 없어요.`;
  if (!p.courseStartISO || !p.graduationISO) return "시트 없이 만들 때는 수강 시작일이 꼭 필요해요.";
  return null;
}

export async function createSheetlessMembers(
  p: { label: string; courseStartISO: string; graduationISO: string },
  names: string[],
): Promise<SheetlessCreateResult> {
  const out: SheetlessCreateResult = { created: [], skipped: [], failed: [] };
  const rows = await cachedRegistryRows({ fresh: true });
  const inRoster = (name: string) =>
    rows.some((r) => String(r[1] ?? "").replace(/기\s*$/, "").trim() === p.label && nameMatches(String(r[2] ?? ""), name));
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name) { out.failed.push({ name: raw, reason: "이름이 비어 있어요." }); continue; }
    if (seen.has(name) || inRoster(name)) { out.skipped.push({ name }); continue; }
    seen.add(name);
    const sheetId = newSheetlessTenantKey(randomUUID());
    try {
      await upsertUserRow({
        email: "", cohort: p.label, name, spreadsheetId: sheetId, role: "trainee", status: "active",
        assignedTrainer: "", team: "", cohortLabel: p.label, nameLabel: name,
        courseStartISO: p.courseStartISO, graduationISO: p.graduationISO, sortOrder: 0,
        driveParentPath: "", feedbackFolderId: "", driveLinkStatus: "", memo: "",
        captainOf: "", gcalToken: "", gcalSettings: "",
      });
      out.created.push({ name, sheetId });
    } catch (e) {
      out.failed.push({ name, reason: e instanceof Error ? e.message : "DB 저장 실패" });
    }
  }
  if (out.created.length > 0) invalidateRegistry();
  return out;
}
