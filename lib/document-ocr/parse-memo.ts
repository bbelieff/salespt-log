/**
 * document-ocr/parse-memo — 미팅하며 메모장에 적은 글(txt) → 업체정보 칸 제안 + 계정 보관함 항목 + 남은 메모
 * (belie 2026-10-08).
 *
 * - "● 라벨 <탭/공백 2칸+> 값" 줄을 항목으로 읽고, 들여쓴 다음 줄은 위 항목 값에 잇는다(매출 여러 해).
 * - 아이디·비번·계좌·주민번호 전체는 칸이 아니라 vault 로만 보낸다 — fields·info·경고·leftover 에는 싣지 않는다.
 * - 칸에 안 맞는 줄(">>" 질문, "=====" 아래 자유 메모, 모르는 라벨)은 leftover — 「기타메모에 붙이기」 용.
 * - 이메일(company-info-email 2026-10): 라벨이 이메일/메일/E-mail 이거나 값 첫 줄이 이메일 모양뿐이면 [대표자]
 *   이메일 칸 제안. 대표·사업장·연락처 분기보다 **먼저** 본다("대표 이메일"이 대표자이름으로 가지 않게). 계정 라벨
 *   ("이메일 아이디 / 비번"·"이메일 id/pw"·"이메일 로그인" — 영문은 대소문자 무시)은 그대로 보관함. 이메일 칸에는
 *   "@" 조각만 넣고, 같은 줄의 영문·숫자 조각(비밀번호일 수 있음)은 보관함으로, 한글 메모는 버린다.
 *   "연락처/이메일" 한 줄은 주소 모양(로컬부@도메인) 조각만 이메일 칸, 나머지는 연락처 칸("@카톡"은 연락처에 남는다).
 *   모양이 아닌 이메일 후보는 valid:false — 비교표에서 기본으로 체크하지 않는다.
 * 초안: Muse(muse-spark-1.3-contributor) — 총괄 검수.
 */
import { looksLikeContactEmail, tidyContactEmail } from "@/util/contact-email";
import { wonToMillion, parseSalesAmount } from "@/util/company-money";
import { salesSlotOf, SALES_YEAR_KEYS, SALES_HALF_KEYS } from "@/util/company-sales";
import { formatBizNo, isValidBizNo } from "./bizno";
import { normalizeRrnFront } from "@/util/rrn-front";
import type { DocParseContext, DocParseResult, ParsedField } from "./types";
import type { VaultItem } from "@/types/company-vault";

export type MemoParseResult = DocParseResult & {
  /** 계정 보관함으로 갈 항목 — 아이디/비번·계좌·주민번호 전체. 제안일 뿐, 사용자가 체크해야 들어간다. */
  vault: VaultItem[];
  /** 칸에 안 맞는 나머지 메모 줄(보관함으로 간 줄 제외) — "기타메모에 붙이기" 용. */
  leftover: string;
};

const BANKS = ["농협", "국민", "기업", "신한", "우리", "하나", "카카오", "IBK", "NH", "수협", "우체국", "토스", "부산", "대구"];
// 계정 기관 이름 — 아이디·비번 같은 말은 isCredentialLabel(아래)이 따로 본다.
const ACCOUNT_LABELS = ["공동인증서", "인증서", "소진공", "홈택스", "위택스", "정부24", "은행"];
// 영문 계정 라벨 — 대소문자 무시, 영문 단어 경계로만("id/pw"·"공동인증서ID"는 계정, "video" 의 id 는 아님).
const LATIN_ID = /(?:^|[^a-z])(?:id|idpw|login)(?:[^a-z]|$)/i;
const LATIN_SECRET = /(?:^|[^a-z])(?:pw|idpw|password|passwd)(?:[^a-z]|$)/i;
const PHONE_LABELS = ["휴대폰", "휴대전화", "전화번호", "연락처"];
const EMAIL_WARN = "이메일 모양이 아니에요. 확인해 주세요.";
const AT = /[@＠]/;

