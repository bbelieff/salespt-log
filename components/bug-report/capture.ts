/**
 * 오류신고용 화면 캡처 — 실제 화면 그대로(2026-10-25 belie: 「다시 그린 캡처가 실제와 다르면 없는 오류가 신고된다」).
 * PC 크롬·엣지: 브라우저의 「이 탭 공유」 허락을 받아 지금 탭을 한 장만 찍고 바로 공유를 끈다.
 * 찍기 직전 전화번호·이름·계좌 칸과 그런 글자를 실제 화면에서 잠깐 회색으로 가린 뒤 되돌린다.
 * 휴대폰·사파리처럼 탭 찍기가 없거나 허락하지 않으면 null — 신고 창에서 직접 찍은 사진을 붙이게 한다.
 */
const MASK_CLASS = "bug-report-mask";
const FIELD_HINT = /전화|연락처|휴대|핸드폰|이름|성명|성함|대표자|담당자|계좌|예금주|주민|생년|비밀번호|PIN|아이디|이메일|주소/i;
/** 전화번호(010-1234-5678·01012345678) · 주민번호 · 계좌처럼 숫자가 길게 이어진 글자. */
const PRIVATE_TEXT = /(01[016789][\s.-]?\d{3,4}[\s.-]?\d{4})|(\d{6}[\s-]?[1-4]\d{6})|(\d{2,6}-\d{2,6}-\d{4,8})|([\w.+-]+@[\w-]+\.[\w.]+)/;

function fieldLabel(el: Element): string {
  const a = el.getAttribute.bind(el);
  const id = el.id ? [...document.querySelectorAll("label[for]")].find(l => l.getAttribute("for") === el.id)?.textContent ?? "" : "";
  return [a("aria-label"), a("name"), a("placeholder"), a("autocomplete"), id, el.closest("label")?.textContent ?? ""].join(" ");
}

/** 가릴 요소 목록 — 테스트에서도 쓴다. */
export function findPrivateElements(root: ParentNode = document): Element[] {
  const out = new Set<Element>();
  root.querySelectorAll("[data-private]").forEach(el => out.add(el));
  root.querySelectorAll("input,textarea,select").forEach(el => {
    const type = el.getAttribute("type") ?? "";
    if (type === "password" || type === "tel" || type === "email" || FIELD_HINT.test(fieldLabel(el))) out.add(el);
    else if ((el as HTMLInputElement).value && PRIVATE_TEXT.test((el as HTMLInputElement).value)) out.add(el);
  });
  // 표: 머리칸이 「대표자」「전화번호」처럼 사람 정보면 그 열 전체를 가린다.
  root.querySelectorAll("th").forEach(th => {
    if (!FIELD_HINT.test(th.textContent ?? "")) return;
    const table = th.closest("table"), col = (th as HTMLTableCellElement).cellIndex;
    table?.querySelectorAll("tbody tr").forEach(tr => { const cell = (tr as HTMLTableRowElement).cells[col]; if (cell) out.add(cell); });
  });
  const walker = document.createTreeWalker(root instanceof Document ? root.body : (root as Node), NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.textContent && PRIVATE_TEXT.test(n.textContent) && n.parentElement) out.add(n.parentElement);
  }
  return [...out];
}

/** 이 브라우저가 탭 찍기를 지원하는지(휴대폰·사파리 모바일은 아님). */
export function canCaptureTab(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function"
    && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** 긴 변 maxSide 이하 JPEG data URL 로. */
function toJpeg(source: CanvasImageSource, width: number, height: number, maxSide = 1600): string {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const c = document.createElement("canvas");
  c.width = Math.round(width * scale);
  c.height = Math.round(height * scale);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

/**
 * 실제 탭 한 장. 버튼 누름 처리 안에서 곧바로 불러야 한다(브라우저 허락 창은 누른 직후에만 뜬다).
 * settleMs: 허락 뒤 닫히는 창·가림이 실제 화면과 탭 영상에 반영될 시간. 실패·거절·미지원이면 null.
 */
export async function captureTab(settleMs = 600): Promise<string | null> {
  if (!canCaptureTab()) return null;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "browser", frameRate: 5 },
      audio: false,
      // 크롬: 지금 탭을 먼저 고르게 하는 힌트(다른 브라우저는 무시한다).
      preferCurrentTab: true, selfBrowserSurface: "include", surfaceSwitching: "exclude",
    } as DisplayMediaStreamOptions);
  } catch {
    return null; // 거절·취소
  }
  const masked = findPrivateElements();
  masked.forEach(el => el.classList.add(MASK_CLASS));
  const video = document.createElement("video");
  try {
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    await wait(settleMs);
    for (let i = 0; i < 20 && !video.videoWidth; i++) await wait(50);
    return video.videoWidth ? toJpeg(video, video.videoWidth, video.videoHeight) : null;
  } catch {
    return null;
  } finally {
    stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
    masked.forEach(el => el.classList.remove(MASK_CLASS));
  }
}

/** 붙여 넣거나 고른 사진(직접 찍은 캡처)을 긴 변 1600px JPEG 로 줄인다 — 크기 상한을 넘지 않게. */
export async function shrinkImage(file: Blob, maxSide = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image_load_failed"));
      i.src = url;
    });
    return toJpeg(img, img.naturalWidth, img.naturalHeight, maxSide);
  } finally {
    URL.revokeObjectURL(url);
  }
}
