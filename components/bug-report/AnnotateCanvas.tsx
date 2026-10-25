"use client";
/**
 * 캡처 위에 빨간 표시를 그리는 그림판 — 박스(끌기) · 펜(체크·동그라미) · 글자(누른 자리에 입력 후 Enter).
 * 되돌리기·전체 지우기 · 「완료」를 누르면 표시를 합친 JPEG 와 표시 개수를 돌려준다. 색은 빨강 하나.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type Pt = { x: number; y: number };
type Shape = { t: "box"; x: number; y: number; w: number; h: number } | { t: "pen"; pts: Pt[] } | { t: "text"; x: number; y: number; s: string };
type Tool = "box" | "pen" | "text";
const RED = "#dc2626";
const TOOLS: { id: Tool; label: string }[] = [{ id: "box", label: "□ 박스" }, { id: "pen", label: "✎ 펜" }, { id: "text", label: "T 글자" }];

export default function AnnotateCanvas({ src, onDone, onCancel }: { src: string; onDone: (image: string, marks: number) => void; onCancel: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const draft = useRef<(Shape & { ox?: number; oy?: number }) | null>(null);
  const [tool, setTool] = useState<Tool>("box");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [typing, setTyping] = useState<{ at: Pt; left: number; top: number } | null>(null);
  const [text, setText] = useState("");
  const textbox = useRef<HTMLInputElement>(null);
  useEffect(() => { if (typing) requestAnimationFrame(() => textbox.current?.focus({ preventScroll: true })); }, [typing]);

  const scale = () => {
    const c = canvas.current!;
    return Math.max(1, c.width / 900); // 큰 캡처에서도 선·글자가 같은 굵기로 보이게
  };
  const redraw = (list: Shape[]) => {
    const c = canvas.current, img = image.current, ctx = c?.getContext("2d");
    if (!c || !img || !ctx) return;
    const k = scale();
    ctx.drawImage(img, 0, 0, c.width, c.height);
    ctx.strokeStyle = RED; ctx.lineWidth = 4 * k; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const s of draft.current ? [...list, draft.current] : list) {
      if (s.t === "box") ctx.strokeRect(s.x, s.y, s.w, s.h);
      else if (s.t === "pen") { ctx.beginPath(); s.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); }
      else {
        ctx.font = `bold ${Math.round(20 * k)}px sans-serif`;
        const w = ctx.measureText(s.s).width;
        ctx.fillStyle = "#ffffffee"; ctx.fillRect(s.x - 4 * k, s.y - 20 * k, w + 8 * k, 28 * k);
        ctx.fillStyle = RED; ctx.fillText(s.s, s.x, s.y);
      }
    }
  };

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      image.current = img;
      const c = canvas.current;
      if (!c) return;
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      redraw([]);
    };
    img.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 캡처가 바뀔 때만 다시 불러온다
  }, [src]);
  useEffect(() => { redraw(shapes); }, [shapes]); // eslint-disable-line react-hooks/exhaustive-deps

  const pos = (e: ReactPointerEvent): Pt => {
    const c = canvas.current!, r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height };
  };
  const down = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const p = pos(e);
    if (tool === "text") {
      e.preventDefault(); // 누른 직후 초점이 그림판으로 옮겨 가 글자 칸이 바로 닫히지 않게
      const r = e.currentTarget.getBoundingClientRect();
      commitText();
      setTyping({ at: p, left: e.clientX - r.left, top: e.clientY - r.top - 14 });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    draft.current = tool === "box" ? { t: "box", x: p.x, y: p.y, w: 0, h: 0, ox: p.x, oy: p.y } : { t: "pen", pts: [p] };
  };
  const move = (e: ReactPointerEvent) => {
    const d = draft.current;
    if (!d) return;
    const p = pos(e);
    if (d.t === "box") { d.x = Math.min(p.x, d.ox!); d.y = Math.min(p.y, d.oy!); d.w = Math.abs(p.x - d.ox!); d.h = Math.abs(p.y - d.oy!); }
    else if (d.t === "pen") d.pts.push(p);
    redraw(shapes);
  };
  const up = () => {
    const d = draft.current;
    draft.current = null;
    if (d && (d.t === "pen" ? d.pts.length > 1 : d.t === "box" && d.w > 4 && d.h > 4)) {
      const { ox: _ox, oy: _oy, ...shape } = d;
      setShapes(list => [...list, shape as Shape]);
    } else redraw(shapes);
  };
  /** Enter 와 칸 닫힘(blur)이 연달아 와도 한 번만 넣는다 — 최신 값은 ref 로 읽는다. */
  const live = useRef({ typing, text });
  live.current = { typing, text };
  function commitText() {
    const { typing: at, text: value } = live.current;
    live.current = { typing: null, text: "" };
    const s = value.trim();
    if (at && s) setShapes(list => [...list, { t: "text", x: at.at.x, y: at.at.y, s }]);
    setTyping(null); setText("");
  }
  const finish = () => {
    const pending = live.current.typing && live.current.text.trim() ? 1 : 0;
    commitText();
    // 상태 반영(다시 그리기) 뒤에 꺼내 마지막 글자까지 합친다.
    setTimeout(() => {
      const c = canvas.current;
      if (c) onDone(c.toDataURL("image/jpeg", 0.85), shapes.length + pending);
    }, 0);
  };

  return <div className="br-annotate">
    <div className="br-tools" role="toolbar" aria-label="그리기 도구">
      {TOOLS.map(t => <button key={t.id} type="button" className="br-tool" aria-pressed={tool === t.id} onClick={() => { commitText(); setTool(t.id); }}>{t.label}</button>)}
      <button type="button" className="br-tool" onClick={() => setShapes(list => list.slice(0, -1))} disabled={!shapes.length}>↶ 되돌리기</button>
      <button type="button" className="br-tool" onClick={() => setShapes([])} disabled={!shapes.length}>전체 지우기</button>
      <span className="br-sp" />
      <button type="button" className="br-tool" onClick={onCancel}>취소</button>
      <button type="button" className="br-primary" onClick={finish}>완료</button>
    </div>
    <div className="br-stage">
      <canvas ref={canvas} aria-label="캡처에 표시하기" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      {typing && <input ref={textbox} className="br-textbox" style={{ left: typing.left, top: typing.top }} value={text} maxLength={40} aria-label="표시할 글자"
        onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitText(); } if (e.key === "Escape") { e.stopPropagation(); setTyping(null); setText(""); } }} onBlur={commitText} />}
    </div>
    <p className="br-hint">박스: 끌어서 네모 · 펜: 체크·동그라미 · 글자: 누른 자리에 입력 후 Enter · 🔒 전화번호·이름 칸은 이미 가려졌어요</p>
  </div>;
}
