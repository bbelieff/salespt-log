"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { TrainerAccessValue, TrainerAccountKey } from "@/types/trainer-access";
import type { TrainerAccessPerson, TrainerGrade, TrainerStudentCategory } from "@/types/trainer-access";
import { defaultTrainerGrants, isTrainerGrants } from "@/util/trainer-access-policy";

const grades = { senior: "수석", regular: "일반", apprentice: "견습" };
const categories = { active: "활성", arena: "아레나", archived: "보관" };
const notes = { active: "현재 활성 수강생", arena: "아레나에 속한 수강생", archived: "보관된 수강생·기수" };
const categoryKeys = Object.keys(categories) as TrainerStudentCategory[];
function range(person: TrainerAccessPerson) {
  const allowed = categoryKeys.filter(key => person.grants[key].read).map(key => categories[key]);
  return allowed.length === 3 ? "전체 수강생" : allowed.join(" · ") || "조회 권한 없음";
}
function validPeople(value: unknown): value is TrainerAccessPerson[] {
  if (!Array.isArray(value)) return false;
  const keys = new Set<string>();
  return value.every(p => {
    if (!p || !TrainerAccountKey.safeParse(p.email).success || keys.has(p.email)
      || typeof p.name !== "string" || !p.name.trim() || p.status !== "active"
      || !Number.isInteger(p.version) || !isTrainerGrants(p.grants)) return false;
    keys.add(p.email);
    return p.grade === null ? p.version === 0 && JSON.stringify(p.grants) === JSON.stringify(defaultTrainerGrants(null))
      : p.version > 0 && TrainerAccessValue.safeParse({ grade: p.grade, grants: p.grants }).success;
  });
}
/** Approved v4 editor, deliberately not mounted in the shared admin page yet.
 * readOnly is presentation only; GET and PUT independently require server admin auth.
 */
