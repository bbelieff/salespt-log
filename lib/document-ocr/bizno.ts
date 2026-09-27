/**
 * document-ocr/bizno — 사업자등록번호(10자리)·법인등록번호(13자리) 형식과 검증식.
 * 사업자등록번호 출처: MoaWork app/src/lib/document-ocr/bizno.ts (origin/main).
 *
 * 사업자등록번호(국세청): 앞 9자리 × [1,3,7,1,3,7,1,3,5] 합 + floor(9번째×5/10) →
 *   (10 − 합%10)%10 == 10번째 자리.
 * 법인등록번호: 앞 12자리 × [1,2,1,2,…] 합 → (10 − 합%10)%10 == 13번째 자리.
 */

const BIZ_WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5] as const;

export function digitsOnly(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

export function formatBizNo(raw: string): string {
  const d = digitsOnly(raw);
  if (!/^\d{10}$/.test(d)) return (raw || "").trim();
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export function isValidBizNo(raw: string): boolean {
  const d = digitsOnly(raw);
  if (!/^\d{10}$/.test(d)) return false;
  if (/^(\d)\1{9}$/.test(d)) return false; // 000-00-00000 같은 자리 채움
  const n = d.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += n[i]! * BIZ_WEIGHTS[i]!;
  sum += Math.floor((n[8]! * 5) / 10);
  return (10 - (sum % 10)) % 10 === n[9];
}

/** 텍스트에서 사업자등록번호 후보(XXX-XX-XXXXX / 10자리 연속)를 순서대로. */
export function findBizNoCandidates(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const d = digitsOnly(raw);
    if (!/^\d{10}$/.test(d) || seen.has(d)) return;
    seen.add(d);
    out.push(raw.trim());
  };
  (text.match(/(?<!\d)\d{3}\s*-\s*\d{2}\s*-\s*\d{5}(?!\d)/g) || []).forEach(push);
  (text.match(/(?<!\d)\d{10}(?!\d)/g) || []).forEach(push);
  return out;
}

export function formatCorpNo(raw: string): string {
  const d = digitsOnly(raw);
  if (!/^\d{13}$/.test(d)) return (raw || "").trim();
  return `${d.slice(0, 6)}-${d.slice(6)}`;
}

export function isValidCorpNo(raw: string): boolean {
  const d = digitsOnly(raw);
  if (!/^\d{13}$/.test(d)) return false;
  if (/^(\d)\1{12}$/.test(d)) return false;
  const n = d.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += n[i]! * (i % 2 === 0 ? 1 : 2);
  return (10 - (sum % 10)) % 10 === n[12];
}
