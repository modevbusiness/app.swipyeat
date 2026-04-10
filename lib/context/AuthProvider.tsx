'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSession, useUser } from '@clerk/nextjs'

interface AuthContextType {
  user: any | null // Simplified User type based on Clerk/Supabase profile
  profile: any
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser()
  const { session } = useSession()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      if (!isUserLoaded) return

      if (clerkUser && session) {
        const token = await session.getToken({ template: 'supabase' })
        const supabase = createClient(token || undefined)

        const { data: users, error } = await supabase
          .from('users')
          .select('name, role, avatar_url, is_active, restaurant_id')
          .eq('id', clerkUser.id)
          .single()

        if (error) console.log('Error fetching user profile:', error)
        setProfile(users)
      } else {
        setProfile(null)
      }
      setLoading(false)
    }

    fetchProfile()
  }, [clerkUser, session, isUserLoaded])

  return (
    <AuthContext.Provider value={{ user: clerkUser, profile, loading: !isUserLoaded || loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
