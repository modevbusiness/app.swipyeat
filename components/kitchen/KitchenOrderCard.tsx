'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/context/AuthProvider';
import { useLanguage } from '@/lib/context/LanguageContext';
import CONTENT from '@/const/content';
import { Clock, ChefHat, CheckCircle2, AlertTriangle, User, Timer } from 'lucide-react';
import { OrderWithDetails, updateOrderStatus } from '@/lib/supabase/queries/getOrders';

interface KitchenOrderCardProps {
    order: OrderWithDetails;
    onStatusChange?: () => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; headerBg: string }> = {
    pending: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-l-amber-500',
        headerBg: 'bg-gradient-to-r from-amber-50 to-amber-100/50'
    },
    preparing: {
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        border: 'border-l-orange-500',
        headerBg: 'bg-gradient-to-r from-orange-50 to-orange-100/50'
    },
    ready: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-l-green-500',
        headerBg: 'bg-gradient-to-r from-green-50 to-green-100/50'
    },
};

export default function KitchenOrderCard({ order, onStatusChange }: KitchenOrderCardProps) {
    const { user } = useAuth();
    const { language } = useLanguage();
    const [isUpdating, setIsUpdating] = useState(false);

    const t = CONTENT[language].kitchenPage;

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString(language === 'ar' ? 'ar-SA' : language === 'fr' ? 'fr-FR' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getElapsedTime = (dateString: string) => {
        const created = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - created.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return { text: t.justNow, isUrgent: false };
        if (diffMins < 10) return { text: `${diffMins} ${t.minutesAgo}`, isUrgent: false };
        if (diffMins < 20) return { text: `${diffMins} ${t.minutesAgo}`, isUrgent: true };
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 1) return { text: `${diffMins} ${t.minutesAgo}`, isUrgent: true };
        return { text: `${diffHours}h ${diffMins % 60}m`, isUrgent: true };
    };

    const handleStartPreparing = async () => {
        if (!user?.id) return;
        setIsUpdating(true);
        await updateOrderStatus(order.id, 'preparing', user.id);
        onStatusChange?.();
        setIsUpdating(false);
    };

    const handleMarkReady = async () => {
        if (!user?.id) return;
        setIsUpdating(true);
        await updateOrderStatus(order.id, 'ready', user.id);
        onStatusChange?.();
        setIsUpdating(false);
    };

    const statusStyle = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
    const isPending = order.status === 'pending';
    const isPreparing = order.status === 'preparing';
    const elapsedTime = getElapsedTime(order.created_at);
    const totalItems = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

    return (
        <div className={`bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden border-l-4 ${statusStyle.border}`}>
            {/* Order Header - Prominent Table & Status */}
            <div className={`p-4 ${statusStyle.headerBg}`}>
                <div className="flex items-center justify-between">
                    {/* Left: Table Number (BIG) */}
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex flex-col items-center justify-center border border-gray-100">
                            <span className="text-xs text-gray-500 font-medium">{t.table}</span>
                            <span className="text-2xl font-bold text-primary">{order.table_number}</span>
                        </div>
                        <div>
                            <p className="text-lg font-bold text-gray-900">#{order.order_number}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 ${statusStyle.bg} ${statusStyle.text}`}>
                                    {isPending && <Clock className="w-4 h-4" />}
                                    {isPreparing && <ChefHat className="w-4 h-4" />}
                                    {isPending ? t.statusPending : isPreparing ? t.statusPreparing : t.statusReady}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Time Info */}
                    <div className="text-right">
                        <div className={`flex items-center justify-end gap-1.5 text-sm font-medium ${elapsedTime.isUrgent ? 'text-red-600' : 'text-gray-600'}`}>
                            <Timer className="w-4 h-4" />
                            <span>{elapsedTime.text}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{formatTime(order.created_at)}</p>
                        <p className="text-sm font-bold text-gray-700 mt-1">{totalItems} {t.items}</p>
                    </div>
                </div>
            </div>

            {/* Order Items - Clear & Readable */}
            <div className="p-4 divide-y divide-gray-100">
                {order.order_items?.map((item, index) => (
                    <div key={item.id} className={`flex items-start gap-4 ${index > 0 ? 'pt-3' : ''} ${index < (order.order_items?.length || 0) - 1 ? 'pb-3' : ''}`}>
                        {/* Quantity Badge */}
                        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                            <span className="text-lg font-bold text-white">{item.quantity}x</span>
                        </div>

                        {/* Item Details */}
                        <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-gray-900">{item.menu_item?.name}</p>

                            {/* Variant */}
                            {item.variant && (
                                <p className="text-sm text-gray-600 mt-0.5">
                                    📏 {item.variant.name}
                                </p>
                            )}

                            {/* Modifiers */}
                            {item.modifiers && item.modifiers.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {item.modifiers.map((m, idx) => (
                                        <span key={idx} className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
                                            + {m.modifier?.name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Special Instructions - VERY PROMINENT */}
                            {item.special_instructions && (
                                <div className="flex items-start gap-2 mt-2 p-3 bg-amber-100 border border-amber-300 rounded-xl">
                                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">{t.specialNote}</p>
                                        <p className="text-sm font-medium text-amber-900 mt-0.5">{item.special_instructions}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Customer/Waiter Notes - Prominent Section */}
            {(order.customer_notes || order.waiter_notes) && (
                <div className="px-4 pb-4 space-y-2">
                    {order.customer_notes && (
                        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <User className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">{t.customerNotes}</p>
                                <p className="text-sm text-amber-800 mt-0.5">{order.customer_notes}</p>
                            </div>
                        </div>
                    )}
                    {order.waiter_notes && (
                        <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                            <User className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">{t.waiterNotes}</p>
                                <p className="text-sm text-blue-800 mt-0.5">{order.waiter_notes}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Action Button - Large & Clear */}
            <div className="p-4 bg-gray-50 border-t border-gray-100">
                {isPending && (
                    <button
                        onClick={handleStartPreparing}
                        disabled={isUpdating}
                        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-3 disabled:opacity-50 text-lg"
                    >
                        {isUpdating ? (
                            <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <ChefHat className="w-6 h-6" />
                                {t.startPreparing}
                            </>
                        )}
                    </button>
                )}
                {isPreparing && (
                    <button
                        onClick={handleMarkReady}
                        disabled={isUpdating}
                        className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-green-500/25 flex items-center justify-center gap-3 disabled:opacity-50 text-lg"
                    >
                        {isUpdating ? (
                            <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <CheckCircle2 className="w-6 h-6" />
                                {t.markReady}
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
