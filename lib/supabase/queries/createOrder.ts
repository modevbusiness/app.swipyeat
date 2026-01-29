import { createClient } from "@/lib/supabase/client";
import { MenuItem, ItemVariant, Modifier } from "@/const/data.type";

interface SelectedModifier {
    modifier: Modifier;
    quantity: number;
}

interface OrderItemInput {
    id: string;
    menuItem: MenuItem;
    selectedVariant: ItemVariant | null;
    selectedModifiers: SelectedModifier[];
    quantity: number;
    specialInstructions: string;
    totalPrice: number;
}

interface CreateOrderInput {
    restaurantId: string;
    tableNumber: string;
    createdBy: string; // User ID
    orderItems: OrderItemInput[];
    customerNotes?: string;
    waiterNotes?: string;
}

interface CreateOrderResult {
    success: boolean;
    orderId?: string;
    orderNumber?: string;
    error?: string;
}

async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const supabase = createClient();
    
    const { restaurantId, tableNumber, createdBy, orderItems, customerNotes, waiterNotes } = input;
    
    // Calculate total amount
    const totalAmount = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    
    try {
        // 1. Create the order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                restaurant_id: restaurantId,
                table_number: tableNumber,
                created_by: createdBy,
                status: 'pending',
                total_amount: totalAmount,
                customer_notes: customerNotes || null,
                waiter_notes: waiterNotes || null,
            })
            .select('id, order_number')
            .single();
        
        if (orderError) {
            console.error('Error creating order:', orderError);
            return { success: false, error: orderError.message };
        }
        
        if (!order) {
            return { success: false, error: 'Failed to create order' };
        }
        
        // 2. Create order items
        const orderItemsToInsert = orderItems.map(item => {
            // Calculate unit price (totalPrice / quantity gives the price per item with all modifiers)
            const unitPrice = item.totalPrice / item.quantity;
            
            return {
                order_id: order.id,
                menu_item_id: item.menuItem.id,
                variant_id: item.selectedVariant?.id || null,
                quantity: item.quantity,
                unit_price: unitPrice,
                subtotal: item.totalPrice,
                special_instructions: item.specialInstructions || null,
            };
        });
        
        const { data: insertedOrderItems, error: orderItemsError } = await supabase
            .from('order_items')
            .insert(orderItemsToInsert)
            .select('id');
        
        if (orderItemsError) {
            console.error('Error creating order items:', orderItemsError);
            // Rollback: delete the order
            await supabase.from('orders').delete().eq('id', order.id);
            return { success: false, error: orderItemsError.message };
        }
        
        // 3. Create order item modifiers
        if (insertedOrderItems && insertedOrderItems.length > 0) {
            const orderItemModifiersToInsert: {
                order_item_id: string;
                modifier_id: string;
                quantity: number;
                unit_price: number;
            }[] = [];
            
            orderItems.forEach((item, index) => {
                const orderItemId = insertedOrderItems[index]?.id;
                if (orderItemId && item.selectedModifiers.length > 0) {
                    item.selectedModifiers.forEach(mod => {
                        orderItemModifiersToInsert.push({
                            order_item_id: orderItemId,
                            modifier_id: mod.modifier.id,
                            quantity: mod.quantity,
                            unit_price: mod.modifier.price,
                        });
                    });
                }
            });
            
            if (orderItemModifiersToInsert.length > 0) {
                const { error: modifiersError } = await supabase
                    .from('order_item_modifiers')
                    .insert(orderItemModifiersToInsert);
                
                if (modifiersError) {
                    console.error('Error creating order item modifiers:', modifiersError);
                    // Note: We don't rollback here as the main order is created
                    // The modifiers are optional enhancements
                }
            }
        }
        
        // 4. Create order status history entry
        await supabase
            .from('order_status_history')
            .insert({
                order_id: order.id,
                from_status: null,
                to_status: 'pending',
                changed_by: createdBy,
                notes: 'Order created',
            });
        
        return {
            success: true,
            orderId: order.id,
            orderNumber: order.order_number,
        };
        
    } catch (error) {
        console.error('Unexpected error creating order:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

export { createOrder };
export type { OrderItemInput, CreateOrderInput, CreateOrderResult };
