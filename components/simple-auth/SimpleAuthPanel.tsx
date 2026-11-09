"use client";
/**
 * 간편인증 서류 조회 화면 본문(belie 2026-11-08~09, 승인 목업 tests/browser/simple-auth).
 * 2단: ① 보내기·가져오기 | ② 보낸 인증(날짜 → 사람 → 업체). 업체 밑에 받은 서류·DB 연결·업체정보 반영을 펼친다.
 * 진행 중(승인 대기·받는 중)인 요청이 있으면 3초마다 목록을 다시 읽는다.
 */
import { useCallback, useEffect, useState } from "react";
import RequestForm from "./RequestForm";
import RequestList from "./RequestList";
import DocBox, { type LinkTo } from "./DocBox";
import { toView, type AuthRequest } from "./view";
import type { SimpleAuthRequest } from "@/types/simple-auth";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? "처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  return j as T;
}

export default function SimpleAuthPanel() {
  const [items, setItems] = useState<AuthRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const j = await call<{ requests: SimpleAuthRequest[]; ready: boolean }>("/api/simple-auth");
      setItems(j.requests.map(toView)); setReady(j.ready !== false); setLoadError("");
    } catch (e) { setLoadError(e instanceof Error ? e.message : "목록을 불러오지 못했어요."); }
    finally { setLoaded(true); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const active = items.some((r) => r.status === "waiting" || r.status === "scraping");
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = active ? setInterval(() => void refresh(), 3000) : undefined;
    return () => { clearInterval(tick); if (poll) clearInterval(poll); };
  }, [active, refresh]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3500); return () => clearTimeout(t); }, [toast]);

  /** 요청 한 건 동작 — 성공하면 목록을 다시 읽고 안내 문구를 띄운다. */
  async function act(id: string, body: Record<string, unknown>, done?: string): Promise<boolean> {
    setBusy(true);
    try {
      const j = await call<{ message?: string }>(`/api/simple-auth/${id}`, { method: "POST", body: JSON.stringify(body) });
      await refresh();
      setToast(j.message ?? done ?? "");
      return !j.message;
    } catch (e) { setToast(e instanceof Error ? e.message : "처리하지 못했어요."); return false; }
    finally { setBusy(false); }
  }

  async function send(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    try {
      await call("/api/simple-auth", { method: "POST", body: JSON.stringify(body) });
      await refresh();
      setToast(body.mode === "cert" ? "공동인증서로 서류를 가져오고 있어요" : "대표 휴대폰으로 인증을 보냈어요. 고객이 승인하면 「승인 확인」을 눌러 주세요");
      return true;
    } catch (e) { setToast(e instanceof Error ? e.message : "보내지 못했어요."); return false; }
    finally { setBusy(false); }
  }

  const detail = (reqId: string, bizNo: string) => {
    const req = items.find((r) => r.id === reqId && r.status === "done");
    const biz = req?.businesses.find((b) => b.bizNo === bizNo);
    if (!req || !biz) return null;
    return (
      <DocBox key={`${reqId}:${bizNo}`} req={req} biz={biz} busy={busy}
        onLink={(l: LinkTo) => void act(reqId, { action: "link", bizNo, link: l }, l.to === "new" ? "DB에 등록했어요" : l.to === "db" ? "DB에 연결했어요" : "")}
        onApply={(patch) => act(reqId, { action: "apply", bizNo, patch }, `업체정보 ${Object.keys(patch).length}칸을 반영했어요`)} />
    );
  };

  return (
    <>
      <div className="flex flex-col gap-4 pc:flex-row pc:items-start">
        <div className="flex flex-col gap-3 pc:w-96 pc:shrink-0 wide:w-1/3">
          {!ready && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">서류 조회 연결을 준비하고 있어요. 연결되면 바로 보낼 수 있어요.</p>}
          <RequestForm onSend={send} busy={busy || !ready} />
        </div>
        <div className="min-w-0 flex-1">
          {loadError && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>}
          {loaded
            ? <RequestList items={items} now={now} detail={detail}
                onApproved={(id) => void act(id, { action: "confirm" }, "서류를 받는 중이에요")}
                onResend={(id) => void act(id, { action: "resend" }, "인증을 다시 보냈어요")}
                onCancel={(id) => void act(id, { action: "cancel" }, "취소했어요")}
                onDelete={(id) => void act(id, { action: "delete" }, "기록을 삭제했어요")} />
            : <p className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">불러오는 중…</p>}
        </div>
      </div>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4">
        {toast && <p className="max-w-md rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</p>}
      </div>
    </>
  );
}
