// @vitest-environment jsdom
/** DB 시트 자동 확인 화면(2026-11-06 belie) — 가져오기 창 「매시간 확인」 연결, 유입 반영 팝업, 연결 줄. 합성 데이터만. */
import React, { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportDialog } from '@/app/(app)/db-sheet/_components/ImportDialog';
import { FeedInflowDialog } from '@/app/(app)/db-sheet/_components/FeedInflowDialog';
import { FeedBar } from '@/app/(app)/db-sheet/_components/FeedBar';
import { blank } from '@/app/(app)/db-sheet/_components/model';
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
vi.mock('@/app/(app)/db-sheet/_components/SupplierInput', () => ({ default: ({onValueChange,...props}: {onValueChange:(v:string)=>void}) => createElement('input', {...props,onChange:(e:React.ChangeEvent<HTMLInputElement>)=>onValueChange(e.target.value)}) }));

const URL_A = 'https://docs.google.com/spreadsheets/d/AAAAAAAAAAAAAAAAAAAAAAAAAAAA/edit?usp=sharing';
const CSV = '업체명,이름,연락처,접수일시,메모,as항목,AS확인,주문개수\n가상상회,김가상,010-0000-1001,2026-11-05 10:00:00,,,,20';
let host: HTMLDivElement, root: Root, calls: { url: string; body: unknown }[];
beforeEach(() => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); calls = [];
  const proto = HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void };
  proto.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  proto.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null; calls.push({ url, body });
    if (url === '/api/db-sheet/import-url') return new Response(JSON.stringify({ text: CSV }), { status: 200 });
    return new Response(JSON.stringify({ feeds: [] }), { status: 200 });
  }));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const setValue = (el: HTMLTextAreaElement, value: string) => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); };
const button = (re: RegExp) => [...host.querySelectorAll('button')].find(b => re.test(b.textContent ?? ''))!;
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });
const followLabel = () => [...host.querySelectorAll<HTMLLabelElement>('label')].find(l => /07~21시 매시간/.test(l.textContent ?? ''));

describe('가져오기 창 — 시트 주소면 매시간 확인 연결', () => {
  it('구글시트 주소로 가져오면 체크칸이 켜져 있고, 추가 뒤 그 시트를 공급처·유형과 함께 연결', async () => {
    const apply = vi.fn(async () => {});
    await act(async () => root.render(createElement(ImportDialog, { rows: [], onApply: apply, onClose: vi.fn(), onExisting: vi.fn() })));
    act(() => setValue(host.querySelector<HTMLTextAreaElement>('#ai-source')!, URL_A));
    await act(async () => button(/자동 배치/).click());
    await flush();
    expect(followLabel()!.querySelector('input')!.checked).toBe(true);
    await act(async () => button(/선택한 1건 추가/).click());
    await flush();
    expect(apply).toHaveBeenCalled();
    expect(calls.find(c => c.url === '/api/db-sheet/feeds')?.body).toEqual({ action: 'connect', url: URL_A, supplier: '애드프로', channel: '매입DB', rules: {} });
  });
  it('체크를 끄면 연결하지 않고, 붙여넣은 글(주소 아님)에는 체크칸이 없다', async () => {
    await act(async () => root.render(createElement(ImportDialog, { rows: [], onApply: vi.fn(async () => {}), onClose: vi.fn(), onExisting: vi.fn() })));
    act(() => setValue(host.querySelector<HTMLTextAreaElement>('#ai-source')!, URL_A));
    await act(async () => button(/자동 배치/).click());
    await flush();
    await act(async () => followLabel()!.querySelector('input')!.click());
    await act(async () => button(/선택한 1건 추가/).click());
    await flush();
    expect(calls.some(c => c.url === '/api/db-sheet/feeds')).toBe(false);
    await act(async () => button(/다시 가져오기/).click());
    act(() => setValue(host.querySelector<HTMLTextAreaElement>('#ai-source')!, CSV));
    await act(async () => button(/자동 배치/).click());
    expect(followLabel()).toBeUndefined();
  });
});

