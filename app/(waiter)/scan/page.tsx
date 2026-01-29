'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/context/AuthProvider';
import { useLanguage } from '@/lib/context/LanguageContext';
import CONTENT from '@/const/content';
import { QROrderPayload, ExpandedOrderItem, parseQROrderData, isQROrderExpired } from '@/const/qrOrderSchema';
import { createClient } from '@/lib/supabase/client';
import { 
  CameraOff, 
  ScanLine, 
  AlertCircle, 
  Clock, 
  Building2,
  Trash2,
  Plus,
  Minus,
  MessageSquare,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ShoppingBag,
  Pencil,
  X,
  Check
} from 'lucide-react';
import MenuModal from '@/components/MenuModal';

type ScanState = 'scanning' | 'loading' | 'permission-denied' | 'invalid-qr' | 'expired-qr' | 'wrong-restaurant' | 'reviewing';

// Types for edit modal
interface EditableVariant {
  id: string;
  name: string;
  price_adjustment: number;
  is_available: boolean;
}

interface EditableModifier {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
}

interface EditItemState {
  item: ExpandedOrderItem;
  availableVariants: EditableVariant[];
  availableModifiers: EditableModifier[];
  selectedVariantId: string | null;
  selectedModifiers: { id: string; name: string; price: number; quantity: number }[];
  quantity: number;
  specialInstructions: string;
}

