/**
 * ArenaCreateModal — Admin 전용 "아레나 추가" 모달 (ADR-0012).
 *
 * 흐름:
 *   - 시즌 번호(예 1) + 명단 원문(기수헤더+이름, `*`=회장 `$`=입금 `()`=부부).
 *   - parseArenaRoster 로 클라 미리보기 표(기수/표시이름/회장/입금) → 확인 → 실행.
 *   - (최초 1회) 템플릿 / 시트폴더 / 업체부모폴더 ID → cohorts "A{시즌}" upsert.
 *   - 실행 → POST /api/admin/create-arena-members(rawText) → 생성/건너뜀/실패 리포트.
 *
 * 산출물(참가자별): `세일즈PT_A{시즌}_{기수}기 {표시이름}_대표님 경영일지` 시트 + `…_대표님 업체관리` 폴더.
 * 멱등: 이미 등록된 (A{시즌}-{기수}기, 표시이름) 은 서버가 건너뜀.
 */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildArenaSheetTitle,
  buildArenaCompanyFolderName,
} from "@/service/cohort-token";
import { parseArenaRoster } from "@/service/arena-parse";
import { DEFAULT_COHORT_TEMPLATE_ID } from "@/config/cohort-template";

interface ResultReport {
  created: { name: string; sheetId: string }[];
  skipped: { name: string }[];
  failed: { name: string; reason: string }[];
}

