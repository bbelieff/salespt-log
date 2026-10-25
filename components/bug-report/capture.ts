/**
 * 오류신고용 화면 캡처 — 지금 보이는 부분만 JPEG 로(html-to-image).
 * 찍기 전에 전화번호·이름·계좌 칸과 그런 글자를 회색 막대로 가리고, 찍은 뒤 되돌린다.
 * 한계: 안쪽에서 따로 스크롤되는 영역(DB관리시트 표 등)은 맨 위 기준으로 찍힌다 — 그때는 직접 캡처를 붙여 넣게 안내한다.
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

export async function captureViewport(): Promise<string> {
  const { toCanvas } = await import("html-to-image");
  const masked = findPrivateElements();
  masked.forEach(el => el.classList.add(MASK_CLASS));
  try {
    const full = await toCanvas(document.body, {
      pixelRatio: 1,
      cacheBust: false,
      skipFonts: true,
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
      filter: node => !(node instanceof HTMLElement && node.hasAttribute("data-bug-report-exclude")),
    });
    const w = window.innerWidth, h = window.innerHeight;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d");
    if (!ctx) throw new Error("canvas_unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(full, window.scrollX, window.scrollY, w, h, 0, 0, w, h);
    return out.toDataURL("image/jpeg", 0.8);
  } finally {
    masked.forEach(el => el.classList.remove(MASK_CLASS));
  }
}

/** 붙여 넣은 이미지(직접 캡처)를 긴 변 1600px JPEG 로 줄인다 — 크기 상한을 넘지 않게. */
export async function shrinkImage(file: Blob, maxSide = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image_load_failed"));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("canvas_unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}
