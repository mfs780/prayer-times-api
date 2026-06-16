import { NextRequest, NextResponse } from 'next/server';
import { parseMasjidRequest, ConfigError } from '@/lib/config';
import { getPrayerTimesResponse } from '@/lib/prayer-times-handler';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...NO_STORE_HEADERS,
      ...(init?.headers || {}),
    },
  });
}

async function handle(request: NextRequest) {
  try {
    const { config: masjid, params } = await parseMasjidRequest(request);
    const { status, body } = await getPrayerTimesResponse(params, masjid);
    return jsonNoStore(body, { status });
  } catch (e) {
    if (e instanceof ConfigError) {
      return jsonNoStore(
        { success: false, error: { code: 'INVALID_CONFIG', field: e.field, message: e.message } },
        { status: 400 },
      );
    }
    console.error('[prayer-times] handler error:', e);
    return jsonNoStore({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
