/**
 * Layer: util. 공동인증서(NPKI) 파일 찾기·요약 — 브라우저에서 고른 폴더/파일 목록을 인증서 단위로 묶고,
 * signCert.der 에서 이름·발급기관·만료일·개인/법인을 읽는다(서버로 보내기 전 화면 표시용).
 * 개인/법인 표시는 참고용이다. 실제 법인 여부는 서버가 받은 사업자등록증명으로 정한다(lib/service/simple-auth.ts).
 * 순수 함수 — DOM·Node API 를 쓰지 않는다(TextDecoder 만).
 */

export type NpkiCertInfo = {
  /** CN 에서 `()숫자` 꼬리를 뗀 이름. 개인은 대표 이름, 법인은 상호. */
  name: string;
  kind: "개인" | "법인" | null;
  /** 발급기관 이름(금융결제원 등). 모르면 O 값 그대로. */
  issuer: string;
  /** 만료일 YYYY-MM-DD(한국시간). */
  notAfter: string;
  expired: boolean;
};

type Tlv = { tag: number; start: number; end: number; next: number };

function readTlv(b: Uint8Array, at: number): Tlv {
  if (at + 2 > b.length) throw new Error("bad der");
  const tag = b[at]!;
  let len = b[at + 1]!, p = at + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n < 1 || n > 4 || p + n > b.length) throw new Error("bad der");
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + b[p + i]!;
    p += n;
  }
  if (p + len > b.length) throw new Error("bad der");
  return { tag, start: p, end: p + len, next: p + len };
}

function children(b: Uint8Array, t: Tlv): Tlv[] {
  const out: Tlv[] = [];
  for (let p = t.start; p < t.end; ) { const c = readTlv(b, p); out.push(c); p = c.next; }
  return out;
}

function oid(b: Uint8Array, t: Tlv): string {
  const v = b.subarray(t.start, t.end);
  if (!v.length) return "";
  const parts = [Math.floor(v[0]! / 40), v[0]! % 40];
  let n = 0;
  for (let i = 1; i < v.length; i++) { n = n * 128 + (v[i]! & 0x7f); if (!(v[i]! & 0x80)) { parts.push(n); n = 0; } }
  return parts.join(".");
}

function text(b: Uint8Array, t: Tlv): string {
  const v = b.subarray(t.start, t.end);
  if (t.tag === 0x1e) { let s = ""; for (let i = 0; i + 1 < v.length; i += 2) s += String.fromCharCode(v[i]! * 256 + v[i + 1]!); return s; }
  return new TextDecoder("utf-8", { fatal: false }).decode(v);
}

/** Name(SEQ of SET of SEQ{oid,value}) → [oid, 값] 목록(순서 유지). */
function names(b: Uint8Array, t: Tlv): [string, string][] {
  const out: [string, string][] = [];
  for (const set of children(b, t)) for (const atv of children(b, set)) {
    const [k, v] = children(b, atv);
    if (k && v) out.push([oid(b, k), text(b, v)]);
  }
  return out;
}

function time(b: Uint8Array, t: Tlv): Date {
  const s = text(b, t);
  const m = t.tag === 0x17 ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/.exec(s) : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/.exec(s);
  if (!m) throw new Error("bad time");
  const y = t.tag === 0x17 ? (+m[1]! >= 50 ? 1900 : 2000) + +m[1]! : +m[1]!;
  return new Date(Date.UTC(y, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +(m[6] ?? 0)));
}

const CN = "2.5.4.3", O = "2.5.4.10", OU = "2.5.4.11", POLICIES = "2.5.29.32";

/** 인증서 정책 OID — 주요 발급기관의 개인·법인 범용/용도제한. 목록에 없으면 OU·이름으로 짐작한다. */
const POLICY_KIND: Readonly<Record<string, "개인" | "법인">> = {
  "1.2.410.200005.1.1.1": "개인", "1.2.410.200005.1.1.4": "개인", "1.2.410.200005.1.1.6.2": "개인",
  "1.2.410.200005.1.1.5": "법인", "1.2.410.200005.1.1.2": "법인", "1.2.410.200005.1.1.6.1": "법인",
  "1.2.410.200004.5.4.1.1": "개인", "1.2.410.200004.5.4.1.101": "개인", "1.2.410.200004.5.4.1.2": "법인", "1.2.410.200004.5.4.1.102": "법인",
  "1.2.410.200004.5.1.1.5": "개인", "1.2.410.200004.5.1.1.9": "개인", "1.2.410.200004.5.1.1.7": "법인", "1.2.410.200004.5.1.1.12": "법인",
  "1.2.410.200004.5.2.1.2": "개인", "1.2.410.200004.5.2.1.7.1": "개인", "1.2.410.200004.5.2.1.1": "법인", "1.2.410.200004.5.2.1.7.2": "법인",
  "1.2.410.200012.1.1.1": "개인", "1.2.410.200012.1.1.101": "개인", "1.2.410.200012.1.1.3": "법인", "1.2.410.200012.1.1.103": "법인",
};
const ISSUER: Readonly<Record<string, string>> = {
  yessign: "금융결제원", crosscert: "한국전자인증", signkorea: "코스콤", kica: "한국정보인증", tradesign: "한국무역정보통신", ncasign: "한국전산원",
};

