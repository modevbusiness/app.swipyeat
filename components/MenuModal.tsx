'use client';

import { useEffect, useState } from 'react';
import { getMenu } from '@/lib/supabase/queries/getMenu';
import { Category, MenuItem, ItemVariant, Modifier } from '@/const/data.type';
import { useLanguage } from '@/lib/context/LanguageContext';
import CONTENT from '@/const/content';
import MenuItemConfig from './menuItemConfig';

interface SelectedModifier {
  modifier: Modifier;
  quantity: number;
}

interface OrderItem {
  id: string;
  menuItem: MenuItem;
  selectedVariant: ItemVariant | null;
  selectedModifiers: SelectedModifier[];
  quantity: number;
  specialInstructions: string;
  totalPrice: number;
}

interface MenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: string;
  restaurantId?: string;
  onConfirmOrder?: (orderItems: OrderItem[], table: string) => void;
  initialOrderItems?: OrderItem[];
  isEditMode?: boolean;
  editOrderId?: string;
}

export default function MenuModal({ isOpen, onClose, table, restaurantId, onConfirmOrder, initialOrderItems, isEditMode, editOrderId }: MenuModalProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | undefined>(undefined);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const { language } = useLanguage();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.history.pushState({ modal: true }, '');

      const handlePopState = () => {
        onClose();
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        document.body.style.overflow = 'unset';
        window.removeEventListener('popstate', handlePopState);
      };
    } else {
      document.body.style.overflow = 'unset';
    }
    const fetchMenu = async () => {
      setIsLoading(true);
      if (restaurantId) {
        const result = await getMenu(restaurantId);
        if (result) {
          if (result.menuItems) {
            setMenuItems(result.menuItems);
          }
          if (result.categories) {
            setCategories(result.categories);
          }
        }
      }
      setIsLoading(false);
    }
    setSelectedCategory('all');
    // Set initial order items if in edit mode, otherwise reset
    if (initialOrderItems && initialOrderItems.length > 0) {
      setOrderItems(initialOrderItems);
      setShowOrderSummary(true);
    } else {
      setOrderItems([]);
      setShowOrderSummary(false);
    }
    fetchMenu();
  }, [isOpen, onClose, restaurantId, initialOrderItems]);

  const handleAddToOrder = (config: {
    menuItem: MenuItem;
    selectedVariant: ItemVariant | null;
    selectedModifiers: SelectedModifier[];
    quantity: number;
    specialInstructions: string;
    totalPrice: number;
  }) => {
    const newOrderItem: OrderItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...config
    };
    setOrderItems(prev => [...prev, newOrderItem]);
  };

  const handleRemoveOrderItem = (itemId: string) => {
    setOrderItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        const unitPrice = item.totalPrice / item.quantity;
        return { ...item, quantity: newQuantity, totalPrice: unitPrice * newQuantity };
      }
      return item;
    }));
  };

  const totalOrderAmount = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const totalItemsCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleConfirmOrder = () => {
    if (onConfirmOrder && orderItems.length > 0) {
      onConfirmOrder(orderItems, table);
      setOrderItems([]);
      setShowOrderSummary(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />
      
      {/* Main Modal */}
      <div className="fixed inset-x-0 bottom-0 z-50 h-[92%] bg-gradient-to-b from-gray-50 to-white rounded-t-3xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 pt-3 pb-4">
          <div className="flex justify-center mb-3">
            <span className="h-1.5 rounded-full bg-gray-300 w-12"></span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{CONTENT[language].menuModalContent.tableLabel} {table}</h1>
              <p className="text-sm text-gray-500">{CONTENT[language].menuModalContent.selectItems}</p>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          {/* Search Bar */}
          <div className="mt-4 relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder={CONTENT[language].menuModalContent.searchPlaceholder} 
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" 
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex-shrink-0 bg-white px-4 py-3 border-b border-gray-100">
          <div className="flex overflow-x-auto no-scrollbar gap-2">
            {[{ id: "all", name: CONTENT[language].menuModalContent.all }, ...categories].map((category) => (
              <button 
                onClick={() => setSelectedCategory(category.id)} 
                key={category.id} 
                className={`min-w-max px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === category.id 
                    ? 'bg-primary text-white shadow-md shadow-primary/30' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500">{CONTENT[language].menuModalContent.loading}</p>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 grid-cols-2 gap-3 p-4 pb-32">
              {menuItems
                .filter(item => (selectedCategory === 'all' || item.category_id === selectedCategory) && (item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.description?.toLowerCase().includes(searchQuery.toLowerCase())))
                .map((item) => (
                  <div 
                    onClick={() => { setSelectedMenuItem(item); setIsConfigOpen(true); }} 
                    key={item.id} 
                    className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                  >
                    <div className="relative h-28 overflow-hidden">
                      <img 
                        src={item.image_url ? item.image_url : '/defaultfood.avif'} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                      {!item.is_available && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white text-xs font-medium px-2 py-1 bg-red-500 rounded-full">{CONTENT[language].menuModalContent.unavailable}</span>
                        </div>
                      )}
                      {item.preparation_time && (
                        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-medium text-gray-600 flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          {item.preparation_time}m
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-1 flex-1">
                      <h2 className="font-semibold text-sm text-gray-900 line-clamp-1">{item.name}</h2>
                      <p className="text-gray-500 text-xs line-clamp-2 flex-1">{item.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-primary text-sm">{item.base_price.toFixed(2)} MAD</span>
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Order Summary Button - Fixed at bottom */}
        {orderItems.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-white via-white to-transparent pt-8">
            <button
              onClick={() => setShowOrderSummary(true)}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg shadow-primary/30 flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold">{totalItemsCount}</span>
                </div>
                <span>{CONTENT[language].menuModalContent.viewOrder}</span>
              </div>
              <span className="font-bold">{totalOrderAmount.toFixed(2)} MAD</span>
            </button>
          </div>
        )}
      </div>

      {/* Order Summary Modal */}
      {showOrderSummary && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[60]" onClick={() => setShowOrderSummary(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[85vh] bg-white rounded-t-3xl flex flex-col overflow-hidden">
            {/* Summary Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-100">
              <div className="flex justify-center mb-3">
                <span className="h-1.5 rounded-full bg-gray-300 w-12"></span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{CONTENT[language].menuModalContent.orderSummary}</h2>
                  <p className="text-sm text-gray-500">{CONTENT[language].menuModalContent.tableLabel} {table} • {totalItemsCount} {CONTENT[language].menuModalContent.items}</p>
                </div>
                <button 
                  onClick={() => setShowOrderSummary(false)}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Order Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {orderItems.map((item) => (
                <div key={item.id} className="bg-gray-50 rounded-xl p-3 flex gap-3">
                  <img 
                    src={item.menuItem.image_url || '/defaultfood.avif'} 
                    alt={item.menuItem.name} 
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{item.menuItem.name}</h3>
                      <button 
                        onClick={() => handleRemoveOrderItem(item.id)}
                        className="text-red-500 hover:text-red-600 p-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Variant */}
                    {item.selectedVariant && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.selectedVariant.name}</p>
                    )}
                    
                    {/* Modifiers */}
                    {item.selectedModifiers.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        + {item.selectedModifiers.map(m => `${m.modifier.name}${m.quantity > 1 ? ` x${m.quantity}` : ''}`).join(', ')}
                      </p>
                    )}
                    
                    {/* Special Instructions */}
                    {item.specialInstructions && (
                      <p className="text-xs text-orange-600 mt-1 italic line-clamp-1">"{item.specialInstructions}"</p>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          disabled={item.quantity <= 1}
                          className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-l-lg disabled:opacity-50"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-r-lg"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                      <span className="font-bold text-primary text-sm">{item.totalPrice.toFixed(2)} MAD</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Footer */}
            <div className="flex-shrink-0 border-t border-gray-100 p-4 bg-white space-y-4">
              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{CONTENT[language].menuModalContent.subtotal}</span>
                  <span>{totalOrderAmount.toFixed(2)} MAD</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-900">
                  <span>{CONTENT[language].menuModalContent.total}</span>
                  <span className="text-primary">{totalOrderAmount.toFixed(2)} MAD</span>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowOrderSummary(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3.5 px-4 rounded-xl transition-colors"
                >
                  {CONTENT[language].menuModalContent.addMore}
                </button>
                <button
                  onClick={handleConfirmOrder}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-500/30"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {CONTENT[language].menuModalContent.confirmOrder}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Menu Item Config Modal */}
      <MenuItemConfig 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)} 
        menuItem={selectedMenuItem}
        onAddToOrder={handleAddToOrder}
      />
    </>
  );
}
