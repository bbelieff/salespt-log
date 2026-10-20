// @vitest-environment jsdom
import React,{act,createElement as h} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {LoadingProvider} from '@/components/ui/LoadingProvider';
import {usePatchContractPayment,useEditContractLinkedFields,useAddStandaloneContract,useRemoveContractPayment,useTerminateContract} from '@/query/contract-payment-hooks';
vi.mock('@/analytics',()=>({track:vi.fn(),EVENTS:{}}));
Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
let root:Root,host:HTMLDivElement,client:QueryClient;
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
beforeEach(()=>{client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();client.clear();vi.unstubAllGlobals();});
it.each(['patch','linked'] as const)('makes only opted-in %s routine mutation silent while preserving errors',async kind=>{
 let reject!:(e:Error)=>void;const deferred=new Promise<Response>((_,no)=>{reject=no;});vi.stubGlobal('fetch',vi.fn(()=>deferred));let start!:()=>void;let failed=false;
 function Probe(){const patch=usePatchContractPayment({silent:true}),linked=useEditContractLinkedFields({silent:true});start=()=>{const run=kind==='patch'?patch.mutateAsync({row:3,data:{} as never}):linked.mutateAsync({old:{계약일:'2030-01-01',업체명:'합성'},next:{수임비:1}});void run.catch(()=>{failed=true;});};return h('button',null,'still interactive');}
 act(()=>root.render(h(QueryClientProvider,{client},h(LoadingProvider,null,h(Probe)))));act(()=>start());await act(async()=>{await pause(230);});
 expect(host.textContent).not.toContain('저장하고 있어요');expect(client.getMutationCache().getAll().find(m=>m.state.status==='pending')?.meta?.silent).toBe(true);
 await act(async()=>{reject(new Error('synthetic failure'));await pause(30);});expect(failed).toBe(true);expect(client.getMutationCache().getAll().some(m=>m.state.status==='error')).toBe(true);
});
it.each(['patch','linked','create','delete','terminate'] as const)('keeps default/explicit %s mutations foreground during a slow request',async kind=>{
 let resolve!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(ok=>{resolve=ok;})));let start!:()=>void;
 function Probe(){const patch=usePatchContractPayment(),linked=useEditContractLinkedFields(),create=useAddStandaloneContract(),remove=useRemoveContractPayment(),terminate=useTerminateContract();start=()=>{if(kind==='patch')patch.mutate({row:3,data:{} as never});if(kind==='linked')linked.mutate({old:{계약일:'2030-01-01',업체명:'합성'},next:{수임비:1}});if(kind==='create')create.mutate({requestKey:'synthetic',계약일:'2030-01-01',업체명:'합성',수임비:1});if(kind==='delete')remove.mutate({row:3});if(kind==='terminate')terminate.mutate({row:3,사유:'합성',반환액:0,숨김:false});};return null;}
 act(()=>root.render(h(QueryClientProvider,{client},h(LoadingProvider,null,h(Probe)))));act(()=>start());await act(async()=>{await pause(230);});expect(host.textContent).toContain('저장하고 있어요');
 await act(async()=>{resolve({ok:true,json:async()=>({ok:true,failures:[]})} as Response);await pause(30);});
});
