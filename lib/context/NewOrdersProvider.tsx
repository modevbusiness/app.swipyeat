'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './AuthProvider'
import { Order } from '@/const/data.type'

interface NewOrdersContextType {
    newOrdersCount: number
    pendingCount: number
    preparingCount: number
    soundEnabled: boolean
    setSoundEnabled: (enabled: boolean) => void
    playNewOrderSound: () => void
}

const NewOrdersContext = createContext<NewOrdersContextType | undefined>(undefined)

export function NewOrdersProvider({ children }: { children: ReactNode }) {
    const [newOrdersCount, setNewOrdersCount] = useState(0)
    const [pendingCount, setPendingCount] = useState(0)
    const [preparingCount, setPreparingCount] = useState(0)
    const [soundEnabled, setSoundEnabledState] = useState<boolean>(true)
    const { profile } = useAuth()
    const supabase = createClient()

    // Track previous order IDs to detect new orders
    const knownOrdersRef = useRef<Set<string>>(new Set())

    // Audio context for notification sound
    const audioContextRef = useRef<AudioContext | null>(null)

    // Load sound preference from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('kitchenSoundEnabled')
        if (stored !== null) {
            setSoundEnabledState(stored === 'true')
        }
    }, [])

    // Save sound preference to localStorage
    const setSoundEnabled = useCallback((enabled: boolean) => {
        setSoundEnabledState(enabled)
        localStorage.setItem('kitchenSoundEnabled', String(enabled))
    }, [])

    // Play notification sound - urgent kitchen bell sound
    const playNewOrderSound = useCallback(() => {
        if (!soundEnabled) return

        try {
            // Try to play mp3 file first
            const audio = new Audio('/notification.mp3')
            audio.volume = 0.8
            audio.play().catch(() => {
                playKitchenBellSound()
            })
        } catch {
            playKitchenBellSound()
        }
    }, [soundEnabled])

    // Fallback kitchen bell sound using Web Audio API - more urgent than regular notification
    const playKitchenBellSound = async () => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
            }
            const ctx = audioContextRef.current

            // Resume context if suspended (browser policy)
            if (ctx.state === 'suspended') {
                await ctx.resume()
            }

            // Play 3 quick beeps (like a kitchen bell)
            const playBeep = (delay: number) => {
                const oscillator = ctx.createOscillator()
                const gainNode = ctx.createGain()

                oscillator.connect(gainNode)
                gainNode.connect(ctx.destination)

                oscillator.frequency.setValueAtTime(1000, ctx.currentTime + delay) // High pitch
                oscillator.type = 'sine'

                gainNode.gain.setValueAtTime(0.4, ctx.currentTime + delay)
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.15)

                oscillator.start(ctx.currentTime + delay)
                oscillator.stop(ctx.currentTime + delay + 0.15)
            }

            // Three quick beeps
            playBeep(0)
            playBeep(0.2)
            playBeep(0.4)
        } catch (err) {
            console.log('Web Audio API not supported:', err)
        }
    }

    // Fetch initial counts
    useEffect(() => {
        if (!profile?.restaurant_id) return

        const fetchOrderCounts = async () => {
            const { data: orders, error } = await supabase
                .from('orders')
                .select('id, status')
                .eq('restaurant_id', profile.restaurant_id)
                .in('status', ['pending', 'preparing'])

            if (orders && !error) {
                // Track known orders
                orders.forEach(order => {
                    knownOrdersRef.current.add(order.id)
                })

                const pending = orders.filter(o => o.status === 'pending').length
                const preparing = orders.filter(o => o.status === 'preparing').length

                setPendingCount(pending)
                setPreparingCount(preparing)
                setNewOrdersCount(pending + preparing)
            }
        }

        fetchOrderCounts()
    }, [profile?.restaurant_id, supabase])

    // Real-time subscription for new orders
    useEffect(() => {
        if (!profile?.restaurant_id) return

        const channel = supabase
            .channel('kitchen-new-orders')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'orders',
                    filter: `restaurant_id=eq.${profile.restaurant_id}`,
                },
                (payload) => {
                    const newOrder = payload.new as Order

                    // Add to known orders
                    knownOrdersRef.current.add(newOrder.id)

                    // Increment counts
                    if (newOrder.status === 'pending') {
                        setPendingCount(prev => prev + 1)
                        setNewOrdersCount(prev => prev + 1)

                        // Play notification sound for new order
                        playNewOrderSound()

                        // Show browser notification
                        showNewOrderNotification(newOrder)
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `restaurant_id=eq.${profile.restaurant_id}`,
                },
                (payload) => {
                    const updatedOrder = payload.new as Order
                    const oldOrder = payload.old as Order

                    // Handle status changes
                    if (oldOrder.status !== updatedOrder.status) {
                        // Pending -> Preparing
                        if (oldOrder.status === 'pending' && updatedOrder.status === 'preparing') {
                            setPendingCount(prev => Math.max(0, prev - 1))
                            setPreparingCount(prev => prev + 1)
                        }
                        // Preparing -> Ready/Served/Canceled
                        else if (oldOrder.status === 'preparing' && ['ready', 'served', 'canceled'].includes(updatedOrder.status)) {
                            setPreparingCount(prev => Math.max(0, prev - 1))
                            setNewOrdersCount(prev => Math.max(0, prev - 1))
                        }
                        // Pending -> Ready/Served/Canceled (skipped preparing)
                        else if (oldOrder.status === 'pending' && ['ready', 'served', 'canceled'].includes(updatedOrder.status)) {
                            setPendingCount(prev => Math.max(0, prev - 1))
                            setNewOrdersCount(prev => Math.max(0, prev - 1))
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.log('Kitchen realtime subscription status:', status)
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [profile?.restaurant_id, supabase, playNewOrderSound])

    return (
        <NewOrdersContext.Provider value={{
            newOrdersCount,
            pendingCount,
            preparingCount,
            soundEnabled,
            setSoundEnabled,
            playNewOrderSound
        }}>
            {children}
        </NewOrdersContext.Provider>
    )
}

export function useNewOrders() {
    const context = useContext(NewOrdersContext)
    if (!context) {
        throw new Error('useNewOrders must be used within a NewOrdersProvider')
    }
    return context
}

// Helper function to show browser notification for new orders
function showNewOrderNotification(order: Order) {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('🔔 New Order!', {
            body: `Order #${order.order_number} for Table ${order.table_number} has arrived!`,
            icon: '/logo.png',
            tag: `new-order-${order.id}`,
            requireInteraction: true, // Keep notification visible until user interacts
        })
    }
}

// Request notification permission
export function requestKitchenNotificationPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
    }
}
