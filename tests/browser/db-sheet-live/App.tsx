import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import DirtyProvider from '@/components/DirtyGuard';
import DesktopNav from '@/components/desktop/DesktopNav';
import TabBar from '@/components/TabBar';
import Page from '@/app/(app)/db-sheet/page';
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><DirtyProvider><div className="desktop-shell pc:flex"><DesktopNav/><div className="min-w-0 pc:flex-1"><main className="app-shell-main"><Page/></main></div><TabBar/></div></DirtyProvider></QueryClientProvider>);
