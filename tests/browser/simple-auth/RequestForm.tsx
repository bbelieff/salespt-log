"use client";
/**
 * 간편인증 서류 조회 — 입력(목업). 탭 2개(belie 2026-11-08):
 *  · 간편인증 — 대표 휴대폰으로 인증을 보내고 고객이 승인.
 *  · 공동인증서 — 사용자가 고객의 공동인증서를 가진 경우, 승인 없이 4대보험 가입자명부·지방세 완납증명까지 한 번에.
 * 인증서 파일·비밀번호는 실제 구현에서 브라우저가 제공사 공개키로 암호화해 보내고 저장하지 않는다.
 */
import { useId, useState } from "react";
import { FileKey2, Send } from "lucide-react";
import PhoneInput from "@/components/ui/PhoneInput";
import AuthMethodIcon from "./AuthMethodIcon";
import RegionSearch from "./RegionSearch";
import { AUTH_METHODS, CERT_DEFAULT_DOCS, DEFAULT_DOCS, DOCS, TELECOMS, type AuthMethod, type DocKey, type Method } from "./data";

export type CertKind = "법인" | "개인";
export type RequestInput = { owner: string; birth: string; phone: string; telecom: string; method: Method; docs: DocKey[]; certKind?: CertKind };
type Mode = "simple" | "cert";

/** 목업: 파일 이름으로 흉내. 실제 구현은 인증서 안의 정책 OID(법인용/개인용)로 판별한다. */
const guessKind = (names: string[]): CertKind => (names.some(n => /\(주\)|주식회사|법인|㈜/.test(n)) ? "법인" : "개인");