export default function TrainerAccessEditor({ endpoint = "/api/admin/trainer-access", readOnly = false }: {
  endpoint?: string; readOnly?: boolean;
}) {
  const id = useId();
  const [people, setPeople] = useState<TrainerAccessPerson[]>([]);
  const [draft, setDraft] = useState<TrainerAccessPerson | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [denied, setDenied] = useState(false);
  const [refreshOnly, setRefreshOnly] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const savedTarget = useRef<{ email: string; version: number } | null>(null);
  const saved = people.find(p => p.email === draft?.email);
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
  const locked = busy || readOnly || denied || refreshOnly;
  const gradeChanged = draft?.grade !== saved?.grade;

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { cache: "no-store", credentials: "same-origin", signal });
    if (response.status === 401 || response.status === 403) throw new Error("denied");
    if (!response.ok) throw new Error("unavailable");
    const body = await response.json();
    if (!validPeople(body.trainers)) throw new Error("unavailable");
    return body.trainers as TrainerAccessPerson[];
  }, [endpoint]);
  useEffect(() => {
    const controller = new AbortController(); const current = ++generation.current;
    setPeople([]); setDraft(null); setBusy(true); setError(""); setNotice(""); setDenied(false); setRefreshOnly(false);
    savedTarget.current = null; inFlight.current = false;
    load(controller.signal).then(rows => {
      if (generation.current !== current) return;
      setPeople(rows); setDraft(rows[0] ? structuredClone(rows[0]) : null);
    }).catch(err => {
      if (controller.signal.aborted || generation.current !== current) return;
      setDenied(err.message === "denied"); setError(err.message === "denied" ? "관리자만 권한 설정을 볼 수 있습니다." : "권한을 불러오지 못했습니다. 다시 시도해 주세요.");
    }).finally(() => { if (generation.current === current) setBusy(false); });
    return () => { controller.abort(); generation.current++; };
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  function closeDialog() { dialog.current?.close(); saveButton.current?.focus(); }
  async function refresh() {
    if (inFlight.current) return;
    inFlight.current = true; const current = generation.current; setBusy(true); setError("");
    try {
      const rows = await load();
      if (generation.current !== current) return;
      const target = savedTarget.current;
      if (target && !rows.some(p => p.email === target.email && p.version >= target.version)) throw new Error("unavailable");
      const next = rows.find(p => p.email === draft?.email) ?? rows[0] ?? null;
      setPeople(rows); setDraft(next ? structuredClone(next) : null); setRefreshOnly(false); setDenied(false);
      setNotice(target ? "저장한 권한을 다시 확인했습니다." : "최신 권한을 불러왔습니다."); savedTarget.current = null;
    } catch (err) {
      if (generation.current !== current) return;
      if (err instanceof Error && err.message === "denied") setDenied(true);
      setError("권한을 다시 확인하지 못했습니다. 변경사항은 유지됩니다.");
    } finally { if (generation.current === current) { setBusy(false); inFlight.current = false; } }
  }
  async function save() {
    if (!draft?.grade || locked || inFlight.current) return;
    inFlight.current = true; const current = generation.current; setBusy(true); setError(""); setNotice(""); closeDialog();
    try {
      const response = await fetch(endpoint, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: draft.email, grade: draft.grade, grants: draft.grants, version: draft.version }) });
      if (generation.current !== current) return;
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) setDenied(true);
        throw new Error(response.status === 409 ? "다른 변경사항이 먼저 저장되었습니다. 초안을 확인한 뒤 최신 권한을 불러와 주세요."
          : "저장하지 못했습니다. 변경사항은 유지됩니다.");
      }
      savedTarget.current = { email: draft.email, version: draft.version + 1 }; setRefreshOnly(true);
      const rows = await load();
      if (generation.current !== current) return;
      const next = rows.find(p => p.email === draft.email);
      if (!next || next.version < savedTarget.current.version) throw new Error("재조회 실패");
      setPeople(rows); setDraft(structuredClone(next)); setRefreshOnly(false); savedTarget.current = null;
      setNotice("저장하고 최신 권한을 다시 확인했습니다.");
    } catch (err) {
      if (generation.current !== current) return;
      if (err instanceof Error && err.message === "denied") setDenied(true);
      setError(savedTarget.current ? "저장 요청은 처리됐지만 재조회하지 못했습니다. 변경사항을 유지하며 재조회를 기다립니다."
        : err instanceof Error ? err.message : "저장하지 못했습니다. 변경사항은 유지됩니다.");
    } finally { if (generation.current === current) { inFlight.current = false; setBusy(false); } }
  }
  return <div className="trainer-access" aria-busy={busy}>
    <style>{editorStyles}</style>
    <div className="permission-head"><div><h1>트레이너 관리</h1><p>등급과 수강생별 조회·수정 범위를 관리합니다.</p></div><span className="permission-admin-badge">{readOnly ? "조회 전용" : "관리자 전용"}</span></div>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {busy && <p role="status">{draft ? "권한을 처리하고 있습니다." : "권한을 불러오고 있습니다."}</p>}
    {!busy && !people.length && !error && <p>활성 트레이너가 없습니다.</p>}
    {(error || refreshOnly) && <button disabled={busy} onClick={() => {
      if (!refreshOnly && dirty && !window.confirm("변경사항을 버리고 최신 권한을 불러올까요?")) return;
      void refresh();
    }}>{refreshOnly ? "저장 결과 다시 조회" : "최신 권한 불러오기"}</button>}
    <div className="permission-layout"><section className="permission-list" aria-label="트레이너 선택"><h2>트레이너 {people.length}명</h2>
      {people.map(person => <button key={person.email} className="trainer-pick" aria-pressed={person.email === draft?.email} disabled={busy || refreshOnly} onClick={() => {
        if (dirty && !window.confirm("저장하지 않은 변경사항을 버리고 다른 트레이너를 선택할까요?")) return;
        setDraft(structuredClone(person)); setError(""); setNotice("");
      }}><span><strong>{person.name}</strong><small className="account-email">{person.email}</small><small>{range(person)}</small></span><span className="grade-tag">{person.grade ? grades[person.grade] : "미분류"}</span></button>)}
    </section>{draft && <section className="permission-editor" aria-label="등급·권한 편집">
      <div className="permission-eyebrow">등급·권한 편집</div><h2>{draft.name}</h2><small className="account-email">{draft.email}</small>
      <div className="permission-section"><label className="grade-label" htmlFor={`${id}-grade`}>트레이너 등급</label>
        <select id={`${id}-grade`} value={draft.grade ?? ""} disabled={locked} onChange={event => {
          const grade = event.target.value as TrainerGrade; setDraft({ ...draft, grade, grants: defaultTrainerGrants(grade) });
        }}><option value="" disabled>미분류 · 권한 없음</option>{Object.entries(grades).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <p className="permission-note">등급 변경 시 아래 권한을 해당 등급의 기본값으로 맞춥니다.<br />저장하기 전에는 실제 권한이 바뀌지 않습니다.</p>
      </div>
      <div className="permission-section"><div className="permission-section-title"><h3>수강생 접근 권한</h3><button disabled={locked || !draft.grade} onClick={() => setDraft({ ...draft, grants: defaultTrainerGrants(draft.grade) })}>등급 기본값으로</button></div>
        <table className="permission-table"><thead><tr><th scope="col">수강생 구분</th><th scope="col">조회</th><th scope="col">수정</th></tr></thead><tbody>{categoryKeys.map(key => <tr key={key}>
          <th scope="row"><strong>{categories[key]}</strong><small>{notes[key]}</small></th>{(["read", "write"] as const).map(action => <td key={action}><label><input type="checkbox" aria-label={`${categories[key]} ${action === "read" ? "조회" : "수정"}`} checked={draft.grants[key][action]}
            disabled={locked || gradeChanged || !defaultTrainerGrants(draft.grade)[key][action]} onChange={event => {
              const grant = { ...draft.grants[key], [action]: event.target.checked };
              if (action === "read" && !grant.read) grant.write = false;
              if (action === "write" && grant.write) grant.read = true;
              setDraft({ ...draft, grants: { ...draft.grants, [key]: grant } });
            }} /></label></td>)}</tr>)}</tbody></table>
        <p className="permission-note">수정하려면 조회 권한이 필요합니다. 조회 해제 시 수정도 해제됩니다.<br />일반·견습은 활성 수강생만 설정할 수 있습니다. 아레나·보관은 수석 등급에서 설정합니다.</p>
        {gradeChanged && <p className="permission-note">등급을 먼저 저장한 뒤 개별 권한을 조정할 수 있습니다.</p>}
      </div>
      <div className="permission-scope">{JSON.stringify(draft.grants) === JSON.stringify(defaultTrainerGrants(draft.grade)) ? "등급 기본 권한" : "개별 조정 권한"} · {range(draft)}<br />담당 여부와 관계없이 허용된 범위에 적용됩니다.</div>
      <div className="permission-savebar"><span>{dirty ? "저장하지 않은 변경사항이 있습니다." : "저장된 권한과 같습니다."}</span><div>
        <button disabled={locked || !dirty} onClick={() => { setDraft(saved ? structuredClone(saved) : null); setError(""); }}>변경 취소</button>
        <button ref={saveButton} className="primary" disabled={locked || !dirty || !draft.grade} onClick={() => dialog.current?.showModal()}>변경사항 저장</button>
      </div></div>
    </section>}</div>
    <dialog ref={dialog} aria-labelledby={`${id}-confirm`} onCancel={() => saveButton.current?.focus()}><h2 id={`${id}-confirm`}>{draft?.name}님의 권한을 변경할까요?</h2>
      <p className="permission-note">저장하면 변경된 범위로 조회·수정 권한이 적용됩니다.</p>
      {draft && <div className="permission-summary">{draft.email}<br />등급: {saved?.grade ? grades[saved.grade] : "미분류"} → {draft.grade ? grades[draft.grade] : "미분류"}<br /><br />{categoryKeys.map(key => <div key={key}>{categories[key]}: {draft.grants[key].write ? "조회·수정" : draft.grants[key].read ? "조회만" : "접근 불가"}</div>)}</div>}
      <div className="dialog-actions"><button onClick={closeDialog}>돌아가기</button><button className="primary" disabled={locked} onClick={() => void save()}>저장</button></div>
    </dialog>
  </div>;
}

