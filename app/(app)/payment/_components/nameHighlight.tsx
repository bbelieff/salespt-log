/** 업체명 검색어 <mark> 하이라이트 — ContractRow 500줄 캡으로 분리(contract-termination PR).
 * 대소문자·공백 무시 매칭은 page 필터와 동일 기준이되, 표시는 원문 그대로
 * (공백 제거 매칭으로 인한 부분 불일치 시 하이라이트 생략). */

export function fmtMoney(n: number): string {
  return n.toLocaleString("ko-KR");
}

export function fmtDate(s: string): string {
  if (!s) return "—";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${parseInt(m[2]!, 10)}/${parseInt(m[3]!, 10)}`;
}

export function renderNameWithHighlight(name: string, q?: string) {
  const display = name || "(업체명 없음)";
  const query = (q ?? "").trim();
  if (!query || !name) return display;
  const i = name.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return display; // 공백-무시 매칭으로만 걸린 경우 — 하이라이트 생략
  return (
    <>
      {name.slice(0, i)}
      <mark className="rounded-sm bg-yellow-100 text-inherit">
        {name.slice(i, i + query.length)}
      </mark>
      {name.slice(i + query.length)}
    </>
  );
}
