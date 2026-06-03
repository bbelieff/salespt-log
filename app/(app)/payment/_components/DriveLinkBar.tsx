/**
 * DriveLinkBar — 요약카드 아래 Drive + 플러그 바로가기 (Scope 1).
 *
 * [Drive 바로가기]: 01 피드백업체 폴더 새 탭. 미연결 시 [다시 연결].
 * [플러그 바로가기]: pluuug.com 새 탭 (임시 — Scope 3에서 제거).
 */
"use client";

import { useState, useCallback } from "react";
import { useMe } from "@/query/me-hook";

export default function DriveLinkBar() {
  const me = useMe();
  const feedbackFolderId = me.data?.feedbackFolderId ?? "";
  const driveLinkStatus = me.data?.driveLinkStatus ?? "";
  const [showRelink, setShowRelink] = useState(false);
  const [relinkUrl, setRelinkUrl] = useState("");
  const [relinkPending, setRelinkPending] = useState(false);
  const [relinkError, setRelinkError] = useState("");
  // 폴더 미공유(403/빈 parents) 시 안내용 — 공유 대상 SA 이메일 + 에러 종류.
  const [errorKind, setErrorKind] = useState("");
  const [saEmail, setSaEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const driveUrl = feedbackFolderId
    ? `https://drive.google.com/drive/folders/${feedbackFolderId}`
    : "";

  const runLink = useCallback(
    async (payload: { mode: "auto" } | { parentFolderUrl: string }) => {
      setRelinkPending(true);
      setRelinkError("");
      setErrorKind("");
      setSaEmail("");
      try {
        const res = await fetch("/api/drive-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.ok) {
          setShowRelink(false);
          setRelinkUrl("");
          me.refetch();
        } else {
          setRelinkError(data.error ?? "연결 실패");
          setErrorKind(data.errorKind ?? "");
          setSaEmail(data.saEmail ?? "");
        }
      } catch {
        setRelinkError("네트워크 오류");
      } finally {
        setRelinkPending(false);
      }
    },
    [me],
  );

  const copySaEmail = useCallback(() => {
    if (!saEmail) return;
    navigator.clipboard?.writeText(saEmail).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {
        /* clipboard 차단 환경 — 무시(이메일은 화면에 보임) */
      },
    );
  }, [saEmail]);

  const handleAuto = useCallback(() => runLink({ mode: "auto" }), [runLink]);
  const handleRelink = useCallback(() => {
    if (!relinkUrl.trim()) return;
    runLink({ parentFolderUrl: relinkUrl });
  }, [relinkUrl, runLink]);

  const isLinked = driveLinkStatus === "ok" && feedbackFolderId;

  return (
    <div className="mb-3 space-y-2">
      <div className="flex gap-2">
        {isLinked ? (
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Drive 바로가기
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setShowRelink(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            {driveLinkStatus === "error" ? "다시 연결" : "Drive 연결"}
          </button>
        )}
        <a
          href="https://www.pluuug.com/"
          target="_blank"
          rel="noopener"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          플러그 바로가기
        </a>
      </div>

      {showRelink && (
        <div className="space-y-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
          {/* 개선 A — 자동으로 찾기 (URL 불필요, 우선 권장) */}
          <div>
            <p className="mb-2 text-xs text-amber-800">
              연결된 경영일지 시트가 있는 폴더에서 <b>‘01 피드백업체’</b> 폴더를 자동으로 찾아 연결해요.
            </p>
            <button
              type="button"
              onClick={handleAuto}
              disabled={relinkPending}
              className="w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              {relinkPending ? "찾는 중…" : "✨ 자동으로 찾기"}
            </button>
          </div>

          {/* 개선 B — 수동 입력 (폴더 주소 직접 붙여넣기) */}
          <div className="border-t border-amber-200 pt-2.5">
            <p className="mb-2 text-xs text-amber-700">
              잘 안 되면, <b>‘01 피드백업체’</b> 폴더 주소를 그대로 붙여넣어도 돼요. (상위 폴더 주소도 괜찮아요)
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={relinkUrl}
                onChange={(e) => setRelinkUrl(e.target.value)}
                placeholder="드라이브 폴더 주소 붙여넣기"
                className="flex-1 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleRelink}
                disabled={relinkPending || !relinkUrl.trim()}
                className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
              >
                {relinkPending ? "…" : "연결"}
              </button>
            </div>
          </div>
          {relinkError && errorKind === "folder_not_shared" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              <p className="mb-2 font-semibold">폴더 공유가 필요해요</p>
              <p className="mb-2 leading-relaxed text-red-600">
                시트가 들어있는 <b>폴더</b>를 아래 계정에 <b>뷰어</b>로 공유해 주세요.
                시트 파일만 공유하면 폴더를 못 찾아요.
              </p>
              {saEmail && (
                <div className="mb-2 flex items-center gap-1.5">
                  <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-[11px] text-gray-800">
                    {saEmail}
                  </code>
                  <button
                    type="button"
                    onClick={copySaEmail}
                    className="shrink-0 rounded border border-red-300 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100"
                  >
                    {copied ? "복사됨 ✓" : "복사"}
                  </button>
                </div>
              )}
              <p className="text-[11px] leading-relaxed text-red-500">
                공유 방법: 드라이브에서 폴더 우클릭 → <b>공유</b> → 위 이메일 추가 →
                권한 <b>뷰어</b> → 완료. 그다음 위 <b>[✨ 자동으로 찾기]</b>를 다시 눌러 주세요.
              </p>
            </div>
          ) : (
            relinkError && <p className="text-xs text-red-600">{relinkError}</p>
          )}
        </div>
      )}
    </div>
  );
}
