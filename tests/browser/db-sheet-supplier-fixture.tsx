/**
 * 「공급처별 성과」 목업 진입점 — 실제 DB관리시트 화면(app/(app)/db-sheet/page.tsx)을 앱 껍데기와 함께 그린다.
 * 데이터는 db-sheet-supplier-server.mjs 가 PGlite 위 실제 /api/db-sheet 경로로 내려 준다(합성 데이터만).
 * ?view=suppliers 처리는 페이지 자신이 한다 — 여기서 localStorage 를 미리 채우지 않는다(딥링크 검증이 거짓 통과하지 않게).
 */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import DirtyProvider from '@/components/DirtyGuard';
import DesktopNav from '@/components/desktop/DesktopNav';
import TabBar from '@/components/TabBar';
import Page from '@/app/(app)/db-sheet/page';
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><DirtyProvider><div className="desktop-shell pc:flex"><DesktopNav/><div className="min-w-0 pc:flex-1"><main className="app-shell-main"><Page/></main></div><TabBar/></div></DirtyProvider></QueryClientProvider>);
