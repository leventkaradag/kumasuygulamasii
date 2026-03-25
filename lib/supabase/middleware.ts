import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { canAccessPath } from '@/lib/authz/access'
import {
  getAuthenticatedRedirectPath,
  getProfileByUserId,
  isApprovedProfile,
} from './profile-access'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password')

  const isResetPasswordPage = pathname.startsWith('/reset-password')

  const isPendingPage = pathname.startsWith('/pending')

  const protectedPrefixes = [
    '/dashboard',
    '/ozetler',
    '/desenler',
    '/dokuma',
    '/boyahane',
    '/depo',
    '/admin-paneli',
    '/onay-paneli',
    '/sevk-rezerv',
    '/raporlar',
    '/ayarlar',
    '/siparis',
    '/superadmin',
    '/notlar',
    '/sevk/',
  ]

  const isProtectedPage = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

  if (!user && (isProtectedPage || isPendingPage)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (!user) {
    return response
  }

  if (isResetPasswordPage) {
    return response
  }

  if (!isAuthPage && !isProtectedPage && !isPendingPage) {
    return response
  }

  const profile = await getProfileByUserId(supabase, user.id)
  const redirectPath = getAuthenticatedRedirectPath(profile)

  if (isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = redirectPath
    return NextResponse.redirect(url)
  }

  if (isPendingPage) {
    if (profile && isApprovedProfile(profile.status)) {
      const url = request.nextUrl.clone()
      url.pathname = getAuthenticatedRedirectPath(profile)
      return NextResponse.redirect(url)
    }

    return response
  }

  if (!profile || !isApprovedProfile(profile.status)) {
    const url = request.nextUrl.clone()
    url.pathname = '/pending'
    return NextResponse.redirect(url)
  }

  if (!canAccessPath(profile.role, pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = getAuthenticatedRedirectPath(profile)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
}
