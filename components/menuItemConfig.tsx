'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { MenuItem, ItemVariant, Modifier } from '@/const/data.type';
import { useLanguage } from '@/lib/context/LanguageContext';
import CONTENT from '@/const/content';

interface SelectedModifier {
    modifier: Modifier;
    quantity: number;
}

interface MenuItemConfigProps {
    isOpen: boolean;
    onClose: () => void;
    menuItem?: MenuItem;
    onAddToOrder?: (config: {
        menuItem: MenuItem;
        selectedVariant: ItemVariant | null;
        selectedModifiers: SelectedModifier[];
        quantity: number;
        specialInstructions: string;
        totalPrice: number;
    }) => void;
}

export default function MenuItemConfig({ isOpen, onClose, menuItem, onAddToOrder }: MenuItemConfigProps) {
    const { language } = useLanguage();
    const [selectedVariant, setSelectedVariant] = useState<ItemVariant | null>(null);
    const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([]);
    const [quantity, setQuantity] = useState(1);
    const [specialInstructions, setSpecialInstructions] = useState('');

    // Reset state when menu item changes
    useEffect(() => {
        if (menuItem) {
            // Set default variant if available
            const defaultVariant = menuItem.item_variants?.find(v => v.is_default && v.is_available) 
                || menuItem.item_variants?.find(v => v.is_available) 
                || null;
            setSelectedVariant(defaultVariant);
            setSelectedModifiers([]);
            setQuantity(1);
            setSpecialInstructions('');
        }
    }, [menuItem]);

    // Calculate total price
    const totalPrice = useMemo(() => {
        if (!menuItem) return 0;
        
        let price = menuItem.base_price;
        
        // Add variant price adjustment
        if (selectedVariant) {
            price += selectedVariant.price_adjustment;
        }
        
        // Add modifiers price
        selectedModifiers.forEach(({ modifier, quantity: modQty }) => {
            price += modifier.price * modQty;
        });
        
        return price * quantity;
    }, [menuItem, selectedVariant, selectedModifiers, quantity]);

    const handleModifierToggle = (modifier: Modifier) => {
        setSelectedModifiers(prev => {
            const existing = prev.find(m => m.modifier.id === modifier.id);
            if (existing) {
                return prev.filter(m => m.modifier.id !== modifier.id);
            }
            return [...prev, { modifier, quantity: 1 }];
        });
    };

    const handleModifierQuantity = (modifierId: string, delta: number) => {
        setSelectedModifiers(prev => 
            prev.map(m => {
                if (m.modifier.id === modifierId) {
                    const newQty = Math.max(1, m.quantity + delta);
                    return { ...m, quantity: newQty };
                }
                return m;
            })
        );
    };

    const handleAddToOrder = () => {
        if (menuItem && onAddToOrder) {
            onAddToOrder({
                menuItem,
                selectedVariant,
                selectedModifiers,
                quantity,
                specialInstructions,
                totalPrice
            });
            onClose();
        }
    };

    const handleQuantityChange = (delta: number) => {
        setQuantity(prev => Math.max(1, prev + delta));
    };

    if (!menuItem) return null;

    const availableVariants = menuItem.item_variants?.filter(v => v.is_available) || [];
    const availableModifiers = menuItem.menu_item_modifiers?.filter(m => m.modifier.is_active).map(m => m.modifier) || [];

    return (
        <div 
            onClick={onClose} 
            className={`fixed inset-0 bg-black/60 z-50 flex justify-center items-end md:items-center transition-opacity ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        >
            <div 
                onClick={(e) => e.stopPropagation()} 
                className={`bg-white w-full md:w-[480px] max-h-[90vh] md:max-h-[85vh] rounded-t-2xl md:rounded-2xl flex flex-col overflow-hidden transform transition-transform duration-300 ${isOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}`}
            >
                {/* Header with Image */}
                <div className="relative h-48 md:h-56 w-full flex-shrink-0">
                    <Image
                        src={menuItem.image_url || '/defaultfood.avif'}
                        alt={menuItem.name}
                        fill
                        className="object-cover"
                    />
                    {/* Close button */}
                    <button 
                        onClick={onClose}
                        className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                    {/* Preparation time badge */}
                    {menuItem.preparation_time && (
                        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium text-gray-700 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                            {menuItem.preparation_time} min
                        </div>
                    )}
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    {/* Title and Description */}
                    <div>
                        <div className="flex items-start justify-between gap-3">
                            <h2 className="text-xl font-bold text-gray-900">{menuItem.name}</h2>
                            <span className="text-lg font-bold text-orange-600 flex-shrink-0">
                                {menuItem.base_price.toFixed(2)} MAD
                            </span>
                        </div>
                        {menuItem.description && (
                            <p className="text-gray-600 text-sm mt-2 leading-relaxed">{menuItem.description}</p>
                        )}
                        {/* Allergens */}
                        {menuItem.allergens && menuItem.allergens.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {menuItem.allergens.map((allergen, index) => (
                                    <span 
                                        key={index} 
                                        className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded-full border border-red-100"
                                    >
                                        {allergen}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Variants Selection */}
                    {availableVariants.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-2">{CONTENT[language].menuItemConfig.sizeVariant}</h3>
                            <div className="flex flex-wrap gap-2">
                                {availableVariants.map((variant) => (
                                    <button
                                        key={variant.id}
                                        onClick={() => setSelectedVariant(variant)}
                                        className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                                            selectedVariant?.id === variant.id
                                                ? 'border-orange-500 bg-orange-50 text-orange-700'
                                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                        }`}
                                    >
                                        <span>{variant.name}</span>
                                        {variant.price_adjustment !== 0 && (
                                            <span className="ml-1 text-xs opacity-75">
                                                {variant.price_adjustment > 0 ? '+' : ''}{variant.price_adjustment.toFixed(2)}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Modifiers Selection */}
                    {availableModifiers.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-2">{CONTENT[language].menuItemConfig.extrasAddons}</h3>
                            <div className="space-y-2">
                                {availableModifiers.map((modifier) => {
                                    const selected = selectedModifiers.find(m => m.modifier.id === modifier.id);
                                    return (
                                        <div 
                                            key={modifier.id}
                                            className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                                                selected 
                                                    ? 'border-orange-500 bg-orange-50' 
                                                    : 'border-gray-200 bg-white'
                                            }`}
                                        >
                                            <button
                                                onClick={() => handleModifierToggle(modifier)}
                                                className="flex items-center gap-3 flex-1 text-left"
                                            >
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                                    selected 
                                                        ? 'border-orange-500 bg-orange-500' 
                                                        : 'border-gray-300'
                                                }`}>
                                                    {selected && (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <div>
                                                    <span className="text-sm font-medium text-gray-900">{modifier.name}</span>
                                                    <span className="text-xs text-gray-500 capitalize ml-2">({modifier.modifier_type})</span>
                                                </div>
                                            </button>
                                            <div className="flex items-center gap-2">
                                                {selected && (
                                                    <div className="flex items-center gap-1 mr-2">
                                                        <button
                                                            onClick={() => handleModifierQuantity(modifier.id, -1)}
                                                            className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                        <span className="w-6 text-center text-sm font-medium">{selected.quantity}</span>
                                                        <button
                                                            onClick={() => handleModifierQuantity(modifier.id, 1)}
                                                            className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                )}
                                                <span className="text-sm font-medium text-orange-600 w-16 text-right">
                                                    +{modifier.price.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Special Instructions */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">{CONTENT[language].menuItemConfig.specialInstructions}</h3>
                        <textarea
                            value={specialInstructions}
                            onChange={(e) => setSpecialInstructions(e.target.value)}
                            placeholder={CONTENT[language].menuItemConfig.specialInstructionsPlaceholder}
                            className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            rows={3}
                        />
                    </div>
                </div>

                {/* Footer with Quantity and Add Button */}
                <div className="flex-shrink-0 border-t border-gray-100 p-4 bg-white">
                    <div className="flex items-center gap-4">
                        {/* Quantity Selector */}
                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => handleQuantityChange(-1)}
                                disabled={quantity <= 1}
                                className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <span className="w-8 text-center font-semibold text-gray-900">{quantity}</span>
                            <button
                                onClick={() => handleQuantityChange(1)}
                                className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 hover:bg-gray-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>

                        {/* Add to Order Button */}
                        <button
                            onClick={handleAddToOrder}
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <span>{CONTENT[language].menuItemConfig.addToOrder}</span>
                            <span className="font-bold">{totalPrice.toFixed(2)} MAD</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