function isBullet(line: string): boolean {
  return /^\s*[●•-]/.test(line);
}

// "● 라벨  값" 을 나눈다
function splitItem(line: string): { label: string; value: string } | null {
  if (!isBullet(line)) return null;
  const rest = line.replace(/^\s*[●•-]\s*/, "");
  const m = rest.match(/^(.*?)(?:\t| {2,})\s*([\s\S]*)$/);
  const label = (m ? m[1]! : rest).trim().replace(/[?:：\s]+$/, "");
  const value = (m ? m[2]! : "").trim();
  return { label, value };
}

const noSpace = (s: string) => s.replace(/\s+/g, "");

function has(hay: string, ...needs: string[]): boolean {
  const h = noSpace(hay);
  return needs.some((n) => h.includes(noSpace(n)));
}

const isEmailLabel = (label: string) => has(label, "이메일", "메일") || /e-?mail/i.test(noSpace(label));
const isSecretLabel = (label: string) => has(label, "비번", "비밀번호", "패스워드") || LATIN_SECRET.test(label);
const isIdLabel = (label: string) => has(label, "아이디") || LATIN_ID.test(label);
/** 아이디·비번·로그인을 직접 말하는 라벨 — 다른 칸 분기보다 먼저 보관함으로. */
const isCredentialLabel = (label: string) => isIdLabel(label) || isSecretLabel(label) || has(label, "로그인", "계정");
/** 계정 라벨(기관 이름 포함) — 이 줄은 칸이 아니라 보관함으로만 간다. */
const isAccountLabel = (label: string) => has(label, ...ACCOUNT_LABELS) || isCredentialLabel(label);

/** 값 한 줄을 조각으로 — 공백·쉼표·세미콜론·"/" 로 나눈다("010-0000-0000(KT) / a@b.co"). */
const wordsOf = (line: string) => line.split(/[\s,;/]+/).filter(Boolean);
/** 로컬부·도메인이 다 있는 이메일 조각("a@b.co") — "@카톡" 같은 메모는 아니다. */
const isEmailPiece = (w: string) => AT.test(w) && looksLikeContactEmail(tidyContactEmail(w));
/** 이메일 줄의 "@" 없는 조각 중 비밀번호일 수 있는 것 — 한글이 없고 괄호만도 아닌 조각. */
const secretWordsOf = (words: string[]) =>
  words.filter((w) => !AT.test(w) && !/[가-힣]/.test(w) && w.replace(/[()（）[\]]/g, "") !== "");

const fullYear = (yy: string) => (yy.length === 4 ? Number(yy) : 2000 + Number(yy));
const pad2 = (s: string) => String(Number(s)).padStart(2, "0");

// 괄호를 떼고 개업일을 YYYY-MM(-DD) 로
function toOpenDate(raw: string): string {
  const v = raw.replace(/\([^)]*\)/g, " ").trim();
  const long = v.match(/(\d{4})\s*[.\-년/]\s*(\d{1,2})(?:\s*[.\-월/]\s*(\d{1,2}))?/);
  const short = long ? null : v.match(/(\d{2})\s*년\s*(\d{1,2})\s*월(?:\s*(\d{1,2})\s*일?)?/);
  const m = long ?? short;
  if (!m) return v;
  const ym = `${long ? m[1] : fullYear(m[1]!)}-${pad2(m[2]!)}`;
  return m[3] ? `${ym}-${pad2(m[3])}` : ym;
}

// 계정 라벨에서 이름만 남긴다
function cleanAccountLabel(label: string): string {
  const c = label
    .replace(/비밀번호|비번|아이디|패스워드/gi, " ")
    .replace(/\bID\b|\bPW\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s/]+|[\s/]+$/g, "") // "이메일 id / pw" → "이메일"(남은 "/" 정리)
    .trim();
  return c || label.trim();
}

