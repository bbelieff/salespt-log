/**
 * CohortCreateModal — Admin 전용 "기수/참가자 추가" 모달.
 *
 * 흐름:
 *   - 기수 토큰 입력 ("8" / "a1") → 일반/아레나 자동 판별 + 표시(8기 / A1회).
 *   - 모드: 생성(create, 템플릿 복제) / 연동(link, 기존 시트 URL).
 *   - create: 템플릿 시트 ID / 루트 폴더 ID (+아레나면 전체명단 시트 ID) → 설정 저장.
 *   - 참가자: 줄 단위. create=이름, link=이름,시트URL.
 *   - 실행 → POST /api/admin/create-cohort-members → 생성/건너뜀/실패 리포트.
 *
 * 멱등: 이미 등록된 (기수,이름) 은 서버가 건너뜀(복제 안 함).
 */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCohortToken } from "@/service/cohort-token";

type Mode = "create" | "link";

interface ResultReport {
  created: { name: string; sheetId: string }[];
  skipped: { name: string }[];
  failed: { name: string; reason: string }[];
}

export default function CohortCreateModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<Mode>("create");
  const [templateSheetId, setTemplateSheetId] = useState("");
  const [rootFolderId, setRootFolderId] = useState("");
  const [rosterSheetId, setRosterSheetId] = useState("");
  const [membersText, setMembersText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<ResultReport | null>(null);

  const parsed = useMemo(() => parseCohortToken(token), [token]);
  const isArena = parsed?.type === "arena";

  function reset() {
    setToken("");
    setMode("create");
    setTemplateSheetId("");
    setRootFolderId("");
    setRosterSheetId("");
    setMembersText("");
    setErr(null);
    setReport(null);
  }

  function parseMembers(): { name: string; sheetUrl?: string }[] {
    return membersText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        if (mode === "link") {
          const parts = line.split(/[,\t]/);
          return { name: (parts[0] ?? "").trim(), sheetUrl: (parts[1] ?? "").trim() };
        }
        return { name: line };
      });
  }

  async function run() {
    setErr(null);
    setReport(null);
    if (!parsed) {
      setErr('기수 토큰 형식 오류 — "8" / "8기" / "a1" / "A1회"');
      return;
    }
    const members = parseMembers();
    if (members.length === 0) {
      setErr("참가자를 한 명 이상 입력하세요.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/create-cohort-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          mode,
          members,
          config:
            mode === "create"
              ? { templateSheetId, rootFolderId, rosterSheetId }
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
        className="rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
      >
        ＋ 기수/참가자 추가
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="mt-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-black text-gray-900">기수/참가자 추가</h3>
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
          {/* 기수 토큰 */}
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">
              기수 토큰
            </label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="예: 8  또는  a1"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              {parsed
                ? `→ ${parsed.type === "arena" ? "아레나" : "일반 기수"}: ${parsed.display}`
                : "숫자=일반 기수, a+숫자=아레나"}
            </p>
          </div>

          {/* 모드 토글 */}
          <div className="flex gap-2">
            {(["create", "link"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={
                  "flex-1 rounded-lg border px-3 py-2 text-xs font-bold " +
                  (mode === m
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-500")
                }
              >
                {m === "create" ? "생성 (템플릿 복제)" : "연동 (기존 시트)"}
              </button>
            ))}
          </div>

          {/* create 설정 */}
          {mode === "create" && (
            <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  템플릿 시트 ID
                </label>
                <input
                  value={templateSheetId}
                  onChange={(e) => setTemplateSheetId(e.target.value)}
                  placeholder="복제 원본 경영일지 시트 ID"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  루트 폴더 ID
                </label>
                <input
                  value={rootFolderId}
                  onChange={(e) => setRootFolderId(e.target.value)}
                  placeholder="이름 폴더들이 들어있는 상위 폴더 ID"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              {isArena && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    아레나 전체 명단 시트 ID
                  </label>
                  <input
                    value={rosterSheetId}
                    onChange={(e) => setRosterSheetId(e.target.value)}
                    placeholder="참가자 1행씩 추가될 명단 시트 ID"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* 참가자 */}
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">
              참가자 (한 줄에 한 명)
            </label>
            <textarea
              value={membersText}
              onChange={(e) => setMembersText(e.target.value)}
              rows={5}
              placeholder={
                mode === "create"
                  ? "김믿음\n이영업\n박계약"
                  : "김믿음, https://docs.google.com/spreadsheets/d/...\n이영업, https://..."
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              {mode === "create"
                ? "이름과 같은 폴더가 루트 폴더 안에 있어야 합니다."
                : "형식: 이름, 시트URL"}
            </p>
          </div>

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
              className="flex-1 rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-50"
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
