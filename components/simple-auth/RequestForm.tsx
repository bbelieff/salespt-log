"use client";
/**
 * 간편인증 서류 조회 — 입력. 탭 2개(belie 2026-11-08~09):
 *  · 간편인증 — 대표 휴대폰으로 인증을 보내고 고객이 승인.
 *  · 공동인증서 — 고객 공동인증서(설치된 NPKI·USB 폴더, 또는 .pfx·der+key 파일 — CertPicker 한 버튼)와 비밀번호로 승인 없이 6종(법인·개인 같음)을 한 번에.
 * 인증서 파일·비밀번호·주민번호 뒷자리는 서버가 요청에만 쓰고 저장하지 않는다(비밀번호는 서버에서 CODEF 공개키로 암호화).
 */
import { useId, useState } from "react";
import { AlertTriangle, FileKey2, Info, Send } from "lucide-react";
import HintTooltip from "@/components/ui/HintTooltip";
import PhoneInput from "@/components/ui/PhoneInput";
import AuthMethodIcon from "./AuthMethodIcon";
import AddressSearch from "./AddressSearch";
import CertPicker, { type PickedCert } from "./CertPicker";
import { SIMPLE_AUTH_APPS, SIMPLE_AUTH_CERT_DEFAULT_DOCS, SIMPLE_AUTH_DEFAULT_DOCS, SIMPLE_AUTH_DOCS, SIMPLE_AUTH_SITES, SIMPLE_AUTH_TELECOMS } from "@/config/simple-auth";
import type { SimpleAuthAddress, SimpleAuthDocKey } from "@/types/simple-auth";
import { formatBizNo } from "@/lib/document-ocr/bizno";

type AuthMethod = (typeof SIMPLE_AUTH_APPS)[number];
type DocKey = SimpleAuthDocKey;
const AUTH_METHODS = SIMPLE_AUTH_APPS, TELECOMS = SIMPLE_AUTH_TELECOMS, DOCS = SIMPLE_AUTH_DOCS;
type Mode = "simple" | "cert";

/** 파일 → base64(앞의 data: 머리 없이). */
const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
  r.onerror = () => reject(new Error("파일을 읽지 못했어요."));
  r.readAsDataURL(f);
});

const INPUT = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-blue-500 focus:outline-none";
const LABEL = "text-sm font-medium text-slate-700";

const BIZ_NO = /\d{3}-?\d{2}-?\d{5}/g;
/** 「사업자번호」 칸 → 번호 목록(중복 제거). 쉼표·띄어쓰기·줄바꿈으로 나눠 넣는다. */
const parseBizNos = (v: string) => [...new Set((v.match(BIZ_NO) ?? []).map(formatBizNo))];
function bizNosError(v: string): string {
  if (v.replace(BIZ_NO, "").replace(/[\s,·/]/g, "")) return "사업자번호 10자리를 쉼표로 나눠 넣어 주세요. 예: 123-45-67890, 234-56-78901";
  return parseBizNos(v).length > 5 ? "사업자번호는 5곳까지 넣을 수 있어요." : "";
}

function birthError(v: string): string {
  if (!v) return "생년월일 8자리를 넣어 주세요.";
  if (!/^\d{8}$/.test(v)) return "숫자 8자리로 넣어 주세요. 예: 19780312";
  const y = +v.slice(0, 4), m = +v.slice(4, 6), d = +v.slice(6, 8);
  const dt = new Date(y, m - 1, d);
  if (y < 1920 || dt.getMonth() !== m - 1 || dt.getDate() !== d) return "없는 날짜예요. 다시 확인해 주세요.";
  return "";
}

