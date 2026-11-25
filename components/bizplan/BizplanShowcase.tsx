"use client";
/**
 * 사업계획서 작성도구 — 「이렇게 만들어져요」 예시 진열대(belie 2026-11-24 「만들고 싶게, 예시 파일 다운로드도」).
 *
 * 가상의 회사((주)예시정밀)로 만든 결과물 3종을 보여 주고 바로 받게 한다.
 * - 사업계획서 PPT: 실제 PPT 를 그림으로 뽑은 슬라이드가 3D 로 겹쳐 넘어간다(자동 넘김, 마우스 기울임).
 * - 슬라이드별 설명 워드 · 현장클리닉 보고서 워드: 실제 문서 첫 장 그림 + 받기.
 * 예시는 공식 빌더(v4.8)에 가상의 회사 자료·AI 로 만든 공장 사진을 넣고 「실행」해 만든 실제 결과물이다.
 * 목록 = lib/config/bizplan-sample.json, 파일·그림 = public/bizplan-samples/.
 * 움직임 줄이기 설정이면 자동 넘김·기울임·3D 를 끈다.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardCheck, Download, FileText, LayoutGrid, Presentation, X } from "lucide-react";
import AppDialog, { AppDialogClose } from "@/components/ui/AppDialog";
import { BIZPLAN_SAMPLE as SAMPLE } from "@/config/bizplan-sample";

const BASE = "/bizplan-samples";
const SLIDES = SAMPLE.slides;
const N = SLIDES.length;
const AUTO_MS = 3800;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const FILES = {
  pptx: { href: `${BASE}/sample-bizplan.pptx`, name: "예시_사업계획서_예시정밀.pptx" },
  notes: { href: `${BASE}/sample-slide-notes.docx`, name: "예시_슬라이드설명_예시정밀.docx" },
  clinic: { href: `${BASE}/sample-clinic-report.docx`, name: "예시_현장클리닉보고서_예시정밀.docx" },
} as const;

/** 앞에서 d 번째(0 = 맨 앞, N-1 = 방금 지나간 장) 카드의 위치. */
function cardStyle(d: number, flat: boolean, fast = false): CSSProperties {
  const ms = fast ? 260 : 750;
  const base: CSSProperties = { transition: flat ? "opacity 200ms" : `transform ${ms}ms ${EASE}, opacity ${Math.round(ms * 0.7)}ms ${EASE}`, transformOrigin: "50% 60%" };
  if (flat) return { ...base, opacity: d === 0 ? 1 : 0, zIndex: d === 0 ? 30 : 0 };
  if (d === 0) return { ...base, transform: "translate3d(0,0,0) rotateY(0deg) scale(1)", opacity: 1, zIndex: 30 };
  if (d === 1) return { ...base, transform: "translate3d(11%,-11%,-160px) rotateY(-10deg) scale(0.88)", opacity: 0.75, zIndex: 20 };
  if (d === 2) return { ...base, transform: "translate3d(20%,-21%,-300px) rotateY(-14deg) scale(0.77)", opacity: 0.4, zIndex: 10 };
  if (d === N - 1) return { ...base, transform: "translate3d(-28%,4%,60px) rotateY(16deg) scale(0.96)", opacity: 0, zIndex: 25 };
  return { ...base, transform: "translate3d(18%,-8%,-380px) rotateY(-16deg) scale(0.8)", opacity: 0, zIndex: 0 };
}

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    setReduce(m.matches);
    const on = () => setReduce(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduce;
}