// Approved trainer-unified-v4.html styles, scoped to this independent component.
const editorStyles = `
.trainer-access{--red:#d71617;--ink:#1f2937;--muted:#64748b;--line:#e5e7eb;color:var(--ink);font-size:15px;line-height:1.65}.trainer-access *{box-sizing:border-box}.trainer-access button,.trainer-access select{font:inherit;color:inherit}.trainer-access button{cursor:pointer;min-height:44px;padding:8px 14px;border:1px solid var(--line);border-radius:8px;background:#fff}.trainer-access button:hover{background:#f3f4f6}.trainer-access button:disabled{cursor:not-allowed;opacity:.5}.trainer-access :is(button,select,input):focus-visible{outline:3px solid #d7161780;outline-offset:3px}.trainer-access .primary{background:var(--red);color:#fff;border-color:var(--red);font-weight:750}.trainer-access .primary:hover{background:#b91213}.trainer-access .account-email{display:block;overflow-wrap:anywhere;color:var(--muted);font-size:11px}.trainer-access .trainer-pick>span:first-child{min-width:0}
.trainer-access .permission-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin:20px 0}.trainer-access .permission-head h1{margin:0;font-size:25px}.trainer-access .permission-head p{margin:5px 0;color:var(--muted);font-size:13px}.trainer-access .permission-layout{display:grid;grid-template-columns:320px minmax(0,1fr);gap:20px}.trainer-access .permission-list,.trainer-access .permission-editor{border:1px solid var(--line);border-radius:12px;background:#fff;min-width:0}.trainer-access .permission-list{overflow:hidden;align-self:start}.trainer-access .permission-list h2{font-size:14px;margin:0;padding:15px 16px;border-bottom:1px solid var(--line)}.trainer-access .trainer-pick{display:flex;align-items:center;gap:12px;text-align:left;width:100%;border:0;border-radius:0;border-bottom:1px solid #f1f3f5;padding:14px 16px;min-height:72px}.trainer-access .trainer-pick:last-child{border-bottom:0}.trainer-access .trainer-pick[aria-pressed=true]{background:#fff4f4;box-shadow:inset 0 0 0 1px #e9a5a6}.trainer-access .trainer-pick strong{display:block;font-size:14px}.trainer-access .trainer-pick small{font-size:12px;color:var(--muted)}.trainer-access .grade-tag{margin-left:auto;white-space:nowrap;font-size:12px;border:1px solid var(--line);padding:2px 8px;border-radius:5px;background:#fff}.trainer-access .permission-editor{padding:24px}.trainer-access .permission-editor h2{margin:0;font-size:20px}.trainer-access .permission-eyebrow{font-size:12px;color:var(--muted);margin-bottom:4px}.trainer-access .permission-section{margin-top:22px}.trainer-access .grade-label{display:block;font-weight:700;margin-bottom:7px}.trainer-access .permission-section select{width:100%;max-width:280px;min-height:44px;border:1px solid #cbd5e1;border-radius:8px;background:white;padding:8px 12px}.trainer-access .permission-note{font-size:12px;color:var(--muted);margin:8px 0 0}.trainer-access .permission-table{width:100%;border-collapse:collapse;margin-top:12px}.trainer-access .permission-table thead th{font-size:12px;color:var(--muted);font-weight:500;text-align:center;background:#f8fafc}.trainer-access .permission-table th:first-child{text-align:left;padding-left:12px}.trainer-access .permission-table th,.trainer-access .permission-table td{padding:12px 8px;border-bottom:1px solid var(--line)}.trainer-access .permission-table td,.trainer-access .permission-table tbody th{text-align:center;font-size:14px;font-weight:400}.trainer-access .permission-table small{display:block;color:var(--muted);font-size:11px}.trainer-access .permission-table input{width:20px;height:20px;accent-color:var(--red);cursor:pointer}.trainer-access .permission-table label{display:flex;justify-content:center;align-items:center;min-width:44px;min-height:44px}.trainer-access .permission-section-title{display:flex;justify-content:space-between;align-items:center;gap:8px}.trainer-access .permission-section-title h3{font-size:15px;margin:0}.trainer-access .permission-section-title button{font-size:12px;padding:5px 10px}.trainer-access .permission-savebar{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid var(--line);padding-top:18px;margin-top:24px}.trainer-access .permission-savebar span{font-size:12px;color:var(--muted)}.trainer-access .permission-savebar div{display:flex;gap:8px}.trainer-access .permission-scope{padding:10px 12px;margin-top:16px;background:#f8fafc;border-radius:6px;font-size:12px}.trainer-access .permission-summary{padding:12px;background:#f8fafc;border-radius:6px;font-size:13px;white-space:pre-line;overflow-wrap:anywhere;margin:16px 0}.trainer-access .permission-admin-badge{border:1px solid var(--line);border-radius:6px;background:white;padding:5px 10px;font-size:12px;white-space:nowrap}.trainer-access dialog{border:0;border-radius:14px;padding:26px;width:460px;max-width:calc(100% - 28px);box-shadow:0 20px 80px #11182730}.trainer-access dialog::backdrop{background:#11182760}.trainer-access dialog h2{font-size:20px}.trainer-access .dialog-actions{display:flex;gap:8px;justify-content:flex-end}
@media(max-width:700px){.trainer-access .permission-layout{grid-template-columns:1fr;gap:12px}.trainer-access .permission-list{display:grid;grid-template-columns:1fr 1fr}.trainer-access .permission-list h2{grid-column:1/-1}.trainer-access .trainer-pick{padding:10px;gap:4px;min-height:65px}.trainer-access .trainer-pick small{font-size:10px}.trainer-access .grade-tag{padding:1px 5px;font-size:10px}.trainer-access .permission-editor{padding:18px 14px}.trainer-access .permission-head h1{font-size:23px}.trainer-access .permission-savebar{align-items:flex-start;flex-direction:column}.trainer-access .permission-savebar div{width:100%}.trainer-access .permission-savebar button{flex:1}.trainer-access .permission-table small{max-width:135px}.trainer-access .permission-section select{max-width:none}.trainer-access .dialog-actions button{flex:1;padding:8px}}
`;
