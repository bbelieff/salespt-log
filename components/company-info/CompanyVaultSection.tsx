/**
 * CompanyVaultSection — 업체정보 안 「계정 보관함」(company-vault, belie 2026-10-08).
 *
 * 고객 아이디·비밀번호·계좌·주민번호 전체를 업체별로 잠가 보관한다. PIN 하나로 한 번 열면
 * 모든 업체 보관함이 30분 열리고(쓸 때마다 연장), 편집은 800ms 뒤 자동 저장한다.
 * 저장 도중 잠기면 입력하던 값은 화면에 남겨 두고, 다시 열면 그 값을 저장한다.
 * incoming = 미팅 메모에서 뽑은 항목 — 열려 있으면 바로, 잠겨 있으면 PIN 을 넣은 뒤 같은 값이 없을 때만 더한다.
 * 초안: Muse(muse-spark-1.3-contributor) — 총괄 검수·수정.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VAULT_KINDS, type VaultItem, type VaultKind, type VaultTarget, type VaultView } from "@/types/company-vault";
import { inputCls } from "./CompanyInfoField";

const KIND_LABEL: Record<VaultKind, string> = { login: "계정", bank: "계좌", rrn: "주민번호", other: "기타" };
const LABEL_PH: Record<VaultKind, string> = { login: "홈택스", bank: "농협 주거래", rrn: "대표자", other: "메모" };
const ID_PH: Record<VaultKind, string> = { login: "아이디", bank: "은행·예금주", rrn: "이름", other: "항목" };
const SECRET_PH: Record<VaultKind, string> = { login: "비밀번호", bank: "계좌번호", rrn: "000000-0000000", other: "값" };

const btnCls = "shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50";
const primaryCls = "rounded-md bg-brand-red px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50";
const pinInputCls = `${inputCls} w-28 tabular-nums`;
/** 종류 select — inputCls 의 w-full 을 빼야 w-24 로 좁아진다(둘 다 있으면 w-full 이 이겨 한 줄을 다 썼다). */
const kindCls = inputCls.replace("w-full ", "");

const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 8);
const toQuery = (t: VaultTarget) =>
  t.meetingId
    ? `meetingId=${encodeURIComponent(t.meetingId)}`
    : `계약일=${encodeURIComponent(t.계약일 ?? "")}&업체명=${encodeURIComponent(t.업체명 ?? "")}`;

async function readJson(res: Response): Promise<{ error?: string } & Partial<VaultView>> {
  return res.json().catch(() => ({}));
}

function PinInput({ id, label, value, onChange, auto }: { id: string; label: string; value: string; onChange: (v: string) => void; auto: string }) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input id={id} type="password" inputMode="numeric" maxLength={8} value={value} placeholder={label}
        onChange={(e) => onChange(onlyDigits(e.target.value))} className={pinInputCls} autoComplete={auto} />
    </div>
  );
}

const sameItem = (a: VaultItem, b: VaultItem) =>
  a.kind === b.kind && a.label === b.label && a.id === b.id && a.secret === b.secret;

interface Props {
  target: VaultTarget;
  idBase: string;
  incoming?: VaultItem[];
  onIncomingDone?: () => void;
}

