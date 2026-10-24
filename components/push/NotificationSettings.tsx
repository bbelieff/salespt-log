"use client";
/**
 * /settings/notifications — 수강생이 직접 고르는 알림 설정 (plan §2-2 4번).
 * Every change saves immediately; the server still caps 2 per day and never sends at night.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { track, EVENTS } from "@/analytics";
import { DEFAULT_PUSH_PREFERENCES, PUSH_CONTENT_KINDS, type PushContentKind, type PushDevice, type PushPreferences } from "@/types/push";
import { kstNow, nextNotification, WEEKDAY_LABELS, weekdayBit } from "@/service/push-schedule";
import { sendTestPush, usePushState, useRemovePushDevice, useSavePushPreferences, useThisDevicePush } from "@/query/push-hooks";
import ThisDevicePush from "./ThisDevicePush";
import "./push.css";

const KIND_LABEL: Record<PushContentKind, [string, string]> = {
  overdue: ["밀린 약속", "기한이 지난 할 일"],
  today: ["오늘 할 일", "오늘 하기로 한 일"],
  meeting: ["미팅 결과", "결과를 아직 안 적은 미팅"],
  initial: ["첫 연락 DB", "아직 연락 전인 새 DB"],
  recontact: ["다시 연락할 DB", "다시 연락할 날이 된 업체"],
  stalled: ["진행 멈춤", "다음 할 일이 비어 있는 진행건"],
};
const PLATFORM_LABEL: Record<PushDevice["platform"], string> = { android: "안드로이드", ios_pwa: "아이폰 홈 화면 앱", desktop: "PC", other: "기타 기기" };
const BROWSER_LABEL: Record<string, string> = { chrome: "크롬", safari: "사파리", edge: "엣지" };
const WEEKDAYS_ONLY = 31, EVERY_DAY = 127;

function times(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = Number(from.slice(0, 2)) * 60 + Number(from.slice(3)); m <= Number(to.slice(0, 2)) * 60 + Number(to.slice(3)); m += 15) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}
const MORNING_TIMES = times("07:00", "11:00"), EVENING_TIMES = times("17:00", "21:00");
const timeLabel = (t: string) => { const h = Number(t.slice(0, 2)); return `${h < 12 ? "오전" : "오후"} ${h > 12 ? h - 12 : h}:${t.slice(3)}`; };

function Switch({ id, checked, onChange, label, disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
    className="push-switch" data-on={checked} onClick={() => onChange(!checked)}><span aria-hidden /></button>;
}

export default function NotificationSettings() {
  const state = usePushState();
  const save = useSavePushPreferences();
  const remove = useRemovePushDevice();
  const device = useThisDevicePush(state.data);
  const [prefs, setPrefs] = useState<PushPreferences | null>(null);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [testNote, setTestNote] = useState<string | null>(null);
  const shown = useRef(false);

  useEffect(() => { if (state.data?.preferences && !prefs) setPrefs(state.data.preferences); }, [state.data, prefs]);
  useEffect(() => {
    if (state.data?.available && !shown.current) { shown.current = true; track(EVENTS.PUSH_PROMPT_SHOWN, { where: "settings" }); }
  }, [state.data?.available]);

  const next = useMemo(() => (prefs ? nextNotification(prefs, kstNow(new Date())) : null), [prefs]);

  if (state.isPending) return <div className="push-page"><p className="push-muted" role="status">알림 설정을 불러오고 있어요…</p></div>;
  if (state.isError) return <div className="push-page"><p role="alert">알림 설정을 불러오지 못했어요. <button type="button" className="push-link" onClick={() => state.refetch()}>다시 시도</button></p></div>;
  if (!state.data.available) return <div className="push-page"><section className="push-card"><h2>이 계정에서는 알림을 쓸 수 없어요</h2><p>알림은 수강생 계정에서 받을 수 있어요. 수강생 계정으로 로그인해 주세요.</p></section></div>;

  const p = prefs ?? DEFAULT_PUSH_PREFERENCES;
  function update(patch: Partial<PushPreferences>, field: string) {
    const nextPrefs = { ...p, ...patch };
    setPrefs(nextPrefs);
    setSaved("saving");
    save.mutate(nextPrefs, { onSuccess: () => setSaved("saved"), onError: () => setSaved("error") });
    track(EVENTS.PUSH_SETTINGS_CHANGED, { field });
  }
  const toggleKind = (k: PushContentKind, on: boolean) => update({ kinds: on ? PUSH_CONTENT_KINDS.filter(x => x === k || p.kinds.includes(x)) : p.kinds.filter(x => x !== k) }, `kind_${k}`);
  const toggleDay = (i: number) => { const bits = p.weekdays ^ weekdayBit(i + 1); if (bits) update({ weekdays: bits }, "weekdays"); };

  async function test() {
    setTestNote("보내는 중…");
    const r = await sendTestPush();
    track(EVENTS.PUSH_TEST_SENT, { ok: r.ok });
    setTestNote(r.ok ? `시험 알림을 ${r.devices}대에 보냈어요. 도착했는지 확인해 보세요.`
      : r.reason === "limit" ? "시험 알림은 하루 3번까지 보낼 수 있어요."
      : r.reason === "no_device" ? "먼저 위에서 「이 기기에서 알림 받기」를 눌러 주세요."
      : "지금은 알림을 보낼 수 없어요. 잠시 뒤 다시 해 주세요.");
  }
  async function removeDevice(d: PushDevice) {
    await remove.mutateAsync(d.id);
    track(EVENTS.PUSH_UNSUBSCRIBED, { platform: d.platform });
    if (device.endpoint && device.endpoint.slice(-16) === d.endpointTail) await device.forgetThisBrowser();
  }
  const nextLabel = next ? `${next.daysAhead === 0 ? "오늘" : next.daysAhead === 1 ? "내일" : ""}(${WEEKDAY_LABELS[next.weekday - 1]}) ${timeLabel(next.time)} · ${next.slot === "morning" ? "아침 알림" : "저녁 알림"}` : "받을 알림이 꺼져 있어요";
  const off = !p.enabled;

  return <div className="push-page">
    {state.data.viewingOther && <p className="push-notice" role="note">지금 다른 사람 화면을 보고 있어요. 이 화면의 알림 설정은 로그인한 본인 것이고, 보고 있는 사람에게는 영향이 없어요.</p>}
    <section className="push-card" aria-labelledby="push-device">
      <h2 id="push-device">이 기기</h2>
      <ThisDevicePush device={device} />
      <dl className="push-next"><dt>다음 알림</dt><dd>{nextLabel}</dd></dl>
      <div className="push-row">
        <button type="button" className="push-secondary" onClick={test}>시험 알림 보내기</button>
        {testNote && <p className="push-muted" role="status">{testNote}</p>}
      </div>
    </section>

    <section className="push-card" aria-labelledby="push-all">
      <div className="push-line">
        <div><h2 id="push-all">알림 받기</h2><p className="push-muted">끄면 아래 설정과 상관없이 알림이 오지 않아요.</p></div>
        <Switch id="push-enabled" checked={p.enabled} onChange={v => update({ enabled: v }, "enabled")} label="알림 받기" />
      </div>
    </section>

    <section className="push-card" aria-labelledby="push-kinds" aria-disabled={off}>
      <h2 id="push-kinds">알림 종류와 시간</h2>
      <div className="push-line">
        <div><h3>아침 · 오늘 챙길 일</h3><p className="push-muted">가장 급한 일 하나와 전체 건수</p></div>
        <Switch id="push-morning" checked={p.morningEnabled} disabled={off} onChange={v => update({ morningEnabled: v }, "morning_enabled")} label="아침 알림" />
      </div>
      <label className="push-select" htmlFor="push-morning-time">아침 시간
        <select id="push-morning-time" value={p.morningTime} disabled={off || !p.morningEnabled} onChange={e => update({ morningTime: e.target.value }, "morning_time")}>
          {MORNING_TIMES.map(t => <option key={t} value={t}>{timeLabel(t)}</option>)}
        </select>
      </label>
      <div className="push-line">
        <div><h3>저녁 · 오늘 마무리와 내일 약속</h3><p className="push-muted">내일 약속이 있으면 미리, 없으면 오늘 남은 일</p></div>
        <Switch id="push-evening" checked={p.eveningEnabled} disabled={off} onChange={v => update({ eveningEnabled: v }, "evening_enabled")} label="저녁 알림" />
      </div>
      <label className="push-select" htmlFor="push-evening-time">저녁 시간
        <select id="push-evening-time" value={p.eveningTime} disabled={off || !p.eveningEnabled} onChange={e => update({ eveningTime: e.target.value }, "evening_time")}>
          {EVENING_TIMES.map(t => <option key={t} value={t}>{timeLabel(t)}</option>)}
        </select>
      </label>
    </section>

    <section className="push-card" aria-labelledby="push-days">
      <h2 id="push-days">받는 요일</h2>
      <div className="push-chips" role="group" aria-label="빠른 선택">
        <button type="button" className="push-chip" aria-pressed={p.weekdays === WEEKDAYS_ONLY} disabled={off} onClick={() => update({ weekdays: WEEKDAYS_ONLY }, "weekdays")}>평일만</button>
        <button type="button" className="push-chip" aria-pressed={p.weekdays === EVERY_DAY} disabled={off} onClick={() => update({ weekdays: EVERY_DAY }, "weekdays")}>매일</button>
      </div>
      <div className="push-days" role="group" aria-label="요일 직접 고르기">
        {WEEKDAY_LABELS.map((d, i) => <button key={d} type="button" className="push-day" aria-pressed={(p.weekdays & weekdayBit(i + 1)) !== 0} disabled={off} onClick={() => toggleDay(i)}>{d}</button>)}
      </div>
    </section>

    <section className="push-card" aria-labelledby="push-content">
      <h2 id="push-content">받을 내용</h2>
      <p className="push-muted">끈 내용은 알림에서 세지도 말하지도 않아요.</p>
      <ul className="push-list">
        {PUSH_CONTENT_KINDS.map(k => <li key={k} className="push-line">
          <div><h3>{KIND_LABEL[k][0]}</h3><p className="push-muted">{KIND_LABEL[k][1]}</p></div>
          <Switch id={`push-kind-${k}`} checked={p.kinds.includes(k)} disabled={off} onChange={v => toggleKind(k, v)} label={KIND_LABEL[k][0]} />
        </li>)}
      </ul>
    </section>

    <section className="push-card" aria-labelledby="push-names">
      <div className="push-line">
        <div><h2 id="push-names">업체명 보이기</h2><p className="push-muted">{p.showCompanyNames ? "알림에 업체명이 나와요. 잠금화면에서도 보일 수 있어요." : "업체명 없이 건수만 알려 드려요."}</p></div>
        <Switch id="push-names-switch" checked={p.showCompanyNames} disabled={off} onChange={v => update({ showCompanyNames: v }, "show_company_names")} label="업체명 보이기" />
      </div>
    </section>

    <section className="push-card" aria-labelledby="push-devices">
      <h2 id="push-devices">알림 받는 기기</h2>
      {state.data.devices.length === 0 ? <p className="push-muted">아직 없어요. 위에서 이 기기를 먼저 켜 주세요.</p> :
        <ul className="push-list">{state.data.devices.map(d => <li key={d.id} className="push-line">
          <div><h3>{PLATFORM_LABEL[d.platform]}{BROWSER_LABEL[d.browser] ? ` · ${BROWSER_LABEL[d.browser]}` : ""}{device.endpoint?.slice(-16) === d.endpointTail ? " (이 기기)" : ""}</h3>
            <p className="push-muted">{d.lastSuccessAt ? `마지막 알림 ${d.lastSuccessAt.slice(5, 10).replace("-", "/")}` : `등록 ${d.createdAt.slice(5, 10).replace("-", "/")}`}</p></div>
          <button type="button" className="push-link" disabled={remove.isPending} onClick={() => removeDevice(d)}>해제</button>
        </li>)}</ul>}
    </section>

    <p className="push-status" role="status" aria-live="polite">
      {saved === "saving" ? "저장 중…" : saved === "saved" ? "저장했어요" : saved === "error" ? "저장하지 못했어요. 다시 바꿔 주세요." : ""}
    </p>
  </div>;
}
