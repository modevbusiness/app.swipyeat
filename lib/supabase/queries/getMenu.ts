import { createClient } from "@/lib/supabase/client";
import { Category, MenuItem } from "@/const/data.type";

async function getMenu(restaurantId: string) {
    const supabase = createClient();
    const { data: menuItems, error } = await supabase
        .from('menu_items')
        .select('*, item_variants(*), menu_item_modifiers(*, modifier:modifiers(*))')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .eq('is_available', true);
        if (error) {
            console.error('Error fetching menu:', error);
            return null;
        }
    const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true);
        if (catError) {
            console.error('Error fetching categories:', catError);
            return null;
        }
    

    return { menuItems, categories } as { menuItems: MenuItem[]; categories: Category[] };
}

export { getMenu };