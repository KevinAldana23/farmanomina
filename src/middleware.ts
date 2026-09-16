import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET_KEY = process.env.NEXTAUTH_SECRET || 'farmanomina-default-secret-key-change-in-production-2026';
const key = new TextEncoder().encode(SECRET_KEY);
const SESSION_COOKIE_NAME = 'fn_session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir archivos estáticos y API interna de Next.js
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let isAuthenticated = false;

  if (token) {
    try {
      await jwtVerify(token, key, { algorithms: ['HS256'] });
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  const isLoginPage = pathname === '/login';

  // Si no está autenticado y trata de entrar a cualquier página protegida
  if (!isAuthenticated && !isLoginPage) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Si ya está autenticado e intenta volver a la pantalla de login
  if (isAuthenticated && isLoginPage) {
    const homeUrl = new URL('/', request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (si hubiera)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
