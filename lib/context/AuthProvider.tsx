'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'


interface AuthContextType {
  user: User | null
  profile: any
  loading: boolean
}


const AuthContext = createContext<AuthContextType | undefined>(undefined)


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data: users, error } = await supabase
          .from('users')
          .select('name, role, avatar_url, is_active, restaurant_id')
          .eq('id', user.id)
          .single()
        if (error) console.log('Error fetching user profile:', error)
        setProfile(users)
      }

      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}


export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
