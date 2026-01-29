import React, { useState } from 'react'
import { KitchenAlert as KitchenAlertType } from '@/const/data.type'
import CONTENT from '@/const/content'
import { useLanguage } from '@/lib/context/LanguageContext'
import { useKitchenAlerts } from '@/lib/context/KitchenAlertsProvider'
// import icons
import { CheckCheck, CheckCircle, Clock, AlertTriangle, ChefHat, Loader2 } from 'lucide-react';

type KitchenAlertProps = {
  data: KitchenAlertType
  onServed?: () => void
}

const STATUS_CONFIG = {
    ready: {
        icon: CheckCircle,
        bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100',
        border: 'border-emerald-200',
        iconColor: 'text-emerald-600',
        badgeBg: 'bg-emerald-500',
    },
    delayed: {
        icon: AlertTriangle,
        bg: 'bg-gradient-to-br from-amber-50 to-amber-100',
        border: 'border-amber-200',
        iconColor: 'text-amber-600',
        badgeBg: 'bg-amber-500',
    },
    preparing: {
        icon: ChefHat,
        bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
        border: 'border-blue-200',
        iconColor: 'text-blue-600',
        badgeBg: 'bg-blue-500',
    },
} as const;

export default function KitchenAlert({ data, onServed }: KitchenAlertProps) {
    const { language } = useLanguage();
    const { markAsServed, isUpdating } = useKitchenAlerts();
    const [isLoading, setIsLoading] = useState(false);
    const config = STATUS_CONFIG[data.message as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.preparing;
    const StatusIcon = config.icon;
    
    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleServed = async () => {
        setIsLoading(true);
        const success = await markAsServed(data);
        setIsLoading(false);
        if (success) {
            onServed?.();
        }
    };

    const isDisabled = isLoading || isUpdating === data.id;

    return (
        <div className={`${config.bg} ${config.border} border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow duration-300`}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 ${config.badgeBg} rounded-lg flex items-center justify-center`}>
                        <StatusIcon className="text-white" size={16} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">
                            {CONTENT[language].waiterHome.kitchenAlertsContent.heading.replace('{order_id}', data.order_id).replace('{table}', data.table)}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                            <Clock size={10} />
                            <span>{formatTime(data.timestamp)}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <p className="text-sm text-gray-700 mb-4 line-clamp-2">
                {CONTENT[language].waiterHome.kitchenAlertsContent[data.message as keyof typeof CONTENT['en']['waiterHome']['kitchenAlertsContent']].replace('{order_id}', data.order_id).replace('{table}', data.table)}
            </p>
            
            {/* { show only if message is 'ready' } */}
            {data.message === 'ready' && (
                <button 
                    onClick={handleServed}
                    disabled={isDisabled}
                    className={`w-full py-2.5 px-4 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors duration-200 shadow-sm hover:shadow ${
                        isDisabled 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-primary hover:bg-primary-hover'
                    }`}
                >
                    {isLoading ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <CheckCheck size={18} />
                    )}
                    {isLoading 
                        ? (language === 'ar' ? 'جاري التحديث...' : language === 'fr' ? 'Mise à jour...' : 'Updating...')
                        : CONTENT[language].waiterHome.kitchenAlertsContent.servedButton
                    }
                </button>
            )}
            
        </div>
    )
}
