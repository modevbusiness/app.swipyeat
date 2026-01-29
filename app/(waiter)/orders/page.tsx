"use client";

import { useAuth } from '@/lib/context/AuthProvider';
import { useLanguage } from "@/lib/context/LanguageContext";
import { useEffect, useState, useCallback } from "react";
import CONTENT from "@/const/content";
import { 
    Clock, 
    ChefHat, 
    CheckCircle, 
    XCircle, 
    RefreshCw, 
    Filter,
    ChevronDown,
    ChevronUp,
    UtensilsCrossed,
    AlertCircle,
    MoreVertical,
    CreditCard
} from "lucide-react";
import { getOrders, OrderWithDetails, updateOrderStatus, deleteOrder } from "@/lib/supabase/queries/getOrders";
import { OrderStatus } from "@/const/data.type";
import OrderActionsModal from "@/components/OrderActionsModal";

type StatusFilter = 'all' | OrderStatus;

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    pending: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    validated: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    preparing: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
    ready: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
    served: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
    paid: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    canceled: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
    pending: <Clock className="w-4 h-4" />,
    validated: <CheckCircle className="w-4 h-4" />,
    preparing: <ChefHat className="w-4 h-4" />,
    ready: <UtensilsCrossed className="w-4 h-4" />,
    served: <CheckCircle className="w-4 h-4" />,
    paid: <CheckCircle className="w-4 h-4" />,
    canceled: <XCircle className="w-4 h-4" />,
};

