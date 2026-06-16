import { NextRequest, NextResponse } from 'next/server';
import { generateConsolidatedIntervalPDF } from '@/utils/pdf-generator-consolidated';
import { parseMasjidRequest, ConfigError } from '@/lib/config';
import { getPrayerTimesResponse } from '@/lib/prayer-times-handler';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

async function handle(request: NextRequest) {
  try {
    const { config: masjid, params } = await parseMasjidRequest(request);
    const year = params.year ?? new Date().getFullYear().toString();

    const { status, body } = await getPrayerTimesResponse(
      { scope: 'year', year, includeRaw: true, groupByInterval: false },
      masjid,
    );
    const payload = body as { success?: boolean; error?: unknown };
    if (status !== 200 || !payload.success) {
      throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to fetch prayer times');
    }

    const pdfBuffer = await generateConsolidatedIntervalPDF(body as any);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${masjid.slug}-iqama-schedule-${year}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        ...NO_STORE_HEADERS,
      },
    });
  } catch (error) {
    if (error instanceof ConfigError) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CONFIG', field: error.field, message: error.message } },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    console.error('Error generating iqama schedule PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate iqama schedule PDF', details: (error as Error).message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export const GET = handle;
export const POST = handle;
