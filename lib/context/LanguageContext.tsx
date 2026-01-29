'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Language = 'en' | 'ar' | 'fr'

type Direction = 'ltr' | 'rtl'

interface LanguageContextType {
    language: Language
    direction: Direction
    setLanguage: (lang: Language) => void
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// Map languages to their text direction
const languageDirectionMap: Record<Language, Direction> = {
    en: 'ltr',
    ar: 'rtl',
    fr: 'ltr',
}

const LANGUAGE_STORAGE_KEY = 'app-language'

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>('en')
    const [isLoaded, setIsLoaded] = useState(false)

    // Load language from localStorage on mount
    useEffect(() => {
        const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null
        if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'ar' || savedLanguage === 'fr')) {
            setLanguageState(savedLanguage)
        }
        setIsLoaded(true)
    }, [])

    const setLanguage = (lang: Language) => {
        setLanguageState(lang)
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
    }

    const direction = languageDirectionMap[language]

    // Prevent flash of wrong language on initial load
    if (!isLoaded) {
        return null
    }

    return (
        <LanguageContext.Provider value={{ language, direction, setLanguage }}>
            {children}
        </LanguageContext.Provider>
    )
}

export function useLanguage() {
    const context = useContext(LanguageContext)
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider')
    }
    return context
}
