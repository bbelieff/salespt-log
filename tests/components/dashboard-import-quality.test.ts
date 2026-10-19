// @vitest-environment jsdom
import * as React from 'react';
import {act,createElement as h} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {ImportDialog} from '@/app/(app)/db-sheet/_components/ImportDialog';
import ProductivityIndicators from '@/components/dashboard/ProductivityIndicators';
import type {DashboardChannelMatrix} from '@/types';

vi.mock('@/components/motion/useMotion',()=>({usePlayOnOpen:()=>false}));
(globalThis as {React?:typeof React}).React=React;
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root,host:HTMLDivElement;
beforeEach(()=>{host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();});

describe('import dialog keyboard containment',()=>{
 it('starts on close, wraps both directions, contains container focus, and restores the trigger',()=>{
  vi.spyOn(HTMLElement.prototype,'offsetParent','get').mockImplementation(function(this:HTMLElement){return this.parentElement;});
  const trigger=document.createElement('button');document.body.prepend(trigger);trigger.focus();
  const close=vi.fn();act(()=>root.render(h(ImportDialog,{rows:[],onClose:close,onApply:async()=>{},onExisting:()=>{}})));
  const dialog=host.querySelector<HTMLElement>('[role="dialog"]')!;
  const first=host.querySelector<HTMLButtonElement>('[aria-label="가져오기 닫기"]')!;
  const last=[...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].at(-1)!;
  expect(document.activeElement).toBe(first);
  act(()=>first.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true})));
  expect(document.activeElement).toBe(last);
  act(()=>last.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})));
  expect(document.activeElement).toBe(first);
  dialog.focus();act(()=>dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true})));
  expect(document.activeElement).toBe(last);
  act(()=>dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  expect(close).toHaveBeenCalledOnce();act(()=>root.render(null));expect(document.activeElement).toBe(trigger);trigger.remove();
 });
});

describe('productivity metric meaning',()=>{
 const base:DashboardChannelMatrix={채널:'매입DB',생산:0,유입:0,컨택진행:0,미팅예약:0,미팅완료:0,계약:0};
 it('distinguishes no denominator from an actual zero conversion',()=>{
  act(()=>root.render(h(ProductivityIndicators,{matrix:[base]})));
  expect(host.querySelectorAll('[aria-label="계산할 기록 없음"]')).toHaveLength(5);
  act(()=>root.render(h(ProductivityIndicators,{matrix:[{...base,유입:10}]})));
  expect(host.querySelectorAll('[aria-label="계산할 기록 없음"]')).toHaveLength(4);
  expect(host.textContent).toContain('0.0%');expect(host.textContent).toContain('0 / 10건');
 });
 it('shows numerator/denominator and retains the established calculations',()=>{
  act(()=>root.render(h(ProductivityIndicators,{matrix:[{...base,유입:20,컨택진행:10,미팅예약:5,미팅완료:4,계약:2}]})));
  for(const text of ['50.0%','80.0%','20.0%','10 / 20건','5 / 10건','4 / 5건','2 / 4건','2 / 10건'])expect(host.textContent).toContain(text);
 });
});

