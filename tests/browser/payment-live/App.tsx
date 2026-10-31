/** 실무/수납 실제 화면(app/(app)/payment/page) 합성 검증 — server.mjs 가 /api 를 가상 값으로 답한다. 실제 이름·전화 없음. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import DirtyProvider from '@/components/DirtyGuard';
import DesktopNav from '@/components/desktop/DesktopNav';
import Page from '@/app/(app)/payment/page';
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><DirtyProvider><div className="desktop-shell pc:flex"><DesktopNav/><div className="min-w-0 pc:flex-1"><main className="app-shell-main"><Page/></main></div></div></DirtyProvider></QueryClientProvider>);
