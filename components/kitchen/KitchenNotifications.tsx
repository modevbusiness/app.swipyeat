'use client';

import { useEffect, useState } from 'react';
import { useNewOrders } from '@/lib/context/NewOrdersProvider';
import { useLanguage } from '@/lib/context/LanguageContext';
import CONTENT from '@/const/content';
import { Bell, X, Clock, ChefHat } from 'lucide-react';
import Link from 'next/link';

export default function KitchenNotifications() {
    const { pendingCount, preparingCount, newOrdersCount } = useNewOrders();
    const { language } = useLanguage();
    const [showBanner, setShowBanner] = useState(false);
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const [prevPendingCount, setPrevPendingCount] = useState(pendingCount);

    const t = CONTENT[language].kitchenPage;

    // Show banner when new pending orders arrive
    useEffect(() => {
        if (pendingCount > prevPendingCount && !bannerDismissed) {
            setShowBanner(true);
            // Auto-hide after 10 seconds
            const timer = setTimeout(() => {
                setShowBanner(false);
            }, 10000);
            return () => clearTimeout(timer);
        }
        setPrevPendingCount(pendingCount);
    }, [pendingCount, prevPendingCount, bannerDismissed]);

    // Reset banner dismissed when count changes
    useEffect(() => {
        if (pendingCount === 0) {
            setBannerDismissed(false);
        }
    }, [pendingCount]);

    const handleDismiss = () => {
        setShowBanner(false);
        setBannerDismissed(true);
    };

    if (!showBanner) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
                <div className="max-w-2xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                        {/* Left: Icon and Message */}
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center animate-pulse">
                                    <Bell className="w-6 h-6" />
                                </div>
                                <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold animate-bounce">
                                    {pendingCount}
                                </span>
                            </div>
                            <div>
                                <p className="font-bold text-lg">{t.newOrderAlert}</p>
                                <p className="text-sm text-white/90">
                                    {pendingCount} {t.newOrdersWaiting}
                                </p>
                            </div>
                        </div>

                        {/* Right: View Button and Dismiss */}
                        <div className="flex items-center gap-2">
                            <Link
                                href="/kitchen/orders?status=pending"
                                onClick={handleDismiss}
                                className="px-4 py-2 bg-white text-orange-600 font-semibold rounded-xl hover:bg-white/90 transition-colors flex items-center gap-2"
                            >
                                <Clock className="w-4 h-4" />
                                {t.viewNow}
                            </Link>
                            <button
                                onClick={handleDismiss}
                                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
