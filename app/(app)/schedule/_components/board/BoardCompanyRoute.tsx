"use client";
/**
 * 주간 보드 미팅 창의 「업체정보 | 길찾기」 줄 — 시안 v44·v45.
 * 업체정보: 펼치면 업체정보 「기본 보기」와 같은 항목([대표자]·[사업자])을 목록으로 보여 준다. 「고치기」(onEdit)를 누르면
 * 목록은 접히고 그 자리에 입력칸만 남는다 — 같은 내용이 위아래로 두 번 보이지 않게(2026-11-16 belie).
 * 길찾기: 저장한 지도 앱이 있으면 바로 열고 고르는 칸도 펼친다. 주소는 믿을 만한 순서의 후보(routeCandidates)에서
 * 고르고, 애매하면 직접 적는다(v45) — 적은 주소는 이 기기에 미팅별로 기억하고, 원하면 업체정보 소재지로 저장한다.
 */
import { useState } from "react";
import type { CompanyInfo } from "@/types";
import { SALES_YEAR_KEYS, resolveBaseYear, salesYearTag } from "@/util/company-sales";
import { MAP_APPS, isVagueAddress, routeCandidates, type MapAppId, type RouteSource } from "@/util/map-links";
import { launch, readApp, saveApp } from "../MapRouteButton";

const ONLINE = /화상|온라인|전화|비대면/;
const DOT: Record<MapAppId, string> = { kakao: "rgb(234 179 8)", naver: "rgb(22 163 74)", tmap: "rgb(37 99 235)" };
const SRC: Record<RouteSource, string> = { own: "직접 적은 주소", place: "미팅 장소", company: "업체정보 소재지" };
const OWN_KEY = "map-route-own"; // { 미팅 id: 직접 적은 주소 } — 최근 50건만

const readOwn = (id: string): string => { try { return (JSON.parse(localStorage.getItem(OWN_KEY) ?? "{}") as Record<string, string>)[id] ?? ""; } catch { return ""; } };
const writeOwn = (id: string, v: string) => {
  try {
    const all = Object.entries(JSON.parse(localStorage.getItem(OWN_KEY) ?? "{}") as Record<string, string>).filter(([k]) => k !== id);
    localStorage.setItem(OWN_KEY, JSON.stringify(Object.fromEntries([...all, [id, v]].slice(-50))));
  } catch { /* 저장소를 못 쓰면 이번에만 쓴다 */ }
};

const Chev = () => <svg aria-hidden="true" className="wb-qa-cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>;