export default function MyOrders() {
    const { user, loading: authLoading, profile } = useAuth();
    const { language } = useLanguage();
    const [orders, setOrders] = useState<OrderWithDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
    const [showActionsModal, setShowActionsModal] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const t = CONTENT[language].myOrdersPage;

    const fetchOrders = useCallback(async () => {
        if (!profile?.restaurant_id || !user?.id) return;
        
        setIsLoading(true);
        const { orders: fetchedOrders, error } = await getOrders({
            restaurantId: profile.restaurant_id,
            createdBy: user.id,
            status: statusFilter === 'all' ? undefined : statusFilter,
        });
        
        if (fetchedOrders) {
            setOrders(fetchedOrders);
        }
        setIsLoading(false);
    }, [profile?.restaurant_id, user?.id, statusFilter]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // Auto-hide toast after 3 seconds
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchOrders();
        setIsRefreshing(false);
    };

    const toggleOrderExpand = (orderId: string) => {
        setExpandedOrders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(orderId)) {
                newSet.delete(orderId);
            } else {
                newSet.add(orderId);
            }
            return newSet;
        });
    };

    const handleMarkAsServed = async (orderId: string) => {
        if (!user?.id) return;
        
        setUpdatingOrderId(orderId);
        const { success } = await updateOrderStatus(orderId, 'served', user.id);
        
        if (success) {
            setOrders(prev => prev.map(order => 
                order.id === orderId ? { ...order, status: 'served' as OrderStatus } : order
            ));
            showToast(t.orderMarkedServed, 'success');
        } else {
            showToast(t.actionFailed, 'error');
        }
        setUpdatingOrderId(null);
    };

    const handleMarkAsPaid = async (orderId: string) => {
        if (!user?.id) return;
        
        setUpdatingOrderId(orderId);
        const { success } = await updateOrderStatus(orderId, 'paid', user.id);
        
        if (success) {
            setOrders(prev => prev.map(order => 
                order.id === orderId ? { ...order, status: 'paid' as OrderStatus } : order
            ));
            showToast(t.orderMarkedPaid, 'success');
        } else {
            showToast(t.actionFailed, 'error');
        }
        setUpdatingOrderId(null);
    };

    const handleCancelOrder = async (orderId: string, reason: string) => {
        if (!user?.id) return;
        
        setUpdatingOrderId(orderId);
        const { success } = await updateOrderStatus(orderId, 'canceled', user.id, reason);
        
        if (success) {
            setOrders(prev => prev.map(order => 
                order.id === orderId ? { 
                    ...order, 
                    status: 'canceled' as OrderStatus,
                    cancellation_reason: reason 
                } : order
            ));
            showToast(t.orderCanceled, 'success');
        } else {
            showToast(t.actionFailed, 'error');
        }
        setUpdatingOrderId(null);
    };

    const handleDeleteOrder = async (orderId: string) => {
        setUpdatingOrderId(orderId);
        const { success, error } = await deleteOrder(orderId);
        
        if (success) {
            setOrders(prev => prev.filter(order => order.id !== orderId));
            showToast(t.orderDeleted, 'success');
        } else {
            showToast(error || t.actionFailed, 'error');
        }
        setUpdatingOrderId(null);
    };

    const handleEditOrder = (order: OrderWithDetails) => {
        // TODO: Navigate to edit order page or open edit modal
        // For now, we'll navigate to a tables page where the order can be edited
        // This could be enhanced to open a modal with the menu for editing
        console.log('Edit order:', order);
        showToast('Edit order feature coming soon', 'success');
    };

    const openActionsModal = (order: OrderWithDetails, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedOrder(order);
        setShowActionsModal(true);
    };

    const closeActionsModal = () => {
        setShowActionsModal(false);
        setSelectedOrder(null);
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString(language === 'ar' ? 'ar-SA' : language === 'fr' ? 'fr-FR' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return t.today;
        } else if (date.toDateString() === yesterday.toDateString()) {
            return t.yesterday;
        }
        
        return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : language === 'fr' ? 'fr-FR' : 'en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    const getStatusLabel = (status: string) => {
        const statusLabels: Record<string, string> = {
            pending: t.statusPending,
            validated: t.statusValidated,
            preparing: t.statusPreparing,
            ready: t.statusReady,
            served: t.statusServed,
            paid: t.statusPaid,
            canceled: t.statusCanceled,
        };
        return statusLabels[status] || status;
    };

    const filterOptions: { value: StatusFilter; label: string }[] = [
        { value: 'all', label: t.filterAll },
        { value: 'pending', label: t.statusPending },
        { value: 'preparing', label: t.statusPreparing },
        { value: 'ready', label: t.statusReady },
        { value: 'served', label: t.statusServed },
        { value: 'paid', label: t.statusPaid },
        { value: 'canceled', label: t.statusCanceled },
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{t.title}</h1>
                        <p className="text-sm text-gray-500">{orders.length} {t.ordersCount}</p>
                    </div>
                    <button 
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-5 h-5 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Filter Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                        <Filter className="w-4 h-4" />
                        <span>{filterOptions.find(f => f.value === statusFilter)?.label}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showFilterDropdown && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
                            <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-20 min-w-45">
                                {filterOptions.map(option => (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            setStatusFilter(option.value);
                                            setShowFilterDropdown(false);
                                        }}
                                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                                            statusFilter === option.value ? 'text-primary font-medium bg-primary/5' : 'text-gray-700'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Orders List */}
            <div className="p-4 space-y-3">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-500">{t.loading}</p>
                        </div>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <UtensilsCrossed className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">{t.noOrders}</h3>
                        <p className="text-sm text-gray-500 text-center max-w-xs">{t.noOrdersDesc}</p>
                    </div>
                ) : (
                    orders.map(order => {
                        const isExpanded = expandedOrders.has(order.id);
                        const statusColor = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
                        const statusIcon = STATUS_ICONS[order.status];
                        const canQuickServe = order.status === 'ready';
                        const canQuickPay = order.status === 'served';
                        
                        return (
                            <div 
                                key={order.id} 
                                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                            >
                                {/* Order Header */}
                                <div className="p-4 flex items-center justify-between">
                                    <button
                                        onClick={() => toggleOrderExpand(order.id)}
                                        className="flex items-center gap-3 flex-1 text-left"
                                    >
                                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                                            <span className="text-lg font-bold text-primary">{order.table_number}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-semibold text-gray-900">#{order.order_number}</h3>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${statusColor.bg} ${statusColor.text}`}>
                                                    {statusIcon}
                                                    {getStatusLabel(order.status)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500 truncate">
                                                {t.table} {order.table_number} • {formatDate(order.created_at)} {formatTime(order.created_at)}
                                            </p>
                                        </div>
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-primary text-sm">{order.total_amount.toFixed(2)} MAD</span>
                                    </div>
                                </div>

                                {/* Expanded Order Details */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100">
                                        {/* Order Items */}
                                        <div className="p-4 space-y-3">
                                            {order.order_items?.map(item => (
                                                <div key={item.id} className="flex gap-3">
                                                    <img 
                                                        src={item.menu_item?.image_url || '/defaultfood.avif'} 
                                                        alt={item.menu_item?.name}
                                                        className="w-16 h-16 object-cover rounded-lg shrink-0"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between">
                                                            <h4 className="font-medium text-gray-900 text-sm">{item.menu_item?.name}</h4>
                                                            <span className="text-sm font-medium text-gray-700">x{item.quantity}</span>
                                                        </div>
                                                        {item.variant && (
                                                            <p className="text-xs text-gray-500">{item.variant.name}</p>
                                                        )}
                                                        {item.modifiers && item.modifiers.length > 0 && (
                                                            <p className="text-xs text-gray-500">
                                                                + {item.modifiers.map(m => m.modifier?.name).filter(Boolean).join(', ')}
                                                            </p>
                                                        )}
                                                        {item.special_instructions && (
                                                            <p className="text-xs text-orange-600 italic mt-1">"{item.special_instructions}"</p>
                                                        )}
                                                        <p className="text-sm font-medium text-primary mt-1">{item.subtotal.toFixed(2)} MAD</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Notes */}
                                        {(order.customer_notes || order.waiter_notes) && (
                                            <div className="px-4 pb-3 space-y-2">
                                                {order.customer_notes && (
                                                    <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
                                                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="text-xs font-medium text-amber-700">{t.customerNotes}</p>
                                                            <p className="text-xs text-amber-600">{order.customer_notes}</p>
                                                        </div>
                                                    </div>
                                                )}
                                                {order.waiter_notes && (
                                                    <div className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
                                                        <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="text-xs font-medium text-blue-700">{t.waiterNotes}</p>
                                                            <p className="text-xs text-blue-600">{order.waiter_notes}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Cancellation Reason */}
                                        {order.status === 'canceled' && order.cancellation_reason && (
                                            <div className="px-4 pb-3">
                                                <div className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
                                                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs font-medium text-red-700">{t.cancellationReason}</p>
                                                        <p className="text-xs text-red-600">{order.cancellation_reason}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Order Total & Actions */}
                                        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="font-medium text-gray-700">{t.total}</span>
                                                <span className="text-lg font-bold text-primary">{order.total_amount.toFixed(2)} MAD</span>
                                            </div>
                                            
                                            {/* Action Buttons */}
                                            <div className="flex gap-2">
                                                {order.status === 'ready' && (
                                                    <button
                                                        onClick={() => handleMarkAsServed(order.id)}
                                                        disabled={updatingOrderId === order.id}
                                                        className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                                    >
                                                        {updatingOrderId === order.id ? (
                                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <>
                                                                <CheckCircle className="w-5 h-5" />
                                                                {t.markAsServed}
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                                {order.status === 'served' && (
                                                    <button
                                                        onClick={() => handleMarkAsPaid(order.id)}
                                                        disabled={updatingOrderId === order.id}
                                                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                                    >
                                                        {updatingOrderId === order.id ? (
                                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <>
                                                                <CreditCard className="w-5 h-5" />
                                                                {t.markAsPaid}
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                                {order.status !== 'paid' && order.status !== 'canceled' && (
                                                    <button
                                                        onClick={(e) => openActionsModal(order, e)}
                                                        className={`${order.status === 'ready' || order.status === 'served' ? 'px-4' : 'flex-1'} py-3 bg-gray-200 hover:bg-gray-300 rounded-xl transition-colors flex items-center justify-center gap-2`}
                                                    >
                                                        <MoreVertical className="w-5 h-5 text-gray-600" />
                                                        {order.status !== 'ready' && order.status !== 'served' && (
                                                            <span className="font-medium text-gray-700">{t.orderActions}</span>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Order Actions Modal */}
            <OrderActionsModal
                isOpen={showActionsModal}
                onClose={closeActionsModal}
                order={selectedOrder}
                onMarkAsServed={handleMarkAsServed}
                onMarkAsPaid={handleMarkAsPaid}
                onCancelOrder={handleCancelOrder}
                onDeleteOrder={handleDeleteOrder}
                onEditOrder={handleEditOrder}
                isProcessing={updatingOrderId !== null}
                translations={{
                    orderActions: t.orderActions,
                    markAsServed: t.markAsServed,
                    markAsPaid: t.markAsPaid,
                    editOrder: t.editOrder,
                    cancelOrder: t.cancelOrder,
                    deleteOrder: t.deleteOrder,
                    confirmServed: t.confirmServed,
                    confirmServedDesc: t.confirmServedDesc,
                    confirmPaid: t.confirmPaid,
                    confirmPaidDesc: t.confirmPaidDesc,
                    confirmCancel: t.confirmCancel,
                    confirmCancelDesc: t.confirmCancelDesc,
                    confirmDelete: t.confirmDelete,
                    confirmDeleteDesc: t.confirmDeleteDesc,
                    confirm: t.confirm,
                    cancel: t.cancel,
                    cancellationReason: t.cancellationReason,
                    cancellationReasonPlaceholder: t.cancellationReasonPlaceholder,
                }}
            />

            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
                    <div className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 ${
                        toast.type === 'success' 
                            ? 'bg-green-500 text-white' 
                            : 'bg-red-500 text-white'
                    }`}>
                        {toast.type === 'success' ? (
                            <CheckCircle className="w-5 h-5" />
                        ) : (
                            <XCircle className="w-5 h-5" />
                        )}
                        <span className="font-medium">{toast.message}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
