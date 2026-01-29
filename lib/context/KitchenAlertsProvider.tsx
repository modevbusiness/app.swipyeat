'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './AuthProvider'
import { KitchenAlert, Order } from '@/const/data.type'

interface KitchenAlertsContextType {
  alerts: KitchenAlert[]
  unreadCount: number
  markAsRead: (orderId: string) => void
  markAllAsRead: () => void
  clearAlert: (orderId: string) => void
  markAsServed: (alert: KitchenAlert) => Promise<boolean>
  isUpdating: string | null
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
}

const KitchenAlertsContext = createContext<KitchenAlertsContextType | undefined>(undefined)

export function KitchenAlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<KitchenAlert[]>([])
  const [readAlerts, setReadAlerts] = useState<Set<string>>(new Set())
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(true)
  const { profile, user } = useAuth()
  const supabase = createClient()
  
  // Track previous order statuses to detect changes
  const orderStatusesRef = useRef<Map<string, string>>(new Map())
  
  // Audio context for fallback sound
  const audioContextRef = useRef<AudioContext | null>(null)
  
  // Load sound preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('notificationSoundEnabled')
    if (stored !== null) {
      setSoundEnabledState(stored === 'true')
    }
  }, [])
  
  // Save sound preference to localStorage
  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled)
    localStorage.setItem('notificationSoundEnabled', String(enabled))
  }, [])

  const unreadCount = alerts.filter(a => !readAlerts.has(a.order_id)).length

  const markAsRead = useCallback((orderId: string) => {
    setReadAlerts(prev => new Set([...prev, orderId]))
  }, [])

  const markAllAsRead = useCallback(() => {
    setReadAlerts(new Set(alerts.map(a => a.order_id)))
  }, [alerts])

  const clearAlert = useCallback((orderId: string) => {
    setAlerts(prev => prev.filter(a => a.order_id !== orderId))
  }, [])

  // Mark order as served in the database
  const markAsServed = useCallback(async (alert: KitchenAlert): Promise<boolean> => {
    if (!user?.id) return false
    
    setIsUpdating(alert.id)
    
    try {
      // Get current order status first
      const { data: currentOrder, error: fetchError } = await supabase
        .from('orders')
        .select('status')
        .eq('id', alert.id)
        .single()
      
      if (fetchError) {
        console.error('Error fetching order:', fetchError)
        setIsUpdating(null)
        return false
      }
      
      const fromStatus = currentOrder?.status
      
      // Update order status to 'served'
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: 'served',
          served_at: new Date().toISOString()
        })
        .eq('id', alert.id)
      
      if (updateError) {
        console.error('Error updating order status:', updateError)
        setIsUpdating(null)
        return false
      }
      
      // Add status history
      await supabase
        .from('order_status_history')
        .insert({
          order_id: alert.id,
          from_status: fromStatus,
          to_status: 'served',
          changed_by: user.id,
          notes: null,
        })
      
      // Clear the alert from the list
      clearAlert(alert.order_id)
      orderStatusesRef.current.delete(alert.id)
      
      setIsUpdating(null)
      return true
      
    } catch (error) {
      console.error('Error marking order as served:', error)
      setIsUpdating(null)
      return false
    }
  }, [user?.id, supabase, clearAlert])
  
  // Play notification sound using Web Audio API (works without external file)
  const playSound = useCallback(() => {
    // Check if sound is enabled
    if (!soundEnabled) return
    
    try {
      // Try to play mp3 file first
      const audio = new Audio('/notification.mp3')
      audio.volume = 0.7
      audio.play().catch(() => {
        // Fallback to Web Audio API beep
        playBeepSound()
      })
    } catch {
      playBeepSound()
    }
  }, [soundEnabled])
  
  // Fallback beep sound using Web Audio API
  const playBeepSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      
      // Create a pleasant notification sound
      const oscillator1 = ctx.createOscillator()
      const oscillator2 = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      oscillator1.connect(gainNode)
      oscillator2.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      // Two-tone notification sound
      oscillator1.frequency.setValueAtTime(880, ctx.currentTime) // A5
      oscillator2.frequency.setValueAtTime(1108.73, ctx.currentTime) // C#6
      
      oscillator1.type = 'sine'
      oscillator2.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      
      oscillator1.start(ctx.currentTime)
      oscillator2.start(ctx.currentTime)
      oscillator1.stop(ctx.currentTime + 0.5)
      oscillator2.stop(ctx.currentTime + 0.5)
    } catch (err) {
      console.log('Web Audio API not supported:', err)
    }
  }

  // Fetch initial alerts (orders that are ready or preparing)
  useEffect(() => {
    if (!profile?.restaurant_id) return

    const fetchActiveOrders = async () => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, table_number, status, ready_at, updated_at, preparing_started_at')
        .eq('restaurant_id', profile.restaurant_id)
        .in('status', ['ready', 'preparing'])
        .order('updated_at', { ascending: false })
        .limit(20)

      if (orders && !error) {
        // Build initial status map
        orders.forEach(order => {
          orderStatusesRef.current.set(order.id, order.status)
        })
        
        const initialAlerts: KitchenAlert[] = orders.map(order => ({
          id: order.id,
          table: order.table_number || 'N/A',
          order_id: order.order_number || order.id,
          message: order.status,
          timestamp: order.status === 'ready' 
            ? (order.ready_at || order.updated_at)
            : (order.preparing_started_at || order.updated_at),
        }))
        setAlerts(initialAlerts)
      }
    }

    fetchActiveOrders()
  }, [profile?.restaurant_id, supabase])

  // Set up real-time subscription for order updates
  useEffect(() => {
    if (!profile?.restaurant_id) return

    const channel = supabase
      .channel('kitchen-alerts')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${profile.restaurant_id}`,
        },
        (payload) => {
          const newOrder = payload.new as Order
          const orderId = newOrder.id
          const orderIdentifier = newOrder.order_number || newOrder.id
          
          // Get the previous status from our ref (more reliable than payload.old)
          const previousStatus = orderStatusesRef.current.get(orderId)
          const newStatus = newOrder.status
          
          // Update the stored status
          orderStatusesRef.current.set(orderId, newStatus)
          
          console.log(`Order ${orderIdentifier}: ${previousStatus} -> ${newStatus}`)

          // Check if status changed to 'ready'
          if (newStatus === 'ready' && previousStatus !== 'ready') {
            const newAlert: KitchenAlert = {
              id: orderId,
              table: newOrder.table_number || 'N/A',
              order_id: orderIdentifier,
              message: 'ready',
              timestamp: newOrder.ready_at || new Date().toISOString(),
            }

            setAlerts(prev => {
              // Remove any existing alert for this order and add the new ready alert
              const filtered = prev.filter(a => a.order_id !== orderIdentifier)
              return [newAlert, ...filtered]
            })

            // Play notification sound
            playSound()

            // Show browser notification if permitted
            showBrowserNotification(newAlert)
          }

          // Check if status changed to 'preparing'
          if (newStatus === 'preparing' && previousStatus !== 'preparing') {
            const newAlert: KitchenAlert = {
              id: orderId,
              table: newOrder.table_number || 'N/A',
              order_id: orderIdentifier,
              message: 'preparing',
              timestamp: newOrder.preparing_started_at || new Date().toISOString(),
            }

            setAlerts(prev => {
              // Replace existing alert for this order or add new
              const filtered = prev.filter(a => a.order_id !== orderIdentifier)
              return [newAlert, ...filtered]
            })
          }

          // Remove alert if order is served or completed
          if (['served', 'completed', 'canceled'].includes(newStatus)) {
            setAlerts(prev => prev.filter(a => a.order_id !== orderIdentifier))
            orderStatusesRef.current.delete(orderId)
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.restaurant_id, supabase, playSound])

  return (
    <KitchenAlertsContext.Provider value={{ 
      alerts, 
      unreadCount, 
      markAsRead, 
      markAllAsRead, 
      clearAlert,
      markAsServed,
      isUpdating,
      soundEnabled,
      setSoundEnabled
    }}>
      {children}
    </KitchenAlertsContext.Provider>
  )
}

export function useKitchenAlerts() {
  const context = useContext(KitchenAlertsContext)
  if (!context) {
    throw new Error('useKitchenAlerts must be used within a KitchenAlertsProvider')
  }
  return context
}

// Helper function to show browser notification
function showBrowserNotification(alert: KitchenAlert) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('🍽️ Order Ready!', {
      body: `Order #${alert.order_id} for Table ${alert.table} is ready to serve!`,
      icon: '/icon.png',
      tag: `order-${alert.order_id}`,
    })
  }
}

// Request notification permission
export function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}
