import { createClient } from "@/lib/supabase/client";
import { Order, OrderItem, MenuItem, ItemVariant, Modifier } from "@/const/data.type";

export interface OrderItemWithDetails extends OrderItem {
    menu_item: MenuItem;
    variant: ItemVariant | null;
    modifiers: {
        id: string;
        modifier_id: string;
        quantity: number;
        unit_price: number;
        modifier: Modifier;
    }[];
}

export interface OrderWithDetails extends Order {
    order_items: OrderItemWithDetails[];
}

interface GetOrdersParams {
    restaurantId: string;
    createdBy?: string; // Filter by waiter
    status?: string | string[]; // Filter by status
    tableNumber?: string; // Filter by table
    limit?: number;
    offset?: number;
}

async function getOrders(params: GetOrdersParams): Promise<{ orders: OrderWithDetails[] | null; count: number; error: string | null }> {
    const supabase = createClient();
    
    const { restaurantId, createdBy, status, tableNumber, limit = 50, offset = 0 } = params;
    
    try {
        let query = supabase
            .from('orders')
            .select(`
                *,
                order_items(
                    *,
                    menu_item:menu_items(*),
                    variant:item_variants(*),
                    modifiers:order_item_modifiers(
                        *,
                        modifier:modifiers(*)
                    )
                )
            `, { count: 'exact' })
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        
        // Apply filters
        if (createdBy) {
            query = query.eq('created_by', createdBy);
        }
        
        if (status) {
            if (Array.isArray(status)) {
                query = query.in('status', status);
            } else {
                query = query.eq('status', status);
            }
        }
        
        if (tableNumber) {
            query = query.eq('table_number', tableNumber);
        }
        
        const { data, error, count } = await query;
        
        if (error) {
            console.error('Error fetching orders:', error);
            return { orders: null, count: 0, error: error.message };
        }
        
        return { orders: data as OrderWithDetails[], count: count || 0, error: null };
        
    } catch (error) {
        console.error('Unexpected error fetching orders:', error);
        return { orders: null, count: 0, error: 'An unexpected error occurred' };
    }
}

async function getOrderById(orderId: string): Promise<{ order: OrderWithDetails | null; error: string | null }> {
    const supabase = createClient();
    
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items(
                    *,
                    menu_item:menu_items(*),
                    variant:item_variants(*),
                    modifiers:order_item_modifiers(
                        *,
                        modifier:modifiers(*)
                    )
                )
            `)
            .eq('id', orderId)
            .single();
        
        if (error) {
            console.error('Error fetching order:', error);
            return { order: null, error: error.message };
        }
        
        return { order: data as OrderWithDetails, error: null };
        
    } catch (error) {
        console.error('Unexpected error fetching order:', error);
        return { order: null, error: 'An unexpected error occurred' };
    }
}

async function updateOrderStatus(
    orderId: string, 
    newStatus: string, 
    userId: string,
    notes?: string
): Promise<{ success: boolean; error: string | null }> {
    const supabase = createClient();
    
    try {
        // Get current order status
        const { data: currentOrder, error: fetchError } = await supabase
            .from('orders')
            .select('status')
            .eq('id', orderId)
            .single();
        
        if (fetchError) {
            return { success: false, error: fetchError.message };
        }
        
        const fromStatus = currentOrder?.status;
        
        // Update order status
        const updateData: Record<string, any> = { status: newStatus };
        
        // Set timestamp based on status
        const now = new Date().toISOString();
        switch (newStatus) {
            case 'validated':
                updateData.validated_at = now;
                updateData.validated_by = userId;
                break;
            case 'preparing':
                updateData.preparing_started_at = now;
                updateData.sent_to_kitchen_at = now;
                break;
            case 'ready':
                updateData.ready_at = now;
                break;
            case 'served':
                updateData.served_at = now;
                break;
            case 'completed':
                updateData.completed_at = now;
                break;
            case 'canceled':
                updateData.canceled_at = now;
                break;
        }
        
        const { error: updateError } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId);
        
        if (updateError) {
            return { success: false, error: updateError.message };
        }
        
        // Add status history
        await supabase
            .from('order_status_history')
            .insert({
                order_id: orderId,
                from_status: fromStatus,
                to_status: newStatus,
                changed_by: userId,
                notes: notes || null,
            });
        
        return { success: true, error: null };
        
    } catch (error) {
        console.error('Unexpected error updating order status:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

async function deleteOrder(orderId: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = createClient();
    
    try {
        // First check if the order can be deleted (only pending or canceled orders)
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('status')
            .eq('id', orderId)
            .single();
        
        if (fetchError) {
            return { success: false, error: fetchError.message };
        }
        
        if (!order) {
            return { success: false, error: 'Order not found' };
        }
        
        // Only allow deleting pending or canceled orders
        if (order.status !== 'pending' && order.status !== 'canceled') {
            return { success: false, error: 'Only pending or canceled orders can be deleted' };
        }
        
        // Get order item IDs first
        const { data: orderItems } = await supabase
            .from('order_items')
            .select('id')
            .eq('order_id', orderId);
        
        // Delete order item modifiers if there are order items
        if (orderItems && orderItems.length > 0) {
            const orderItemIds = orderItems.map(item => item.id);
            await supabase
                .from('order_item_modifiers')
                .delete()
                .in('order_item_id', orderItemIds);
        }
        
        // Delete order items
        const { error: itemsError } = await supabase
            .from('order_items')
            .delete()
            .eq('order_id', orderId);
        
        if (itemsError) {
            console.error('Error deleting order items:', itemsError);
        }
        
        // Delete status history
        const { error: historyError } = await supabase
            .from('order_status_history')
            .delete()
            .eq('order_id', orderId);
        
        if (historyError) {
            console.error('Error deleting order status history:', historyError);
        }
        
        // Delete the order
        const { error: deleteError } = await supabase
            .from('orders')
            .delete()
            .eq('id', orderId);
        
        if (deleteError) {
            return { success: false, error: deleteError.message };
        }
        
        return { success: true, error: null };
        
    } catch (error) {
        console.error('Unexpected error deleting order:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

async function updateOrderNotes(
    orderId: string,
    customerNotes?: string,
    waiterNotes?: string
): Promise<{ success: boolean; error: string | null }> {
    const supabase = createClient();
    
    try {
        const updateData: Record<string, any> = {};
        
        if (customerNotes !== undefined) {
            updateData.customer_notes = customerNotes || null;
        }
        if (waiterNotes !== undefined) {
            updateData.waiter_notes = waiterNotes || null;
        }
        
        const { error } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId);
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        return { success: true, error: null };
        
    } catch (error) {
        console.error('Unexpected error updating order notes:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

export { getOrders, getOrderById, updateOrderStatus, deleteOrder, updateOrderNotes };
