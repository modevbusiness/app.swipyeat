'use client'

import { useEffect, useState } from 'react'
import { useKitchenAlerts } from '@/lib/context/KitchenAlertsProvider'
import { useLanguage } from '@/lib/context/LanguageContext'
import { CheckCircle, X, Bell, ChefHat, AlertTriangle, Loader2 } from 'lucide-react'
import { KitchenAlert } from '@/const/data.type'

interface ToastNotification {
  id: string
  alert: KitchenAlert
  visible: boolean
  isUpdating: boolean
}

export default function GlobalNotifications() {
  const { alerts, markAsServed } = useKitchenAlerts()
  const { language } = useLanguage()
  const [toasts, setToasts] = useState<ToastNotification[]>([])
  const [seenAlerts, setSeenAlerts] = useState<Set<string>>(new Set())

  // Watch for new alerts and create toasts
  useEffect(() => {
    alerts.forEach(alert => {
      const alertKey = `${alert.order_id}-${alert.message}`
      
      if (!seenAlerts.has(alertKey) && alert.message === 'ready') {
        // Add new toast
        const newToast: ToastNotification = {
          id: alertKey,
          alert,
          visible: true,
          isUpdating: false,
        }
        
        setToasts(prev => [...prev, newToast])
        setSeenAlerts(prev => new Set([...prev, alertKey]))
        
        // Auto-dismiss after 8 seconds
        setTimeout(() => {
          dismissToast(alertKey)
        }, 8000)
      }
    })
  }, [alerts, seenAlerts])

  const dismissToast = (id: string) => {
    setToasts(prev => prev.map(t => 
      t.id === id ? { ...t, visible: false } : t
    ))
    
    // Remove from DOM after animation
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 300)
  }

  const handleMarkServed = async (toast: ToastNotification) => {
    // Set updating state
    setToasts(prev => prev.map(t => 
      t.id === toast.id ? { ...t, isUpdating: true } : t
    ))
    
    const success = await markAsServed(toast.alert)
    
    if (success) {
      dismissToast(toast.id)
    } else {
      // Reset updating state on failure
      setToasts(prev => prev.map(t => 
        t.id === toast.id ? { ...t, isUpdating: false } : t
      ))
    }
  }

  const getStatusConfig = (message: string) => {
    switch (message) {
      case 'ready':
        return {
          icon: CheckCircle,
          bg: 'bg-emerald-500',
          gradient: 'from-emerald-500 to-emerald-600',
          title: language === 'ar' ? 'الطلب جاهز!' : language === 'fr' ? 'Commande Prête!' : 'Order Ready!',
        }
      case 'preparing':
        return {
          icon: ChefHat,
          bg: 'bg-blue-500',
          gradient: 'from-blue-500 to-blue-600',
          title: language === 'ar' ? 'قيد التحضير' : language === 'fr' ? 'En Préparation' : 'Preparing',
        }
      case 'delayed':
        return {
          icon: AlertTriangle,
          bg: 'bg-amber-500',
          gradient: 'from-amber-500 to-amber-600',
          title: language === 'ar' ? 'تأخير' : language === 'fr' ? 'Retardé' : 'Delayed',
        }
      default:
        return {
          icon: Bell,
          bg: 'bg-primary',
          gradient: 'from-primary to-orange-600',
          title: language === 'ar' ? 'تنبيه' : language === 'fr' ? 'Alerte' : 'Alert',
        }
    }
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 left-4 md:left-auto md:w-96 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => {
        const config = getStatusConfig(toast.alert.message)
        const StatusIcon = config.icon
        
        return (
          <div
            key={toast.id}
            className={`
              pointer-events-auto
              bg-white rounded-2xl shadow-2xl border border-gray-100
              transform transition-all duration-300 ease-out
              ${toast.visible 
                ? 'translate-x-0 opacity-100 scale-100' 
                : 'translate-x-full opacity-0 scale-95'
              }
            `}
          >
            {/* Colored top bar */}
            <div className={`h-1.5 bg-gradient-to-r ${config.gradient} rounded-t-2xl`} />
            
            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`${config.bg} p-2.5 rounded-xl shrink-0`}>
                  <StatusIcon className="text-white" size={22} />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-gray-900">{config.title}</h4>
                    <button 
                      onClick={() => dismissToast(toast.id)}
                      className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X size={16} className="text-gray-400" />
                    </button>
                  </div>
                  
                  <p className="text-sm text-gray-600 mt-0.5">
                    {language === 'ar' 
                      ? `طلب #${toast.alert.order_id} للطاولة ${toast.alert.table} جاهز للتقديم!`
                      : language === 'fr'
                      ? `Commande #${toast.alert.order_id} pour Table ${toast.alert.table} est prête!`
                      : `Order #${toast.alert.order_id} for Table ${toast.alert.table} is ready to serve!`
                    }
                  </p>
                  
                  {/* Action button */}
                  <button 
                    onClick={() => handleMarkServed(toast)}
                    disabled={toast.isUpdating}
                    className={`mt-3 w-full py-2 px-4 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                      toast.isUpdating 
                        ? 'bg-gray-500 cursor-not-allowed' 
                        : 'bg-gray-900 hover:bg-gray-800'
                    }`}
                  >
                    {toast.isUpdating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        {language === 'ar' 
                          ? 'جاري التحديث...'
                          : language === 'fr'
                          ? 'Mise à jour...'
                          : 'Updating...'
                        }
                      </>
                    ) : (
                      language === 'ar' 
                        ? 'تم التقديم ✓'
                        : language === 'fr'
                        ? 'Marqué comme servi ✓'
                        : 'Mark as Served ✓'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
