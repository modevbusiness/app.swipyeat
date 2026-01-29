'use client';

import React from 'react'
import Tabs from "@/components/tabs";
import { House, ClipboardPlus, User, Scan, Grid2X2 } from 'lucide-react';
import { KitchenAlertsProvider } from '@/lib/context/KitchenAlertsProvider';
import GlobalNotifications from '@/components/GlobalNotifications';
import { useAuth } from '@/lib/context/AuthProvider';
import { useRouter } from 'next/navigation';
import LoadingPage from '@/components/LoadingPage';


export default function layout({ children }: { children: React.ReactNode }) {
  const tabs = [
    { name: 'home', to: '/', icon: <House /> },
    { name: 'orders', to: '/orders', icon: <ClipboardPlus /> },
    { name: 'scan', to: '/scan', icon: <Scan /> },
    { name: 'tables', to: '/tables', icon: <Grid2X2 /> },
    { name: 'profile', to: '/profile', icon: <User /> },
  ];
  const Router = useRouter();
  const { user, profile, loading } = useAuth();
  if (loading || !user || !profile) {
    return <main>
      <LoadingPage />
    </main>;
  } else if (user && profile) {
    if (profile.role === 'kitchen_staff') {
      Router.push('/kitchen');
    } else if (profile.role === 'waiter') {
      return (
        <main>
            <KitchenAlertsProvider>
              <GlobalNotifications />
              <div>
                {children}
              </div>
              <Tabs tabs={tabs} />
            </KitchenAlertsProvider>
        </main>
      )
    } else {
      return (<main>
        <h1>403 - Forbidden</h1>
        <p>You do not have access to this page.</p>
      </main>);
    }
  }
}