const INPUT = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-blue-500 focus:outline-none";
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
  const [mode, setMode] = useState<Mode>("simple");
  const [owner, setOwner] = useState("");
  const [birth, setBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [telecom, setTelecom] = useState("");
  const [method, setMethod] = useState<AuthMethod>("카카오톡");
  const [docs, setDocs] = useState<DocKey[]>(DEFAULT_DOCS);
  const [rrnBack, setRrnBack] = useState("");
  const [address, setAddress] = useState("");
  const [certFiles, setCertFiles] = useState<string[]>([]);
  const [certPw, setCertPw] = useState("");
  const [tried, setTried] = useState(false);
  const cert = mode === "cert";
  const gov24 = docs.includes("localTax");
  const shownDocs = DOCS.filter(d => (cert ? !d.simpleOnly : !d.certOnly));
  const certKind = certFiles.length ? guessKind(certFiles) : undefined;
  const corp = certKind === "법인";

  const errors = {
    owner: owner.trim() ? "" : "대표 이름을 넣어 주세요.",
    birth: cert ? "" : birthError(birth),
    phone: cert ? (phone && !/^010-\d{4}-\d{4}$/.test(phone) ? "휴대폰 번호 11자리를 넣어 주세요." : "") : /^010-\d{4}-\d{4}$/.test(phone) ? "" : "휴대폰 번호 11자리를 넣어 주세요.",
    telecom: !cert && method === "PASS" && !telecom ? "PASS는 통신사가 필요해요." : "",
    cert: cert && !certFiles.length ? "인증서 파일을 골라 주세요. (.pfx, 또는 signCert.der + signPri.key)" : "",
    certPw: cert && !certPw ? "인증서 비밀번호를 넣어 주세요." : "",
    docs: docs.length ? "" : "받을 서류를 하나 이상 골라 주세요.",
    rrnBack: !cert && gov24 && !/^\d{7}$/.test(rrnBack) ? "주민번호 뒷자리 7자리를 넣어 주세요." : "",
    address: gov24 && !address ? "시·군·구를 골라 주세요." : "",
  };
  const show = (k: keyof typeof errors) => (tried && errors[k] ? <p id={`${id}-${k}-err`} className="mt-1 text-xs text-red-600">{errors[k]}</p> : null);
  const invalid = (k: keyof typeof errors) => (tried && errors[k] ? { "aria-invalid": true, "aria-describedby": `${id}-${k}-err` } : {});
  const toggleDoc = (k: DocKey) => k !== "biz" && setDocs(d => (d.includes(k) ? d.filter(x => x !== k) : [...d, k]));
  function switchMode(m: Mode) {
    setMode(m); setTried(false);
    setDocs(m === "cert" ? CERT_DEFAULT_DOCS : DEFAULT_DOCS);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    onSend({ owner: owner.trim(), birth, phone, telecom, method: cert ? "공동인증서" : method, docs, ...(cert && certKind ? { certKind } : {}) });
    setOwner(""); setBirth(""); setPhone(""); setTelecom(""); setRrnBack(""); setAddress(""); setCertFiles([]); setCertPw(""); setTried(false);
  }

  const tab = (m: Mode, label: string) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
      className={`flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${mode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
      {label}
    </button>
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div role="tablist" aria-label="가져오는 방법" className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {tab("simple", "간편인증 보내기")}
        {tab("cert", "공동인증서로 가져오기")}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label htmlFor={`${id}-owner`} className={LABEL}>대표 이름</label>
          <input id={`${id}-owner`} value={owner} onChange={e => setOwner(e.target.value)} autoComplete="off" className={`${INPUT} mt-1`} {...invalid("owner")} />
          {show("owner")}
        </div>
        {!cert && (
          <div className="min-w-0">
            <label htmlFor={`${id}-birth`} className={LABEL}>생년월일</label>
            <input id={`${id}-birth`} value={birth} onChange={e => setBirth(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" placeholder="19780312" autoComplete="off" className={`${INPUT} mt-1 tabular-nums`} {...invalid("birth")} />
            {show("birth")}
          </div>
        )}
      </div>

      <div>
        <label htmlFor={`${id}-phone`} className={LABEL}>대표 휴대폰{cert && <span className="font-normal text-gray-500"> (선택 · DB 연결용)</span>}</label>
        <PhoneInput value={phone} onChange={setPhone} className={`${INPUT} mt-1 tabular-nums`} aria-label="대표 휴대폰" />
        {show("phone")}
      </div>

      {cert ? (
        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="sr-only">공동인증서</legend>
          <div>
            <label htmlFor={`${id}-cert`} className={LABEL}>인증서 파일</label>
            <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-base text-gray-700 hover:bg-gray-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-500">
              <FileKey2 className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{certFiles.length ? certFiles.join(", ") : ".pfx 또는 signCert.der + signPri.key"}</span>
              <input id={`${id}-cert`} type="file" multiple accept=".pfx,.p12,.der,.key" className="sr-only" onChange={e => setCertFiles([...(e.target.files ?? [])].map(f => f.name))} {...invalid("cert")} />
            </label>
            {show("cert")}
            {certKind && (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-700">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${corp ? "bg-violet-50 text-violet-700" : "bg-emerald-50 text-emerald-700"}`}>{certKind} 인증서</span>
                {corp ? "법인 서류로 가져와요" : "대표의 개인사업자를 모두 가져와요"}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${id}-certpw`} className={LABEL}>인증서 비밀번호</label>
            <input id={`${id}-certpw`} type="password" value={certPw} onChange={e => setCertPw(e.target.value)} autoComplete="off" className={`${INPUT} mt-1`} {...invalid("certPw")} />
            {show("certPw")}
          </div>
        </fieldset>
      ) : (
        <fieldset className="min-w-0">
          <legend className={LABEL}>인증 수단</legend>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {AUTH_METHODS.map(m => (
              <label key={m} className={`flex cursor-pointer items-center justify-start gap-1.5 whitespace-nowrap rounded-lg border px-2 py-1.5 text-sm 2xl:gap-2 2xl:px-2.5 2xl:text-base transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-500 ${method === m ? "border-blue-500 bg-blue-50 font-semibold text-blue-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
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
      )}

      <fieldset className="min-w-0">
        <legend className={LABEL}>받을 서류</legend>
        <ul className="mt-1 flex flex-wrap gap-1.5 pc:flex-col pc:items-start">
          {shownDocs.map(d => {
            const on = docs.includes(d.key);
            const note = cert && d.key === "localTax" ? "정부24" : d.note;
            return (
              <li key={d.key}>
                <label className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-500 ${on ? "border-blue-500 bg-blue-50 font-semibold text-blue-700" : "border-gray-300 text-gray-700"} ${d.locked ? "cursor-default" : "cursor-pointer hover:bg-gray-50"}`}>
                  <input type="checkbox" checked={on} disabled={d.locked} onChange={() => toggleDoc(d.key)} className="sr-only" />
                  {d.label}{note && <span className={on ? "font-normal text-blue-600" : "text-gray-500"}>{note}</span>}
                </label>
              </li>
            );
          })}
        </ul>
        {show("docs")}
      </fieldset>

      {gov24 && (
        <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <legend className="px-1 text-xs font-semibold text-gray-600">지방세 완납증명(정부24)에 필요</legend>
          {!cert && (
            <div>
              <label htmlFor={`${id}-rrn`} className={LABEL}>주민번호 뒷자리</label>
              <input id={`${id}-rrn`} value={rrnBack} onChange={e => setRrnBack(e.target.value.replace(/\D/g, "").slice(0, 7))} type="password" inputMode="numeric" autoComplete="off" placeholder="7자리" className={`${INPUT} mt-1 tabular-nums`} {...invalid("rrnBack")} />
              {show("rrnBack")}
            </div>
          )}
          <div>
            <label htmlFor={`${id}-addr`} className={LABEL}>{corp ? "본점 소재지" : "주민등록 주소"} <span className="font-normal text-gray-500">시·군·구</span></label>
            <RegionSearch id={`${id}-addr`} value={address} onChange={setAddress} invalid={invalid("address")} />
            {show("address")}
          </div>
        </fieldset>
      )}

      <button type="submit" disabled={busy} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500">
        {cert ? <FileKey2 className="h-4 w-4" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        {busy ? "보내는 중…" : cert ? "서류 가져오기" : "인증 보내기"}
      </button>
    </form>
  );
}
