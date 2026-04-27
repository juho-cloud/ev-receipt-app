import { NextResponse } from 'next/server'

const PASSWORD = process.env.APP_PASSWORD || 'changeme'
const COOKIE = 'ev_app_auth'

export function middleware(request) {
  const { pathname } = request.nextUrl

  if (pathname === '/api/login') return NextResponse.next()

  const cookie = request.cookies.get(COOKIE)
  if (cookie?.value === PASSWORD) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const loginUrl = new URL('/login', request.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico).*)']
}
