// @vitest-environment jsdom
import * as React from 'react';
import {act,createElement as h} from 'react';
import {createRoot} from 'react-dom/client';
import {describe,it,expect,vi} from 'vitest';
import WeeklyDualChart from '@/components/dashboard/WeeklyDualChart';
vi.mock('@/components/motion/useMotion',()=>({usePlayOnOpen:()=>false}));
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
describe('weekly trend course/recent rendering',()=>{
 it('keeps course weeks, then uses actual recent dates and exposes the data description',()=>{
  const host=document.createElement('div'),root=createRoot(host);
  act(()=>root.render(h(WeeklyDualChart,{points:[{주차:1,계약수:2,활동량:5}]})));
  expect(host.textContent).toContain('코스 8주 기준');expect(host.querySelector('svg')?.getAttribute('aria-label')).toBe('코스 8주 주차 추이');
  const period={kind:'recent',startISO:'2025-12-05',endISO:'2026-01-26',status:'available'} as const;
  act(()=>root.render(h(WeeklyDualChart,{points:[{주차:1,계약수:2,활동량:5,startISO:'2025-12-05'}],period})));
  expect(host.textContent).toContain('지난 8주간 추이');expect(host.textContent).toContain('12/5');expect(host.textContent).toContain('이번 주');
  expect(host.querySelector('desc')?.textContent).toContain('활동량 5건, 계약 2건');
  const retry=vi.fn();act(()=>root.render(h(WeeklyDualChart,{points:[],period:{...period,status:'unavailable'},onRetry:retry})));
  expect(host.querySelector('svg')).toBeNull();expect(host.textContent).toContain('불러오지 못했어요');act(()=>host.querySelector('button')!.click());expect(retry).toHaveBeenCalledOnce();
  act(()=>root.unmount());
 });
});
