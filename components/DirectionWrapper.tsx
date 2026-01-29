'use client'

import { useLanguage } from '@/lib/context/LanguageContext'
import { useEffect } from 'react'

export function DirectionWrapper({ children }: { children: React.ReactNode }) {
    const { direction, language } = useLanguage()

    useEffect(() => {
        // Update the html element's dir and lang attributes
        document.documentElement.dir = direction
        document.documentElement.lang = language
    }, [direction, language])

    return <>{children}</>
}
