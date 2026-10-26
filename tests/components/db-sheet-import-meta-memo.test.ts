// @vitest-environment jsdom
/** 2026-10-26 belie: ① 매입DB로 적었는데 직접생산·메타 광고로 저장 ② 메모 열은 상담메모로. 합성 데이터만. */
import React, { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportDialog } from '@/app/(app)/db-sheet/_components/ImportDialog';
import { parse } from '@/app/(app)/db-sheet/_components/model';
import { contactDraft } from '@/app/(app)/db-sheet/_components/ContactPanel';
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
vi.mock('@/app/(app)/db-sheet/_components/SupplierInput', () => ({ default: ({onValueChange,...props}: {onValueChange:(v:string)=>void}) => createElement('input', {...props,onChange:(e:React.ChangeEvent<HTMLInputElement>)=>onValueChange(e.target.value)}) }));

const META_CSV = 'created_time\tlead_id\tfull_name\tphone_number\t메모\n2026-10-20\tl1\t김가상\t010-0000-1111\t오전 통화 희망';

describe('메모 열 → 상담메모', () => {
  it('메모·비고·상담내용 열은 note, 나머지 모르는 열은 원본 메모', () => {
    const [row] = parse('사업자명\t전화번호\t상담내용\t기타칸\n가상상사\t01000002222\t자금 3천 문의\t참고');
    expect(row!.note).toBe('자금 3천 문의');
    expect(row!.memo).toContain('기타칸: 참고');
    expect(contactDraft(row!).note).toBe('자금 3천 문의');
  });
});

let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const setValue = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) => {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
};

describe('메타 광고 양식', () => {
  it('「직접생산 · 메타 광고」를 공통 칸에 채워 보여 주고, 매입DB·다른 공급처로 바꾸면 그대로 저장', async () => {
    const apply = vi.fn(async () => {});
    await act(async () => root.render(createElement(ImportDialog, { rows: [], onApply: apply, onClose: vi.fn(), onExisting: vi.fn() })));
    act(() => setValue(host.querySelector<HTMLTextAreaElement>('#ai-source')!, META_CSV));
    await act(async () => [...host.querySelectorAll('button')].find((b) => /가져오기|배치/.test(b.textContent ?? '') && !b.disabled && b.closest('.ai-paste'))!.click());
    const channel = host.querySelector<HTMLSelectElement>('select[aria-label="가져오기 유형"]')!;
    const supplier = host.querySelector<HTMLInputElement>('input[aria-label="가져오기 공급처"]')!;
    expect(channel.value).toBe('직접생산');
    expect(supplier.value).toBe('메타 광고');
    act(() => setValue(channel, '매입DB'));
    act(() => setValue(supplier, '가상DB'));
    await act(async () => [...host.querySelectorAll('button')].find((b) => /선택한 1건 추가/.test(b.textContent ?? ''))!.click());
    expect(apply).toHaveBeenCalledWith([expect.objectContaining({ channel: '매입DB', supplier: '가상DB', owner: '김가상', note: '오전 통화 희망' })], []);
  });
});
