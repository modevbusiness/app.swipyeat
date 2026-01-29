"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    X, 
    CheckCircle, 
    XCircle, 
    Trash2, 
    Edit3, 
    CreditCard,
    AlertTriangle,
    ChefHat,
    FileText
} from 'lucide-react';
import { OrderWithDetails } from '@/lib/supabase/queries/getOrders';
import { OrderStatus } from '@/const/data.type';

type ActionType = 'served' | 'paid' | 'cancel' | 'delete' | null;

interface OrderActionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: OrderWithDetails | null;
    onMarkAsServed: (orderId: string) => Promise<void>;
    onMarkAsPaid: (orderId: string) => Promise<void>;
    onCancelOrder: (orderId: string, reason: string) => Promise<void>;
    onDeleteOrder: (orderId: string) => Promise<void>;
    onEditOrder: (order: OrderWithDetails) => void;
    isProcessing: boolean;
    translations: {
        orderActions: string;
        markAsServed: string;
        markAsPaid: string;
        editOrder: string;
        cancelOrder: string;
        deleteOrder: string;
        confirmServed: string;
        confirmServedDesc: string;
        confirmPaid: string;
        confirmPaidDesc: string;
        confirmCancel: string;
        confirmCancelDesc: string;
        confirmDelete: string;
        confirmDeleteDesc: string;
        confirm: string;
        cancel: string;
        cancellationReason: string;
        cancellationReasonPlaceholder: string;
    };
}

