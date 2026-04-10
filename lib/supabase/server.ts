import { createClient as supabaseCreateClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

/**
 * Create a Supabase server client that automatically includes the Clerk
 * session token via the `accessToken` callback.
 *
 * Uses the native Clerk ↔ Supabase third-party auth integration (post April 2025).
 */
export async function createClient() {
  return supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      async accessToken() {
        return (await auth()).getToken()
      },
    }
  )
}
