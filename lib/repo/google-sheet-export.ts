/**
 * 구글시트 공유 주소에서 표를 CSV 로 내려받는다(DB 가져오기, 2026-10-24 belie).
 * 「링크가 있는 모든 사용자」로 공유된 시트만 읽힌다 — 로그인 화면(HTML)이 오면 공유 안내 오류.
 * 주소는 docs.google.com 의 문서 id 로만 만들고(parseGoogleSheetUrl), 넘어가는 곳도 구글 도메인만 허용한다.
 * 고객 원문은 저장·기록하지 않고 그대로 돌려준다.
 */
import { googleSheetCsvUrl, parseGoogleSheetUrl } from "@/util/google-sheet-url";

export class GoogleSheetImportError extends Error {}

const MAX_BYTES = 5 * 1024 * 1024;
const allowedHost = (host: string) => host === "docs.google.com" || host.endsWith(".googleusercontent.com");

export async function fetchGoogleSheetCsv(shareUrl: string, fetcher: typeof fetch = fetch): Promise<string> {
  const ref = parseGoogleSheetUrl(shareUrl);
  if (!ref) throw new GoogleSheetImportError("구글시트 공유 주소(docs.google.com/spreadsheets/…)를 넣어 주세요.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    let url = googleSheetCsvUrl(ref);
    let res: Response | null = null;
    // 리다이렉트를 직접 따라가며 구글 도메인만 허용한다(최대 5번).
    for (let hop = 0; hop < 5; hop++) {
      res = await fetcher(url, { redirect: "manual", signal: controller.signal, headers: { accept: "text/csv" } });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        if (!next) break;
        const target = new URL(next, url);
        if (target.protocol !== "https:" || !allowedHost(target.hostname)) throw new GoogleSheetImportError("구글시트를 읽지 못했어요. 공유 설정을 「링크가 있는 모든 사용자」로 바꿔 주세요.");
        url = target.toString();
        continue;
      }
      break;
    }
    if (!res || !res.ok) throw new GoogleSheetImportError(res && (res.status === 401 || res.status === 403 || res.status === 404)
      ? "구글시트를 열 수 없어요. 공유 설정을 「링크가 있는 모든 사용자 · 뷰어」로 바꿔 주세요."
      : "구글시트를 내려받지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    const type = res.headers.get("content-type") ?? "";
    if (/text\/html/i.test(type)) throw new GoogleSheetImportError("구글시트가 비공개예요. 공유 설정을 「링크가 있는 모든 사용자 · 뷰어」로 바꿔 주세요.");
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) throw new GoogleSheetImportError("5MB 이하 시트만 가져올 수 있어요. 필요한 범위만 새 탭에 옮겨 주세요.");
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) throw new GoogleSheetImportError("5MB 이하 시트만 가져올 수 있어요. 필요한 범위만 새 탭에 옮겨 주세요.");
    const text = new TextDecoder("utf-8").decode(buffer).replace(/^﻿/, "");
    if (/^\s*<(!doctype|html)/i.test(text)) throw new GoogleSheetImportError("구글시트가 비공개예요. 공유 설정을 「링크가 있는 모든 사용자 · 뷰어」로 바꿔 주세요.");
    if (!text.trim()) throw new GoogleSheetImportError("시트가 비어 있어요. 고객 정보가 있는 탭 주소인지 확인해 주세요.");
    return text;
  } catch (error) {
    if (error instanceof GoogleSheetImportError) throw error;
    throw new GoogleSheetImportError("구글시트를 내려받지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  } finally {
    clearTimeout(timer);
  }
}
