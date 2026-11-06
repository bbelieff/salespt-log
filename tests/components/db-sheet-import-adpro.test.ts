// @vitest-environment jsdom
/** 2026-11-06 belie: 애드프로 DB 시트(업체명·이름·연락처·접수일시·메모·as항목·AS확인·주문개수·AS 기준) 그대로 인식. 합성 데이터만. */
import React, { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportDialog } from '@/app/(app)/db-sheet/_components/ImportDialog';
import { analyzeImport } from '@/app/(app)/db-sheet/_components/adaptive-import';
import { issues, isJunkImportRow } from '@/app/(app)/db-sheet/_components/model';
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
vi.mock('@/app/(app)/db-sheet/_components/SupplierInput', () => ({ default: ({onValueChange,...props}: {onValueChange:(v:string)=>void}) => createElement('input', {...props,onChange:(e:React.ChangeEvent<HTMLInputElement>)=>onValueChange(e.target.value)}) }));

const ADPRO_CSV = [
  '업체명,이름,연락처,접수일시,메모,as항목,AS확인,주문개수,"AS 기준 : 타지역, 외국인, 미성년자, 결번, 중복 (대표자 아님은 AS 대상이 아닙니다)"',
  '테스트,테스트,1000000000,2026. 8. 19  14:56:18,,,공지사항 보기,20,',
  '가상상회,김가상,010-0000-1001,2026-09-08 22:10:52,,,,,',
  '가상꽃집,Nickname,01000001002,2026-09-13 9:26:11,,,,10,',
  '가상공방,이가상 대표원장 | 가상 아카데미,1000001003,2026. 9. 11  9:17:34,,,,,',
  '가상금속,박가상,01000001004,2026. 10. 12  16:37:09,오후 통화,,,마감,',
].join('\n');

describe('애드프로 시트 분석', () => {
  it('시험 행은 빼고, 앞 0 빠진 번호·점 날짜·시각 붙은 날짜를 고쳐 4건 모두 바로 추가 가능', () => {
    const a = analyzeImport(ADPRO_CSV);
    expect(a.header).toBe(true);
    expect(a.items.map((i) => i.lead.company)).toEqual(['가상상회', '가상꽃집', '가상공방', '가상금속']);
    expect(a.items.map((i) => i.lead.phone)).toEqual(['010-0000-1001', '010-0000-1002', '010-0000-1003', '010-0000-1004']);
    expect(a.items.map((i) => i.lead.date)).toEqual(['2026-09-08', '2026-09-13', '2026-09-11', '2026-10-12']);
    expect(a.items.every((i) => i.lead.supplier === '애드프로' && i.lead.channel === '매입DB')).toBe(true);
    expect(a.items.every((i) => !i.questions.length && !issues(i.lead))).toBe(true);
    expect(a.items[3]!.lead.note).toBe('오후 통화');
    expect(a.items[3]!.lead.memo).toContain('주문개수: 마감');
  });
  it('시험 행 판정은 업체명·이름 두 칸이 모두 「테스트」일 때만', () => {
    expect(isJunkImportRow(['테스트', '테스트', '1000000000'], ['업체명', '이름', '연락처'])).toBe(true);
    expect(isJunkImportRow(['테스트상사', '김가상', '01000001001'], ['업체명', '이름', '연락처'])).toBe(false);
    expect(isJunkImportRow(['가상상사', '테스트', '01000001001'], ['업체명', '이름', '연락처'])).toBe(false);
  });
  it('as 열이 없는 일반 시트는 공급처를 추정하지 않는다', () => {
    const a = analyzeImport('업체명,이름,연락처,접수일시\n가상상회,김가상,010-0000-1001,2026-09-08');
    expect(a.items[0]!.lead.supplier).toBe('');
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

describe('애드프로 가져오기 창', () => {
  it('공통 칸에 「매입DB · 애드프로」를 채워 보여 주고 4건을 바로 추가', async () => {
    const apply = vi.fn(async () => {});
    await act(async () => root.render(createElement(ImportDialog, { rows: [], onApply: apply, onClose: vi.fn(), onExisting: vi.fn() })));
    act(() => setValue(host.querySelector<HTMLTextAreaElement>('#ai-source')!, ADPRO_CSV));
    await act(async () => [...host.querySelectorAll('button')].find((b) => /배치/.test(b.textContent ?? '') && !b.disabled)!.click());
    expect(host.querySelector<HTMLSelectElement>('select[aria-label="가져오기 유형"]')!.value).toBe('매입DB');
    expect(host.querySelector<HTMLInputElement>('input[aria-label="가져오기 공급처"]')!.value).toBe('애드프로');
    const add = [...host.querySelectorAll('button')].find((b) => /선택한 4건 추가/.test(b.textContent ?? ''))!;
    expect(add.disabled).toBe(false);
    await act(async () => add.click());
    expect(apply).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ channel: '매입DB', supplier: '애드프로', company: '가상금속' })]), []);
  });
});

/** 2026-11-06 belie: 디비스트 시트(빈 created_time 열 + 접수시간·신용700·국세체납·연매출액·사업자번호·이름·전화번호×2·비고·메모). 합성 데이터만. */
const DBIST_CSV = [
  'created_time,접수시간,신용700,국세체납,연매출액,사업자번호,이름,전화번호,전화번호,비고,메모',
  '#REF!,접수시간,#REF!,,,,,,전화번호,,',
  ',2026. 9. 8 오후 4:55:43,예,아니오,5천미만,1000000001,김가상,p:+821000001001,01000001001,연습용,서울송파구(가상상회)/ 부재중1',
  ',2026. 9. 9 오전 10:01:02,예,예,1억~2억,1000000002,이가상,p:+821000001002,01000001002,,',
].join('\n');

describe('디비스트 시트', () => {
  it('제목 반복 줄은 빼고, 빈 created_time 이 있어도 메타 광고가 아니라 「디비스트 · 매입DB」로 추정', () => {
    const a = analyzeImport(DBIST_CSV);
    expect(a.items).toHaveLength(2);
    expect(a.items.every((i) => i.lead.supplier === '디비스트' && i.lead.channel === '매입DB')).toBe(true);
    const [first] = a.items;
    expect(first!.lead).toMatchObject({ owner: '김가상', phone: '010-0000-1001', date: '2026-09-08', biz: '1000000001', credit: '700점 이상', arrears: '없음', sales: '5천미만', company: '가상상회', address: '서울 송파구' });
    expect(a.items.every((i) => !i.questions.length && !issues(i.lead))).toBe(true);
  });
  it('lead_id 가 있는 진짜 메타 양식은 그대로 메타 광고', () => {
    const a = analyzeImport('created_time,lead_id,full_name,phone_number\n2026-10-20,l1,김가상,010-0000-1111');
    expect(a.items[0]!.lead.supplier).toBe('메타 광고');
  });
});