export default function ScanPage() {
  const { profile, user } = useAuth();
  const { language } = useLanguage();
  const t = CONTENT[language].scanPage;
  const supabase = createClient();
  
  // State
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [qrData, setQrData] = useState<QROrderPayload | null>(null);
  const [editedItems, setEditedItems] = useState<ExpandedOrderItem[]>([]);
  const [customerNotes, setCustomerNotes] = useState('');
  const [waiterNotes, setWaiterNotes] = useState('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<EditItemState | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  
  // Video ref for camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Fetch menu item details from database
  const fetchItemDetails = async (payload: QROrderPayload): Promise<ExpandedOrderItem[]> => {
    const menuItemIds = payload.i.map(item => item.m);
    const variantIds = payload.i.filter(item => item.v).map(item => item.v!);
    const modifierIds = payload.i.flatMap(item => item.x?.map(m => m.i) || []);
    
    // Fetch menu items
    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('id, name, name_ar, name_fr, base_price, image_url')
      .in('id', menuItemIds);
    
    // Fetch variants if any
    let variants: any[] = [];
    if (variantIds.length > 0) {
      const { data } = await supabase
        .from('item_variants')
        .select('id, name, name_ar, name_fr, price_adjustment')
        .in('id', variantIds);
      variants = data || [];
    }
    
    // Fetch modifiers if any
    let modifiers: any[] = [];
    if (modifierIds.length > 0) {
      const { data } = await supabase
        .from('modifiers')
        .select('id, name, name_ar, name_fr, price')
        .in('id', modifierIds);
      modifiers = data || [];
    }
    
    // Map to expanded items
    const expandedItems: ExpandedOrderItem[] = payload.i.map((qrItem, index) => {
      const menuItem = menuItems?.find(m => m.id === qrItem.m);
      const variant = qrItem.v ? variants.find(v => v.id === qrItem.v) : null;
      
      const itemModifiers = (qrItem.x || []).map(qrMod => {
        const mod = modifiers.find(m => m.id === qrMod.i);
        return {
          id: qrMod.i,
          name: mod ? (language === 'ar' ? mod.name_ar : language === 'fr' ? mod.name_fr : mod.name) || mod.name : 'Unknown',
          price: mod?.price || 0,
          quantity: qrMod.q
        };
      });
      
      const basePrice = menuItem?.base_price || 0;
      const variantAdjustment = variant?.price_adjustment || 0;
      const modifiersTotal = itemModifiers.reduce((sum, m) => sum + (m.price * m.quantity), 0);
      const unitPrice = basePrice + variantAdjustment + modifiersTotal;
      const itemTotal = unitPrice * qrItem.q;
      
      return {
        id: `item-${index}-${Date.now()}`,
        menuItemId: qrItem.m,
        name: menuItem ? (language === 'ar' ? menuItem.name_ar : language === 'fr' ? menuItem.name_fr : menuItem.name) || menuItem.name : 'Unknown Item',
        imageUrl: menuItem?.image_url || null,
        basePrice,
        variant: variant ? {
          id: variant.id,
          name: (language === 'ar' ? variant.name_ar : language === 'fr' ? variant.name_fr : variant.name) || variant.name,
          priceAdjustment: variant.price_adjustment
        } : null,
        modifiers: itemModifiers,
        quantity: qrItem.q,
        specialInstructions: qrItem.n || '',
        itemTotal
      };
    });
    
    return expandedItems;
  };

  // Start camera and scanning - just set state, actual camera setup in useEffect
  const startScanning = useCallback(() => {
    isProcessingRef.current = false;
    setScanState('scanning');
  }, []);
  // Scan current video frame for QR code
  const scanFrame = useCallback(() => {
    if (!videoRef.current || isProcessingRef.current) return;
    if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) return;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    if (canvas.width === 0 || canvas.height === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Use BarcodeDetector API if available
    if ('BarcodeDetector' in window) {
      // @ts-ignore
      const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
      barcodeDetector.detect(canvas)
        .then((barcodes: { rawValue: string }[]) => {
          if (barcodes.length > 0 && !isProcessingRef.current) {
            isProcessingRef.current = true;
            handleQRDetected(barcodes[0].rawValue);
          }
        })
        .catch(() => {});
    }
  }, []);
  // Set up camera when entering scanning state
  useEffect(() => {
    if (scanState !== 'scanning') return;
    
    let mounted = true;
    
    const setupCamera = async () => {
      try {
        // Small delay to ensure video element is mounted
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!mounted) return;
        
        // Stop any existing stream first
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait for video to be ready
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play().catch(console.error);
            }
          };
          // Also try to play immediately if already ready
          if (videoRef.current.readyState >= 2) {
            videoRef.current.play().catch(console.error);
          }
        }
        
        // Start scanning interval
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
        }
        scanIntervalRef.current = setInterval(scanFrame, 300);
        
      } catch (error) {
        console.error('Camera error:', error);
        if (mounted) {
          setScanState('permission-denied');
        }
      }
    };
    
    setupCamera();
    
    return () => {
      mounted = false;
      // Clean up on unmount or state change
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [scanState, scanFrame]);
  
  
  
  // Handle QR code detection
  const handleQRDetected = useCallback(async (qrString: string) => {
    // Stop scanning
    stopScanning();
    setScanState('loading');
    
    // Parse QR data
    const payload = parseQROrderData(qrString);
    
    if (!payload) {
      setScanState('invalid-qr');
      return;
    }
    
    // Check if expired
    if (isQROrderExpired(payload)) {
      setScanState('expired-qr');
      return;
    }
    
    // Check if correct restaurant
    if (profile?.restaurant_id && payload.r !== profile.restaurant_id) {
      setScanState('wrong-restaurant');
      return;
    }
    
    try {
      // Fetch item details from database
      const items = await fetchItemDetails(payload);
      
      setQrData(payload);
      setEditedItems(items);
      setCustomerNotes(payload.c || '');
      setWaiterNotes('');
      setScanState('reviewing');
    } catch (error) {
      console.error('Error fetching item details:', error);
      setScanState('invalid-qr');
    }
    
  }, [profile?.restaurant_id, supabase, language]);
  
  // Stop camera and scanning
  const stopScanning = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);
  
  // Reset to scanning
  const resetToScanning = useCallback(() => {
    setQrData(null);
    setEditedItems([]);
    setCustomerNotes('');
    setWaiterNotes('');
    setErrorMessage('');
    setShowSuccess(false);
    isProcessingRef.current = false;
    startScanning();
  }, [startScanning]);
  
  // Update item quantity
  const updateItemQuantity = useCallback((itemId: string, delta: number) => {
    setEditedItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        const unitPrice = item.itemTotal / item.quantity;
        return { ...item, quantity: newQuantity, itemTotal: unitPrice * newQuantity };
      }
      return item;
    }));
  }, []);
  
  // Remove item from order
  const removeItem = useCallback((itemId: string) => {
    setEditedItems(prev => prev.filter(item => item.id !== itemId));
    setItemToRemove(null);
  }, []);
  
  // Open edit modal for an item
  const openEditItem = useCallback(async (item: ExpandedOrderItem) => {
    setIsLoadingEdit(true);
    
    try {
      // Fetch available variants for this menu item
      const { data: variants } = await supabase
        .from('item_variants')
        .select('id, name, name_ar, name_fr, price_adjustment, is_available')
        .eq('menu_item_id', item.menuItemId)
        .eq('is_available', true);
      
      // Fetch available modifiers for this menu item
      const { data: modifiers } = await supabase
        .from('modifiers')
        .select('id, name, name_ar, name_fr, price, is_available')
        .eq('menu_item_id', item.menuItemId)
        .eq('is_available', true);
      
      const mappedVariants: EditableVariant[] = (variants || []).map(v => ({
        id: v.id,
        name: (language === 'ar' ? v.name_ar : language === 'fr' ? v.name_fr : v.name) || v.name,
        price_adjustment: v.price_adjustment,
        is_available: v.is_available
      }));
      
      const mappedModifiers: EditableModifier[] = (modifiers || []).map(m => ({
        id: m.id,
        name: (language === 'ar' ? m.name_ar : language === 'fr' ? m.name_fr : m.name) || m.name,
        price: m.price,
        is_available: m.is_available
      }));
      
      setEditingItem({
        item,
        availableVariants: mappedVariants,
        availableModifiers: mappedModifiers,
        selectedVariantId: item.variant?.id || null,
        selectedModifiers: [...item.modifiers],
        quantity: item.quantity,
        specialInstructions: item.specialInstructions
      });
    } catch (error) {
      console.error('Error fetching item options:', error);
    } finally {
      setIsLoadingEdit(false);
    }
  }, [supabase, language]);
  
  // Toggle modifier in edit modal
  const toggleEditModifier = useCallback((modifier: EditableModifier) => {
    if (!editingItem) return;
    
    const existing = editingItem.selectedModifiers.find(m => m.id === modifier.id);
    if (existing) {
      setEditingItem(prev => prev ? {
        ...prev,
        selectedModifiers: prev.selectedModifiers.filter(m => m.id !== modifier.id)
      } : null);
    } else {
      setEditingItem(prev => prev ? {
        ...prev,
        selectedModifiers: [...prev.selectedModifiers, { id: modifier.id, name: modifier.name, price: modifier.price, quantity: 1 }]
      } : null);
    }
  }, [editingItem]);
  
  // Update modifier quantity in edit modal
  const updateEditModifierQuantity = useCallback((modifierId: string, delta: number) => {
    if (!editingItem) return;
    
    setEditingItem(prev => prev ? {
      ...prev,
      selectedModifiers: prev.selectedModifiers.map(m => 
        m.id === modifierId ? { ...m, quantity: Math.max(1, m.quantity + delta) } : m
      )
    } : null);
  }, [editingItem]);
  
  // Calculate edit item price
  const calculateEditItemPrice = useCallback(() => {
    if (!editingItem) return 0;
    
    let price = editingItem.item.basePrice;
    
    // Add variant price
    if (editingItem.selectedVariantId) {
      const variant = editingItem.availableVariants.find(v => v.id === editingItem.selectedVariantId);
      if (variant) price += variant.price_adjustment;
    }
    
    // Add modifiers price
    editingItem.selectedModifiers.forEach(mod => {
      price += mod.price * mod.quantity;
    });
    
    return price * editingItem.quantity;
  }, [editingItem]);
  
  // Save edited item
  const saveEditedItem = useCallback(() => {
    if (!editingItem) return;
    
    const selectedVariant = editingItem.selectedVariantId
      ? editingItem.availableVariants.find(v => v.id === editingItem.selectedVariantId)
      : null;
    
    const newTotal = calculateEditItemPrice();
    
    setEditedItems(prev => prev.map(item => {
      if (item.id === editingItem.item.id) {
        return {
          ...item,
          variant: selectedVariant ? {
            id: selectedVariant.id,
            name: selectedVariant.name,
            priceAdjustment: selectedVariant.price_adjustment
          } : null,
          modifiers: editingItem.selectedModifiers,
          quantity: editingItem.quantity,
          specialInstructions: editingItem.specialInstructions,
          itemTotal: newTotal
        };
      }
      return item;
    }));
    
    setEditingItem(null);
  }, [editingItem, calculateEditItemPrice]);
  
  // Calculate total
  const orderTotal = editedItems.reduce((sum, item) => sum + item.itemTotal, 0);
  
  // Handle adding more items from menu
  const handleAddMoreItems = (orderItems: any[], table: string) => {
    const newItems: ExpandedOrderItem[] = orderItems.map((item, index) => ({
      id: `new-${Date.now()}-${index}`,
      menuItemId: item.menuItem.id,
      name: item.menuItem.name,
      imageUrl: item.menuItem.image_url,
      basePrice: item.menuItem.base_price,
      variant: item.selectedVariant ? {
        id: item.selectedVariant.id,
        name: item.selectedVariant.name,
        priceAdjustment: item.selectedVariant.price_adjustment
      } : null,
      modifiers: item.selectedModifiers.map((m: any) => ({
        id: m.modifier.id,
        name: m.modifier.name,
        price: m.modifier.price,
        quantity: m.quantity
      })),
      quantity: item.quantity,
      specialInstructions: item.specialInstructions || '',
      itemTotal: item.totalPrice
    }));
    
    setEditedItems(prev => [...prev, ...newItems]);
    setShowMenuModal(false);
  };
  
  // Create order in database
  const handleConfirmOrder = async () => {
    if (!profile?.restaurant_id || !user?.id || editedItems.length === 0) return;
    
    setIsCreatingOrder(true);
    setErrorMessage('');
    
    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: profile.restaurant_id,
          table_number: qrData?.t || 'Unknown',
          order_number: qrData?.o || null,
          created_by: user.id,
          status: 'pending',
          total_amount: orderTotal,
          customer_notes: customerNotes || null,
          waiter_notes: waiterNotes || null,
        })
        .select('id, order_number')
        .single();
      
      if (orderError) throw orderError;
      
      const orderItemsToInsert = editedItems.map(item => ({
        order_id: order.id,
        menu_item_id: item.menuItemId,
        variant_id: item.variant?.id || null,
        quantity: item.quantity,
        unit_price: item.itemTotal / item.quantity,
        subtotal: item.itemTotal,
        special_instructions: item.specialInstructions || null,
      }));
      
      const { data: insertedItems, error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert)
        .select('id');
      
      if (itemsError) throw itemsError;
      
      if (insertedItems) {
        const modifiersToInsert: any[] = [];
        
        editedItems.forEach((item, index) => {
          item.modifiers.forEach(mod => {
            modifiersToInsert.push({
              order_item_id: insertedItems[index].id,
              modifier_id: mod.id,
              quantity: mod.quantity,
              unit_price: mod.price,
            });
          });
        });
        
        if (modifiersToInsert.length > 0) {
          await supabase.from('order_item_modifiers').insert(modifiersToInsert);
        }
      }
      
      setShowSuccess(true);
      setTimeout(() => {
        resetToScanning();
      }, 2000);
      
    } catch (error) {
      console.error('Error creating order:', error);
      setErrorMessage(t.orderFailed);
    } finally {
      setIsCreatingOrder(false);
    }
  };
  
  // Start scanning on mount
  useEffect(() => {
    startScanning();
    // Cleanup is handled by the scanState effect
  }, []);
  
  // Success overlay
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-xl">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t.orderCreated}</h2>
        </div>
      </div>
    );
  }
  
  // Loading state
  if (scanState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-xl">
          <Loader2 size={40} className="text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }
  
  // Scanning view
  if (scanState === 'scanning') {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        {/* Header */}
        <div className="bg-black/80 backdrop-blur-sm px-4 py-4 z-10">
          <h1 className="text-xl font-bold text-white">{t.title}</h1>
          <p className="text-sm text-white/70">{t.subtitle}</p>
        </div>
        
        {/* Camera View */}
        <div className="flex-1 relative">
          <video 
            ref={videoRef} 
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
          
          {/* Dark overlay with cutout */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Semi-transparent overlay */}
            <div className="absolute inset-0 bg-black/40" />
            
            {/* Scan frame */}
            <div className="relative z-10 w-72 h-72">
              {/* Clear center area */}
              <div className="absolute inset-0 bg-transparent border-2 border-white/30 rounded-2xl" />
              
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-xl" />
              
              {/* Scanning line animation */}
              <div className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />
            </div>
          </div>
          
          {/* Instructions */}
          <div className="absolute bottom-24 left-0 right-0 text-center z-10">
            <div className="inline-flex items-center gap-2 bg-black/60 backdrop-blur-sm px-5 py-3 rounded-full">
              <ScanLine size={20} className="text-primary" />
              <span className="text-white text-sm font-medium">{t.pointCamera}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Permission denied
  if (scanState === 'permission-denied') {
    return (
      <div className="min-h-screen bg-gradient-primary flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <CameraOff size={40} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t.permissionDenied}</h2>
        <p className="text-gray-500 mb-6">{t.permissionDeniedDesc}</p>
        <button
          onClick={startScanning}
          className="bg-primary text-white font-semibold px-6 py-3 rounded-xl"
        >
          {t.retryPermission}
        </button>
      </div>
    );
  }
  
  // Error states
  if (scanState === 'invalid-qr' || scanState === 'expired-qr' || scanState === 'wrong-restaurant') {
    const errorConfig = {
      'invalid-qr': { icon: <AlertCircle size={40} className="text-amber-500" />, title: t.invalidQR, desc: t.invalidQRDesc },
      'expired-qr': { icon: <Clock size={40} className="text-amber-500" />, title: t.expiredQR, desc: t.expiredQRDesc },
      'wrong-restaurant': { icon: <Building2 size={40} className="text-amber-500" />, title: t.wrongRestaurant, desc: t.wrongRestaurantDesc },
    }[scanState];
    
    return (
      <div className="min-h-screen bg-gradient-primary flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-4">
          {errorConfig.icon}
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{errorConfig.title}</h2>
        <p className="text-gray-500 mb-6">{errorConfig.desc}</p>
        <button
          onClick={resetToScanning}
          className="bg-primary text-white font-semibold px-6 py-3 rounded-xl"
        >
          {t.scanAgain}
        </button>
      </div>
    );
  }
  
  // Order review
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button 
          onClick={resetToScanning}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">{t.orderReview}</h1>
          <p className="text-sm text-gray-500">
            {t.table} {qrData?.t} • {editedItems.length} {t.items}
          </p>
        </div>
      </div>
      
      {/* Order Items */}
      <div className="flex-1 overflow-y-auto p-4 pb-56">
        {editedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <ShoppingBag size={48} className="text-gray-300 mb-4" />
            <h3 className="font-semibold text-gray-900">{t.noItemsInOrder}</h3>
            <p className="text-sm text-gray-500 mt-1">{t.noItemsDesc}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {editedItems.map((item) => (
              <div key={item.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                <div className="flex gap-3">
                  <img 
                    src={item.imageUrl || '/defaultfood.avif'} 
                    alt={item.name} 
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => openEditItem(item)}
                          className="text-primary p-1 hover:bg-primary/10 rounded"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={() => setItemToRemove(item.id)}
                          className="text-red-500 p-1 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    {item.variant && (
                      <p className="text-xs text-gray-500">{item.variant.name}</p>
                    )}
                    
                    {item.modifiers.length > 0 && (
                      <p className="text-xs text-gray-500">
                        + {item.modifiers.map(m => `${m.name}${m.quantity > 1 ? ` x${m.quantity}` : ''}`).join(', ')}
                      </p>
                    )}
                    
                    {item.specialInstructions && (
                      <p className="text-xs text-orange-600 italic mt-1">"{item.specialInstructions}"</p>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 bg-gray-100 rounded-lg">
                        <button
                          onClick={() => updateItemQuantity(item.id, -1)}
                          disabled={item.quantity <= 1}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 disabled:opacity-50"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateItemQuantity(item.id, 1)}
                          className="w-8 h-8 flex items-center justify-center text-gray-600"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="font-bold text-primary">{item.itemTotal.toFixed(2)} MAD</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Customer Notes */}
        {customerNotes && (
          <div className="mt-4 bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-center gap-2 text-blue-700 mb-2">
              <MessageSquare size={16} />
              <span className="font-semibold text-sm">{t.customerNotes}</span>
            </div>
            <p className="text-sm text-blue-800">{customerNotes}</p>
          </div>
        )}
        
        {/* Waiter Notes */}
        <div className="mt-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {t.waiterNotes}
          </label>
          <textarea
            value={waiterNotes}
            onChange={(e) => setWaiterNotes(e.target.value)}
            placeholder={t.waiterNotesPlaceholder}
            className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            rows={3}
          />
        </div>
      </div>
      
      {/* Footer Actions */}
      <div className="fixed bottom-20 left-0 right-0 bg-white border-t border-gray-100 p-4 space-y-3 z-10">
        <button
          onClick={() => setShowMenuModal(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 font-medium hover:border-primary hover:text-primary transition-colors"
        >
          <Plus size={20} />
          {t.addMoreItems}
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{t.orderTotal}</p>
            <p className="text-xl font-bold text-primary">{orderTotal.toFixed(2)} MAD</p>
          </div>
          <button
            onClick={handleConfirmOrder}
            disabled={isCreatingOrder || editedItems.length === 0}
            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 transition-colors"
          >
            {isCreatingOrder ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                {t.creatingOrder}
              </>
            ) : (
              <>
                <CheckCircle2 size={20} />
                {t.confirmOrder}
              </>
            )}
          </button>
        </div>
        
        {errorMessage && (
          <p className="text-center text-sm text-red-500">{errorMessage}</p>
        )}
      </div>
      
      {/* Remove Item Modal */}
      {itemToRemove && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setItemToRemove(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg mx-auto overflow-hidden">
              <div className="p-6 text-center">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={24} className="text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{t.confirmRemove}</h3>
                <p className="text-gray-500">{t.confirmRemoveDesc}</p>
              </div>
              <div className="flex border-t border-gray-100">
                <button
                  onClick={() => setItemToRemove(null)}
                  className="flex-1 p-4 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {CONTENT[language].myOrdersPage.cancel}
                </button>
                <button
                  onClick={() => removeItem(itemToRemove)}
                  className="flex-1 p-4 font-semibold text-red-600 hover:bg-red-50"
                >
                  {t.removeItem}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Menu Modal */}
      <MenuModal
        isOpen={showMenuModal}
        onClose={() => setShowMenuModal(false)}
        table={qrData?.t || ''}
        restaurantId={profile?.restaurant_id}
        onConfirmOrder={handleAddMoreItems}
      />
      
      {/* Edit Item Modal */}
      {(editingItem || isLoadingEdit) && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => !isLoadingEdit && setEditingItem(null)} />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] bg-white rounded-t-3xl overflow-hidden flex flex-col">
            {isLoadingEdit ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 size={32} className="text-primary animate-spin" />
              </div>
            ) : editingItem && (
              <>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <button 
                    onClick={() => setEditingItem(null)}
                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    <X size={20} className="text-gray-600" />
                  </button>
                  <h2 className="text-lg font-bold text-gray-900">{t.editItem}</h2>
                  <button 
                    onClick={saveEditedItem}
                    className="w-10 h-10 rounded-full bg-primary flex items-center justify-center"
                  >
                    <Check size={20} className="text-white" />
                  </button>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {/* Item Info */}
                  <div className="flex gap-4 items-start">
                    <img 
                      src={editingItem.item.imageUrl || '/defaultfood.avif'} 
                      alt={editingItem.item.name} 
                      className="w-20 h-20 rounded-xl object-cover"
                    />
                    <div>
                      <h3 className="font-bold text-gray-900">{editingItem.item.name}</h3>
                      <p className="text-primary font-semibold">{editingItem.item.basePrice.toFixed(2)} MAD</p>
                    </div>
                  </div>
                  
                  {/* Variants */}
                  {editingItem.availableVariants.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">{t.selectVariant || 'Select Variant'}</h4>
                      <div className="space-y-2">
                        {editingItem.availableVariants.map(variant => (
                          <button
                            key={variant.id}
                            onClick={() => setEditingItem(prev => prev ? { ...prev, selectedVariantId: variant.id } : null)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-colors ${
                              editingItem.selectedVariantId === variant.id 
                                ? 'border-primary bg-primary/5' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <span className="font-medium text-gray-900">{variant.name}</span>
                            <span className="text-sm text-gray-500">
                              {variant.price_adjustment >= 0 ? '+' : ''}{variant.price_adjustment.toFixed(2)} MAD
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Modifiers */}
                  {editingItem.availableModifiers.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">{t.selectModifiers || 'Modifiers'}</h4>
                      <div className="space-y-2">
                        {editingItem.availableModifiers.map(modifier => {
                          const selected = editingItem.selectedModifiers.find(m => m.id === modifier.id);
                          return (
                            <div 
                              key={modifier.id}
                              className={`p-3 rounded-xl border-2 transition-colors ${
                                selected ? 'border-primary bg-primary/5' : 'border-gray-200'
                              }`}
                            >
                              <button
                                onClick={() => toggleEditModifier(modifier)}
                                className="w-full flex items-center justify-between"
                              >
                                <span className="font-medium text-gray-900">{modifier.name}</span>
                                <span className="text-sm text-gray-500">+{modifier.price.toFixed(2)} MAD</span>
                              </button>
                              
                              {selected && (
                                <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-gray-100">
                                  <button
                                    onClick={() => updateEditModifierQuantity(modifier.id, -1)}
                                    disabled={selected.quantity <= 1}
                                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-50"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <span className="w-8 text-center font-medium">{selected.quantity}</span>
                                  <button
                                    onClick={() => updateEditModifierQuantity(modifier.id, 1)}
                                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Quantity */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">{t.quantity || 'Quantity'}</h4>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setEditingItem(prev => prev ? { ...prev, quantity: Math.max(1, prev.quantity - 1) } : null)}
                        disabled={editingItem.quantity <= 1}
                        className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-50"
                      >
                        <Minus size={20} />
                      </button>
                      <span className="text-2xl font-bold text-gray-900 w-12 text-center">{editingItem.quantity}</span>
                      <button
                        onClick={() => setEditingItem(prev => prev ? { ...prev, quantity: prev.quantity + 1 } : null)}
                        className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Special Instructions */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">{t.specialInstructions || 'Special Instructions'}</h4>
                    <textarea
                      value={editingItem.specialInstructions}
                      onChange={(e) => setEditingItem(prev => prev ? { ...prev, specialInstructions: e.target.value } : null)}
                      placeholder={t.specialInstructionsPlaceholder || 'e.g., No onions, extra sauce...'}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                      rows={3}
                    />
                  </div>
                </div>
                
                {/* Footer with Price */}
                <div className="p-4 border-t border-gray-100 bg-white">
                  <button
                    onClick={saveEditedItem}
                    className="w-full bg-primary text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2"
                  >
                    <Check size={20} />
                    {t.saveChanges || 'Save Changes'} • {calculateEditItemPrice().toFixed(2)} MAD
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
