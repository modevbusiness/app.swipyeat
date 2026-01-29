// ==========================================
// ENUMS (Based on USER-DEFINED types)
// ==========================================

export type OrderStatus = 
  | 'pending' 
  | 'validated' 
  | 'preparing' 
  | 'ready' 
  | 'served' 
  | 'completed' 
  | 'paid'
  | 'canceled';

export type UserRole = 'waiter' | 'kitchen' | 'manager' | 'admin';

export type ModifierType = 'extra' | 'replacement' | 'side' | string;

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

export type PlanType = 'basic' | 'pro' | 'enterprise';

// ==========================================
// DATABASE TABLES
// ==========================================

export type Category = {
  id: string;
  restaurant_id: string;
  name: string;
  name_ar: string | null;
  name_fr: string | null;
  description: string | null;
  description_ar: string | null;
  description_fr: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ItemVariant = {
  id: string;
  menu_item_id: string;
  name: string;
  name_ar: string | null;
  name_fr: string | null;
  price_adjustment: number;
  is_default: boolean;
  is_available: boolean;
  created_at: string;
};

// Junction table for Many-to-Many relationship
export type MenuItemModifier = {
  menu_item_id: string;
  modifier_id: string;
  is_required: boolean;
  max_selections: number | null;
};



export type Modifier = {
  id: string;
  restaurant_id: string;
  name: string;
  name_ar: string | null;
  name_fr: string | null;
  modifier_type: ModifierType;
  price: number;
  is_active: boolean;
  created_at: string;
};

export type MenuItem = {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  name_ar: string | null;
  name_fr: string | null;
  description: string | null;
  description_ar: string | null;
  description_fr: string | null;
  base_price: number;
  image_url: string | null;
  preparation_time: number | null; // in minutes
  allergens: string[] | null;
  is_available: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  item_variants?: ItemVariant[];
  menu_item_modifiers?: {
      modifier: Modifier;
  }[];
};

export type OrderItemModifier = {
  id: string;
  order_item_id: string;
  modifier_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  special_instructions: string | null;
  created_at: string;
};

export type OrderStatusHistory = {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: string | null; // User ID
  notes: string | null;
  created_at: string;
};

export type Order = {
  id: string;
  restaurant_id: string;
  table_number: string | null;
  order_number: string;
  created_by: string; // User ID
  validated_by: string | null; // User ID
  status: OrderStatus;
  validated_at: string | null;
  sent_to_kitchen_at: string | null;
  preparing_started_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  completed_at: string | null;
  canceled_at: string | null;
  total_amount: number;
  customer_notes: string | null;
  waiter_notes: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type Restaurant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_image_url: string | null;
  phone: string | null;
  email: string | null;
  address: string;
  city: string | null;
  number_of_tables: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Role = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[]; // Assumed JSONB is an array of permission strings
  created_at: string;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  plan_type: PlanType;
  price_monthly: number;
  price_yearly: number | null;
  max_tables: number | null;
  max_menu_items: number | null;
  max_staff: number | null;
  features: Record<string, any>; // JSONB object
  is_active: boolean;
  created_at: string;
};

export type Subscription = {
  id: string;
  restaurant_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  is_current: boolean;
  billing_cycle: string; // 'monthly' | 'yearly'
  started_at: string;
  ends_at: string | null;
  trial_ends_at: string | null;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
};

export type UserRoleAssignment = {
  user_id: string;
  role_id: string;
  assigned_at: string;
};

export type User = {
  id: string;
  restaurant_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

// ==========================================
// HELPER TYPES (Useful for Frontend/API)
// ==========================================

// Example: An order fetched with its items for the Kitchen Display System
export type OrderWithDetails = Order & {
  items: (OrderItem & {
    menu_item: MenuItem;
    modifiers: OrderItemModifier[];
  })[];
};

// The type you requested in your prompt
export type KitchenAlert = {
    id: string; // Database UUID
    table: string;
    order_id: string; // Order number for display
    message: string;
    timestamp: string;
};