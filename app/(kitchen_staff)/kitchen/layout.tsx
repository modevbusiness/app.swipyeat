'use client';

import React, { useEffect } from 'react'
import Tabs from "@/components/tabs";
import { ChefHat, ClipboardList, User } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthProvider';
import { useRouter } from 'next/navigation';
import LoadingPage from '@/components/LoadingPage';
import { NewOrdersProvider, requestKitchenNotificationPermission } from '@/lib/context/NewOrdersProvider';
import KitchenNotifications from '@/components/kitchen/KitchenNotifications';


export default function KitchenLayout({ children }: { children: React.ReactNode }) {
    const tabs = [
        { name: 'home', to: '/kitchen', icon: <ChefHat /> },
        { name: 'orders', to: '/kitchen/orders', icon: <ClipboardList /> },
        { name: 'profile', to: '/kitchen/profile', icon: <User /> },
    ];
    const Router = useRouter();
    const { user, profile, loading } = useAuth();

    // Request notification permission on mount
    useEffect(() => {
        requestKitchenNotificationPermission();
    }, []);

    if (loading || !user || !profile) {
        return <main>
            <LoadingPage />
        </main>;
    } else if (user && profile) {
        if (profile.role === 'waiter') {
            Router.push('/');
        } else if (profile.role === 'kitchen_staff') {
            return (
                <main>
                    <NewOrdersProvider>
                        <KitchenNotifications />
                        <div>
                            {children}
                        </div>
                        <Tabs tabs={tabs} />
                    </NewOrdersProvider>
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