export default function ArenaCreateModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [season, setSeason] = useState("");
  const [templateSheetId, setTemplateSheetId] = useState(DEFAULT_COHORT_TEMPLATE_ID);
  const [sheetsFolderId, setSheetsFolderId] = useState("");
  const [companyParentFolderId, setCompanyParentFolderId] = useState("");
  const [namesText, setNamesText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<ResultReport | null>(null);

  const seasonNum = useMemo(() => {
    const n = Number(season);
    return Number.isInteger(n) && n > 0 ? n : null;
  }, [season]);

  // 명단 원문 파싱 (기수헤더·콤마/줄 분리·회장*·입금$·부부괄호).
  const parsed = useMemo(
    () => parseArenaRoster(namesText, seasonNum ?? 0),
    [namesText, seasonNum],
  );
  const members = parsed.participants;
  const effSeason = parsed.season || seasonNum || 0;
  const presidentCount = members.filter((m) => m.isPresident).length;
  const depositCount = members.filter((m) => m.isDeposit).length;

  const preview = useMemo(() => {
    if (!effSeason || members.length === 0) return null;
    const s = members[0]!;
    return {
      sheet: buildArenaSheetTitle(effSeason, s.gisu, s.displayName),
      folder: buildArenaCompanyFolderName(effSeason, s.gisu, s.displayName),
    };
  }, [effSeason, members]);

  function reset() {
    setSeason("");
    setTemplateSheetId(DEFAULT_COHORT_TEMPLATE_ID);
    setSheetsFolderId("");
    setCompanyParentFolderId("");
    setNamesText("");
    setErr(null);
    setReport(null);
  }

  async function run() {
    setErr(null);
    setReport(null);
    if (!effSeason) {
      setErr("시즌을 알 수 없습니다 — 시즌 번호를 입력하거나 원문 상단에 'A1' 을 넣으세요.");
      return;
    }
    if (members.length === 0) {
      setErr("참가자가 없습니다. 'N기' 헤더 + 이름(콤마/줄바꿈) 형식인지 확인하세요.");
      return;
    }
    setBusy(true);
    try {
      const hasConfig =
        templateSheetId || sheetsFolderId || companyParentFolderId;
      const res = await fetch("/api/admin/create-arena-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season: effSeason,
          rawText: namesText,
          config: hasConfig
            ? { templateSheetId, sheetsFolderId, companyParentFolderId }
            : undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d.hint ?? d.error ?? `HTTP ${res.status}`);
        return;
      }
      setReport({
        created: d.created ?? [],
        skipped: d.skipped ?? [],
        failed: d.failed ?? [],
      });
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100"
      >
        ＋ 아레나 추가
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="mt-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-black text-gray-900">아레나 추가</h3>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              reset();
            }}
            className="rounded-full px-2 py-1 text-sm font-bold text-gray-400 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* 시즌 */}
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">
              시즌 번호
            </label>
            <input
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              inputMode="numeric"
              placeholder="예: 1"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              {seasonNum ? `→ 아레나 A${seasonNum}` : "A(고정) + 시즌 번호"}
            </p>
          </div>

          {/* 설정 (최초 1회) */}
          <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-bold text-gray-600">
              대상 위치 설정 (최초 1회 — 이후 생략 가능)
            </p>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                템플릿 시트 ID
              </label>
              <input
                value={templateSheetId}
                onChange={(e) => setTemplateSheetId(e.target.value)}
                placeholder="경영일지 양식 시트 ID"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                시트 생성 폴더 ID
              </label>
              <input
                value={sheetsFolderId}
                onChange={(e) => setSheetsFolderId(e.target.value)}
                placeholder="참가자 구글시트 폴더 ID"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                업체관리 부모 폴더 ID
              </label>
              <input
                value={companyParentFolderId}
                onChange={(e) => setCompanyParentFolderId(e.target.value)}
                placeholder="ARENA S01 폴더 ID"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* 명단 원문 */}
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">
              명단 원문 (기수 헤더 + 이름 · `*`=회장 · `$`=입금 · `()`=부부)
            </label>
            <textarea
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              rows={8}
              placeholder={"1기\n*김지훈, 김소라\n2기\n류서하(심나영), 김태현$"}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              레지스트리 라벨 = A{effSeason || "?"}-기수기. 부부는 둘 중 한 이름만
              입력해도 클레임 인식.
            </p>
          </div>

          {/* 파싱 미리보기 표 */}
          {members.length > 0 && (
            <div className="rounded-xl border border-purple-100 bg-purple-50 p-3 text-xs text-purple-900">
              <div className="mb-2 font-bold">
                미리보기 — A{effSeason} · {members.length}명 · 회장 {presidentCount}{" "}
                · 입금 {depositCount}
              </div>
              {preview && (
                <div className="mb-2 space-y-0.5 text-[11px] text-purple-700">
                  <div>📄 {preview.sheet}</div>
                  <div>📁 {preview.folder}</div>
                </div>
              )}
              <div className="max-h-44 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="text-purple-500">
                    <tr>
                      <th className="pr-2">기수</th>
                      <th className="pr-2">표시이름</th>
                      <th className="pr-2">회장</th>
                      <th>입금</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m, i) => (
                      <tr key={i} className="border-t border-purple-100">
                        <td className="pr-2 py-0.5">A{effSeason}-{m.gisu}기</td>
                        <td className="pr-2">{m.displayName}</td>
                        <td className="pr-2">{m.isPresident ? "회장" : ""}</td>
                        <td>{m.isDeposit ? "입금" : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.errors.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[11px] text-amber-700">
                  {parsed.errors.map((e, i) => (
                    <li key={i}>⚠ {e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {err}
            </div>
          )}

          {report && (
            <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3 text-xs">
              <div className="font-bold text-gray-900">
                결과 — 생성 {report.created.length} · 건너뜀{" "}
                {report.skipped.length} · 실패 {report.failed.length}
              </div>
              {report.created.length > 0 && (
                <div className="text-green-700">
                  ✅ 생성: {report.created.map((c) => c.name).join(", ")}
                </div>
              )}
              {report.skipped.length > 0 && (
                <div className="text-gray-500">
                  ⏭ 건너뜀(이미 등록): {report.skipped.map((s) => s.name).join(", ")}
                </div>
              )}
              {report.failed.length > 0 && (
                <ul className="space-y-0.5 text-red-700">
                  {report.failed.map((f, i) => (
                    <li key={i}>
                      ❌ {f.name}: {f.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={run}
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {busy ? "처리 중…" : "실행"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
