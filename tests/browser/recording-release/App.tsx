import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import DirtyProvider from '@/components/DirtyGuard';
import DesktopNav from '@/components/desktop/DesktopNav';
import TabBar from '@/components/TabBar';
import Page from '@/app/(app)/db-sheet/page';
import DeletedMeetings from '@/components/meeting-safety/DeletedMeetings';
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><DirtyProvider><div className="desktop-shell pc:flex"><DesktopNav/><div className="min-w-0 pc:flex-1"><main className="app-shell-main"><Page/><aside className="p-4"><small>합성 검증용 · 운영과 같은 미팅 보관함</small><DeletedMeetings/></aside></main></div><TabBar/></div></DirtyProvider></QueryClientProvider>);
