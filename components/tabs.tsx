'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/lib/context/LanguageContext'
import CONTENT from '@/const/content'

type TabsProps = {
    tabs: {name: string, to: string, icon: React.ReactNode}[]
}

export default function Tabs({ tabs }: TabsProps) {
    const { language } = useLanguage();
    return (
        <div className='fixed bottom-0 py-3 w-full bg-white border-t border-t-slate-200 flex justify-between'>
            {tabs.map((tab) => (
                <Link key={CONTENT[language].tabs[tab.name as keyof typeof CONTENT[typeof language]['tabs']]} href={tab.to} className={`flex  flex-col flex-1 items-center ${usePathname() === tab.to ? 'text-primary' : 'text-gray-600'}`}>
                    {tab.icon}
                    <span className='text-sm truncate mt-1'>{CONTENT[language].tabs[tab.name as keyof typeof CONTENT[typeof language]['tabs']]}</span>
                </Link>
            ))}
        </div>
    )
}
