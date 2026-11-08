"use client";
/** 간편인증 서류 조회 — 「인증 보내기」 입력(목업). 고객 정보는 수강생이 통화로 받아 넣는다. */
import { useId, useState } from "react";
import { Info, Send } from "lucide-react";
import PhoneInput from "@/components/ui/PhoneInput";
import { AUTH_METHODS, CONSENT_WAYS, DEFAULT_DOCS, DOCS, TELECOMS, type AuthMethod, type DocKey } from "./data";

export type RequestInput = { owner: string; birth: string; phone: string; telecom: string; method: AuthMethod; docs: DocKey[]; consentWay: string };

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
  const [consent, setConsent] = useState(false);
  const [consentWay, setConsentWay] = useState<string>("통화");
  const [tried, setTried] = useState(false);

  const errors = {
    owner: owner.trim() ? "" : "대표 이름을 넣어 주세요.",
    birth: birthError(birth),
    phone: /^010-\d{4}-\d{4}$/.test(phone) ? "" : "휴대폰 번호 11자리를 넣어 주세요.",
    telecom: method === "PASS" && !telecom ? "PASS는 통신사가 필요해요." : "",
    docs: docs.length ? "" : "받을 서류를 하나 이상 골라 주세요.",
    consent: consent ? "" : "고객 동의를 받은 뒤 체크해 주세요.",
  };
  const show = (k: keyof typeof errors) => (tried && errors[k] ? <p id={`${id}-${k}-err`} className="mt-1 text-xs text-red-600">{errors[k]}</p> : null);
  const invalid = (k: keyof typeof errors) => (tried && errors[k] ? { "aria-invalid": true, "aria-describedby": `${id}-${k}-err` } : {});
  const toggleDoc = (k: DocKey) => k !== "biz" && setDocs(d => (d.includes(k) ? d.filter(x => x !== k) : [...d, k]));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    onSend({ owner: owner.trim(), birth, phone, telecom, method, docs, consentWay });
    setOwner(""); setBirth(""); setPhone(""); setTelecom(""); setConsent(false); setTried(false);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">인증 보내기</h2>

      <p className="-mt-2 text-sm text-gray-600">업체를 먼저 고르지 않아도 돼요. 서류가 오면 사업자번호로 내 DB에 연결해 드려요.</p>

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
            <label key={m} className={`cursor-pointer rounded-lg border px-2 py-1.5 text-center text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-500 ${method === m ? "border-blue-500 bg-blue-50 font-semibold text-blue-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
              <input type="radio" name={`${id}-method`} value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />{m}
            </label>
          ))}
        </div>
        {method === "PASS" && (
          <div className="mt-2">
            <label htmlFor={`${id}-telecom`} className="text-xs text-gray-600">통신사</label>
            <select id={`${id}-telecom`} value={telecom} onChange={e => setTelecom(e.target.value)} className={`${INPUT} mt-1`} {...invalid("telecom")}>
              <option value="">통신사 고르기 (알뜰폰은 망 기준)</option>
              {TELECOMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {show("telecom")}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className={LABEL}>받을 서류</legend>
        <ul className="mt-1 flex flex-col gap-1">
          {DOCS.map(d => (
            <li key={d.key}>
              <label className={`flex items-center gap-2 rounded-md px-1 py-1 text-sm text-gray-800 ${d.locked ? "" : "cursor-pointer hover:bg-gray-50"}`}>
                <input type="checkbox" checked={docs.includes(d.key)} disabled={d.locked} onChange={() => toggleDoc(d.key)} className="h-4 w-4 accent-blue-600" />
                <span>{d.label}</span>
                {d.note && <span className="text-xs text-gray-500">{d.note}</span>}
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-gray-500">고른 서류는 고객 승인 한 번으로 모두 받아요.</p>
        {show("docs")}
      </fieldset>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <p className="flex items-center gap-1.5 font-semibold"><Info className="h-4 w-4 shrink-0" aria-hidden />보내기 전에 고객에게 말해 주세요</p>
        <p className="mt-1 text-blue-800">“곧 {method}으로 홈택스 로그인 인증 요청이 갑니다. 승인만 눌러 주시면 서류는 저희가 받아 둘게요. 4분 30초 안에 눌러 주세요.”</p>
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-800">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" {...invalid("consent")} />
          <span>고객에게 개인정보 조회·제3자 제공(조회 대행사) 동의를 받았습니다.</span>
        </label>
        <div className="mt-2 flex items-center gap-2 pl-6 text-xs text-gray-600">
          <label htmlFor={`${id}-way`}>동의 방법</label>
          <select id={`${id}-way`} value={consentWay} onChange={e => setConsentWay(e.target.value)} className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs">
            {CONSENT_WAYS.map(w => <option key={w}>{w}</option>)}
          </select>
          <span>· 보낸 시각과 함께 남아요</span>
        </div>
        {show("consent")}
      </div>

      <button type="submit" disabled={busy} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500">
        <Send className="h-4 w-4" aria-hidden />{busy ? "보내는 중…" : "인증 보내기"}
      </button>
      <p className="-mt-2 text-center text-xs text-gray-500">주민등록번호는 받지 않아요. 홈택스 회원이 아니면 회원가입 후 다시 보내 주세요.</p>
    </form>
  );
}