export default function CompanyVaultSection({ target, idBase, incoming = [], onIncomingDone }: Props) {
  const query = toQuery(target);
  const [view, setView] = useState<VaultView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [pinError, setPinError] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [shown, setShown] = useState<Record<number, boolean>>({});
  const [pinEdit, setPinEdit] = useState(false);
  const [curPin, setCurPin] = useState("");
  const [addedNote, setAddedNote] = useState("");
  // 사용자가 고친 뒤 아직 서버에 못 넣은 값 — 잠겼다 다시 열어도 이 값을 저장한다.
  const unsaved = useRef<VaultItem[] | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetRef = useRef(target);
  targetRef.current = target;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/vault?${query}`);
      const data = await readJson(res);
      if (!res.ok) {
        setLoadError(data.error ?? "보관함을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.");
        return;
      }
      const v = data as VaultView;
      setView(v);
      if (v.unlocked) setItems(unsaved.current ?? v.items ?? []);
    } catch {
      setLoadError("보관함을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    unsaved.current = null;
    load();
  }, [load]);

  const save = useCallback(async (next: VaultItem[]) => {
    setSaveState("saving");
    setSaveError("");
    try {
      const res = await fetch("/api/vault", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: targetRef.current, items: next }),
      });
      const data = await readJson(res);
      if (res.status === 401) {
        setView((v) => (v ? { ...v, unlocked: false, items: null } : v));
        setPinError("보관함이 잠겼어요. PIN을 다시 입력하면 입력하던 내용을 저장해요.");
        setSaveState("idle");
        return;
      }
      if (!res.ok) {
        setSaveState("error");
        setSaveError(data.error ?? "저장하지 못했어요. 잠시 뒤 다시 고쳐 주세요.");
        return;
      }
      if (unsaved.current === next) unsaved.current = null;
      if (data.unlockedUntil) setView((v) => (v ? { ...v, unlockedUntil: data.unlockedUntil ?? null } : v));
      setSaveState("saved");
    } catch {
      setSaveState("error");
      setSaveError("저장하지 못했어요. 인터넷 연결을 확인해 주세요.");
    }
  }, []);

  // 다시 열렸을 때 못 넣은 값이 있으면 바로 저장한다.
  useEffect(() => {
    if (view?.unlocked && unsaved.current) save(unsaved.current);
  }, [view?.unlocked, save]);

  const edit = (next: VaultItem[]) => {
    setItems(next);
    unsaved.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(next), 800);
  };
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  useEffect(() => {
    if (!view?.unlocked) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [view?.unlocked]);

  const remain = view?.unlocked && view.unlockedUntil
    ? Math.max(0, Math.round((new Date(view.unlockedUntil).getTime() - now) / 1000))
    : 0;
  useEffect(() => {
    if (view?.unlocked && remain === 0) load();
  }, [view?.unlocked, remain, load]);

  const post = async (url: string, body: object, fail: string) => {
    setBusy(true);
    setPinError("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await readJson(res);
      if (!res.ok) return setPinError(data.error ?? fail);
      setPin1("");
      setPin2("");
      setCurPin("");
      setPinEdit(false);
      await load();
    } catch {
      setPinError(fail);
    } finally {
      setBusy(false);
    }
  };

  const submitNewPin = (e: React.FormEvent, currentPin?: string) => {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(pin1)) return setPinError("PIN은 숫자 4~8자리로 입력해 주세요.");
    if (pin1 !== pin2) return setPinError("두 PIN이 달라요.");
    post("/api/vault/pin", currentPin === undefined ? { pin: pin1 } : { pin: pin1, currentPin }, "PIN을 저장하지 못했어요. 다시 해 주세요.");
  };

  const unlock = (e: React.FormEvent) => {
    e.preventDefault();
    post("/api/vault/unlock", { pin: pin1 }, "열지 못했어요. 잠시 뒤 다시 해 주세요.");
  };

  // 메모에서 온 항목은 열려 있고 불러오기가 끝났을 때 한 번만 더한다.
  const ready0 = !loading && view?.unlocked;
  useEffect(() => {
    if (!ready0 || incoming.length === 0) return;
    const fresh = incoming.filter((n) => !items.some((it) => sameItem(it, n)));
    if (fresh.length > 0) edit([...items, ...fresh]);
    setAddedNote(fresh.length > 0 ? `메모에서 ${fresh.length}건을 넣었어요.` : "메모의 항목은 이미 보관함에 있어요.");
    onIncomingDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열린 직후·새 항목이 왔을 때만
  }, [ready0, incoming]);

  // 지운 항목은 바로 저장(기다리지 않음) + 잠깐 「되돌리기」. 보기/복사 표시는 번호 기준이라 함께 비운다.
  const [removed, setRemoved] = useState<{ item: VaultItem; at: number } | null>(null);
  const remove = (i: number) => {
    const next = items.filter((_, n) => n !== i);
    setRemoved({ item: items[i]!, at: i });
    setShown({});
    setItems(next);
    unsaved.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    save(next);
  };
  const restore = () => {
    if (!removed) return;
    const next = [...items.slice(0, removed.at), removed.item, ...items.slice(removed.at)];
    setRemoved(null);
    edit(next);
  };

  const patch = (i: number, k: keyof VaultItem, v: string) =>
    edit(items.map((it, n) => (n === i ? { ...it, [k]: v } : it)));

  const mm = String(Math.floor(remain / 60)).padStart(2, "0");
  const ss = String(remain % 60).padStart(2, "0");
  const ready = !loading && !loadError && view;

  return (
    <section aria-label="계정 보관함" className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      {/* 제목 한 줄: 「계정 보관함 · 열림 · mm:ss 뒤 잠겨요」 + PIN 바꾸기(belie 2026-10-09 — 잠금 저장 배지·지금 잠그기 뺌). */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 text-sm font-bold text-gray-900">
          계정 보관함
          {ready && view.unlocked && (
            <span className="ml-1.5 text-xs font-semibold text-emerald-700">
              · 열림 · <span className="tabular-nums">{mm}:{ss}</span> 뒤 잠겨요
            </span>
          )}
        </h3>
        {ready && view.unlocked && (
          <button type="button" onClick={() => { setPinEdit((v) => !v); setPinError(""); }} className={btnCls}>PIN 바꾸기</button>
        )}
      </div>

      {loading && !view && <p className="animate-pulse text-xs text-gray-400">보관함 불러오는 중…</p>}
      {loadError && <p role="alert" className="text-xs text-red-600">{loadError}</p>}

      {ready && !view.hasPin && (
        <form onSubmit={(e) => submitNewPin(e)} className="space-y-2">
          <p className="text-xs text-gray-600">고객 계정·계좌·주민번호를 잠가서 보관해요. 먼저 PIN(숫자 4~8자리)을 만들어 주세요.</p>
          <div className="flex flex-wrap items-center gap-2">
            <PinInput id={`${idBase}-pin1`} label="PIN" value={pin1} onChange={setPin1} auto="new-password" />
            <PinInput id={`${idBase}-pin2`} label="PIN 확인" value={pin2} onChange={setPin2} auto="new-password" />
            <button type="submit" disabled={busy} className={primaryCls}>{busy ? "만드는 중…" : "PIN 만들기"}</button>
          </div>
          {pinError && <p role="alert" className="text-xs text-red-600">{pinError}</p>}
        </form>
      )}

      {ready && view.hasPin && !view.unlocked && (
        <form onSubmit={unlock} className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">
            보관 항목 <span className="tabular-nums">{view.count}</span>개 · 잠김
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <PinInput id={`${idBase}-unlock`} label="PIN" value={pin1} onChange={setPin1} auto="current-password" />
            <button type="submit" disabled={busy || pin1.length < 4} className={primaryCls}>{busy ? "여는 중…" : "열기"}</button>
          </div>
          <p className="text-xs text-gray-500">한 번 열면 모든 업체 보관함이 30분 동안 열려요.</p>
          {incoming.length > 0 && (
            <p className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
              메모에서 가져온 {incoming.length}건 — PIN을 넣으면 보관함에 들어가요.
            </p>
          )}
          {pinError && <p role="alert" className="text-xs text-red-600">{pinError}</p>}
        </form>
      )}

      {ready && view.unlocked && (
        <div className="space-y-2">
          {pinEdit && (
            <form onSubmit={(e) => submitNewPin(e, curPin)} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2">
              <PinInput id={`${idBase}-cur`} label="지금 PIN" value={curPin} onChange={setCurPin} auto="current-password" />
              <PinInput id={`${idBase}-next`} label="새 PIN" value={pin1} onChange={setPin1} auto="new-password" />
              <PinInput id={`${idBase}-next2`} label="새 PIN 확인" value={pin2} onChange={setPin2} auto="new-password" />
              <button type="submit" disabled={busy} className={primaryCls}>{busy ? "바꾸는 중…" : "바꾸기"}</button>
              <button type="button" onClick={() => setPinEdit(false)} className={btnCls}>취소</button>
              {pinError && <p role="alert" className="w-full text-xs text-red-600">{pinError}</p>}
            </form>
          )}

          {removed && (
            <p className="flex items-center justify-between gap-2 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700" role="status">
              <span className="min-w-0 truncate">「{removed.item.label || "이름 없는 항목"}」을 지웠어요</span>
              <button type="button" onClick={restore} className="shrink-0 font-semibold underline underline-offset-2">되돌리기</button>
            </p>
          )}
          {addedNote && <p className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">{addedNote}</p>}
          {items.length === 0 && (
            <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">아직 보관한 항목이 없어요. 아래 [+ 항목 추가]로 넣어 주세요.</p>
          )}

          {items.map((it, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border border-gray-200 bg-white p-2">
              {/* 어디 계정인지(이름)가 먼저, 종류는 옆에 좁게 — 한 줄을 종류 칸이 다 쓰지 않게(belie 2026-10-09). */}
              <div className="flex items-center gap-1.5">
                <label htmlFor={`${idBase}-label-${i}`} className="sr-only">항목 {i + 1} 이름</label>
                <input id={`${idBase}-label-${i}`} value={it.label} onChange={(e) => patch(i, "label", e.target.value)}
                  placeholder={LABEL_PH[it.kind]} className={`${inputCls} min-w-0 flex-1 font-semibold`} />
                <label htmlFor={`${idBase}-kind-${i}`} className="sr-only">항목 {i + 1} 종류</label>
                <select id={`${idBase}-kind-${i}`} value={it.kind} onChange={(e) => patch(i, "kind", e.target.value)} className={`${kindCls} w-20 shrink-0 px-1`}>
                  {VAULT_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </select>
                {/* 삭제 — 손가락으로 누를 수 있는 크기(h-8)·테두리로 분명하게(belie 2026-10-09 「삭제가 안 됨」). */}
                <button type="button" onClick={() => remove(i)}
                  aria-label={`항목 ${i + 1} 삭제`} className="h-8 shrink-0 rounded-md border border-gray-300 bg-white px-2 text-xs font-semibold text-gray-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600">삭제</button>
              </div>
              {/* 아이디 | 비밀번호 한 줄 + 보기(복사 없음, belie 2026-10-09). */}
              <div className="flex items-center gap-1.5">
                <label htmlFor={`${idBase}-id-${i}`} className="sr-only">항목 {i + 1} {ID_PH[it.kind]}</label>
                <input id={`${idBase}-id-${i}`} value={it.id} onChange={(e) => patch(i, "id", e.target.value)}
                  placeholder={ID_PH[it.kind]} className={`${inputCls} min-w-0 flex-1`} />
                <label htmlFor={`${idBase}-secret-${i}`} className="sr-only">항목 {i + 1} {SECRET_PH[it.kind]}</label>
                <input id={`${idBase}-secret-${i}`} type={shown[i] ? "text" : "password"} value={it.secret} autoComplete="off"
                  onChange={(e) => patch(i, "secret", e.target.value)} placeholder={SECRET_PH[it.kind]} className={`${inputCls} min-w-0 flex-1 tabular-nums`} />
                <button type="button" onClick={() => setShown((p) => ({ ...p, [i]: !p[i] }))} className={btnCls}>{shown[i] ? "가리기" : "보기"}</button>
              </div>
              {/* 메모 칸은 뺐다 — 예전에 적은 메모가 있는 항목만 그대로 보여 고칠 수 있게(값을 숨기지 않음). */}
              {it.note.trim() && (
                <>
                  <label htmlFor={`${idBase}-note-${i}`} className="sr-only">항목 {i + 1} 메모</label>
                  <input id={`${idBase}-note-${i}`} value={it.note} onChange={(e) => patch(i, "note", e.target.value)} placeholder="메모" className={inputCls} />
                </>
              )}
            </div>
          ))}

          <button type="button" onClick={() => edit([...items, { kind: "login", label: "", id: "", secret: "", note: "" }])}
            className="w-full rounded-lg border border-dashed border-gray-300 bg-white p-2 text-xs font-semibold text-gray-600 hover:border-brand-red hover:text-brand-red">
            + 항목 추가
          </button>

          <p aria-live="polite" className="text-xs text-gray-500">
            {saveState === "saving" && "저장 중…"}
            {saveState === "saved" && "저장됨"}
            {saveState === "error" && <span className="text-red-600">{saveError}</span>}
          </p>
        </div>
      )}
    </section>
  );
}
