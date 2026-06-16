import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/prayer-times/route';
import { getPrayerTimesAPI, getPrayerTimesForYearAPI } from '@/utils/prayer-times';

jest.mock('@/utils/prayer-times', () => {
  const actual: any = jest.requireActual('@/utils/prayer-times');
  return {
    ...actual,
    getPrayerTimesAPI: jest.fn(),
    getPrayerTimesForYearAPI: jest.fn(),
  };
});

// Mock the config parser so the legacy tests don't need to embed a `config=...`
// query param in every URL. The ICCF masjid config is inlined here because
// jest hoists `jest.mock` factories above module-level constants.
jest.mock('@/lib/config', () => {
  const actual: any = jest.requireActual('@/lib/config');
  const prayerTimes: any = jest.requireActual('@/utils/prayer-times');
  const ICCF = {
    slug: 'iccf',
    name: 'Islamic Foundation of Clovis and Fresno (ICCF)',
    address: '2111 E Nees Ave, Fresno, CA 93720',
    timezone: 'America/Los_Angeles',
    calcMethodId: 2,
    calcMethodLabel: 'ISNA',
    iqamaRules: prayerTimes.DEFAULT_PRAYER_CONFIGS,
  };
  return {
    ...actual,
    parseMasjidRequest: async (request: Request) => {
      const url = new URL(request.url);
      const sp = url.searchParams;
      return {
        config: ICCF,
        params: {
          scope: (sp.get('scope') || 'day') as 'day' | 'month' | 'ramadan' | 'year',
          date: sp.get('date') ?? undefined,
          asOf: sp.get('asOf') ?? undefined,
          month: sp.get('month') ?? undefined,
          year: sp.get('year') ?? undefined,
          groupByInterval: sp.get('groupByInterval') === 'true',
          includeRaw: sp.get('includeRaw') === 'true',
          includeDebug: sp.get('includeDebug') === 'true',
        },
      };
    },
  };
});

function createEntry(
  day: number,
  fajr: string,
  hijriMonthNumber: number,
  hijriDay: string,
  timingOverrides: Partial<Record<string, string>> = {},
  gregorianMonth = 3,
  gregorianYear = 2026
) {
  const paddedDay = String(day).padStart(2, '0');
  const hijriMonthNames: Record<number, string> = {
    8: "Sha'ban",
    9: 'Ramadan',
    10: 'Shawwal',
    11: 'Dhul-Qadah',
  };

  return {
    timings: {
      Fajr: fajr,
      Sunrise: '07:10',
      Dhuhr: '13:05',
      Asr: '16:55',
      Sunset: '19:09',
      Maghrib: '19:09',
      Isha: '20:31',
      Imsak: '04:55',
      Midnight: '00:30',
      Firstthird: '22:00',
      Lastthird: '03:00',
      ...timingOverrides,
    },
    date: {
      gregorian: {
        date: `${paddedDay}-${String(gregorianMonth).padStart(2, '0')}-${gregorianYear}`,
      },
      hijri: {
        day: hijriDay,
        month: {
          number: hijriMonthNumber,
          en: hijriMonthNames[hijriMonthNumber],
        },
        year: '1447',
      },
    },
    meta: {},
  };
}

const fajrTimes: Record<number, string> = {
  1: '06:22',
  2: '06:21',
  3: '06:20',
  4: '06:18',
  5: '06:16',
  6: '06:14',
  7: '06:12',
  8: '06:09',
  9: '06:08',
  10: '06:06',
  11: '06:05',
  12: '06:03',
  13: '06:02',
  14: '06:00',
  15: '05:59',
  16: '05:57',
  17: '05:56',
  18: '05:54',
  19: '05:53',
  20: '05:51',
  21: '05:50',
  22: '05:48',
  23: '05:47',
  24: '05:45',
  25: '05:44',
  26: '05:42',
  27: '05:41',
  28: '05:39',
  29: '05:38',
  30: '05:36',
  31: '05:35',
};

