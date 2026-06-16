import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Comma-separated list of allowed origins. Default `*` (open to all callers).
// Set `ALLOWED_ORIGINS=https://a.example,https://b.example` to lock down.
const ALLOWED = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function pickAllowedOrigin(origin: string | null): string {
  if (ALLOWED.includes('*')) return '*';
  if (origin && ALLOWED.includes(origin)) return origin;
  return '';
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = pickAllowedOrigin(origin);
  if (!allow) return {};
  return {
    'Access-Control-Allow-Origin': allow,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }

  const response = NextResponse.next();
  for (const [k, v] of Object.entries(corsHeaders(origin))) {
    response.headers.set(k, v);
  }
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
