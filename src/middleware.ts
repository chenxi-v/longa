import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie, verifySignature } from '@/lib/auth';

function shouldSkipAuth(pathname: string): boolean {
  const skipPaths = [
    '/_next',
    '/favicon.ico',
    '/robots.txt',
    '/manifest.json',
    '/icons/',
    '/logo.png',
    '/api/login',
    '/api/logout',
    '/api/db-status',
    '/api/data',
    '/api/proxy',
    '/api/video-proxy',
    '/api/health',
    '/api/spider-proxy',
    '/api/backend',
    '/local-api/',
  ];

  return skipPaths.some((path) => pathname.startsWith(path));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkipAuth(pathname)) {
    return NextResponse.next();
  }

  const envUsername = process.env.ADMIN_USERNAME;
  const envPassword = process.env.ADMIN_PASSWORD;

  if (!envUsername || !envPassword) {
    if (pathname.startsWith('/api')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'not_configured');
    return NextResponse.redirect(loginUrl);
  }

  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo || !authInfo.username) {
    return handleAuthFailure(request, pathname);
  }

  if (authInfo.username !== envUsername) {
    return handleAuthFailure(request, pathname);
  }

  if (authInfo.signature) {
    const isValid = await verifySignature(authInfo.username, authInfo.signature, envPassword);
    if (!isValid) {
      return handleAuthFailure(request, pathname);
    }
  } else {
    return handleAuthFailure(request, pathname);
  }

  return NextResponse.next();
}

function handleAuthFailure(request: NextRequest, pathname: string): NextResponse {
  if (pathname.startsWith('/api')) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  const fullUrl = `${pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set('redirect', fullUrl);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|api/login|api/logout|api/db-status|api/data|api/proxy|api/video-proxy|api/health|local-api).*)',
  ],
};
