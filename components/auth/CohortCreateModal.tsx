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

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCohortToken } from "@/service/cohort-token";
import {
  resolveCourseStartInput,
  type CourseDateStatus,
} from "@/service/cohort-dates";
import { DEFAULT_COHORT_TEMPLATE_ID } from "@/config/cohort-template";

type Mode = "create" | "link";

interface DateOutcome {
  name: string;
  status: CourseDateStatus;
  courseStartISO: string;
  graduationISO: string;
  sheet?: { o1: string; o2: string; b3: string; c3: string };
  reason?: string;
}

interface ResultReport {
  created: { name: string; sheetId: string }[];
  skipped: { name: string }[];
  failed: { name: string; reason: string }[];
  pending: { name: string; reason: string }[];
  dates: DateOutcome[];
}

export default function CohortCreateModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<Mode>("create");
  const [templateSheetId, setTemplateSheetId] = useState(DEFAULT_COHORT_TEMPLATE_ID);
  const [rootFolderId, setRootFolderId] = useState("");
  const [rosterSheetId, setRosterSheetId] = useState("");
  const [courseStartISO, setCourseStartISO] = useState("");
  const [membersText, setMembersText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<ResultReport | null>(null);
  // 날짜 없이 생성하려 할 때 1회 확인 — 첫 [실행]은 경고만 띄우고 멈춘다.
  const [noDateAck, setNoDateAck] = useState(false);
  // 자동화·자동완성이 DOM value 를 직접 세팅해 onChange 가 안 뜬 경우의 폴백 소스.
  const startInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseCohortToken(token), [token]);
  const isArena = parsed?.type === "arena";
  // 날짜가 기록된 시트 / 템플릿 잔재가 남은 시트로 갈라 각각 초록·앰버 블록으로 보여준다.
  const dateWritten = useMemo(
    () => (report?.dates ?? []).filter((d) => d.status === "written"),
    [report],
  );
  const dateMissing = useMemo(
    () => (report?.dates ?? []).filter((d) => d.status !== "written"),
    [report],
  );

  function reset() {
    setToken("");
    setMode("create");
    setTemplateSheetId(DEFAULT_COHORT_TEMPLATE_ID);
    setRootFolderId("");
    setRosterSheetId("");
    setCourseStartISO("");
    setMembersText("");
    setErr(null);
    setReport(null);
    setNoDateAck(false);
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
    // state 가 비어도 input 의 DOM value 로 폴백 — 자동화가 값을 직접 넣어 React onChange 가
    // 발화하지 않은 경우에도 서버에 날짜가 전달된다(사고 2회의 원인).
    const resolvedStart =
      mode === "create"
        ? resolveCourseStartInput(courseStartISO, startInputRef.current?.value ?? "")
        : "";
    // 보이는 값 = 보낸 값. 폴백으로 찾은 날짜는 화면에도 반영한다.
    if (resolvedStart !== courseStartISO) setCourseStartISO(resolvedStart);
    // 날짜 없이 생성 = 새 시트에 템플릿(이전 기수) 날짜가 그대로 남는 경로 → 1회 확인.
    if (mode === "create" && !resolvedStart && !noDateAck) {
      setNoDateAck(true);
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
          // 수강시작일은 생성(create) 모드에서만 — link(기존 시트 연동)엔 날짜 미전송.
          courseStartISO: resolvedStart || undefined,
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
        pending: d.pending ?? [],
        dates: d.dates ?? [],
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
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  수강시작일 <span className="font-normal text-gray-400">(선택)</span>
                </label>
                <input
                  ref={startInputRef}
                  type="date"
                  value={courseStartISO}
                  onChange={(e) => {
                    setCourseStartISO(e.target.value);
                    setNoDateAck(false);
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  넣으면 새 시트 O1(수강시작)·O2(종강=+50일)을 자동 기록해요. 비우면 템플릿(이전 기수) 날짜가 그대로 남아요.
                </p>
              </div>
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

          {/* 날짜 미입력 확인 — 실행을 한 번 멈추고 무슨 일이 벌어지는지 먼저 알린다. */}
          {noDateAck && mode === "create" && !courseStartISO && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-bold">수강시작일이 비어 있어요.</p>
              <p className="mt-1">
                이대로 만들면 새 시트에 <b>템플릿(이전 기수)의 날짜</b>가 그대로 남습니다. 개막
                후 기록이 다른 주차로 계산돼 대시보드가 전부 0으로 보일 수 있어요.
              </p>
              <p className="mt-1">
                그래도 진행하려면 <b>[실행]</b>을 한 번 더 누르세요.
              </p>
            </div>
          )}

          {report && (
            <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3 text-xs">
              <div className="font-bold text-gray-900">
                결과 — 생성 {report.created.length} · 건너뜀{" "}
                {report.skipped.length} · 대기 {report.pending.length} · 실패{" "}
                {report.failed.length}
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
              {report.pending.length > 0 && (
                <ul className="space-y-0.5 text-amber-700">
                  {report.pending.map((p, i) => (
                    <li key={i}>
                      ⏳ {p.name}: 복제 실패 — 대기열 등록됨(재시도로 완주). {p.reason}
                    </li>
                  ))}
                </ul>
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

              {/* 수강시작일 결과 — 기록됐는지, 안 됐으면 시트에 실제로 뭐가 남았는지. */}
              {dateWritten.length > 0 && (
                <div className="text-green-700">
                  📅 수강시작일 기록: {dateWritten[0]!.courseStartISO} → 종강{" "}
                  {dateWritten[0]!.graduationISO} ({dateWritten.length}명)
                </div>
              )}
              {dateMissing.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-amber-800">
                  <p className="font-bold">
                    ⚠️ 수강시작일이 기록되지 않았어요 ({dateMissing.length}명) — 새 시트에
                    템플릿 날짜가 그대로 있습니다.
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {dateMissing.map((d, i) => (
                      <li key={i}>
                        {d.name} — 시트값 수강시작(O1) <b>{d.sheet?.o1 || "빈칸"}</b> · 종강(O2){" "}
                        <b>{d.sheet?.o2 || "빈칸"}</b> · 기수(B3) <b>{d.sheet?.b3 || "빈칸"}</b>
                        {d.reason ? ` · ${d.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1">
                    수강시작일을 넣고 다시 실행해도 이미 만들어진 시트는 바뀌지 않아요 — 시트에서
                    직접 고치거나 운영 스크립트로 마감하세요.
                  </p>
                </div>
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