export default function RequestForm({ onSend, busy }: { onSend: (body: Record<string, unknown>) => Promise<boolean>; busy: boolean }) {
  const id = useId();
  const [mode, setMode] = useState<Mode>("simple");
  const [owner, setOwner] = useState("");
  const [birth, setBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [telecom, setTelecom] = useState("");
  const [method, setMethod] = useState<AuthMethod>("카카오톡");
  const [docs, setDocs] = useState<DocKey[]>([...SIMPLE_AUTH_DEFAULT_DOCS]);
  const [rrnBack, setRrnBack] = useState("");
  const [address, setAddress] = useState<SimpleAuthAddress | null>(null);
  const [bizText, setBizText] = useState("");
  const [picked, setPicked] = useState<PickedCert | null>(null);
  const [certPw, setCertPw] = useState("");
  const [tried, setTried] = useState(false);
  const cert = mode === "cert";
  const gov24 = docs.includes("localTax");
  const fsOn = docs.includes("fs");
  const shownDocs = DOCS.filter(d => (cert ? !d.simpleOnly : !d.certOnly));

  const errors = {
    owner: owner.trim() ? "" : "대표 이름을 넣어 주세요.",
    birth: cert ? "" : birthError(birth),
    phone: cert ? (phone && !/^010-\d{4}-\d{4}$/.test(phone) ? "휴대폰 번호 11자리를 넣어 주세요." : gov24 && !phone ? "지방세 완납증명은 대표 휴대폰이 필요해요." : "") : /^010-\d{4}-\d{4}$/.test(phone) ? "" : "휴대폰 번호 11자리를 넣어 주세요.",
    telecom: !cert && method === "PASS" && !telecom ? "PASS는 통신사가 필요해요." : "",
    cert: !cert ? "" : !picked ? "인증서를 골라 주세요." : picked.kind === "npki" && picked.info?.expired ? "만료된 인증서예요. 다른 인증서를 골라 주세요." : "",
    certPw: cert && !certPw ? "인증서 비밀번호를 넣어 주세요." : "",
    docs: docs.length ? "" : "받을 서류를 하나 이상 골라 주세요.",
    rrnBack: !cert && gov24 && !/^\d{7}$/.test(rrnBack) ? "주민번호 뒷자리 7자리를 넣어 주세요." : "",
    address: gov24 && !address ? "주소를 검색해 골라 주세요." : "",
    bizNos: fsOn ? bizNosError(bizText) : "",
  };
  const show = (k: keyof typeof errors) => (tried && errors[k] ? <p id={`${id}-${k}-err`} className="mt-1 text-xs text-red-600">{errors[k]}</p> : null);
  const invalid = (k: keyof typeof errors) => (tried && errors[k] ? { "aria-invalid": true, "aria-describedby": `${id}-${k}-err` } : {});
  const toggleDoc = (k: DocKey) => k !== "biz" && setDocs(d => (d.includes(k) ? d.filter(x => x !== k) : [...d, k]));
  // 개인 인증서면 이름 칸이 비었을 때 인증서 이름으로 채운다(법인은 상호라 채우지 않음).
  function pickCert(c: PickedCert | null) {
    setPicked(c);
    if (c?.kind === "npki" && c.info?.kind === "개인" && !owner.trim()) setOwner(c.info.name);
  }
  function switchMode(m: Mode) {
    setMode(m); setTried(false);
    setDocs([...(m === "cert" ? SIMPLE_AUTH_CERT_DEFAULT_DOCS : SIMPLE_AUTH_DEFAULT_DOCS)]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    const common = { owner: owner.trim(), phone, docs, ...(gov24 && address ? { address } : {}), ...(fsOn ? { bizNos: parseBizNos(bizText) } : {}) };
    let body: Record<string, unknown>;
    try {
      body = cert
        ? { mode: "cert", ...common, certPassword: certPw, ...(picked!.kind === "pfx" ? { certPfx: await toBase64(picked!.file) } : { certDer: await toBase64(picked!.der), certKey: await toBase64(picked!.key) }) }
        : { mode: "simple", ...common, birth, telecom, method, ...(gov24 ? { rrnBack } : {}) };
    } catch { return; }
    if (!(await onSend(body))) return;
    setOwner(""); setBirth(""); setPhone(""); setTelecom(""); setRrnBack(""); setAddress(null); setBizText(""); setPicked(null); setCertPw(""); setTried(false);
  }

  const tab = (m: Mode, label: string) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
      className={`flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
      {label}
    </button>
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div role="tablist" aria-label="가져오는 방법" className="flex gap-1 rounded-lg bg-slate-100 p-1">
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
        <label htmlFor={`${id}-phone`} className={LABEL}>대표 휴대폰{cert && <span className="font-normal text-slate-500"> (선택 · DB 연결용)</span>}</label>
        <PhoneInput value={phone} onChange={setPhone} className={`${INPUT} mt-1 tabular-nums`} aria-label="대표 휴대폰" />
        {show("phone")}
      </div>

      {cert ? (
        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="sr-only">공동인증서</legend>
          <div>
            <label htmlFor={`${id}-cert`} className={LABEL}>인증서</label>
            <CertPicker id={`${id}-cert`} value={picked} onChange={pickCert} invalid={invalid("cert")} />
            {show("cert")}
            {/* 법인/개인은 받은 사업자등록증명의 사업자 종류로 서버가 정한다(재무제표·지방세 상품이 다름). */}
            <p className="mt-1.5 text-xs text-slate-500">법인 인증서면 법인 서류, 개인 인증서면 대표의 개인사업자 서류를 가져와요.</p>
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
              <label key={m} className={`flex cursor-pointer items-center justify-start gap-1.5 whitespace-nowrap rounded-lg border px-2 py-1.5 text-sm 2xl:gap-2 2xl:px-2.5 2xl:text-base transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-500 ${method === m ? "border-blue-500 bg-blue-50 font-semibold text-blue-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
                <input type="radio" name={`${id}-method`} value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" /><AuthMethodIcon method={m} />{m}
              </label>
            ))}
          </div>
          {method === "PASS" && (
            <div className="mt-2">
              <label htmlFor={`${id}-telecom`} className="text-xs text-slate-600">통신사</label>
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
        <div className="mt-1 flex flex-col gap-2.5">
          {SIMPLE_AUTH_SITES.map(site => {
            const list = shownDocs.filter(d => d.site === site);
            if (!list.length) return null;
            return (
              <div key={site} className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">{site}</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {list.map(d => {
                    const on = docs.includes(d.key);
                    return (
                      <li key={d.key} className="inline-flex items-center">
                        <label className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-500 ${on ? "border-blue-500 bg-blue-50 font-semibold text-blue-700" : "border-slate-300 text-slate-700"} ${d.locked ? "cursor-default" : "cursor-pointer hover:bg-slate-50"}`}>
                          <input type="checkbox" checked={on} disabled={d.locked} onChange={() => toggleDoc(d.key)} className="sr-only" />
                          {d.label}{d.note && <span className={on ? "font-normal text-blue-600" : "text-slate-500"}>{d.note}</span>}
                        </label>
                        {d.hint && <HintTooltip label={d.label} text={d.hint} trigger={<span className="inline-flex h-8 w-7 items-center justify-center text-amber-600 hover:text-amber-700"><Info className="h-4 w-4" aria-hidden /></span>} />}
                      </li>
                    );
                  })}
                </ul>
                {list.filter(d => d.caution && docs.includes(d.key)).map(d => (
                  <p key={d.key} className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-sm leading-snug text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{d.caution}</span>
                  </p>
                ))}
                {fsOn && list.some(d => d.key === "fs") && (
                  <div className="mt-2">
                    <label htmlFor={`${id}-biznos`} className={LABEL}>사업자번호<span className="font-normal text-slate-500"> (사업장이 여러 곳일 때만)</span></label>
                    <input id={`${id}-biznos`} value={bizText} onChange={e => setBizText(e.target.value)} autoComplete="off" placeholder="123-45-67890, 234-56-78901" className={`${INPUT} mt-1 tabular-nums`} {...invalid("bizNos")} />
                    {show("bizNos")}
                    <p className="mt-1 text-xs text-slate-500">{cert ? "비워 두면 사업자등록증명에 나온 사업장마다 받아요." : "1곳이면 비워 두세요. 여러 곳인데 비워 두면 재무제표가 안 들어와요."}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {show("docs")}
      </fieldset>

      {gov24 && (
        <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <legend className="px-1 text-xs font-semibold text-slate-600">지방세 완납증명(정부24)에 필요</legend>
          {!cert && (
            <div>
              <label htmlFor={`${id}-rrn`} className={LABEL}>주민번호 뒷자리</label>
              <input id={`${id}-rrn`} value={rrnBack} onChange={e => setRrnBack(e.target.value.replace(/\D/g, "").slice(0, 7))} type="password" inputMode="numeric" autoComplete="off" placeholder="7자리" className={`${INPUT} mt-1 tabular-nums`} {...invalid("rrnBack")} />
              {show("rrnBack")}
            </div>
          )}
          <div>
            <label htmlFor={`${id}-addr`} className={LABEL}>{cert ? "주민등록 주소 (법인은 본점 소재지)" : "주민등록 주소"}</label>
            <AddressSearch id={`${id}-addr`} value={address} onChange={setAddress} invalid={invalid("address")} />
            {show("address")}
          </div>
        </fieldset>
      )}

      <button type="submit" disabled={busy} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
        {cert ? <FileKey2 className="h-4 w-4" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        {busy ? "보내는 중…" : cert ? "서류 가져오기" : "인증 보내기"}
      </button>
    </form>
  );
}
