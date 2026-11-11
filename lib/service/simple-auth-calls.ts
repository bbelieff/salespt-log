/**
 * Layer: service. 간편인증 — CODEF 요청 만들기(로그인 칸·서류별 상품 칸)와 한국시간 도우미. simple-auth.ts 에서 분리(500줄 상한).
 * 상품별 입력은 developer.codef.io 각 상품 문서 입력부 기준.
 */
import { type SimpleAuthDocKey, type SimpleAuthStart } from "@/types/simple-auth";
import { CODEF_LOGIN_LEVEL, CODEF_PATH, CODEF_TELECOM, SIMPLE_AUTH_YEARS } from "@/config/simple-auth";
import { codefEncrypt } from "@/repo/codef-client";
import { digitsOnly } from "@/lib/document-ocr/bizno";

export type Obj = Record<string, unknown>;
export type Call = { doc: SimpleAuthDocKey; path: string; params: Obj; group: "nt" | "mw" | "pp" };

const KST = 9 * 3_600_000;
export const kstNow = (now = Date.now()) => new Date(now + KST);
export const kstMidnight = (now = Date.now()) => { const k = kstNow(now); return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()) - KST); };
export const kstToday = () => kstNow().toISOString().slice(0, 10);
export const baseYear = () => kstNow().getUTCFullYear();

// ───────────────────────── CODEF 요청 만들기 ─────────────────────────

function loginParams(input: SimpleAuthStart, id: string, group: Call["group"]): Obj {
  if (input.mode === "simple") {
    return {
      organization: "0001", loginType: "5", loginTypeLevel: CODEF_LOGIN_LEVEL[input.method], userName: input.owner,
      loginIdentity: input.birth, phoneNo: digitsOnly(input.phone), telecom: input.method === "PASS" ? CODEF_TELECOM[input.telecom] ?? "" : "", id,
    };
  }
  const cert = input.certPfx ? { certType: "pfx", certFile: input.certPfx } : { certType: "1", certFile: input.certDer ?? "", keyFile: input.certKey ?? "" };
  return { organization: group === "pp" ? "0003" : "0001", ...(group === "pp" ? {} : { loginType: "0" }), ...cert, certPassword: codefEncrypt(input.certPassword) };
}

/** vat 조회 범위 — 1~3월은 작년 2기까지, 그 뒤는 올해 1기까지(홈택스 조회 가능 범위 안에서 3년). */
function vatRange(): { startDate: string; endDate: string } {
  const k = kstNow(), y = k.getUTCFullYear(), m = k.getUTCMonth() + 1;
  return { startDate: `${y - SIMPLE_AUTH_YEARS}01`, endDate: m >= 8 ? `${y}01` : `${y - 1}07` };
}

export function buildCalls(input: SimpleAuthStart, ids: Record<Call["group"], string>, corp: boolean, docs: readonly SimpleAuthDocKey[] = input.docs): Call[] {
  const y = baseYear();
  const nt = (doc: SimpleAuthDocKey, path: string, extra: Obj): Call => ({ doc, path, group: "nt", params: { ...loginParams(input, ids.nt, "nt"), ...extra } });
  const proof = { usePurposes: "99", submitTargets: "99", isIdentityViewYN: "0", originDataYN1: "1" };
  const calls: Call[] = [];
  for (const doc of docs) {
    if (doc === "biz") calls.push(nt("biz", CODEF_PATH.biz, proof));
    if (doc === "vat") calls.push(nt("vat", CODEF_PATH.vat, { ...proof, ...vatRange() }));
    if (doc === "fs") {
      for (let i = 1; i <= SIMPLE_AUTH_YEARS; i++) {
        const fs = { ...proof, startDate: corp ? `${y - i}12` : String(y - i), ...(corp ? {} : { proofType: "40" }) };
        // 재무제표 상품만 간편인증 전화번호 칸 이름이 다르다(loginPhoneNo).
        const c = nt("fs", CODEF_PATH.fs, fs);
        if (input.mode === "simple") { c.params.loginPhoneNo = c.params.phoneNo; delete c.params.phoneNo; }
        calls.push(c);
      }
    }
    // isAddrViewYn 를 빼면 CODEF 가 {userError:ADDR_VIEWYN:undefined} 로 거절한다(2026-11-10 운영 실측).
    if (doc === "tax") calls.push(nt("tax", CODEF_PATH.tax, { proofType: "B0007", submitTargets: "99", isIdentityViewYN: "0", isAddrViewYn: "0", originDataYN1: "1" }));
    if (doc === "closed") calls.push(nt("closed", CODEF_PATH.closed, { usePurposes: "99", submitTargets: "99", isIdentityViewYn: "0", originDataYN1: "1" }));
    if (doc === "income") calls.push(nt("income", CODEF_PATH.income, { startYear: String(y - SIMPLE_AUTH_YEARS), endYear: String(y - 1), usePurposes: "99", submitTargets: "99", isIdentityViewYn: "0", isAddrViewYn: "0", originDataYN1: "1" }));
    if (doc === "localTax") {
      const addr = input.address!;
      const phoneNo = digitsOnly(input.phone);
      const base = { address: addr.road, addrDetail: addr.detail, proofType: "99", isIdentityViewYn: "1", originDataYN1: "1" };
      if (input.mode === "simple") {
        const login = loginParams(input, ids.mw, "mw");
        delete login.loginIdentity;
        calls.push({ doc, group: "mw", path: CODEF_PATH.localTax, params: {
          ...login, ...base, phoneNo1: phoneNo, identityEncYn: "Y", birthDate: input.birth.slice(2), identity: codefEncrypt(input.rrnBack ?? ""),
        } });
      } else {
        calls.push({ doc, group: "mw", path: corp ? CODEF_PATH.localTaxCorp : CODEF_PATH.localTax, params: {
          ...loginParams(input, ids.mw, "mw"), ...base, ...(corp ? { phoneNo } : { phoneNo1: phoneNo }),
        } });
      }
    }
    if (doc === "ins" && input.mode === "cert") calls.push({ doc, group: "pp", path: CODEF_PATH.ins, params: { ...loginParams(input, ids.pp, "pp"), inquiryType: "0", originDataYN: "1" } });
  }
  return calls;
}