const monthEntries = Array.from({ length: 31 }, (_, index) => {
  const day = index + 1;

  if (day <= 10) {
    return createEntry(day, fajrTimes[day], 8, String(day + 20));
  }

  if (day <= 19) {
    return createEntry(day, fajrTimes[day], 9, String(day - 10));
  }

  return createEntry(day, fajrTimes[day], 10, String(day - 19));
});

const intervalSensitiveEntries = Array.from({ length: 31 }, (_, index) => {
  const day = index + 1;
  const baseHijriDay = String(day).padStart(2, '0');

  if (day >= 11) {
    return createEntry(day, fajrTimes[day], 10, baseHijriDay, {
      Isha: '21:06',
    });
  }

  if (day >= 8) {
    return createEntry(day, fajrTimes[day], 10, baseHijriDay, {
      Isha: '20:56',
    });
  }

  return createEntry(day, fajrTimes[day], 10, baseHijriDay);
});

const aprilIntervalEntries = Array.from({ length: 30 }, (_, index) => {
  const day = index + 1;
  const baseHijriDay = String(day).padStart(2, '0');
  const ishaTimes: Record<number, string> = {
    21: '20:56',
    22: '20:57',
    23: '20:58',
    24: '20:59',
    25: '21:00',
    26: '21:01',
    27: '21:02',
    28: '21:04',
    29: '21:05',
    30: '21:06',
  };

  return createEntry(
    day,
    '05:00',
    10,
    baseHijriDay,
    ishaTimes[day] ? { Isha: ishaTimes[day] } : {},
    4
  );
});

const unsortedAprilIntervalEntries = [
  ...aprilIntervalEntries.slice(0, 28),
  aprilIntervalEntries[29],
  aprilIntervalEntries[28],
];

const mayIntervalEntries = Array.from({ length: 31 }, (_, index) => {
  const day = index + 1;
  const baseHijriDay = String(day).padStart(2, '0');

  return createEntry(
    day,
    '04:55',
    11,
    baseHijriDay,
    {
      Isha: '21:07',
    },
    5
  );
});

