"use client";

import { useAuth } from '@/lib/context/AuthProvider';
import { useLanguage } from "@/lib/context/LanguageContext";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from 'next/navigation';
import CONTENT from "@/const/content";
import {
    Clock,
    ChefHat,
    CheckCircle2,
    RefreshCw,
    UtensilsCrossed
} from "lucide-react";
import { getOrders, OrderWithDetails } from "@/lib/supabase/queries/getOrders";
import KitchenOrderCard from "@/components/kitchen/KitchenOrderCard";
import { createClient } from "@/lib/supabase/client";

type StatusFilter = 'all' | 'pending' | 'preparing' | 'ready';

export default function KitchenOrders() {
    const { profile } = useAuth();
    const { language } = useLanguage();
    const searchParams = useSearchParams();
    const [orders, setOrders] = useState<OrderWithDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(
        (searchParams.get('status') as StatusFilter) || 'all'
    );
    const [isRefreshing, setIsRefreshing] = useState(false);
    const supabase = createClient();

    const t = CONTENT[language].kitchenPage;

    const fetchOrders = useCallback(async () => {
        if (!profile?.restaurant_id) return;

        setIsLoading(true);
        const statusList = statusFilter === 'all'
            ? ['pending', 'preparing', 'ready']
            : [statusFilter];

        const { orders: fetchedOrders } = await getOrders({
            restaurantId: profile.restaurant_id,
            status: statusList,
        });

        if (fetchedOrders) {
            setOrders(fetchedOrders);
        }
        setIsLoading(false);
    }, [profile?.restaurant_id, statusFilter]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // Real-time subscription
    useEffect(() => {
        if (!profile?.restaurant_id) return;

        const channel = supabase
            .channel('kitchen-orders-page')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `restaurant_id=eq.${profile.restaurant_id}`,
                },
                () => {
                    fetchOrders();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.restaurant_id, supabase, fetchOrders]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchOrders();
        setIsRefreshing(false);
    };

    // Calculate counts for all statuses from the full order list
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const preparingCount = orders.filter(o => o.status === 'preparing').length;
    const readyCount = orders.filter(o => o.status === 'ready').length;

    const filterTabs: { value: StatusFilter; label: string; icon: React.ReactNode; count: number; color: string; activeColor: string }[] = [
        {
            value: 'all',
            label: t.filterAll,
            icon: <UtensilsCrossed className="w-5 h-5" />,
            count: orders.length,
            color: 'bg-gray-100 text-gray-700 border-gray-200',
            activeColor: 'bg-primary text-white border-primary shadow-lg shadow-primary/25'
        },
        {
            value: 'pending',
            label: t.statusPending,
            icon: <Clock className="w-5 h-5" />,
            count: pendingCount,
            color: 'bg-amber-50 text-amber-700 border-amber-200',
            activeColor: 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/25'
        },
        {
            value: 'preparing',
            label: t.statusPreparing,
            icon: <ChefHat className="w-5 h-5" />,
            count: preparingCount,
            color: 'bg-orange-50 text-orange-700 border-orange-200',
            activeColor: 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/25'
        },
        {
            value: 'ready',
            label: t.statusReady,
            icon: <CheckCircle2 className="w-5 h-5" />,
            count: readyCount,
            color: 'bg-green-50 text-green-700 border-green-200',
            activeColor: 'bg-green-500 text-white border-green-500 shadow-lg shadow-green-500/25'
        },
    ];

    const filteredOrders = statusFilter === 'all'
        ? orders
        : orders.filter(o => o.status === statusFilter);

    return (
        <div className="min-h-screen bg-gray-100 pb-24">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-20 shadow-sm">
                <div className="flex items-center justify-between max-w-2xl mx-auto">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{t.ordersTitle}</h1>
                        <p className="text-sm text-gray-500">{filteredOrders.length} {t.ordersCount}</p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-6 h-6 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Filter Tabs - Sticky & Easy to Tap */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-[72px] z-10">
                <div className="grid grid-cols-4 gap-2 max-w-2xl mx-auto">
                    {filterTabs.map(tab => (
                        <button
                            key={tab.value}
                            onClick={() => setStatusFilter(tab.value)}
                            className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all duration-200 ${statusFilter === tab.value ? tab.activeColor : tab.color
                                }`}
                        >
                            {tab.icon}
                            <span className="text-xs font-semibold">{tab.label}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusFilter === tab.value
                                    ? 'bg-white/30'
                                    : 'bg-black/5'
                                }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Orders List */}
            <div className="p-4 space-y-4 max-w-2xl mx-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-500 font-medium">{t.loading}</p>
                        </div>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                            <UtensilsCrossed className="w-12 h-12 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">{t.noOrders}</h3>
                        <p className="text-sm text-gray-500 text-center max-w-xs">{t.noOrdersDesc}</p>
                    </div>
                ) : (
                    filteredOrders.map(order => (
                        <KitchenOrderCard
                            key={order.id}
                            order={order}
                            onStatusChange={fetchOrders}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