export default function OrderActionsModal({
    isOpen,
    onClose,
    order,
    onMarkAsServed,
    onMarkAsPaid,
    onCancelOrder,
    onDeleteOrder,
    onEditOrder,
    isProcessing,
    translations: t
}: OrderActionsModalProps) {
    const router = useRouter();
    const [activeAction, setActiveAction] = useState<ActionType>(null);
    const [cancellationReason, setCancellationReason] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setActiveAction(null);
            setCancellationReason('');
        }
    }, [isOpen]);

    if (!isOpen || !order) return null;

    // More permissive conditions - show actions for relevant workflow stages
    const canMarkAsServed = ['pending', 'validated', 'preparing', 'ready'].includes(order.status);
    const canMarkAsPaid = ['ready', 'served'].includes(order.status);
    const canCancel = ['pending', 'validated', 'preparing'].includes(order.status);
    const canDelete = ['pending', 'canceled'].includes(order.status);
    const canEditOrder = order.status === 'pending';

    const handleAction = async () => {
        if (!order) return;

        switch (activeAction) {
            case 'served':
                await onMarkAsServed(order.id);
                break;
            case 'paid':
                await onMarkAsPaid(order.id);
                break;
            case 'cancel':
                await onCancelOrder(order.id, cancellationReason);
                break;
            case 'delete':
                await onDeleteOrder(order.id);
                break;
        }
        setActiveAction(null);
        onClose();
    };

    const handleEditOrder = () => {
        if (order) {
            // Navigate to tables page with edit mode
            router.push(`/tables?edit=${order.id}&table=${order.table_number}`);
            onClose();
        }
    };

    const renderActionButtons = () => (
        <div className="space-y-2">
            {/* Mark as Served */}
            {canMarkAsServed && (
                <button
                    onClick={() => setActiveAction('served')}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-green-50 hover:bg-green-100 transition-colors border border-green-200"
                >
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-medium text-green-700">{t.markAsServed}</span>
                </button>
            )}

            {/* Mark as Paid */}
            {canMarkAsPaid && (
                <button
                    onClick={() => setActiveAction('paid')}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200"
                >
                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-medium text-emerald-700">{t.markAsPaid}</span>
                </button>
            )}

            {/* Edit Order */}
            {canEditOrder && (
                <button
                    onClick={handleEditOrder}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-200"
                >
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                        <Edit3 className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-medium text-blue-700">{t.editOrder}</span>
                </button>
            )}

            {/* Cancel Order */}
            {canCancel && (
                <button
                    onClick={() => setActiveAction('cancel')}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200"
                >
                    <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                        <XCircle className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-medium text-amber-700">{t.cancelOrder}</span>
                </button>
            )}

            {/* Delete Order */}
            {canDelete && (
                <button
                    onClick={() => setActiveAction('delete')}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-50 hover:bg-red-100 transition-colors border border-red-200"
                >
                    <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                        <Trash2 className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-medium text-red-700">{t.deleteOrder}</span>
                </button>
            )}
        </div>
    );

    const renderConfirmation = () => {
        let config = {
            icon: <CheckCircle className="w-8 h-8" />,
            iconBg: 'bg-green-500',
            title: '',
            description: '',
            buttonBg: 'bg-green-500 hover:bg-green-600',
        };

        switch (activeAction) {
            case 'served':
                config = {
                    icon: <CheckCircle className="w-8 h-8" />,
                    iconBg: 'bg-green-500',
                    title: t.confirmServed,
                    description: t.confirmServedDesc,
                    buttonBg: 'bg-green-500 hover:bg-green-600',
                };
                break;
            case 'paid':
                config = {
                    icon: <CreditCard className="w-8 h-8" />,
                    iconBg: 'bg-emerald-500',
                    title: t.confirmPaid,
                    description: t.confirmPaidDesc,
                    buttonBg: 'bg-emerald-500 hover:bg-emerald-600',
                };
                break;
            case 'cancel':
                config = {
                    icon: <AlertTriangle className="w-8 h-8" />,
                    iconBg: 'bg-amber-500',
                    title: t.confirmCancel,
                    description: t.confirmCancelDesc,
                    buttonBg: 'bg-amber-500 hover:bg-amber-600',
                };
                break;
            case 'delete':
                config = {
                    icon: <Trash2 className="w-8 h-8" />,
                    iconBg: 'bg-red-500',
                    title: t.confirmDelete,
                    description: t.confirmDeleteDesc,
                    buttonBg: 'bg-red-500 hover:bg-red-600',
                };
                break;
        }

        return (
            <div className="flex flex-col items-center text-center">
                <div className={`w-16 h-16 ${config.iconBg} rounded-full flex items-center justify-center text-white mb-4`}>
                    {config.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{config.title}</h3>
                <p className="text-sm text-gray-500 mb-6">{config.description}</p>

                {/* Cancellation reason input */}
                {activeAction === 'cancel' && (
                    <div className="w-full mb-6">
                        <label className="block text-sm font-medium text-gray-700 text-left mb-2">
                            {t.cancellationReason}
                        </label>
                        <textarea
                            value={cancellationReason}
                            onChange={(e) => setCancellationReason(e.target.value)}
                            placeholder={t.cancellationReasonPlaceholder}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                            rows={3}
                        />
                    </div>
                )}

                <div className="flex gap-3 w-full">
                    <button
                        onClick={() => setActiveAction(null)}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        {t.cancel}
                    </button>
                    <button
                        onClick={handleAction}
                        disabled={isProcessing}
                        className={`flex-1 px-4 py-3 rounded-xl font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center ${config.buttonBg}`}
                    >
                        {isProcessing ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            t.confirm
                        )}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                onClick={onClose}
            />
            
            {/* Bottom Sheet Modal */}
            <div className="fixed left-0 right-0 bottom-0 z-50 animate-slide-up flex justify-center">
                <div className="bg-white rounded-t-3xl shadow-xl max-h-[85vh] overflow-hidden w-full max-w-lg">
                    {/* Handle bar */}
                    <div className="flex justify-center pt-3 pb-2">
                        <div className="w-10 h-1 bg-gray-300 rounded-full" />
                    </div>
                    
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 pb-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                <span className="text-sm font-bold text-primary">{order.table_number}</span>
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-900">#{order.order_number}</h2>
                                <p className="text-xs text-gray-500">{order.total_amount.toFixed(2)} MAD</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                        >
                            <X className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>
                    
                    {/* Content */}
                    <div className="p-4 pb-8 overflow-y-auto max-h-[60vh]">
                        {activeAction === null && renderActionButtons()}
                        {activeAction !== null && renderConfirmation()}
                    </div>
                </div>
            </div>
        </>
    );
}
