"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from '@/lib/context/AuthProvider'
import { useLanguage } from "@/lib/context/LanguageContext";
import { useKitchenAlerts, requestNotificationPermission } from "@/lib/context/KitchenAlertsProvider";
import CONTENT from "@/const/content";
import Image from "next/image";
import { Utensils, Bell, QrCode, FilePlus, Grid2X2, ClipboardList, ChevronRight, Sparkles } from "lucide-react";
import LanguageSwitcher from '@/components/LanguageSwitcher';
import KitchenAlert from '@/components/KitchenAlert';
import Link from "next/link";

export default function Home() {
  const supabase = createClient();
  const { user, loading, profile } = useAuth();
  const [restaurant, setRestaurant] = useState<any>(null);
  const { language } = useLanguage();
  const { alerts: kitchenAlerts, unreadCount } = useKitchenAlerts();

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Get greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return language === 'ar' ? 'صباح الخير' : language === 'fr' ? 'Bonjour' : 'Good Morning';
    if (hour < 18) return language === 'ar' ? 'مساء الخير' : language === 'fr' ? 'Bon après-midi' : 'Good Afternoon';
    return language === 'ar' ? 'مساء الخير' : language === 'fr' ? 'Bonsoir' : 'Good Evening';
  }, [language]);

  useEffect(() => {
    const getRestaurant = async () => {
      if (profile?.restaurant_id) {
        const { data, error } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', profile.restaurant_id)
          .single();
        if (error) {
          console.error('Error fetching restaurant:', error);
        } else {
          setRestaurant(data);
        }
      }
    };
    getRestaurant();
  }, [profile, supabase]);

  return (
    <div className="bg-gradient-primary min-h-screen flex flex-col pb-24">
      {/* Header Section */}
      <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-100">
        <div className="px-4 py-4 max-w-lg mx-auto">
          <div className="flex gap-3 items-center">
            <div className="relative">
              <Image 
                src={profile?.avatar_url ?? "/default-avatar.png"} 
                alt="Profile Picture" 
                width={48} 
                height={48} 
                className="rounded-full ring-2 ring-primary/20 ring-offset-2" 
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white"></span>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 font-medium">{greeting} 👋</p>
              <h1 className="text-lg font-bold text-gray-900">{profile?.name || 'Waiter'}</h1>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Utensils size={14} className="text-primary"/>
                <p className="truncate max-w-[150px]">{restaurant?.name || 'Loading...'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="relative p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                <Bell size={22} className="text-gray-600"/>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </div>

      {/* Kitchen Alerts Section */}
      <div className="px-4 pt-5 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Sparkles size={18} className="text-primary" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">{CONTENT[language].waiterHome.kitchenAlerts}</h2>
          </div>
          <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            {kitchenAlerts.length} {language === 'ar' ? 'نشط' : language === 'fr' ? 'actifs' : 'active'}
          </span>
        </div>
        {kitchenAlerts.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto py-1 -mx-4 px-4 scroll-smooth no-scrollbar snap-x snap-mandatory">
            {kitchenAlerts.map((alert, index) => (
              <div key={`${alert.order_id}-${index}`} className="snap-start shrink-0 w-[280px]">
                <KitchenAlert data={alert} />
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Sparkles size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">
              {language === 'ar' 
                ? 'لا توجد تنبيهات حالياً'
                : language === 'fr'
                ? 'Aucune alerte pour le moment'
                : 'No alerts at the moment'
              }
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {language === 'ar' 
                ? 'ستظهر الطلبات الجاهزة هنا'
                : language === 'fr'
                ? 'Les commandes prêtes apparaîtront ici'
                : 'Ready orders will appear here'
              }
            </p>
          </div>
        )}
      </div>

      {/* Quick Actions Section */}
      <div className="px-4 pt-6 max-w-lg mx-auto w-full">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Grid2X2 size={18} className="text-primary" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">{CONTENT[language].waiterHome.quickActions}</h2>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <Link 
            href="/scan" 
            className="group bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-6 rounded-2xl flex flex-col items-center justify-center hover:shadow-lg hover:shadow-primary/10 hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5"
          >
            <div className="w-14 h-14 bg-primary/15 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
              <QrCode size={28} className="text-primary"/>
            </div>
            <p className="text-center font-semibold text-gray-800 text-sm">
              {CONTENT[language].waiterHome.scanOrderQR}
            </p>
          </Link>
          
          <Link 
            href="/tables" 
            className="group bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-6 rounded-2xl flex flex-col items-center justify-center hover:shadow-lg hover:shadow-blue-100 hover:border-blue-300 transition-all duration-300 hover:-translate-y-0.5"
          >
            <div className="w-14 h-14 bg-blue-200/60 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
              <FilePlus size={28} className="text-blue-600"/>
            </div>
            <p className="text-center font-semibold text-gray-800 text-sm">
              {CONTENT[language].waiterHome.addAnOrder}
            </p>
          </Link>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="px-4 pt-6 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <ClipboardList size={18} className="text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              {language === 'ar' ? 'طلباتي' : language === 'fr' ? 'Mes Commandes' : 'My Orders'}
            </h2>
          </div>
        </div>
        
        <Link 
          href="/orders"
          className="group flex items-center justify-between bg-white border border-gray-200 rounded-2xl p-4 hover:border-primary/30 hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl flex items-center justify-center">
              <ClipboardList size={24} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                {language === 'ar' ? 'عرض جميع الطلبات' : language === 'fr' ? 'Voir toutes les commandes' : 'View All Orders'}
              </p>
              <p className="text-sm text-gray-500">
                {language === 'ar' ? 'إدارة وتتبع طلباتك' : language === 'fr' ? 'Gérer et suivre vos commandes' : 'Manage & track your orders'}
              </p>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </Link>
      </div>
    </div>
  );
}