function filterEntriesByRange(start: string, end: string, entries = monthEntries) {
  const createDate = (value: string) => {
    const [day, month, year] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const startDate = createDate(start);
  const endDate = createDate(end);

  return entries.filter((entry) => {
    const entryDate = createDate(entry.date.gregorian.date);
    return entryDate >= startDate && entryDate <= endDate;
  });
}

function findPrayer(prayers: any[], prayerName: string): any {
  return prayers.find((prayer) => prayer.name === prayerName);
}

describe('Public ICCF Prayer Times API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getPrayerTimesAPI as jest.Mock).mockImplementation((async (start: string, end: string) => ({
      code: 200,
      status: 'OK',
      data: filterEntriesByRange(start, end),
    })) as any);
    (getPrayerTimesForYearAPI as jest.Mock).mockResolvedValue({
      code: 200,
      status: 'OK',
      data: {
        '03': monthEntries,
      },
    } as any);
  });

  test('uses the first day of the next canonical interval for non-grouped day responses', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/public/iccf/prayer-times?scope=day&date=2026-03-11&includeRaw=true'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.today.interval).toContain('11');
    expect(data.data.today.interval).toContain('19');
    expect(data.data.tomorrow.date.gregorian).toBe('2026-03-20');
    expect(data.data.tomorrow.interval).toContain('20');

    const todayFajr = data.data.today.prayers.find((prayer: { name: string }) => prayer.name === 'Fajr');
    const nextIntervalFajr = data.data.tomorrow.prayers.find((prayer: { name: string }) => prayer.name === 'Fajr');

    expect(todayFajr.iqama).toBe('6:15 AM');
    expect(todayFajr.iqamaRaw).toBe('06:15');
    expect(nextIntervalFajr.iqama).toBe('6:15 AM');
    expect(nextIntervalFajr.iqamaRaw).toBe('06:15');
  });

  test('returns API-sourced debug metadata for the resolved interval', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/public/iccf/prayer-times?scope=day&date=2026-03-11&includeRaw=true&includeDebug=true'
    );

    const response = await GET(request);
    const data = await response.json();
    const todayFajr = data.data.today.prayers.find((prayer: { name: string }) => prayer.name === 'Fajr');

    expect(todayFajr.debugInfo.intervalDebug.intervalPeriod).toEqual({
      start: '11-03-2026',
      end: '19-03-2026',
      label: expect.stringContaining('11'),
    });
    expect(todayFajr.debugInfo.intervalDebug.accommodatingIqama).toBe('06:15');
    expect(todayFajr.debugInfo.intervalDebug.intervalCalculations).toHaveLength(9);
    expect(data.data.today.meta.location).toContain('Fresno');
  });

  test('keeps grouped day responses aligned with the canonical current interval', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/public/iccf/prayer-times?scope=day&date=2026-03-13&groupByInterval=true&includeRaw=true'
    );

    const response = await GET(request);
    const data = await response.json();
    const currentFajr = data.data.currentInterval.prayers.find((prayer: { name: string }) => prayer.name === 'Fajr');

    expect(data.success).toBe(true);
    expect(data.data.currentInterval.interval).toContain('11');
    expect(data.data.currentInterval.interval).toContain('19');
    expect(currentFajr.athan).toBe('6:02 AM');
    expect(currentFajr.athanRaw).toBe('06:02');
    expect(currentFajr.iqama).toBe('6:15 AM');
    expect(currentFajr.iqamaRaw).toBe('06:15');
  });

  test('uses the displayed day for grouped interval Maghrib delay iqama', async () => {
    const maghribTimes: Record<number, string> = {
      11: '19:09',
      12: '19:12',
      13: '19:15',
      14: '19:18',
      15: '19:21',
      16: '19:24',
      17: '19:27',
      18: '19:30',
      19: '19:33',
    };
    const maghribRegressionEntries = monthEntries.map((entry) => {
      const day = Number(entry.date.gregorian.date.slice(0, 2));
      const maghrib = maghribTimes[day];

      if (!maghrib) {
        return entry;
      }

      return createEntry(day, fajrTimes[day], 9, String(day - 10), {
        Sunset: maghrib,
        Maghrib: maghrib,
      });
    });

    (getPrayerTimesAPI as jest.Mock).mockImplementation(async (start: string, end: string) => ({
      code: 200,
      status: 'OK',
      data: filterEntriesByRange(start, end, maghribRegressionEntries),
    }));

    const request = new NextRequest(
      'http://localhost:3000/api/public/iccf/prayer-times?scope=day&date=2026-03-13&groupByInterval=true&includeRaw=true'
    );

    const response = await GET(request);
    const data = await response.json();
    const currentMaghrib = data.data.currentInterval.prayers.find((prayer: { name: string }) => prayer.name === 'Maghrib');

    expect(data.success).toBe(true);
    expect(currentMaghrib.athan).toBe('7:15 PM');
    expect(currentMaghrib.athanRaw).toBe('19:15');
    expect(currentMaghrib.iqama).toBe('7:25 PM');
    expect(currentMaghrib.iqamaRaw).toBe('19:25');
  });

  test('marks day responses as no-store to prevent stale browser caching', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/public/iccf/prayer-times?scope=day&date=2026-03-13&includeRaw=true'
    );

    const response = await GET(request);

    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('expires')).toBe('0');
  });

  test('keeps today stable across morning and evening requests on the same Pacific date', async () => {
    (getPrayerTimesAPI as jest.Mock).mockImplementation(async (start: string, end: string) => ({
      code: 200,
      status: 'OK',
      data: filterEntriesByRange(start, end, intervalSensitiveEntries),
    }));

    jest.useFakeTimers();

    try {
      const request = new NextRequest(
        'http://localhost:3000/api/public/iccf/prayer-times?scope=day&includeRaw=true'
      );

      jest.setSystemTime(new Date('2026-03-09T15:00:00Z'));
      const morningResponse = await GET(request);
      const morningData = await morningResponse.json();
      const morningIsha = findPrayer(morningData.data.today.prayers, 'Isha');
      const morningNextIsha = findPrayer(morningData.data.tomorrow.prayers, 'Isha');

      expect(morningData.data.today.date.gregorian).toBe('2026-03-09');
      expect(morningIsha.iqamaRaw).toBe('21:15');
      expect(morningNextIsha.iqamaRaw).toBe('21:30');

      jest.setSystemTime(new Date('2026-03-10T03:00:00Z'));
      const eveningResponse = await GET(request);
      const eveningData = await eveningResponse.json();
      const eveningIsha = findPrayer(eveningData.data.today.prayers, 'Isha');
      const eveningNextIsha = findPrayer(eveningData.data.tomorrow.prayers, 'Isha');

      expect(eveningData.data.today.date.gregorian).toBe('2026-03-09');
      expect(eveningIsha.iqamaRaw).toBe('21:15');
      expect(eveningNextIsha.iqamaRaw).toBe('21:30');
    } finally {
      jest.useRealTimers();
    }
  });

  test('switches to the next day exactly at midnight Pacific', async () => {
    jest.useFakeTimers();

    try {
      const request = new NextRequest(
        'http://localhost:3000/api/public/iccf/prayer-times?scope=day&includeRaw=true'
      );

      jest.setSystemTime(new Date('2026-03-14T06:59:00Z'));
      const beforeMidnightResponse = await GET(request);
      const beforeMidnightData = await beforeMidnightResponse.json();

      expect(beforeMidnightData.data.today.date.gregorian).toBe('2026-03-13');

      jest.setSystemTime(new Date('2026-03-14T07:00:00Z'));
      const afterMidnightResponse = await GET(request);
      const afterMidnightData = await afterMidnightResponse.json();

      expect(afterMidnightData.data.today.date.gregorian).toBe('2026-03-14');
    } finally {
      jest.useRealTimers();
    }
  });

  test('resolves the same Pacific day for morning and evening asOf overrides', async () => {
    (getPrayerTimesAPI as jest.Mock).mockImplementation(async (start: string, end: string) => ({
      code: 200,
      status: 'OK',
      data: filterEntriesByRange(start, end, intervalSensitiveEntries),
    }));

    const morningRequest = new NextRequest(
      'http://localhost:3000/api/public/iccf/prayer-times?scope=day&includeRaw=true&includeDebug=true&asOf=2026-03-09T08:00:00-07:00'
    );
    const eveningRequest = new NextRequest(
      'http://localhost:3000/api/public/iccf/prayer-times?scope=day&includeRaw=true&includeDebug=true&asOf=2026-03-09T20:00:00-07:00'
    );

    const morningResponse = await GET(morningRequest);
    const morningData = await morningResponse.json();
    const morningIsha = findPrayer(morningData.data.today.prayers, 'Isha');
    const morningNextIsha = findPrayer(morningData.data.tomorrow.prayers, 'Isha');

    const eveningResponse = await GET(eveningRequest);
    const eveningData = await eveningResponse.json();
    const eveningIsha = findPrayer(eveningData.data.today.prayers, 'Isha');
    const eveningNextIsha = findPrayer(eveningData.data.tomorrow.prayers, 'Isha');

    expect(morningData.data.today.date.gregorian).toBe('2026-03-09');
    expect(morningIsha.iqamaRaw).toBe('21:15');
    expect(morningNextIsha.iqamaRaw).toBe('21:30');
    expect(morningData.data.today.meta.debugContext).toEqual({
      requestedDate: null,
      requestedAsOf: '2026-03-09T08:00:00-07:00',
      effectiveNowUtc: '2026-03-09T15:00:00.000Z',
      resolvedDate: '2026-03-09',
      usedAsOfOverride: true,
    });

    expect(eveningData.data.today.date.gregorian).toBe('2026-03-09');
    expect(eveningIsha.iqamaRaw).toBe('21:15');
    expect(eveningNextIsha.iqamaRaw).toBe('21:30');
    expect(eveningData.data.today.meta.debugContext).toEqual({
      requestedDate: null,
      requestedAsOf: '2026-03-09T20:00:00-07:00',
      effectiveNowUtc: '2026-03-10T03:00:00.000Z',
      resolvedDate: '2026-03-09',
      usedAsOfOverride: true,
    });
  });

  test('switches the resolved day at midnight Pacific for asOf overrides', async () => {
    const beforeMidnightRequest = new NextRequest(
      'http://localhost:3000/api/public/iccf/prayer-times?scope=day&includeRaw=true&includeDebug=true&asOf=2026-03-13T23:59:00-07:00'
    );
    const afterMidnightRequest = new NextRequest(
      'http://localhost:3000/api/public/iccf/prayer-times?scope=day&includeRaw=true&includeDebug=true&asOf=2026-03-14T00:00:00-07:00'
    );

    const beforeMidnightResponse = await GET(beforeMidnightRequest);
    const beforeMidnightData = await beforeMidnightResponse.json();
    const afterMidnightResponse = await GET(afterMidnightRequest);
    const afterMidnightData = await afterMidnightResponse.json();

    expect(beforeMidnightData.data.today.date.gregorian).toBe('2026-03-13');
    expect(beforeMidnightData.data.today.meta.debugContext.resolvedDate).toBe('2026-03-13');
    expect(afterMidnightData.data.today.date.gregorian).toBe('2026-03-14');
    expect(afterMidnightData.data.today.meta.debugContext.resolvedDate).toBe('2026-03-14');
  });

  test('prefers explicit date over asOf when both are provided', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/public/iccf/prayer-times?scope=day&date=2026-03-09&includeRaw=true&includeDebug=true&asOf=2026-03-10T20:00:00-07:00'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.data.today.date.gregorian).toBe('2026-03-09');
    expect(data.data.today.meta.debugContext).toEqual({
      requestedDate: '2026-03-09',
      requestedAsOf: '2026-03-10T20:00:00-07:00',
      effectiveNowUtc: expect.any(String),
      resolvedDate: '2026-03-09',
      usedAsOfOverride: false,
    });
  });

  test('rejects invalid asOf overrides in debug mode', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/public/iccf/prayer-times?scope=day&includeDebug=true&asOf=2026-03-09T20:00:00'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid asOf');
  });

  test('keeps the April 21 to 30 interval intact even when April data is unsorted', async () => {
    (getPrayerTimesAPI as jest.Mock).mockImplementation(async (start: string, end: string) => ({
      code: 200,
      status: 'OK',
      data: filterEntriesByRange(
        start,
        end,
        start.includes('-04-2026') ? unsortedAprilIntervalEntries : mayIntervalEntries
      ),
    }));

    const request = new NextRequest(
      'http://localhost:3000/api/public/iccf/prayer-times?scope=day&date=2026-04-24&includeRaw=true&includeDebug=true'
    );

    const response = await GET(request);
    const data = await response.json();
    const todayIsha = findPrayer(data.data.today.prayers, 'Isha');

    expect(data.success).toBe(true);
    expect(data.data.today.interval).toBe('Apr 21–30');
    expect(todayIsha.iqamaRaw).toBe('21:30');
    expect(todayIsha.debugInfo.intervalDebug.intervalPeriod).toEqual({
      start: '21-04-2026',
      end: '30-04-2026',
      label: 'Apr 21–30',
    });
  });

  test('keeps grouped month intervals aligned with the canonical March 2026 boundaries', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/public/iccf/prayer-times?scope=month&month=3&year=2026&groupByInterval=true'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(
      data.data.map((interval: { startDate: { gregorian: string }; endDate: { gregorian: string } }) => [
        interval.startDate.gregorian,
        interval.endDate.gregorian,
      ])
    ).toEqual([
      ['2026-03-01', '2026-03-07'],
      ['2026-03-08', '2026-03-10'],
      ['2026-03-11', '2026-03-19'],
      ['2026-03-20', '2026-03-20'],
      ['2026-03-21', '2026-03-31'],
    ]);
  });

  test('preserves includeRaw for non-grouped year responses', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/public/iccf/prayer-times?scope=year&year=2026&includeRaw=true'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);

    const firstDayFajr = data.data[0].days[0].prayers.find((prayer: { name: string }) => prayer.name === 'Fajr');
    expect(firstDayFajr.athanRaw).toBe('06:22');
    expect(firstDayFajr.iqamaRaw).toBeDefined();
  });
});
