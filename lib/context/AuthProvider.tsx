'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setClerkSessionGetter } from '@/lib/supabase/client'
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

  // Wire up the Clerk session token getter for the Supabase client.
  // This runs once the session is available and allows all Supabase
  // clients created via createClient() to automatically include the
  // Clerk token in every request.
  useEffect(() => {
    if (session) {
      setClerkSessionGetter(async () => {
        return session.getToken() ?? null
      })
    }
  }, [session])

  useEffect(() => {
    const fetchProfile = async () => {
      if (!isUserLoaded) return

      if (clerkUser && session) {
        try {
          const supabase = createClient()

          const { data: users, error } = await supabase
            .from('users')
            .select('name, role, avatar_url, is_active, restaurant_id')
            .eq('id', clerkUser.id)
            .single()

          if (error) {
            console.error('Error fetching user profile:', error)
            if (error.code === 'PGRST301') {
              console.error(
                'Supabase rejected the Clerk JWT. Make sure you have configured Clerk as a ' +
                'third-party auth provider in your Supabase dashboard ' +
                '(Authentication > Sign In / Up > Third-Party Auth > Add Clerk).'
              )
            }
          }
          setProfile(users)
        } catch (err) {
          console.error('AuthProvider: unexpected error fetching profile:', err)
          setProfile(null)
        }
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
