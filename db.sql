-- ============================================================================
-- SwipeToEat - Enhanced Supabase Database Schema (Waiter-Centric)
-- A complete SaaS + POS solution for restaurant digital ordering
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('super_admin', 'restaurant_admin', 'manager', 'waiter', 'kitchen_staff');
CREATE TYPE subscription_plan AS ENUM ('free_trial', 'pro');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'expired', 'suspended');
CREATE TYPE order_status AS ENUM ('ordered', 'pending', 'confirmed', 'preparing', 'ready', 'served', 'canceled');
CREATE TYPE modifier_type AS ENUM ('extra', 'option', 'size', 'customization');

-- ============================================================================
-- CORE BUSINESS TABLES
-- ============================================================================

-- Restaurants (Main tenant table)
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- For custom URLs: swipetoeeat.com/my-restaurant
  logo_url TEXT,
  cover_image_url TEXT,
  phone TEXT,
  email TEXT,
  address TEXT NOT NULL,
  city TEXT,
  number_of_tables INTEGER DEFAULT 10, -- Simple table count
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SUBSCRIPTION & BILLING
-- ============================================================================

-- Subscription Plans (Master list of available plans)
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  plan_type subscription_plan NOT NULL,
  price_monthly NUMERIC(10,2) NOT NULL,
  price_yearly NUMERIC(10,2),
  max_tables INTEGER,
  max_menu_items INTEGER,
  max_staff INTEGER,
  features JSONB DEFAULT '{}', -- {"analytics": true, "multi_branch": false}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Restaurant Subscriptions (Current and historical)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status subscription_status DEFAULT 'active',
  is_current BOOLEAN DEFAULT true, -- Only one active subscription per restaurant
  billing_cycle TEXT DEFAULT 'monthly', -- 'monthly' or 'yearly'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);



-- ============================================================================
-- USER MANAGEMENT & AUTHENTICATION
-- ============================================================================

-- Users (Links to Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  avatar_url TEXT,
  role user_role DEFAULT 'waiter',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles & Permissions (RBAC)
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB DEFAULT '[]', -- ["menu.edit", "orders.view", "staff.manage"]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Role Assignments
CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);


-- ============================================================================
-- MENU MANAGEMENT
-- ============================================================================

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT, -- Arabic translation
  name_fr TEXT, -- French translation
  description TEXT,
  description_ar TEXT,
  description_fr TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Items (Previously "plats")
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  name_fr TEXT,
  description TEXT,
  description_ar TEXT,
  description_fr TEXT,
  base_price NUMERIC(10,2) NOT NULL,
  image_url TEXT,
  preparation_time INTEGER, -- in minutes
  allergens TEXT[], -- ['nuts', 'dairy', 'eggs']
  is_available BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Variants (Sizes: Small, Medium, Large)
CREATE TABLE item_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 'Small', 'Medium', 'Large'
  name_ar TEXT,
  name_fr TEXT,
  price_adjustment NUMERIC(10,2) DEFAULT 0, -- +5.00 for Large
  is_default BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modifiers (Add-ons, Extras, Customizations)
CREATE TABLE modifiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 'Extra Cheese', 'No Onions', 'Spicy'
  name_ar TEXT,
  name_fr TEXT,
  modifier_type modifier_type DEFAULT 'extra',
  price NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Item Modifiers (Which modifiers are available for which items)
CREATE TABLE menu_item_modifiers (
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  modifier_id UUID REFERENCES modifiers(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT false,
  max_selections INTEGER, -- For option groups
  PRIMARY KEY (menu_item_id, modifier_id)
);

-- ============================================================================
-- ORDERS & ORDER ITEMS
-- ============================================================================

-- Orders (Waiter creates orders for customers)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Table information (simple)
  table_number TEXT, -- '1', 'A1', 'Terrace-5', etc.
  
  -- Order identification
  order_number TEXT NOT NULL, -- Human readable: #001234
  
  -- Staff tracking
  created_by UUID NOT NULL REFERENCES users(id), -- Waiter who created the order
  validated_by UUID REFERENCES users(id), -- Could be same waiter or manager
  
  -- Workflow tracking
  status order_status DEFAULT 'pending',
  validated_at TIMESTAMPTZ,
  sent_to_kitchen_at TIMESTAMPTZ,
  preparing_started_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  
  -- Pricing
  total_amount NUMERIC(10,2) DEFAULT 0,
  
  -- Additional info
  customer_notes TEXT, -- Waiter can add customer preferences/requests
  waiter_notes TEXT,
  cancellation_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(restaurant_id, order_number)
);

-- Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  variant_id UUID REFERENCES item_variants(id),
  
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL, -- Price at time of order
  subtotal NUMERIC(10,2) NOT NULL,
  
  special_instructions TEXT, -- 'Well done', 'No salt', etc.
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Item Modifiers (Selected extras/add-ons)
CREATE TABLE order_item_modifiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_id UUID NOT NULL REFERENCES modifiers(id),
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Status History (Audit trail)
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status,
  to_status order_status NOT NULL,
  changed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Restaurants
CREATE INDEX idx_restaurants_slug ON restaurants(slug);
CREATE INDEX idx_restaurants_is_active ON restaurants(is_active);

-- Users
CREATE INDEX idx_users_restaurant_id ON users(restaurant_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- Subscriptions
CREATE INDEX idx_subscriptions_restaurant_id ON subscriptions(restaurant_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_is_current ON subscriptions(is_current);

-- Menu Items
CREATE INDEX idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_menu_items_is_active ON menu_items(is_active);
CREATE INDEX idx_menu_items_is_available ON menu_items(is_available);

-- Orders
CREATE INDEX idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX idx_orders_table_number ON orders(table_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_created_by ON orders(created_by);
CREATE INDEX idx_orders_validated_by ON orders(validated_by);


-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                        LPAD(NEXTVAL('order_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE order_number_seq;

CREATE TRIGGER set_order_number BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Essential for Supabase
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Example RLS Policies

-- Users can only see their own restaurant's data
CREATE POLICY "Users see own restaurant menu" ON menu_items
  FOR SELECT USING (
    restaurant_id IN (
      SELECT restaurant_id FROM users WHERE id = auth.uid()
    )
  );

-- Staff can manage their restaurant's orders
CREATE POLICY "Staff can manage orders" ON orders
  FOR ALL USING (
    restaurant_id IN (
      SELECT restaurant_id FROM users WHERE id = auth.uid()
    )
  );

-- Staff can only modify menu items if they have permission
CREATE POLICY "Admins can modify menu" ON menu_items
  FOR ALL USING (
    restaurant_id IN (
      SELECT restaurant_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('restaurant_admin', 'manager', 'super_admin')
    )
  );
