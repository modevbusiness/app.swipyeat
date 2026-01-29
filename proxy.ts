import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'


export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  
  // Redirect logged-in users away from auth pages
  if ((request.nextUrl.pathname === '/login' || 
       request.nextUrl.pathname === '/signup') && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Protect routes
  const protectedRoutes = ['/orders', '/profile', '/', '/tables', '/scan', '/kitchen', '/kitchen/orders', '/kitchen/profile']
  if (protectedRoutes.includes(request.nextUrl.pathname) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}