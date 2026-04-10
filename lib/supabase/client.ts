import { createClient as supabaseCreateClient } from '@supabase/supabase-js'

// This variable holds the Clerk session getter, set by AuthProvider once Clerk is ready.
let clerkSessionGetter: (() => Promise<string | null>) | null = null

/**
 * Called by AuthProvider to wire up the Clerk session token provider.
 * This allows the Supabase client to automatically include the Clerk
 * session token in every request — no JWT template needed, using the
 * native Clerk ↔ Supabase third-party auth integration.
 */
export function setClerkSessionGetter(getter: () => Promise<string | null>) {
  clerkSessionGetter = getter
}

/**
 * Create a Supabase browser client that automatically uses the Clerk
 * session token via the `accessToken` callback.
 *
 * Per the latest Clerk + Supabase integration docs (post April 2025),
 * this uses session.getToken() (without any template parameter) since
 * Supabase natively verifies Clerk JWTs via third-party auth.
 */
export function createClient() {
  return supabaseCreateClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      async accessToken() {
        if (clerkSessionGetter) {
          return clerkSessionGetter()
        }
        return null
      },
    }
  )
}