describe('가져오기 창 — 「구글시트 연동」 칸·연결 중 표시·자동 확인만 연결(2026-11-07 belie)', () => {
  const setInput = (el: HTMLInputElement, value: string) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); };
  it('연동 칸에 주소를 넣고 아래 「자동 배치」 → 추가하면 연결', async () => {
    await act(async () => root.render(createElement(ImportDialog, { rows: [], onApply: vi.fn(async () => {}), onClose: vi.fn(), onExisting: vi.fn() })));
    expect(button(/자동 배치/).closest('footer')).not.toBeNull();
    act(() => setInput(host.querySelector<HTMLInputElement>('#ai-sheet')!, URL_A));
    await act(async () => button(/자동 배치/).click());
    await flush();
    await act(async () => button(/선택한 1건 추가/).click());
    await flush();
    expect(calls.find(c => c.url === '/api/db-sheet/feeds')?.body).toMatchObject({ action: 'connect', url: URL_A });
  });
  it('이미 연결한 시트면 칸 옆·체크칸 자리에 「자동 확인 연결 중」, 다시 연결하지 않는다', async () => {
    const other = 'https://docs.google.com/spreadsheets/d/AAAAAAAAAAAAAAAAAAAAAAAAAAAA/edit#gid=0';
    await act(async () => root.render(createElement(ImportDialog, { rows: [], feeds: [{ sheetUrl: other }], onApply: vi.fn(async () => {}), onClose: vi.fn(), onExisting: vi.fn() })));
    act(() => setInput(host.querySelector<HTMLInputElement>('#ai-sheet')!, URL_A));
    expect(host.querySelector('.ai-paste .ai-linked')?.textContent).toContain('자동 확인 연결 중');
    await act(async () => button(/자동 배치/).click());
    await flush();
    expect(followLabel()).toBeUndefined();
    expect(host.querySelector('.ai-options .ai-linked')?.textContent).toContain('자동 확인 연결 중');
    await act(async () => button(/선택한 1건 추가/).click());
    await flush();
    expect(calls.some(c => c.url === '/api/db-sheet/feeds')).toBe(false);
  });
  it('시트의 DB가 전부 이미 있으면 「자동 확인만 연결」 — DB 추가 없이 연결하고 닫는다', async () => {
    const apply = vi.fn(async () => {}), close = vi.fn();
    const rows = [{ ...blank(), company: '가상상회', owner: '김가상', phone: '010-0000-1001', supplier: '애드프로' }];
    await act(async () => root.render(createElement(ImportDialog, { rows, onApply: apply, onClose: close, onExisting: vi.fn() })));
    act(() => setInput(host.querySelector<HTMLInputElement>('#ai-sheet')!, URL_A));
    await act(async () => button(/자동 배치/).click());
    await flush();
    expect(button(/선택한 \d+건 추가/)).toBeUndefined();
    await act(async () => button(/자동 확인만 연결/).click());
    await flush();
    expect(apply).not.toHaveBeenCalled();
    expect(calls.find(c => c.url === '/api/db-sheet/feeds')?.body).toMatchObject({ action: 'connect', url: URL_A, supplier: '애드프로' });
    expect(close).toHaveBeenCalled();
  });
  it('연동 칸에 시트 주소가 아닌 글이면 안내만 하고 가져오지 않는다', async () => {
    await act(async () => root.render(createElement(ImportDialog, { rows: [], onApply: vi.fn(async () => {}), onClose: vi.fn(), onExisting: vi.fn() })));
    act(() => setInput(host.querySelector<HTMLInputElement>('#ai-sheet')!, 'https://example.invalid/sheet'));
    await act(async () => button(/자동 배치/).click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('구글시트 공유 주소');
    expect(calls.length).toBe(0);
  });
});

describe('새로 들어온 DB 유입 반영 팝업', () => {
  const rows = [{ ...blank(), company: '가상상회', supplier: '애드프로', date: '2026-11-06' }, { ...blank(), company: '가상꽃집', supplier: '애드프로', date: '2026-11-06' }];
  it('기본 전체 선택, 한 건 빼고 반영하면 고른 것만 반영하고 둘 다 답한 것으로', async () => {
    const reflect = vi.fn(async () => {}), answer = vi.fn(async () => {});
    await act(async () => root.render(createElement(FeedInflowDialog, { rows, onReflect: reflect, onAnswer: answer, onLater: vi.fn() })));
    const boxes = [...document.querySelectorAll<HTMLInputElement>('li input')];
    expect(boxes.every(b => b.checked)).toBe(true);
    await act(async () => boxes[1]!.click());
    await act(async () => [...document.querySelectorAll('button')].find(b => /1건 반영/.test(b.textContent ?? ''))!.click());
    expect(reflect).toHaveBeenCalledWith([rows[0]!.id]);
    expect(answer).toHaveBeenCalledWith([rows[0]!.id, rows[1]!.id]);
  });
  it('「반영 안 함」은 반영 없이 답만, 「나중에」는 미루기만', async () => {
    const reflect = vi.fn(async () => {}), answer = vi.fn(async () => {}), later = vi.fn();
    await act(async () => root.render(createElement(FeedInflowDialog, { rows, onReflect: reflect, onAnswer: answer, onLater: later })));
    await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === '나중에')!.click());
    expect(later).toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
    await act(async () => [...document.querySelectorAll('button')].find(b => /반영 안 함/.test(b.textContent ?? ''))!.click());
    expect(reflect).not.toHaveBeenCalled();
    expect(answer).toHaveBeenCalledWith([rows[0]!.id, rows[1]!.id]);
  });
});

describe('연결 줄', () => {
  const feed = { id: '00000000-0000-4000-8000-000000000001', supplier: '애드프로', channel: '매입DB', sheetUrl: URL_A, enabled: true, lastCheckedAt: '2026-11-06T04:00:00.000Z', lastAdded: 3, reviewCount: 2, lastError: null, pendingInflow: [] };
  it('매시간 확인 · 마지막 시각 · 새 DB · 확인 대기를 보이고, 확인 대기를 누르면 그 시트로', async () => {
    const review = vi.fn(), onAct = vi.fn(async () => ({ result: { added: 0, review: 0 } }));
    await act(async () => root.render(createElement(FeedBar, { feeds: [feed], message: null, onDismiss: vi.fn(), onAct, onReview: review })));
    expect(host.textContent).toContain('애드프로 시트');
    expect(host.textContent).toContain('07~21시 매시간 확인');
    expect(host.textContent).toContain('13:00');
    expect(host.textContent).toContain('새 DB 3건');
    await act(async () => button(/확인 대기 2건/).click());
    expect(review).toHaveBeenCalledWith(feed);
    await act(async () => button(/지금 확인/).click());
    expect(onAct).toHaveBeenCalledWith({ action: 'check', id: feed.id });
    expect(host.textContent).toContain('새 DB가 없어요.');
  });
  it('남의 화면을 볼 때(보기 전용)는 버튼이 없다', async () => {
    await act(async () => root.render(createElement(FeedBar, { feeds: [feed], message: null, readOnly: true, onDismiss: vi.fn(), onAct: vi.fn(), onReview: vi.fn() })));
    expect(host.textContent).not.toContain('지금 확인');
  });
});