const kstDate = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

/** signCert.der 바이트 → 요약. 읽지 못하면 null. */
export function readNpkiCert(der: Uint8Array, now: Date = new Date()): NpkiCertInfo | null {
  try {
    const cert = readTlv(der, 0);
    const tbs = children(der, children(der, cert)[0]!);
    let i = tbs[0]?.tag === 0xa0 ? 1 : 0;
    const issuer = names(der, tbs[i + 2]!), validity = children(der, tbs[i + 3]!), subject = names(der, tbs[i + 4]!);
    i += 6;
    let kind: NpkiCertInfo["kind"] = null;
    const ext = tbs.find((t, k) => k >= i && t.tag === 0xa3);
    if (ext) for (const e of children(der, children(der, ext)[0]!)) {
      const parts = children(der, e);
      if (oid(der, parts[0]!) !== POLICIES) continue;
      const val = parts[parts.length - 1]!;
      for (const pi of children(der, readTlv(der, val.start))) {
        const k = POLICY_KIND[oid(der, children(der, pi)[0]!)];
        if (k) kind = k;
      }
    }
    const cn = subject.filter(([k]) => k === CN).map(([, v]) => v).pop() ?? "";
    const ous = subject.filter(([k]) => k === OU).map(([, v]) => v.toLowerCase());
    if (!kind && ous.some(v => /personal|개인/.test(v))) kind = "개인";
    if (!kind && ous.some(v => /corporat|법인|business/.test(v))) kind = "법인";
    const name = cn.replace(/\(\)?\d{6,}$/, "").replace(/\(\)$/, "").trim() || cn;
    if (!kind && /^\(주\)|주식회사|\(유\)|유한회사|\(사\)|법인/.test(name)) kind = "법인";
    const org = issuer.filter(([k]) => k === O).map(([, v]) => v).pop() ?? "";
    const notAfter = time(der, validity[1]!);
    return { name, kind, issuer: ISSUER[org.toLowerCase()] ?? org, notAfter: kstDate(notAfter), expired: notAfter.getTime() < now.getTime() };
  } catch {
    return null;
  }
}

/** 폴더·파일에서 찾은 인증서 후보. */
export type NpkiCandidate<F> =
  | { kind: "npki"; dir: string; cert: F; key: F }
  | { kind: "pfx"; dir: string; file: F };

const base = (p: string) => p.slice(p.lastIndexOf("/") + 1).toLowerCase();
const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");

/** 관심 있는 파일 이름인가(폴더를 훑을 때 다른 파일은 읽지 않는다). */
export function isCertFileName(name: string): boolean {
  return /\.(der|key|pfx|p12)$/i.test(name);
}

/**
 * 경로(`/` 구분, 폴더 기준 상대경로) 붙은 파일들 → 인증서 후보.
 * 같은 폴더의 signCert.der + signPri.key 를 한 장으로 묶는다(kmCert·kmPri 는 암호화용이라 뺀다).
 * 이름이 다르면 그 폴더에 .der·.key 가 하나씩일 때만 묶는다(파일을 직접 두 개 고른 경우).
 * .pfx·.p12 는 각각 한 장.
 */
export function groupCertFiles<F extends { path: string }>(files: readonly F[]): NpkiCandidate<F>[] {
  const byDir = new Map<string, F[]>();
  for (const f of files) {
    if (!isCertFileName(f.path)) continue;
    const d = dirOf(f.path);
    byDir.set(d, [...(byDir.get(d) ?? []), f]);
  }
  const out: NpkiCandidate<F>[] = [];
  for (const [dir, fs] of [...byDir.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const ders = fs.filter(f => /\.der$/i.test(f.path)), keys = fs.filter(f => /\.key$/i.test(f.path));
    const cert = ders.find(f => base(f.path) === "signcert.der") ?? (ders.length === 1 && !/^kmcert/.test(base(ders[0]!.path)) ? ders[0] : undefined);
    const key = keys.find(f => base(f.path) === "signpri.key") ?? (keys.length === 1 && !/^kmpri/.test(base(keys[0]!.path)) ? keys[0] : undefined);
    if (cert && key) out.push({ kind: "npki", dir, cert, key });
    for (const f of fs) if (/\.(pfx|p12)$/i.test(f.path)) out.push({ kind: "pfx", dir, file: f });
  }
  return out;
}
