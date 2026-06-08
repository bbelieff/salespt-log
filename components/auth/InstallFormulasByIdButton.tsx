/**
 * InstallFormulasByIdButton — 레지스트리 미등록 시트(템플릿·8기 기복사본 등)에
 * 시트 ID/URL 직접 지정으로 수식 설치 (헤더용 작은 버튼 + 인라인 패널).
 *
 * 동작:
 *   1. [📋 ID로 수식 설치] → 인라인 패널 토글
 *   2. 시트 ID/URL 줄단위 입력 → 실행
 *   3. POST /api/admin/install-formulas-by-id → 결과 alert (성공/실패/보존셀)
 *
 * install-formulas-bulk 와 동일 installFormulas + §2.5 보존 가드. 콜·지·기·소 계약
 * N/O fix(#319) 를 템플릿·8기에 전파하는 용도.
 */
"use client";

import { useState } from "react";

interface SuccessItem {
  sheetId: string;
  installed: number;
  preserved: number;
  preservedCells: string[];
}
interface FailedItem {
  sheetId: string;
  error: string;
}

export default function InstallFormulasByIdButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [folder, setFolder] = useState("");
  const [tokens, setTokens] = useState("세일즈PT 8기 경영일지");
  const [finding, setFinding] = useState(false);

  // 폴더에서 시트 자동 발견(read-only) → 찾은 ID 를 textarea 에 채움.
  async function discover() {
    if (!folder.trim()) {
      window.alert("폴더 ID 또는 폴더 URL 을 입력하세요.");
      return;
    }
    setFinding(true);
    try {
      const res = await fetch("/api/admin/discover-folder-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: folder,
          tokens: tokens.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(`에러: ${d.hint ?? d.error ?? `HTTP ${res.status}`}`);
        return;
      }
      const sheets: { sheetId: string; name: string }[] = d.sheets ?? [];
      if (sheets.length === 0) {
        window.alert("일치하는 시트가 없습니다. (토큰/폴더/공유드라이브 멤버십 확인)");
        return;
      }
      setText(sheets.map((s) => s.sheetId).join("\n"));
      window.alert(
        `${sheets.length}개 발견 — 아래 목록 확인 후 [설치]:\n\n` +
          sheets.map((s) => `· ${s.name}`).join("\n"),
      );
    } catch (e) {
      window.alert(`네트워크 오류: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setFinding(false);
    }
  }

  async function run() {
    const sheetIds = text
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sheetIds.length === 0) {
      window.alert("시트 ID 또는 URL 을 한 줄에 하나씩 입력하세요.");
      return;
    }
    if (
      !window.confirm(
        `${sheetIds.length}개 시트에 04 업체관리 + 01 영업관리 자동 수식을 설치합니다.\n\n` +
          "✓ 사용자 raw 입력값은 자동 보존(수식·빈 셀만 덮어씀, §2.5 가드).\n" +
          "전제: masterbot 이 각 시트 writer(공유 드라이브 멤버) 여야 합니다.\n\n계속할까요?",
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/install-formulas-by-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(`에러: ${data.hint ?? data.error ?? `HTTP ${res.status}`}`);
        return;
      }
      const success: SuccessItem[] = data.success ?? [];
      const failed: FailedItem[] = data.failed ?? [];
      const withPreserved = success.filter((s) => s.preserved > 0);
      const summary =
        `처리: ${data.processed ?? 0}개\n✓ 성공: ${success.length}개` +
        (withPreserved.length > 0
          ? `\n⚠️ raw 보존 시트 ${withPreserved.length}개 (수식만 교체)`
          : "") +
        (failed.length > 0
          ? `\n✗ 실패: ${failed.length}개\n` +
            failed
              .map((f) => `  · ${f.sheetId.slice(0, 12)}…: ${f.error.slice(0, 80)}`)
              .join("\n")
          : "");
      window.alert(summary);
      if (failed.length === 0) {
        setText("");
        setOpen(false);
      }
    } catch (e) {
      window.alert(`네트워크 오류: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="시트 ID/URL 직접 지정으로 수식 설치 (템플릿·8기 등 레지스트리 미등록분)"
        className="rounded-full border border-violet-300 bg-white px-3 py-1.5 text-[11px] font-bold text-violet-700 hover:bg-violet-50"
      >
        📋 ID로 수식 설치
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="mt-16 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-gray-900">
            ID로 수식 설치 (미등록 시트)
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full px-2 py-1 text-sm font-bold text-gray-400 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>
        {/* 폴더에서 자동 발견 — 8기 등 미등록 시트 ID 를 직접 안 찾고 enumerate */}
        <div className="mb-3 space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-2.5">
          <p className="text-[11px] font-bold text-gray-600">
            폴더에서 자동 찾기 (선택)
          </p>
          <input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="폴더 ID 또는 URL (예: 8기 폴더 1rIxiC3…)"
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
          />
          <input
            value={tokens}
            onChange={(e) => setTokens(e.target.value)}
            placeholder="제목 토큰 (공백 구분)"
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
          />
          <button
            type="button"
            disabled={finding}
            onClick={discover}
            className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-[11px] font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
          >
            {finding ? "찾는 중…" : "🔍 폴더에서 찾기"}
          </button>
        </div>

        <p className="mb-2 text-xs text-gray-500">
          시트 ID 또는 URL — 한 줄에 하나 (템플릿·8기 기복사본 등).
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={"1nx1EufkFFGaf5dp...\nhttps://docs.google.com/spreadsheets/d/.../edit"}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={run}
            className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? "설치 중…" : "설치"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
