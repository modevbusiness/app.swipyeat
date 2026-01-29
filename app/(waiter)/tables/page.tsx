"use client";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from '@/lib/context/AuthProvider'
import { useLanguage } from "@/lib/context/LanguageContext";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import CONTENT from "@/const/content";
import { Plus, Users, Clock, ChefHat, CheckCircle, XCircle } from "lucide-react";
import MenuModal from "@/components/MenuModal";
import { createOrder, OrderItemInput } from "@/lib/supabase/queries/createOrder";
import { getOrderById, OrderWithDetails, deleteOrder } from "@/lib/supabase/queries/getOrders";

type TableStatus = 'available' | 'occupied' | 'pending' | 'ready';

interface TableData {
    number: number;
    status: TableStatus;
    orderCount?: number;
    lastOrderTime?: string;
}

export default function Orders() {
    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading, profile } = useAuth();
    const [restaurant, setRestaurant] = useState<any>(null);
    const [tableNumber, setTableNumber] = useState<number>(0);
    const [tables, setTables] = useState<TableData[]>([]);
    const { language } = useLanguage();
    const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error'; message: string; orderNumber?: string }>({ show: false, type: 'success', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Edit mode state
    const [isEditMode, setIsEditMode] = useState(false);
    const [editOrderId, setEditOrderId] = useState<string | null>(null);
    const [initialOrderItems, setInitialOrderItems] = useState<OrderItemInput[]>([]);

    const showToast = (type: 'success' | 'error', message: string, orderNumber?: string) => {
        setToast({ show: true, type, message, orderNumber });
        setTimeout(() => setToast({ show: false, type: 'success', message: '' }), 4000);
    };

    // Handle edit mode from URL parameters
    useEffect(() => {
        const editId = searchParams.get('edit');
        const tableNum = searchParams.get('table');
        
        if (editId && tableNum) {
            setEditOrderId(editId);
            setIsEditMode(true);
            setSelectedTable(tableNum);
            
            // Fetch the order details
            const fetchOrderForEdit = async () => {
                const { order, error } = await getOrderById(editId);
                if (order && order.order_items) {
                    // Convert order items to the format expected by MenuModal
                    const items: OrderItemInput[] = order.order_items.map(item => ({
                        id: item.id,
                        menuItem: item.menu_item,
                        selectedVariant: item.variant || null,
                        selectedModifiers: item.modifiers?.map(m => ({
                            modifier: m.modifier,
                            quantity: m.quantity
                        })) || [],
                        quantity: item.quantity,
                        specialInstructions: item.special_instructions || '',
                        totalPrice: item.subtotal
                    }));
                    setInitialOrderItems(items);
                    setIsMenuModalOpen(true);
                } else {
                    showToast('error', 'Failed to load order for editing');
                    // Clear URL params
                    router.replace('/tables');
                }
            };
            
            fetchOrderForEdit();
        }
    }, [searchParams, router]);

    const handleConfirmOrder = async (orderItems: OrderItemInput[], table: string) => {
        if (!restaurant?.id || !user?.id) {
            showToast('error', CONTENT[language].ordersPage.orderError || 'Missing restaurant or user information');
            return;
        }

        setIsSubmitting(true);
        
        // If in edit mode, delete the old order first
        if (isEditMode && editOrderId) {
            const { success: deleteSuccess } = await deleteOrder(editOrderId);
            if (!deleteSuccess) {
                showToast('error', 'Failed to update order');
                setIsSubmitting(false);
                return;
            }
        }
        
        const result = await createOrder({
            restaurantId: restaurant.id,
            tableNumber: table,
            createdBy: user.id,
            orderItems: orderItems,
        });

        setIsSubmitting(false);

        if (result.success) {
            showToast('success', isEditMode ? 'Order updated successfully!' : (CONTENT[language].ordersPage.orderSuccess || 'Order created successfully!'), result.orderNumber);
            // Update table status to pending
            setTables(prev => prev.map(t => 
                t.number === parseInt(table) 
                    ? { ...t, status: 'pending' as TableStatus, orderCount: (t.orderCount || 0) + (isEditMode ? 0 : 1) }
                    : t
            ));
            
            // Clear edit mode
            if (isEditMode) {
                setIsEditMode(false);
                setEditOrderId(null);
                setInitialOrderItems([]);
                router.replace('/tables');
            }
        } else {
            showToast('error', result.error || CONTENT[language].ordersPage.orderError || 'Failed to create order');
        }
    };

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
                    setTableNumber(data?.number_of_tables || 0);
                    // Initialize tables with mock status (replace with real data later)
                    const initialTables: TableData[] = Array.from(
                        { length: data?.number_of_tables || 0 },
                        (_, idx) => ({
                            number: idx + 1,
                            status: 'available' as TableStatus,
                            orderCount: 0
                        })
                    );
                    setTables(initialTables);
                }
            }
        };
        getRestaurant();
    }, [profile]);

    const getStatusConfig = (status: TableStatus) => {
        const t = CONTENT[language].ordersPage;
        switch (status) {
            case 'available':
                return {
                    bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100',
                    border: 'border-emerald-200',
                    badge: 'bg-emerald-500',
                    badgeText: t.available,
                    icon: null
                };
            case 'occupied':
                return {
                    bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
                    border: 'border-blue-200',
                    badge: 'bg-blue-500',
                    badgeText: t.occupied,
                    icon: <Users className="w-4 h-4" />
                };
            case 'pending':
                return {
                    bg: 'bg-gradient-to-br from-amber-50 to-amber-100',
                    border: 'border-amber-200',
                    badge: 'bg-amber-500',
                    badgeText: t.pending,
                    icon: <Clock className="w-4 h-4" />
                };
            case 'ready':
                return {
                    bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
                    border: 'border-purple-200',
                    badge: 'bg-purple-500',
                    badgeText: t.ready,
                    icon: <ChefHat className="w-4 h-4" />
                };
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">
                            {restaurant?.name || 'Restaurant'}
                        </h1>
                        <p className="text-sm text-gray-500">
                            {tableNumber} {CONTENT[language].ordersPage.tables} • {CONTENT[language].ordersPage.manageOrders}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-xs font-medium text-emerald-700">{CONTENT[language].ordersPage.live}</span>
                        </div>
                    </div>
                </div>

                {/* Status Legend */}
                <div className="flex gap-3 mt-4 overflow-x-auto no-scrollbar pb-1">
                    {[
                        { color: 'bg-emerald-500', label: CONTENT[language].ordersPage.available },
                        { color: 'bg-blue-500', label: CONTENT[language].ordersPage.occupied },
                        { color: 'bg-amber-500', label: CONTENT[language].ordersPage.pending },
                        { color: 'bg-purple-500', label: CONTENT[language].ordersPage.ready },
                    ].map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5 min-w-max">
                            <div className={`w-2.5 h-2.5 rounded-full ${item.color}`}></div>
                            <span className="text-xs text-gray-600">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tables Grid */}
            <div className="p-4">
                <div className="grid md:grid-cols-4 sm:grid-cols-3 grid-cols-2 gap-3">
                    {tables.map((table) => {
                        const config = getStatusConfig(table.status);
                        return (
                            <div
                                key={table.number}
                                className={`${config.bg} ${config.border} border-2 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col`}
                            >
                                {/* Table Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                            <span className="text-lg font-bold text-gray-800">{table.number}</span>
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-semibold text-gray-800">{CONTENT[language].ordersPage.table} {table.number}</h2>
                                            {table.orderCount && table.orderCount > 0 ? (
                                                <p className="text-xs text-gray-500">{table.orderCount} {CONTENT[language].ordersPage.orders}</p>
                                            ) : (
                                                <p className="text-xs text-gray-500">{CONTENT[language].ordersPage.noOrders}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Status Badge */}
                                <div className="flex items-center gap-1.5 mb-3">
                                    <span className={`${config.badge} text-white text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1`}>
                                        {config.icon}
                                        {config.badgeText}
                                    </span>
                                </div>

                                {/* Action Button */}
                                <button
                                    onClick={() => {
                                        setIsMenuModalOpen(true);
                                        setSelectedTable(`${table.number}`);
                                    }}
                                    className="mt-auto flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                                >
                                    <Plus size={18} strokeWidth={2.5} />
                                    <span className="text-sm">{CONTENT[language].waiterHome.addAnOrder}</span>
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Empty State */}
                {tables.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Users className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">{CONTENT[language].ordersPage.noTablesFound}</h3>
                        <p className="text-sm text-gray-500 text-center max-w-xs">
                            {CONTENT[language].ordersPage.noTablesDesc}
                        </p>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-500">{CONTENT[language].ordersPage.loadingTables}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Menu Modal */}
            <MenuModal
                isOpen={isMenuModalOpen}
                onClose={() => {
                    setIsMenuModalOpen(false);
                    // Clear edit mode when closing
                    if (isEditMode) {
                        setIsEditMode(false);
                        setEditOrderId(null);
                        setInitialOrderItems([]);
                        router.replace('/tables');
                    }
                }}
                table={selectedTable}
                restaurantId={restaurant?.id || ""}
                onConfirmOrder={handleConfirmOrder}
                initialOrderItems={initialOrderItems}
                isEditMode={isEditMode}
                editOrderId={editOrderId || undefined}
            />

            {/* Toast Notification */}
            {toast.show && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-up ${
                    toast.type === 'success' 
                        ? 'bg-green-500 text-white' 
                        : 'bg-red-500 text-white'
                }`}>
                    {toast.type === 'success' ? (
                        <CheckCircle className="w-6 h-6" />
                    ) : (
                        <XCircle className="w-6 h-6" />
                    )}
                    <div>
                        <p className="font-semibold">{toast.message}</p>
                        {toast.orderNumber && (
                            <p className="text-sm opacity-90">#{toast.orderNumber}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
