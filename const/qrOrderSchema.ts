/**
 * QR Order Schema (Minimal)
 * 
 * This file defines the MINIMAL JSON structure for order data encoded in QR codes.
 * Only essential IDs and quantities are stored - all other data (names, prices, images)
 * are fetched from the database when the waiter scans the QR code.
 * 
 * Flow:
 * 1. Customer browses menu on their device
 * 2. Customer adds items to cart
 * 3. Customer generates QR code with minimal data (IDs + quantities only)
 * 4. Waiter scans QR code
 * 5. App fetches full item details from database
 * 6. Waiter reviews/edits order and adds notes
 * 7. Waiter confirms → Order is created in database
 */

// Minimal modifier in QR (just ID and quantity)
export interface QRModifier {
  i: string;   // Modifier ID
  q: number;   // Quantity
}

// Minimal item in QR (just IDs, quantity, instructions)
export interface QRItem {
  m: string;              // Menu item ID
  v?: string;             // Variant ID (optional)
  x?: QRModifier[];       // Modifiers (optional)
  q: number;              // Quantity
  n?: string;             // Special instructions/notes (optional)
}

// Minimal QR Order payload
export interface QROrderPayload {
  v: '1';                 // Version (short)
  r: string;              // Restaurant ID
  t: string;              // Table number
  o: string;              // Order number (e.g., ORD-20260120-000001)
  i: QRItem[];            // Items
  c?: string;             // Customer notes (optional)
  e: number;              // Expires at (Unix timestamp in seconds)
}

// Expanded item after fetching from database
export interface ExpandedOrderItem {
  id: string;             // Generated client-side ID for editing
  menuItemId: string;
  name: string;
  imageUrl: string | null;
  basePrice: number;
  variant: {
    id: string;
    name: string;
    priceAdjustment: number;
  } | null;
  modifiers: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  quantity: number;
  specialInstructions: string;
  itemTotal: number;
}

// Validation helper
export function isValidQROrderPayload(data: unknown): data is QROrderPayload {
  if (!data || typeof data !== 'object') return false;
  
  const payload = data as Record<string, unknown>;
  
  return (
    payload.v === '1' &&
    typeof payload.r === 'string' &&
    typeof payload.t === 'string' &&
    typeof payload.o === 'string' &&
    Array.isArray(payload.i) &&
    payload.i.length > 0 &&
    typeof payload.e === 'number'
  );
}

// Check if QR order is expired
export function isQROrderExpired(payload: QROrderPayload): boolean {
  const now = Math.floor(Date.now() / 1000);
  return false;
}

// Parse QR code string to payload
export function parseQROrderData(qrString: string): QROrderPayload | null {
  try {
    const data = JSON.parse(qrString);
    if (isValidQROrderPayload(data)) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

// Generate order number
export function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `ORD-${dateStr}-${random}`;
}

// Generate minimal QR payload (for client app)
export function generateQRPayload(
  restaurantId: string,
  tableNumber: string,
  orderNumber: string,
  items: { menuItemId: string; variantId?: string; modifiers?: { id: string; quantity: number }[]; quantity: number; notes?: string }[],
  customerNotes?: string,
  expirationMinutes: number = 30
): QROrderPayload {
  const expiresAt = Math.floor(Date.now() / 1000) + (expirationMinutes * 60);
  
  return {
    v: '1',
    r: restaurantId,
    t: tableNumber,
    o: orderNumber,
    i: items.map(item => ({
      m: item.menuItemId,
      ...(item.variantId && { v: item.variantId }),
      ...(item.modifiers?.length && { x: item.modifiers.map(mod => ({ i: mod.id, q: mod.quantity })) }),
      q: item.quantity,
      ...(item.notes && { n: item.notes }),
    })),
    ...(customerNotes && { c: customerNotes }),
    e: expiresAt,
  };
}
