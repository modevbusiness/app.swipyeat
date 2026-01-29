"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from '@/lib/context/AuthProvider'
import { useLanguage } from "@/lib/context/LanguageContext";
import CONTENT from "@/const/content";
import Image from "next/image";
import { ChefHat, Clock, Utensils, RefreshCw, Flame, CheckCircle2 } from "lucide-react";
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Link from "next/link";
import { getOrders, OrderWithDetails } from "@/lib/supabase/queries/getOrders";
import KitchenOrderCard from "@/components/kitchen/KitchenOrderCard";

export default function KitchenHome() {
    const supabase = createClient();
    const { user, loading, profile } = useAuth();
    const [restaurant, setRestaurant] = useState<any>(null);
    const { language } = useLanguage();
    const [orders, setOrders] = useState<OrderWithDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const t = CONTENT[language].kitchenPage;

    // Get greeting based on time of day
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return language === 'ar' ? 'صباح الخير' : language === 'fr' ? 'Bonjour' : 'Good Morning';
        if (hour < 18) return language === 'ar' ? 'مساء الخير' : language === 'fr' ? 'Bon après-midi' : 'Good Afternoon';
        return language === 'ar' ? 'مساء الخير' : language === 'fr' ? 'Bonsoir' : 'Good Evening';
    }, [language]);

    useEffect(() => {
        const getRestaurant = async () => {
            if (profile?.restaurant_id) {
                const { data, error } = await supabase
                    .from('restaurants')
                    .select('*')
                    .eq('id', profile.restaurant_id)
                    .single();
                if (error) {
                    console.error('Error fetching restaurant:', error);
                } else {
                    setRestaurant(data);
                }
            }
        };
        getRestaurant();
    }, [profile, supabase]);

    const fetchOrders = useCallback(async () => {
        if (!profile?.restaurant_id) return;

        setIsLoading(true);
        const { orders: fetchedOrders } = await getOrders({
            restaurantId: profile.restaurant_id,
            status: ['pending', 'preparing'],
        });

        if (fetchedOrders) {
            setOrders(fetchedOrders);
        }
        setIsLoading(false);
    }, [profile?.restaurant_id]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // Real-time subscription for order updates
    useEffect(() => {
        if (!profile?.restaurant_id) return;

        const channel = supabase
            .channel('kitchen-orders')
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

    const pendingOrders = orders.filter(o => o.status === 'pending');
    const preparingOrders = orders.filter(o => o.status === 'preparing');

    return (
        <div className="bg-gradient-primary min-h-screen flex flex-col pb-24">
            {/* Header Section */}
            <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-100">
                <div className="px-4 py-4 max-w-lg mx-auto">
                    <div className="flex gap-3 items-center">
                        <div className="relative">
                            <Image
                                src={profile?.avatar_url ?? "/default-avatar.png"}
                                alt="Profile Picture"
                                width={48}
                                height={48}
                                className="rounded-full ring-2 ring-primary/20 ring-offset-2"
                            />
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white"></span>
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-gray-500 font-medium">{greeting} 👋</p>
                            <h1 className="text-lg font-bold text-gray-900">{profile?.name || t.chef}</h1>
                            <div className="flex items-center gap-1.5 text-sm text-gray-500">
                                <Utensils size={14} className="text-primary" />
                                <p className="truncate max-w-[150px]">{restaurant?.name || 'Loading...'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
                            >
                                <RefreshCw size={22} className={`text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </button>
                            <LanguageSwitcher />
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Section */}
            <div className="px-4 pt-5 max-w-lg mx-auto w-full">
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                                <Clock size={24} className="text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{pendingOrders.length}</p>
                                <p className="text-sm text-gray-500">{t.pendingOrders}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                                <Flame size={24} className="text-orange-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{preparingOrders.length}</p>
                                <p className="text-sm text-gray-500">{t.preparingOrders}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pending Orders Section */}
            <div className="px-4 pt-6 max-w-lg mx-auto w-full">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                            <Clock size={18} className="text-amber-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">{t.newOrders}</h2>
                    </div>
                    <Link
                        href="/kitchen/orders?status=pending"
                        className="text-sm font-medium text-primary"
                    >
                        {t.viewAll}
                    </Link>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : pendingOrders.length > 0 ? (
                    <div className="space-y-3">
                        {pendingOrders.slice(0, 3).map(order => (
                            <KitchenOrderCard
                                key={order.id}
                                order={order}
                                onStatusChange={fetchOrders}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <CheckCircle2 size={24} className="text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">{t.noNewOrders}</p>
                        <p className="text-gray-400 text-sm mt-1">{t.noNewOrdersDesc}</p>
                    </div>
                )}
            </div>

            {/* Preparing Orders Section */}
            <div className="px-4 pt-6 max-w-lg mx-auto w-full">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                            <ChefHat size={18} className="text-orange-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">{t.inProgress}</h2>
                    </div>
                    <Link
                        href="/kitchen/orders?status=preparing"
                        className="text-sm font-medium text-primary"
                    >
                        {t.viewAll}
                    </Link>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : preparingOrders.length > 0 ? (
                    <div className="space-y-3">
                        {preparingOrders.slice(0, 3).map(order => (
                            <KitchenOrderCard
                                key={order.id}
                                order={order}
                                onStatusChange={fetchOrders}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <ChefHat size={24} className="text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">{t.noPreparingOrders}</p>
                        <p className="text-gray-400 text-sm mt-1">{t.noPreparingOrdersDesc}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
