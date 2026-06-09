/**
 * ArenaCreateModal — Admin 전용 "아레나 추가" 모달 (ADR-0012).
 *
 * 흐름:
 *   - 시즌 번호(예 1) + 명단(이름 다건, 한 줄 1명).
 *   - (최초 1회) 템플릿 시트 / 시트 생성 폴더 / 업체관리 부모 폴더 ID 설정 → cohorts "A{시즌}" upsert.
 *   - 실행 → POST /api/admin/create-arena-members → 생성/건너뜀/실패 리포트.
 *   - 제목·폴더명 미리보기.
 *
 * 산출물(참가자별): `세일즈PT_A{시즌}_0기 {이름}_대표님 경영일지` 시트 + `…_대표님 업체관리` 폴더.
 * 멱등: 이미 등록된 (A{시즌}, 이름) 은 서버가 건너뜀.
 */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildArenaSheetTitle,
  buildArenaCompanyFolderName,
} from "@/service/cohort-token";
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

  // 명단: 한 줄에 "이름, 기수" (쉼표/탭/공백 구분). 기수 없으면 무효 라인.
  const members = useMemo(
    () =>
      namesText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(/[,\t]|\s+/).filter(Boolean);
          const name = parts[0] ?? "";
          const gisu = Number(parts[1]);
          return { name, gisu };
        })
        .filter((m) => m.name && Number.isInteger(m.gisu) && m.gisu >= 0),
    [namesText],
  );

  const preview = useMemo(() => {
    if (!seasonNum || members.length === 0) return null;
    const s = members[0]!;
    return {
      sheet: buildArenaSheetTitle(seasonNum, s.gisu, s.name),
      folder: buildArenaCompanyFolderName(seasonNum, s.gisu, s.name),
    };
  }, [seasonNum, members]);

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
    if (!seasonNum) {
      setErr("시즌 번호를 양의 정수로 입력하세요 (예: 1).");
      return;
    }
    if (members.length === 0) {
      setErr('참가자를 "이름, 기수" 형식으로 한 명 이상 입력하세요 (예: 김믿음, 1).');
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
          season: seasonNum,
          members,
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

          {/* 명단 */}
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">
              참가자 (한 줄에 &quot;이름, 자기기수&quot;)
            </label>
            <textarea
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              rows={5}
              placeholder={"김믿음, 1\n이영업, 2\n박계약, 1"}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              각 줄에 이름과 본인 기수. 레지스트리 라벨 = A{seasonNum ?? "?"}
              -기수기 (예: A{seasonNum ?? 1}-1기).
            </p>
          </div>

          {/* 미리보기 */}
          {preview && (
            <div className="space-y-1 rounded-xl border border-purple-100 bg-purple-50 p-3 text-xs text-purple-800">
              <div className="font-bold">
                미리보기 ({members[0]!.name} · {members[0]!.gisu}기)
              </div>
              <div>📄 {preview.sheet}</div>
              <div>📁 {preview.folder}</div>
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
