"use client";

import { useClerk } from "@clerk/nextjs";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useAuth } from '@/lib/context/AuthProvider';
import { useLanguage } from "@/lib/context/LanguageContext";
import CONTENT from "@/const/content";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
    Mail,
    Building2,
    Calendar,
    LogOut,
    Bell,
    Globe,
    Loader2,
    ChefHat
} from "lucide-react";
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function KitchenProfilePage() {
    const supabase = createClient();
    const router = useRouter();
    const { user, loading, profile } = useAuth();
    const { signOut } = useClerk();
    const [restaurant, setRestaurant] = useState<any>(null);
    const { language } = useLanguage();
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);

    const t = CONTENT[language].profilePage;

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

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await signOut();
        router.push(`${process.env.NEXT_PUBLIC_LANDING_URL}/sign-in`);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : language === 'fr' ? 'fr-FR' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getRoleBadge = (role: string) => {
        const roleColors: Record<string, string> = {
            waiter: 'bg-blue-100 text-blue-700',
            kitchen_staff: 'bg-orange-100 text-orange-700',
            manager: 'bg-purple-100 text-purple-700',
            admin: 'bg-red-100 text-red-700',
        };
        const roleLabels: Record<string, Record<string, string>> = {
            waiter: { en: 'Waiter', ar: 'نادل', fr: 'Serveur' },
            kitchen_staff: { en: 'Kitchen Staff', ar: 'طاقم المطبخ', fr: 'Personnel de Cuisine' },
            manager: { en: 'Manager', ar: 'مدير', fr: 'Gestionnaire' },
            admin: { en: 'Admin', ar: 'مسؤول', fr: 'Admin' },
        };
        return {
            color: roleColors[role] || 'bg-gray-100 text-gray-700',
            label: roleLabels[role]?.[language] || role
        };
    };

    if (loading) {
        return (
            <div className="bg-gradient-primary min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const roleBadge = getRoleBadge(profile?.role || 'kitchen_staff');

    return (
        <div className="bg-gradient-primary min-h-screen flex flex-col pb-24">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-100">
                <div className="px-4 py-4 max-w-lg mx-auto">
                    <h1 className="text-xl font-bold text-gray-900">{t.title}</h1>
                </div>
            </div>

            {/* Profile Card */}
            <div className="px-4 pt-6 max-w-lg mx-auto w-full">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Profile Header */}
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Image
                                    src={profile?.avatar_url ?? "/default-avatar.png"}
                                    alt="Profile Picture"
                                    width={80}
                                    height={80}
                                    className="rounded-full ring-4 ring-white shadow-lg"
                                />
                                <span className={`absolute bottom-1 right-1 w-4 h-4 rounded-full ring-2 ring-white ${profile?.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-gray-900">{profile?.name || 'User'}</h2>
                                <p className="text-sm text-gray-500">{user?.email}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${roleBadge.color}`}>
                                        <ChefHat size={12} />
                                        {roleBadge.label}
                                    </span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${profile?.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {profile?.is_active ? t.active : t.inactive}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Profile Details */}
                    <div className="p-4 space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Mail size={20} className="text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-gray-500">{t.email}</p>
                                <p className="text-sm font-medium text-gray-900">{user?.email || '-'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <Building2 size={20} className="text-emerald-600" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-gray-500">{t.restaurant}</p>
                                <p className="text-sm font-medium text-gray-900">{restaurant?.name || '-'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Calendar size={20} className="text-purple-600" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-gray-500">{t.memberSince}</p>
                                <p className="text-sm font-medium text-gray-900">
                                    {user?.created_at ? formatDate(user.created_at) : '-'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Settings Section */}
            <div className="px-4 pt-6 max-w-lg mx-auto w-full">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
                    {t.settings}
                </h3>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                    {/* Language */}
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <Globe size={20} className="text-indigo-600" />
                            </div>
                            <span className="font-medium text-gray-900">{t.language}</span>
                        </div>
                        <LanguageSwitcher />
                    </div>

                    {/* Notifications */}
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                <Bell size={20} className="text-amber-600" />
                            </div>
                            <span className="font-medium text-gray-900">{t.notifications}</span>
                        </div>
                        <button
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            className={`relative w-12 h-7 rounded-full transition-colors ${soundEnabled ? 'bg-primary' : 'bg-gray-300'}`}
                        >
                            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${soundEnabled ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Logout Button */}
            <div className="px-4 pt-6 max-w-lg mx-auto w-full">
                <button
                    onClick={() => setShowLogoutModal(true)}
                    className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 hover:bg-red-100 border border-red-200 rounded-2xl transition-colors"
                >
                    <LogOut size={20} className="text-red-600" />
                    <span className="font-semibold text-red-600">{t.logout}</span>
                </button>
            </div>

            {/* Version */}
            <div className="px-4 pt-6 pb-4 max-w-lg mx-auto w-full text-center">
                <p className="text-xs text-gray-400">{t.version} 1.0.0</p>
            </div>

            {/* Logout Confirmation Modal */}
            {showLogoutModal && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
                        onClick={() => setShowLogoutModal(false)}
                    />
                    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
                        <div className="bg-white rounded-2xl max-w-lg mx-auto overflow-hidden shadow-2xl">
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <LogOut size={32} className="text-red-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">{t.logout}</h3>
                                <p className="text-gray-500">{t.logoutConfirm}</p>
                            </div>
                            <div className="flex border-t border-gray-100">
                                <button
                                    onClick={() => setShowLogoutModal(false)}
                                    className="flex-1 p-4 font-semibold text-gray-700 hover:bg-gray-50 transition-colors border-r border-gray-100"
                                >
                                    {CONTENT[language].myOrdersPage.cancel}
                                </button>
                                <button
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="flex-1 p-4 font-semibold text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isLoggingOut ? (
                                        <Loader2 size={20} className="animate-spin" />
                                    ) : null}
                                    {t.logout}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