function accountIn(line: string): string | null {
  for (const m of line.match(/\d{3,6}(?:-\d{2,6}){1,4}/g) ?? []) {
    const d = m.replace(/\D/g, "").length;
    if (d >= 10 && d <= 16) return m;
  }
  return null;
}

// 혼자 적힌 비밀번호 모양인지 본다
function isPasswordLine(s: string): boolean {
  const t = s.trim();
  if (!/^\S{6,32}$/.test(t)) return false;
  if (/[가-힣]/.test(t)) return false;
  if (!/[A-Za-z]/.test(t) || !/[0-9]/.test(t)) return false;
  if (t.includes("@")) return false;
  if (!/[^A-Za-z0-9]/.test(t) && !(/[a-z]/.test(t) && /[A-Z]/.test(t))) return false;
  if (accountIn(t)) return false;
  if (/^\*?\d{1,2}\/\d{1,2}$/.test(t)) return false;
  return true;
}

/** "아이디 / 비번" · "비번//" · 값 하나 → 보관함 항목. */
function loginOf(label: string, value: string): VaultItem {
  let id = "";
  let secret = "";
  if (value.includes("/")) {
    const parts = value.split("/").map((s) => s.trim());
    const back = parts.slice(1).join("/").replace(/^\/+/, "").trim();
    if (back) { id = parts[0] ?? ""; secret = back; } else secret = parts[0] ?? "";
  } else if (isSecretLabel(label)) secret = value;
  else if (isIdLabel(label) || AT.test(value)) id = value; // "이메일 로그인  a@b.co" — 주소는 아이디 쪽
  else secret = value;
  return { kind: "login", label: cleanAccountLabel(label), id, secret, note: "" };
}

