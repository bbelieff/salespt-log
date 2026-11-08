"use client";
/** 간편인증 서류 조회 — 「인증 보내기」 입력(목업). 고객 정보는 수강생이 통화로 받아 넣는다. */
import { useId, useState } from "react";
import { Send } from "lucide-react";
import PhoneInput from "@/components/ui/PhoneInput";
import AuthMethodIcon from "./AuthMethodIcon";
import { AUTH_METHODS, DEFAULT_DOCS, DOCS, TELECOMS, type AuthMethod, type DocKey } from "./data";

export type RequestInput = { owner: string; birth: string; phone: string; telecom: string; method: AuthMethod; docs: DocKey[] };

const INPUT = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
const LABEL = "text-sm font-medium text-gray-700";

function birthError(v: string): string {
  if (!v) return "생년월일 8자리를 넣어 주세요.";
  if (!/^\d{8}$/.test(v)) return "숫자 8자리로 넣어 주세요. 예: 19780312";
  const y = +v.slice(0, 4), m = +v.slice(4, 6), d = +v.slice(6, 8);
  const dt = new Date(y, m - 1, d);
  if (y < 1920 || dt.getMonth() !== m - 1 || dt.getDate() !== d) return "없는 날짜예요. 다시 확인해 주세요.";
  return "";
}

export default function RequestForm({ onSend, busy }: { onSend: (v: RequestInput) => void; busy: boolean }) {
  const id = useId();
  const [owner, setOwner] = useState("");
  const [birth, setBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [telecom, setTelecom] = useState("");
  const [method, setMethod] = useState<AuthMethod>("카카오톡");
  const [docs, setDocs] = useState<DocKey[]>(DEFAULT_DOCS);
  const [rrnBack, setRrnBack] = useState("");
  const [address, setAddress] = useState("");
  const [tried, setTried] = useState(false);
  const gov24 = docs.includes("localTax");

  const errors = {
    rrnBack: gov24 && !/^\d{7}$/.test(rrnBack) ? "주민번호 뒷자리 7자리를 넣어 주세요." : "",
    address: gov24 && !address.trim() ? "주소를 넣어 주세요." : "",
    owner: owner.trim() ? "" : "대표 이름을 넣어 주세요.",
    birth: birthError(birth),
    phone: /^010-\d{4}-\d{4}$/.test(phone) ? "" : "휴대폰 번호 11자리를 넣어 주세요.",
    telecom: method === "PASS" && !telecom ? "PASS는 통신사가 필요해요." : "",
    docs: docs.length ? "" : "받을 서류를 하나 이상 골라 주세요.",
  };
  const show = (k: keyof typeof errors) => (tried && errors[k] ? <p id={`${id}-${k}-err`} className="mt-1 text-xs text-red-600">{errors[k]}</p> : null);
  const invalid = (k: keyof typeof errors) => (tried && errors[k] ? { "aria-invalid": true, "aria-describedby": `${id}-${k}-err` } : {});
  const toggleDoc = (k: DocKey) => k !== "biz" && setDocs(d => (d.includes(k) ? d.filter(x => x !== k) : [...d, k]));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    onSend({ owner: owner.trim(), birth, phone, telecom, method, docs });
    setOwner(""); setBirth(""); setPhone(""); setTelecom(""); setRrnBack(""); setAddress(""); setTried(false);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">인증 보내기</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label htmlFor={`${id}-owner`} className={LABEL}>대표 이름</label>
          <input id={`${id}-owner`} value={owner} onChange={e => setOwner(e.target.value)} autoComplete="off" className={`${INPUT} mt-1`} {...invalid("owner")} />
          {show("owner")}
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-birth`} className={LABEL}>생년월일</label>
          <input id={`${id}-birth`} value={birth} onChange={e => setBirth(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" placeholder="19780312" autoComplete="off" className={`${INPUT} mt-1 tabular-nums`} {...invalid("birth")} />
          {show("birth")}
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-phone`} className={LABEL}>대표 휴대폰</label>
        <PhoneInput value={phone} onChange={setPhone} className={`${INPUT} mt-1 tabular-nums`} aria-label="대표 휴대폰" />
        {show("phone")}
      </div>

      <fieldset>
        <legend className={LABEL}>인증 수단</legend>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          {AUTH_METHODS.map(m => (
            <label key={m} className={`flex cursor-pointer items-center justify-start gap-2 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-500 ${method === m ? "border-blue-500 bg-blue-50 font-semibold text-blue-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
              <input type="radio" name={`${id}-method`} value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" /><AuthMethodIcon method={m} />{m}
            </label>
          ))}
        </div>
        {method === "PASS" && (
          <div className="mt-2">
            <label htmlFor={`${id}-telecom`} className="text-xs text-gray-600">통신사</label>
            <select id={`${id}-telecom`} value={telecom} onChange={e => setTelecom(e.target.value)} className={`${INPUT} mt-1`} {...invalid("telecom")}>
              <option value="">통신사</option>
              {TELECOMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {show("telecom")}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className={LABEL}>받을 서류</legend>
        <ul className="mt-1 flex flex-wrap gap-1.5 pc:flex-col pc:items-start">
          {DOCS.map(d => {
            const on = docs.includes(d.key);
            return (
              <li key={d.key}>
                <label className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-500 ${on ? "border-blue-500 bg-blue-50 font-semibold text-blue-700" : "border-gray-300 text-gray-700"} ${d.locked ? "cursor-default" : "cursor-pointer hover:bg-gray-50"}`}>
                  <input type="checkbox" checked={on} disabled={d.locked} onChange={() => toggleDoc(d.key)} className="sr-only" />
                  {d.label}{d.note && <span className={on ? "font-normal text-blue-600" : "text-gray-500"}>{d.note}</span>}
                </label>
              </li>
            );
          })}
        </ul>
        {show("docs")}
      </fieldset>

      {gov24 && (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <legend className="px-1 text-xs font-semibold text-gray-600">지방세 완납증명(정부24)에 필요</legend>
          <div>
            <label htmlFor={`${id}-rrn`} className={LABEL}>주민번호 뒷자리</label>
            <input id={`${id}-rrn`} value={rrnBack} onChange={e => setRrnBack(e.target.value.replace(/\D/g, "").slice(0, 7))} type="password" inputMode="numeric" autoComplete="off" placeholder="7자리" className={`${INPUT} mt-1 tabular-nums`} {...invalid("rrnBack")} />
            {show("rrnBack")}
          </div>
          <div>
            <label htmlFor={`${id}-addr`} className={LABEL}>주소</label>
            <input id={`${id}-addr`} value={address} onChange={e => setAddress(e.target.value)} autoComplete="off" placeholder="주민등록상 주소" className={`${INPUT} mt-1`} {...invalid("address")} />
            {show("address")}
          </div>
        </fieldset>
      )}



      <button type="submit" disabled={busy} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500">
        <Send className="h-4 w-4" aria-hidden />{busy ? "보내는 중…" : "인증 보내기"}
      </button>
    </form>
  );
}