export default function BoardCompanyRoute({ meetingId, place, info, editing, onEdit, onSaveAddress }: {
  meetingId: string; place: string; info: CompanyInfo | undefined; editing: boolean; onEdit: () => void;
  /** 직접 적은 주소를 업체정보 소재지로 저장. */
  onSaveAddress: (address: string) => void;
}) {
  const [openBox, setOpenBox] = useState<"info" | "route" | null>(null);
  const [app, setApp] = useState<MapAppId | null>(() => readApp());
  const [keep, setKeep] = useState(true);
  const [own, setOwn] = useState(() => readOwn(meetingId));
  const [picked, setPicked] = useState<RouteSource | null>(null);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");

  const cands = ONLINE.test(place) ? [] : routeCandidates(place, info?.소재지, own);
  const sel = cands.find((c) => c.source === picked) ?? cands[0];
  const query = sel?.address ?? "";
  const vague = !!query && isVagueAddress(query);
  const savedName = app ? MAP_APPS.find((a) => a.id === app)?.name : "";
  const why = !sel ? "" : sel.source === "own" ? "직접 적은 주소로 찾아요"
    : sel.source === "place" ? "미팅 장소로 찾아요"
    : place.trim() && place.trim() !== query ? `업체정보 소재지로 찾아요 (장소 「${place.trim()}」는 주소가 아님)` : "업체정보 소재지로 찾아요";

  // 업체정보 「기본 보기」(components/company-info-defs.ts 의 기본_대표자_ITEMS·기본_사업자_ITEMS)와 같은 항목·순서.
  const base = resolveBaseYear(info?.매출기준연도, new Date());
  const sales = SALES_YEAR_KEYS.map((k, i) => [salesYearTag(i, base), (info?.[k] ?? "").trim()] as const).filter(([, v]) => v).map(([t, v]) => `${t} ${v}`).join(" · ");
  const groups: [string, [string, string][]][] = [
    ["대표자", [["이름", info?.대표자이름 ?? ""], ["신용점수", info?.신용점수 ?? ""], ["기대출 개인", info?.기대출개인 ?? ""]]],
    ["사업자", [
      ["개업일", info?.개업일 ?? ""],
      ["사업자 구분", [info?.사업자구분, info?.과세유형].map((v) => (v ?? "").trim()).filter(Boolean).join(" · ")],
      ["업종", info?.업종주생산품목 ?? ""], ["아이템", info?.주생산품목 ?? ""], ["연매출", sales],
      ["사업자 대출", info?.기대출사업자 ?? ""], ["4대보험 직원", info?.사대보험직원 ?? ""], ["특허 및 인증", info?.특허및인증 ?? ""],
      ["소재지", info?.소재지 ?? ""], ["기타메모", info?.업체기타메모 ?? ""],
    ]],
  ];
  const hasInfo = groups.some(([, rows]) => rows.some(([, v]) => v.trim()));

  const pick = (id: MapAppId) => {
    if (keep) { saveApp(id); setApp(id); } else { saveApp(null); setApp(null); }
    setOpenBox(null);
    launch(id, query);
  };
  const onRoute = () => {
    if (app && openBox !== "route") { launch(app, query); setOpenBox("route"); return; }
    setOpenBox((b) => (b === "route" ? null : "route"));
  };
  const applyOwn = () => {
    const v = draft.trim();
    if (!v) return;
    writeOwn(meetingId, v); setOwn(v); setPicked("own"); setTyping(false);
  };

  return (
    <div>
      <div className="wb-qa" role="group" aria-label="업체">
        <button type="button" aria-expanded={openBox === "info" || editing} aria-controls="wb-qinfo" onClick={() => { if (editing) { onEdit(); setOpenBox("info"); } else setOpenBox((b) => (b === "info" ? null : "info")); }}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4" /></svg>
          업체정보<Chev />
        </button>
        <button type="button" disabled={!query} title={query ? undefined : "화상·전화 미팅이거나 주소가 없어 길찾기가 없어요"} aria-expanded={openBox === "route"} aria-controls="wb-qroute" onClick={onRoute}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-8-8 18-2-8-8-2z" /></svg>
          {query ? (savedName ? `길찾기 · ${savedName}` : "길찾기") : "길찾기 없음"}
        </button>
      </div>

      {openBox === "info" && !editing && (
        <div className="wb-qbox" id="wb-qinfo">
          {hasInfo ? groups.map(([g, rows]) => (
            <section key={g} className="wb-qgrp" aria-label={g}>
              <h4>{g}</h4>
              <dl className="wb-qds">
                {rows.map(([k, v]) => (
                  <div key={k} className="contents"><dt>{k}</dt><dd className="whitespace-pre-wrap">{v.trim() || <span className="wb-qnone">–</span>}</dd></div>
                ))}
              </dl>
            </section>
          )) : <p className="wb-qempty">아직 적은 업체정보가 없어요</p>}
          <div className="wb-qfoot">
            <span>{hasInfo ? "업체정보 기본 보기와 같은 항목" : "대표자·사업자 기본 항목"}</span>
            <button type="button" onClick={onEdit}>{hasInfo ? "고치기" : "업체정보 적기"}</button>
          </div>
        </div>
      )}

      {openBox === "route" && sel && (
        <div className="wb-qbox" id="wb-qroute">
          <div className="wb-qaddr">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-6.1 7-12a7 7 0 10-14 0c0 5.9 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>
            <span>{query}<small>{why}</small></span>
          </div>
          {vague && <p className="wb-qvague">번지·도로명 번호가 없어 근처까지만 안내될 수 있어요 — 아래에 정확한 주소를 적어 주세요</p>}
          {cands.length > 1 && (
            <div className="wb-qsrcs" role="radiogroup" aria-label="찾을 주소">
              {cands.map((c, i) => (
                <button key={c.source} type="button" role="radio" aria-checked={c.source === sel.source} onClick={() => setPicked(c.source)}>
                  <b>{SRC[c.source]}{i === 0 && c.source !== "own" && <i className="wb-qbest">추천</i>}</b><span>{c.address}</span>
                </button>
              ))}
            </div>
          )}
          {typing || (vague && sel.source !== "own") ? (
            <form className="wb-qaddrin" onSubmit={(e) => { e.preventDefault(); applyOwn(); }}>
              <input aria-label="주소 직접 적기" value={draft} maxLength={120} onChange={(e) => setDraft(e.target.value)} placeholder="예: 경기 김포시 양촌읍 황금로 117" />
              <button type="submit">이 주소로</button>
            </form>
          ) : (
            <div className="wb-qaddrlinks">
              <button type="button" onClick={() => { setDraft(own); setTyping(true); }}>{own ? "적은 주소 고치기" : "주소 직접 적기"}</button>
              {sel.source === "own" && own !== (info?.소재지 ?? "").trim() && <button type="button" onClick={() => onSaveAddress(own)}>업체정보 소재지로 저장</button>}
            </div>
          )}
          <div className="wb-qmaps" role="group" aria-label="지도 앱">
            {MAP_APPS.map((a) => (
              <button key={a.id} type="button" aria-pressed={app === a.id} onClick={() => pick(a.id)}>
                <i style={{ background: DOT[a.id] }} />{a.name}
              </button>
            ))}
          </div>
          <label className="wb-qkeep"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />다음에도 이 앱으로 바로 열기</label>
        </div>
      )}
    </div>
  );
}