export function parseMeetingMemo(text: string, ctx?: DocParseContext): MemoParseResult {
  const baseYear = ctx?.baseYear ?? new Date().getFullYear();
  const fields: ParsedField[] = [];
  const documentWarnings: string[] = [];
  const info: { label: string; value: string }[] = [];
  const vault: VaultItem[] = [];
  const leftover: string[] = [];

  const lines = text.replace(/\r/g, "").split("\n");
  const sepIdx = lines.findIndex((l) => /^\s*={5,}\s*$/.test(l));
  const head = sepIdx >= 0 ? lines.slice(0, sepIdx) : lines;
  const tail = sepIdx >= 0 ? lines.slice(sepIdx + 1) : [];

  // 첫 줄이 제목이면 상호·대표자를 챙긴다
  let repName = "";
  let start = 0;
  const firstIdx = head.findIndex((l) => l.trim() !== "");
  if (firstIdx >= 0 && !isBullet(head[firstIdx]!)) {
    const parts = head[firstIdx]!.trim().split("/").map((s) => s.trim().replace(/^\[(.*)\]$/, "$1").trim());
    if (parts[0]) info.push({ label: "상호", value: parts[0] });
    if (parts[1]) {
      repName = parts[1];
      fields.push({ key: "대표자이름", value: repName, confidence: 0.7, warnings: [] });
    }
    start = firstIdx + 1;
  }

  // 항목을 모으고 들여쓴 줄을 위 항목에 잇는다
  const items: { label: string; value: string }[] = [];
  for (let i = start; i < head.length; i++) {
    const line = head[i]!;
    if (line.trim() === "") continue;
    const it = splitItem(line);
    if (it) {
      items.push(it);
      continue;
    }
    if (/^(?:\s{3,}|\t)/.test(line) && items.length > 0) {
      items[items.length - 1]!.value += `\n${line.trim()}`;
      continue;
    }
    leftover.push(line.trim().replace(/^>>\s*/, ""));
  }

  const usedSales = new Set<string>();
  const push = (key: ParsedField["key"], value: string, confidence = 0.8, warnings: string[] = []) => {
    if (value) fields.push({ key, value, confidence, warnings });
  };
  // 이메일은 적은 그대로 제안 — 모양이 아니면 정확도를 낮추고 확인을 요청하며 기본 체크를 끈다(valid:false).
  const pushEmail = (raw: string) => {
    const v = tidyContactEmail(raw);
    if (!v) return;
    const ok = looksLikeContactEmail(v);
    fields.push({ key: "이메일", value: v, confidence: ok ? 0.9 : 0.5, warnings: ok ? [] : [EMAIL_WARN], ...(ok ? {} : { valid: false }) });
  };
  // 계정은 칸으로 안 가고 보관함으로 — 같은 이름에 빈 쪽만 채우고, 다 찼으면 원래 라벨로 따로 둔다.
  const addLogin = (label: string, value: string) => {
    if (!value) return;
    const item = loginOf(label, value);
    const same = vault.find((x) => x.kind === "login" && x.label === item.label);
    if (same && !(same.id && item.id) && !(same.secret && item.secret)) {
      same.id ||= item.id;
      same.secret ||= item.secret;
    } else vault.push(same ? { ...item, label: label.trim() } : item);
  };
  // 이메일 라벨 줄 — 이메일 칸에는 "@" 조각만. 영문·숫자 조각(비밀번호일 수 있음)은 보관함, 한글 메모는 버린다.
  const pushEmailLine = (label: string, first: string, words: string[]) => {
    const at = words.filter((w) => AT.test(w));
    if (at.length === 0) {
      if (isPasswordLine(first)) vault.push({ kind: "other", label: `${label.trim()}(어느 계정인지 확인)`, id: "", secret: first, note: "" });
      else pushEmail(first); // "ceo.example.com" 같은 오타 — 모양 안내와 함께 제안(기본 체크 없음)
      return;
    }
    pushEmail(at.join(", "));
    const secret = secretWordsOf(words);
    if (secret.length > 0) {
      vault.push({ kind: "login", label: cleanAccountLabel(label), id: at.join(", "), secret: secret.join(" "), note: "" });
    }
  };

  for (const { label, value: rawValue } of items) {
    const value = rawValue.trim();
    if (!label) continue;
    const first = value.split("\n")[0]!.trim();
    const words = wordsOf(first);
    const phoneLabel = has(label, ...PHONE_LABELS);
    const emailOnly = words.length > 0 && words.every(isEmailPiece);

    if (!isAccountLabel(label) && (isEmailLabel(label) || emailOnly || (phoneLabel && words.some(isEmailPiece)))) {
      // 대표·사업장·연락처 분기보다 먼저 — "대표 이메일"·"사업장 메일"이 대표자이름·소재지로 가지 않게.
      if (phoneLabel) {
        // 「연락처/이메일」처럼 라벨이 이메일을 말하면 "@" 조각은 모양이 틀려도 이메일 후보(안내·기본 체크 없음),
        // 연락처만 말하면 주소 모양 조각만 — "@카톡" 같은 메모는 연락처에 남긴다.
        const pick = isEmailLabel(label) ? (w: string) => AT.test(w) : isEmailPiece;
        pushEmail(words.filter(pick).join(", "));
        push("연락처통신사", words.filter((w) => !pick(w)).join(" ").replace(/\(\s*\)/g, "").trim());
      } else pushEmailLine(label, first, words);
    } else if (isCredentialLabel(label)) {
      // 아이디·비번·로그인 라벨은 대표·연락처 분기보다 먼저 보관함으로("대표 이메일 id/pw"가 대표자이름으로 가지 않게).
      // 기관 이름만 있는 라벨(은행·홈택스 …)은 아래 원래 자리 — "기존 은행 대출"은 기대출 칸 그대로.
      addLogin(label, value);
    } else if (has(label, "대표자", "대표")) {
      repName = value.split("\n")[0]!.trim() || repName;
      push("대표자이름", repName);
    } else if (has(label, "창업일자", "창업연월", "개업일")) {
      push("개업일", toOpenDate(value));
    } else if (has(label, "업종")) {
      push("업종주생산품목", value);
    } else if (has(label, "아이템") && !has(label, "특허", "인증")) {
      push("주생산품목", value);
    } else if (has(label, "사업자등록번호")) {
      const ok = isValidBizNo(value);
      fields.push({
        key: "사업자등록번호",
        value: formatBizNo(value),
        confidence: 0.9,
        warnings: ok ? [] : ["사업자등록번호 형식이 맞지 않아요. 확인해 주세요."],
        valid: ok,
      });
    } else if (has(label, "사업장", "사업자소재지", "소재지")) {
      push("소재지", value);
    } else if (has(label, "자택")) {
      const m = value.match(/^\((자가|전세|월세)\)\s*/);
      push("자택주소지", m ? value.slice(m[0].length).trim() : value);
      if (m) info.push({ label: "자택 소유", value: m[1]! });
    } else if (phoneLabel) {
      push("연락처통신사", value.replace(/\(\s*\)/g, "").trim());
    } else if (has(label, "주민등록번호")) {
      const m = value.match(/\d{6}\s*-?\s*\d{7}/);
      const front = value.match(/\d{6}/);
      if (m) {
        const d = m[0].replace(/\D/g, "");
        const full = `${d.slice(0, 6)}-${d.slice(6)}`;
        push("주민등록번호", normalizeRrnFront(full), 0.9);
        vault.push({ kind: "rrn", label: "대표자 주민번호", id: repName, secret: full, note: "" });
      } else if (front) push("주민등록번호", normalizeRrnFront(front[0]), 0.9);
    } else if (has(label, "생년월일")) {
      const d = value.replace(/\D/g, "");
      push("대표자생년월일", d.length === 6 ? `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 6)}` : value);
    } else if (has(label, "신용점수")) {
      push("신용점수", value);
    } else if ((has(label, "기존") && has(label, "대출")) || has(label, "정책자금", "기대출")) {
      push("기대출사업자", value, 0.6, ["개인·사업자 대출을 나눠 확인해 주세요."]);
    } else if (has(label, "4대보험", "직원수")) {
      push("사대보험직원", value);
    } else if (isAccountLabel(label)) {
      addLogin(label, value);
    } else if (has(label, "인증", "특허")) {
      push("특허및인증", value);
    } else if (has(label, "매출") || /^(20)?\d{2}년/.test(noSpace(label))) {
      readSales(label, value);
    } else {
      const oneLine = value.replace(/\n/g, " ").trim();
      leftover.push(oneLine ? `${label}: ${oneLine}` : `${label}:`);
    }
  }

  function readSales(label: string, value: string) {
    const lm = noSpace(label).match(/(20\d{2}|\d{2})년/);
    const labelYear = lm ? fullYear(lm[1]!) : null;
    for (const rawLine of value.split("\n").map((s) => s.trim()).filter(Boolean)) {
      const memos = [...rawLine.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]!.trim()).filter(Boolean);
      const deParen = rawLine.replace(/\([^)]*\)/g, " ").trim();
      const ym = deParen.match(/^\s*(20\d{2}|\d{2})\s*년(?:도)?\s*(.*)$/);
      const year = ym ? fullYear(ym[1]!) : labelYear;
      const amt = (ym ? ym[2]! : deParen).trim();
      if (year == null || !amt) continue;
      const yy = String(year).slice(2);
      let r = parseSalesAmount(amt);
      let lowConf = false;
      if (!r && /^[\d,]+$/.test(amt)) {
        r = parseSalesAmount(amt, { bareUnit: 1e4 });
        lowConf = !!r;
      }
      if (!r) {
        documentWarnings.push(`${yy}년 매출 '${amt}'는 범위라 직접 적어 주세요.`);
        continue;
      }
      const slot = salesSlotOf(year, baseYear);
      if (slot == null) {
        documentWarnings.push(`${yy}년 매출은 표(최근 4년) 밖이라 넣지 않았어요.`);
        continue;
      }
      const month = r.month ?? (memos.join(" ").match(/(\d{1,2})\s*월/) ? Number(memos.join(" ").match(/(\d{1,2})\s*월/)![1]) : null);
      const half = `${label} ${rawLine}`;
      const upper = half.includes("상반기") || (month != null && month >= 1 && month <= 6);
      const lower = half.includes("하반기") || (month != null && month >= 7 && month <= 12);
      const key = upper ? SALES_HALF_KEYS[slot]![0] : lower ? SALES_HALF_KEYS[slot]![1] : SALES_YEAR_KEYS[slot]!;
      if (usedSales.has(key)) continue;
      usedSales.add(key);
      const warns = memos.map((m) => `메모: ${m}`);
      if (lowConf) warns.push("단위가 없어 만원으로 읽었어요. 확인해 주세요.");
      fields.push({ key, value: wonToMillion(r.won), confidence: lowConf ? 0.4 : 0.8, warnings: warns, sourceWon: r.won });
    }
  }

  // "=====" 아래 자유 메모 — 아이디 줄, 계좌, 따로 적힌 비밀번호를 보관함으로
  const free = tail.map((l) => l.trim());
  const used = free.map(() => false);
  const bankNear = (idx: number): string | null => {
    for (let j = idx - 1; j >= 0 && j >= idx - 2; j--) {
      if (free[j] && BANKS.some((b) => free[j]!.toUpperCase().includes(b.toUpperCase()))) return free[j]!;
    }
    return null;
  };
  for (let i = 0; i < free.length; i++) {
    if (free[i] !== "아이디") continue;
    let j = i + 1;
    while (j < free.length && free[j] === "") j++;
    if (j < free.length) {
      vault.push({ kind: "login", label: "아이디(메모)", id: free[j]!, secret: "", note: "" });
      used[i] = used[j] = true;
    }
  }
  for (let i = 0; i < free.length; i++) {
    if (used[i] || !free[i]) continue;
    const acc = accountIn(free[i]!);
    if (!acc) continue;
    const near = bankNear(i);
    vault.push({ kind: "bank", label: free[i]!.replace(acc, "").trim() || near || "계좌", id: "", secret: acc, note: "" });
    used[i] = true;
    // 은행 이름만 적힌 바로 위 줄도 보관함 항목에 녹였으니 메모에서 뺀다.
    const nearIdx = near ? free.lastIndexOf(near, i - 1) : -1;
    if (nearIdx >= 0 && !accountIn(free[nearIdx]!) && free[nearIdx]!.length <= 12) used[nearIdx] = true;
  }
  for (let i = 0; i < free.length; i++) {
    if (used[i] || !free[i] || !isPasswordLine(free[i]!)) continue;
    vault.push({ kind: "other", label: "비밀번호(어느 계정인지 확인)", id: "", secret: free[i]!, note: "메모에 따로 적힌 값" });
    used[i] = true;
  }
  for (let i = 0; i < free.length; i++) if (!used[i]) leftover.push(free[i]!);

  // 뒤늦게 안 대표자 이름을 주민번호 보관함에 채운다
  for (const v of vault) if (v.kind === "rrn" && !v.id) v.id = repName;

  if (vault.length > 0) documentWarnings.push(`계정·계좌 ${vault.length}건은 계정 보관함으로 옮길 수 있어요.`);

  const out: string[] = [];
  for (const l of leftover) {
    if (l.trim() === "") {
      if (out.length > 0 && out[out.length - 1] !== "") out.push("");
    } else out.push(l);
  }
  return { fields, documentWarnings, info, vault, leftover: out.join("\n").trim() };
}
