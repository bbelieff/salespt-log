/**
 * 같은 사이트 /api 쓰기 요청(GET·HEAD 외)에 이 탭의 신원 지문을 머리말로 싣는다.
 * 서버가 지금 신원과 다르면 저장을 거부한다(lib/auth/tab-identity.ts). 지문을 아직 모르면 싣지 않는다.
 */
import { TAB_IDENTITY_HEADER } from "@/auth/tab-identity";

export function shouldStamp(url: string, method: string, origin: string): boolean {
  if (/^(GET|HEAD)$/i.test(method)) return false;
  try {
    const u = new URL(url, origin);
    return u.origin === origin && u.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

/** window.fetch 를 감싼다. 되돌리는 함수를 돌려준다. */
export function installTabIdentityStamp(getFingerprint: () => string | null): () => void {
  const original = window.fetch;
  const wrapped: typeof fetch = (input, init) => {
    const fp = getFingerprint();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (!fp || !shouldStamp(url, method, window.location.origin)) return original(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(TAB_IDENTITY_HEADER, fp);
    return original(input, { ...init, headers });
  };
  window.fetch = wrapped;
  return () => { if (window.fetch === wrapped) window.fetch = original; };
}
