'use client'

import { useLanguage } from '@/lib/context/LanguageContext'
import Image from 'next/image'

const languageConfig = {
    en: { next: 'ar', flag: 'https://flagcdn.com/us.svg', label: 'English' },
    ar: { next: 'fr', flag: 'https://flagcdn.com/sa.svg', label: 'العربية' },
    fr: { next: 'en', flag: 'https://flagcdn.com/fr.svg', label: 'Français' },
} as const;

export default function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage()

    const toggleLanguage = () => {
        const nextLang = languageConfig[language].next;
        setLanguage(nextLang);
    }

    const currentConfig = languageConfig[language];

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 transition-all border border-gray-200 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl"
            aria-label="Switch language"
        >
            <Image 
                src={currentConfig.flag} 
                alt={currentConfig.label} 
                width={20} 
                height={20} 
                className="rounded-sm"
            />
            <span className="text-sm font-medium text-gray-700">
                {language.toUpperCase()}
            </span>
        </button>
    )
}
