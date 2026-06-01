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

  const driveUrl = feedbackFolderId
    ? `https://drive.google.com/drive/folders/${feedbackFolderId}`
    : "";

  const handleRelink = useCallback(async () => {
    if (!relinkUrl.trim()) return;
    setRelinkPending(true);
    setRelinkError("");
    try {
      const res = await fetch("/api/drive-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentFolderUrl: relinkUrl }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowRelink(false);
        setRelinkUrl("");
        me.refetch();
      } else {
        setRelinkError(data.error ?? "연결 실패");
      }
    } catch {
      setRelinkError("네트워크 오류");
    } finally {
      setRelinkPending(false);
    }
  }, [relinkUrl, me]);

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
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-xs text-amber-800">
            Drive 부모 폴더 URL을 입력하면 &apos;01 피드백업체&apos; 폴더를 자동으로 찾습니다.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={relinkUrl}
              onChange={(e) => setRelinkUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="flex-1 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleRelink}
              disabled={relinkPending || !relinkUrl.trim()}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              {relinkPending ? "…" : "연결"}
            </button>
          </div>
          {relinkError && (
            <p className="mt-1.5 text-xs text-red-600">{relinkError}</p>
          )}
        </div>
      )}
    </div>
  );
}