function SlideDeck() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const touchX = useRef<number | null>(null);
  const go = useCallback((n: number) => setI(((n % N) + N) % N), []);

  useEffect(() => {
    if (hold || reduce) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % N), AUTO_MS);
    return () => window.clearInterval(t);
  }, [hold, reduce]);

  // 마우스를 슬라이드 위에서 왼쪽→오른쪽으로 움직이면 1장→마지막 장으로 넘어간다(스크러빙). 손을 떼면 자동 넘김이 다시 흐른다.
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const fx = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 0.9999);
    setI(Math.floor(fx * N));
    if (!reduce) setTilt({ x: fx - 0.5, y: (e.clientY - r.top) / r.height - 0.5 });
  };
  const cur = SLIDES[i]!;

  return (
    <div>
      <div
        className="relative mx-auto mt-12 w-5/6 max-w-2xl select-none pc:mt-12 pc:w-11/12 pc:max-w-none"
        style={{ perspective: "1800px" }}
        onPointerEnter={() => setHold(true)}
        onPointerLeave={() => { setHold(false); setTilt({ x: 0, y: 0 }); }}
        onPointerMove={onMove}
        onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; setHold(true); }}
        onTouchEnd={(e) => {
          const s = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          if (s !== null && end !== undefined && Math.abs(end - s) > 40) go(i + (end < s ? 1 : -1));
          touchX.current = null;
        }}
        role="region"
        aria-roledescription="슬라이드 넘겨보기"
        aria-label={`예시 사업계획서 PPT ${N}장`}
      >
        <div
          className="relative aspect-video"
          style={{
            transformStyle: "preserve-3d",
            transform: reduce ? undefined : `rotateX(${(-tilt.y * 6).toFixed(2)}deg) rotateY(${(tilt.x * 8).toFixed(2)}deg)`,
            transition: `transform 400ms ${EASE}`,
          }}
        >
          {SLIDES.map((s, k) => {
            const d = (k - i + N) % N;
            return (
              <button
                key={s.no}
                type="button"
                tabIndex={d === 0 ? 0 : -1}
                aria-hidden={d !== 0}
                onClick={() => go(d === 0 ? i + 1 : k)}
                className="absolute inset-0 overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300"
                style={cardStyle(d, reduce, hold)}
              >
                <img src={`${BASE}/slides/s${s.no}.webp`} alt={d === 0 ? `${s.no}장 — ${s.title}` : ""} className="h-full w-full object-cover" loading={k < 3 ? "eager" : "lazy"} draggable={false} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto mt-5 flex w-full max-w-2xl items-center gap-3 pc:max-w-none">
        <button type="button" onClick={() => go(i - 1)} aria-label="이전 장" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-700 text-slate-300 transition-colors hover:border-slate-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm text-slate-300" aria-live="polite">
          <span className="mr-2 font-bold tabular-nums text-indigo-300">{String(cur.no).padStart(2, "0")} / {N}</span>
          {cur.title}
        </p>
        <button type="button" onClick={() => go(i + 1)} aria-label="다음 장" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-700 text-slate-300 transition-colors hover:border-slate-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <p className="mx-auto mt-1.5 w-full max-w-2xl text-xs leading-relaxed text-slate-400 pc:max-w-none">{cur.explain}</p>
      <p className="mx-auto mt-1 hidden w-full text-xs text-slate-500 pc:block">슬라이드 위에서 마우스를 좌우로 움직이면 1장부터 {N}장까지 넘겨 볼 수 있어요.</p>
      <div className="mx-auto mt-3 flex w-full max-w-2xl gap-1 pc:max-w-none" aria-hidden="true">
        {SLIDES.map((s, k) => (
          <span key={s.no} className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
            <span
              className="block h-full rounded-full bg-indigo-400"
              style={{ width: k < i ? "100%" : k === i ? "100%" : "0%", opacity: k <= i ? 1 : 0, transition: k === i && !hold && !reduce ? `width ${AUTO_MS}ms linear` : "none" }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

/** 워드 문서 미리보기 — 실제 문서 첫 장 그림을 종이처럼 겹쳐 보여 준다. */
function Pages({ doc, pages }: { doc: string; pages: number }) {
  const shown = Math.min(pages, 2);
  return (
    <div className="relative h-40 overflow-hidden pc:h-32 wide:h-44">
      {Array.from({ length: shown }, (_, k) => shown - k).map((n, k) => (
        <img
          key={n}
          src={`${BASE}/docs/${doc}-${n}.webp`}
          alt=""
          className="absolute w-3/4 rounded-sm bg-white shadow-lg ring-1 ring-black/10 transition-transform duration-300 group-hover:-rotate-1"
          style={{ left: `${4 + k * 18}%`, top: `${4 + k * 9}%`, transform: `rotate(${k === 0 && shown > 1 ? -4 : 2}deg)` }}
        />
      ))}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-900 to-transparent" />
    </div>
  );
}

type Kind = "pptx" | "notes" | "clinic";
const pageList = (doc: string, n: number) => Array.from({ length: n }, (_, k) => ({ src: `${BASE}/docs/${doc}-${k + 1}.webp`, label: `${k + 1}쪽` }));
const GALLERY: Record<Kind, { title: string; file: { href: string; name: string }; wide: boolean; pages: { src: string; label: string }[] }> = {
  pptx: { title: "사업계획서 PPT", file: FILES.pptx, wide: true, pages: SLIDES.map((s) => ({ src: `${BASE}/slides/s${s.no}.webp`, label: `${s.no}. ${s.title}` })) },
  notes: { title: "슬라이드별 설명 워드", file: FILES.notes, wide: false, pages: pageList("notes", SAMPLE.docs.notes) },
  clinic: { title: "현장클리닉 보고서", file: FILES.clinic, wide: false, pages: pageList("clinic", SAMPLE.docs.clinic) },
};

/** 결과물 카드를 누르면 여는 바둑판 미리보기 — 한 장을 누르면 크게, 「전체 보기」로 돌아간다. */
function Gallery({ kind, onClose }: { kind: Kind; onClose: () => void }) {
  const g = GALLERY[kind];
  const [big, setBig] = useState<number | null>(null);
  const n = g.pages.length;
  const page = big === null ? null : g.pages[big]!;
  const step = (by: number) => setBig(((big ?? 0) + by + n) % n);
  return (
    <AppDialog title={`${g.title} 미리보기`} size="xl" dismissOnBackdrop onClose={onClose} className="rounded-2xl bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center gap-2">
        {page ? (
          <>
            <button type="button" onClick={() => setBig(null)} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              전체 보기
            </button>
            <p className="min-w-0 flex-1 truncate text-sm text-slate-600">{page.label}</p>
          </>
        ) : (
          <p className="min-w-0 flex-1 truncate text-base font-bold text-slate-900">
            {g.title} <span className="text-sm font-medium text-slate-500">· {n}{g.wide ? "장" : "쪽"}</span>
          </p>
        )}
        <a href={g.file.href} download={g.file.name} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800">
          <Download className="h-4 w-4" aria-hidden="true" />
          받기
        </a>
        <AppDialogClose aria-label="닫기" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100">
          <X className="h-5 w-5" aria-hidden="true" />
        </AppDialogClose>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: "72vh" }}>
        {page ? (
          <div>
            <img src={page.src} alt={page.label} className={`mx-auto rounded-md shadow ring-1 ring-black/10 ${g.wide ? "w-full" : "w-4/5"}`} />
            <div className="mt-3 flex items-center justify-center gap-3">
              <button type="button" onClick={() => step(-1)} aria-label="이전" className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="text-sm tabular-nums text-slate-600">{(big ?? 0) + 1} / {n}</span>
              <button type="button" onClick={() => step(1)} aria-label="다음" className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <ul className={`grid gap-3 ${g.wide ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-4"}`}>
            {g.pages.map((p, k) => (
              <li key={p.src}>
                <button type="button" onClick={() => setBig(k)} className="group block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
                  <img src={p.src} alt={p.label} loading="lazy" className="w-full rounded-md bg-white shadow-sm ring-1 ring-black/10 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md" />
                  <span className="mt-1 block truncate text-xs text-slate-600">{p.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppDialog>
  );
}

function OutputCard({ icon, title, desc, file, label, preview, onOpen }: {
  icon: ReactNode;
  title: string;
  desc: string;
  file: { href: string; name: string };
  label: string;
  preview: ReactNode;
  onOpen: () => void;
}) {
  return (
    <li className="group flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3 transition-all duration-300 hover:-translate-y-1 hover:border-slate-600 pc:flex-row pc:items-stretch">
      <button type="button" onClick={onOpen} aria-label={`${title} 전체 미리보기`} className="relative block w-full rounded-md text-left pc:w-1/2 pc:shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300">
        <div className="transition-transform duration-300 group-hover:scale-105">{preview}</div>
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-900 opacity-90 shadow transition-opacity group-hover:opacity-100">
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
          전체 보기
        </span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-indigo-300">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-xs text-slate-400">{desc}</p>
        </div>
      </div>
      <a
        href={file.href}
        download={file.name}
        className="mt-auto inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {label}
      </a>
      </div>
    </li>
  );
}

export default function BizplanShowcase() {
  const [open, setOpen] = useState<Kind | null>(null);
  return (
    <section
      aria-labelledby="bizplan-showcase-title"
      className="overflow-hidden rounded-2xl bg-slate-950 px-4 pb-5 pt-6 text-white shadow-sm pc:px-8"
      style={{ backgroundImage: "radial-gradient(60% 50% at 50% 0%, rgba(72,80,255,0.35), transparent 70%)" }}
    >
      <p className="text-center text-xs font-bold tracking-widest text-indigo-300">EXAMPLE</p>
      <h2 id="bizplan-showcase-title" className="mt-1 text-center text-xl font-bold">이렇게 만들어져요</h2>
      <p className="mx-auto mt-1 max-w-md text-center text-sm text-slate-300 wide:max-w-none">
        꾸러미 하나로 파일 3개가 나와요. 아래는 예시회사로 만든 샘플이에요 — 넘겨 보고, 카드를 눌러 전체를 보고, 받아서 열어 보세요.
      </p>

      <div className="pc:mt-2 pc:grid pc:grid-cols-3 pc:items-center pc:gap-6 wide:gap-8">
      <div className="mt-6 pc:col-span-2 pc:mt-0">
        <SlideDeck />
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-3 pc:mt-0 pc:grid-cols-1 wide:gap-4">
        <OutputCard
          icon={<Presentation className="h-4 w-4" aria-hidden="true" />}
          title="사업계획서 PPT"
          desc={`심사 순서대로 ${N}장 · 공장 사진 포함`}
          file={FILES.pptx}
          onOpen={() => setOpen("pptx")}
          label="PPT 받기"
          preview={
            <div className="relative h-40 pc:h-32 wide:h-44">
              {[3, 2, 1].map((n, k) => (
                <img
                  key={n}
                  src={`${BASE}/slides/s${SAMPLE.highlight[n - 1]}.webp`}
                  alt=""
                  className="absolute w-4/5 rounded-md shadow-lg ring-1 ring-black/10 transition-transform duration-300"
                  style={{ left: `${k * 9}%`, top: `${k * 14}%` }}
                  loading="lazy"
                />
              ))}
            </div>
          }
        />
        <OutputCard
          icon={<FileText className="h-4 w-4" aria-hidden="true" />}
          title="슬라이드별 설명 워드"
          desc="장마다 무엇을, 왜 넣었는지 — 발표·제출용"
          file={FILES.notes}
          onOpen={() => setOpen("notes")}
          label="워드 받기"
          preview={<Pages doc="notes" pages={SAMPLE.docs.notes} />}
        />
        <OutputCard
          icon={<ClipboardCheck className="h-4 w-4" aria-hidden="true" />}
          title="현장클리닉 보고서"
          desc="진단 → 문제점 → 개선과제 → 개선방안 → 사후관리"
          file={FILES.clinic}
          onOpen={() => setOpen("clinic")}
          label="워드 받기"
          preview={<Pages doc="clinic" pages={SAMPLE.docs.clinic} />}
        />
      </ul>
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">{SAMPLE.notice}</p>
      {open && <Gallery kind={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
