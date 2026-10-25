/**
 * 최근 화면 오류 10개를 메모리에만 모아 둔다(오류신고에 붙이는 용도, 저장·전송 없음).
 * 메시지 안의 숫자 9자리 이상(전화·계좌)과 이메일은 지운다.
 */
const MAX = 10;
const recent: string[] = [];
let installed = false;

export function scrubText(s: string): string {
  return s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[이메일]").replace(/\d[\d\s-]{7,}\d/g, "[숫자]").slice(0, 300);
}

function push(message: string) {
  const line = `${new Date().toISOString().slice(11, 19)} ${scrubText(message)}`;
  recent.push(line);
  if (recent.length > MAX) recent.shift();
}

export function installErrorLog(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", e => push(e.message || "알 수 없는 오류"));
  window.addEventListener("unhandledrejection", e => {
    const r: unknown = e.reason;
    push(r instanceof Error ? r.message : typeof r === "string" ? r : "처리되지 않은 오류");
  });
}

export function recentErrors(): string[] {
  return [...recent];
}
