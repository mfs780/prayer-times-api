import {
  getPrayerTimesAPI,
  getPrayerTimesForYearAPI,
  calculateIqamaTime,
  formatTo12Hour,
  createDateFromDMY,
  getActualIntervalDates,
  getRamadanTransitionDays,
  generateIntervals,
  compareTime,
  addMinutes,
  roundToNearestInterval,
  isRamadan,
  isDST,
  getDSTTransitionDates,
  sortDailyEntriesByGregorianDate,
  DailyEntry,
  ApiResponse,
  PrayerTimeConfig,
  type AladhanSource,
} from '@/utils/prayer-times';
import {
  dateToAladhan,
  createDateFromISO,
  getTodayISOInTimeZone,
  type AladhanDateString,
} from '@/utils/date-formats';
import {
  PRAYER_NAMES,
  type MasjidConfig,
  type PrayerTimesParams,
} from '@/lib/config';

function aladhanSource(masjid: MasjidConfig): AladhanSource {
  return { address: masjid.address, methodId: masjid.calcMethodId };
}

interface PrayerData {
  name: string;
  athan: string;
  iqama: string;
  athanRaw?: string; // 24-hour format (HH:MM)
  iqamaRaw?: string; // 24-hour format (HH:MM)
  debugInfo?: PrayerDebugInfo;
}

interface DateInfo {
  gregorian: string;
  gregorianFormatted: string;
  hijri: string;
}

interface IntervalCalculationDetails {
  date: string;
  athanTime: string;
  athanPlusGap: string;
  finalCalculated: string;
}

interface IntervalDebugInfo {
  gapTime: number;
  minIqamaTime: string;
  intervalMinutes: number;
  roundedResult: string;
  intervalPeriod?: {
    start: string;
    end: string;
    label: string;
  };
  intervalCalculations?: IntervalCalculationDetails[];
  accommodatingIqama?: string;
}

interface PrayerDebugInfo {
  config: PrayerTimeConfig | null;
  calculationSteps: string[];
  isDST: boolean;
  isRamadan: boolean;
  usedRamadanRules: boolean;
  intervalDebug?: IntervalDebugInfo;
}

interface DayMeta {
  location: string;
  timezone: string;
  method: string;
  dstInfo: {
    isDST: boolean;
    dstStart: string;
    dstEnd: string;
  };
  debugContext?: DebugContext;
}

interface DayResponse {
  date: DateInfo;
  prayers: PrayerData[];
  meta?: DayMeta;
}

interface IntervalResponse {
  interval: string;
  startDate: DateInfo;
  endDate?: DateInfo;
  prayers: PrayerData[];
}

interface DebugContext {
  requestedDate: string | null;
  requestedAsOf: string | null;
  effectiveNowUtc: string;
  resolvedDate: string;
  usedAsOfOverride: boolean;
}

function getISODateForTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Unable to derive date for timezone: ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

function parseDebugAsOf(asOf: string): Date | null {
  const hasTimeZone = /(Z|[+-]\d{2}:\d{2})$/i.test(asOf);
  if (!hasTimeZone) {
    return null;
  }

  const parsed = new Date(asOf);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function getDayOfMonth(entry: DailyEntry): number {
  return parseInt(entry.date.gregorian.date.split('-')[0], 10);
}

function getGregorianMonthKey(entry: DailyEntry): string {
  const [_day, month, year] = entry.date.gregorian.date.split('-');
  return `${month}-${year}`;
}

function groupEntriesByGregorianMonth(entries: DailyEntry[]): Map<string, DailyEntry[]> {
  const monthGroups = new Map<string, DailyEntry[]>();

  sortDailyEntriesByGregorianDate(entries).forEach((entry) => {
    const monthKey = getGregorianMonthKey(entry);
    if (!monthGroups.has(monthKey)) {
      monthGroups.set(monthKey, []);
    }
    monthGroups.get(monthKey)!.push(entry);
  });

  return monthGroups;
}

function findIntervalEntriesForDay(entry: DailyEntry, monthEntries: DailyEntry[]): DailyEntry[] {
  if (monthEntries.length === 0) return [entry];

  const sortedMonthEntries = sortDailyEntriesByGregorianDate(monthEntries);
  const targetDay = getDayOfMonth(entry);
  const interval = generateIntervals(sortedMonthEntries).find(({ range: [start, end] }) => {
    return targetDay >= start && targetDay <= end;
  });

  if (!interval) {
    return [entry];
  }

  const [start, end] = interval.range;
  const intervalEntries = sortedMonthEntries.filter((candidate) => {
    const day = getDayOfMonth(candidate);
    return day >= start && day <= end;
  });

  return intervalEntries.length > 0 ? intervalEntries : [entry];
}

function filterEntriesByDateRange(
  entries: DailyEntry[],
  startDate: AladhanDateString,
  endDate: AladhanDateString
): DailyEntry[] {
  const start = createDateFromDMY(startDate);
  const end = createDateFromDMY(endDate);

  return sortDailyEntriesByGregorianDate(entries).filter((entry) => {
    const entryDate = createDateFromDMY(entry.date.gregorian.date);
    return entryDate >= start && entryDate <= end;
  });
}

function createPrayerDateTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const dateAtTime = new Date(date);
  dateAtTime.setHours(hours, minutes, 0, 0);
  return dateAtTime;
}

function createDayMeta(entry: DailyEntry, masjid: MasjidConfig, debugContext?: DebugContext): DayMeta {
  const date = createDateFromDMY(entry.date.gregorian.date);
  const dateAtMidnight = new Date(date);
  dateAtMidnight.setHours(0, 0, 0, 0);
  const dstInfo = getDSTTransitionDates(date.getFullYear());

  return {
    location: masjid.address,
    timezone: masjid.timezone,
    method: masjid.calcMethodLabel,
    dstInfo: {
      isDST: isDST(dateAtMidnight, masjid.timezone),
      dstStart: dstInfo.start.toISOString(),
      dstEnd: dstInfo.end.toISOString(),
    },
    ...(debugContext ? { debugContext } : {}),
  };
}

function createIntervalDebugInfo(
  entry: DailyEntry,
  prayer: string,
  intervalEntries: DailyEntry[],
  config: PrayerTimeConfig,
  masjid: MasjidConfig
): IntervalDebugInfo | undefined {
  const activeRules = isRamadan(entry.date.hijri) && config.ramadanRules
    ? config.ramadanRules
    : config.defaultRules;

  if (activeRules.type !== 'interval') {
    return undefined;
  }

  const athanTime = entry.timings[prayer];
  const minIqamaTime = addMinutes(athanTime, activeRules.gapTime);
  const roundedResult = roundToNearestInterval(minIqamaTime, activeRules.interval);
  const intervalCalculations = intervalEntries.map((intervalEntry) => {
    const intervalAthan = intervalEntry.timings[prayer];
    const athanPlusGap = addMinutes(intervalAthan, activeRules.gapTime);
    const finalCalculated = calculateIqamaTime(
      intervalAthan,
      config,
      intervalEntry.date.hijri,
      createDateFromDMY(intervalEntry.date.gregorian.date),
      masjid.timezone,
    );

    return {
      date: intervalEntry.date.gregorian.date,
      athanTime: intervalAthan,
      athanPlusGap,
      finalCalculated,
    };
  });

  const intervalStart = intervalEntries[0]?.date.gregorian.date;
  const intervalEnd = intervalEntries[intervalEntries.length - 1]?.date.gregorian.date;
  const intervalPeriod = intervalStart && intervalEnd
    ? {
        start: intervalStart,
        end: intervalEnd,
        label: formatIntervalLabel(intervalStart, intervalEnd),
      }
    : undefined;

  return {
    gapTime: activeRules.gapTime,
    minIqamaTime,
    intervalMinutes: activeRules.interval,
    roundedResult,
    intervalPeriod,
    intervalCalculations,
    accommodatingIqama: calculateAccommodatingIqama(intervalEntries, prayer, masjid).raw,
  };
}

function buildPrayerDebugInfo(
  entry: DailyEntry,
  prayer: string,
  intervalEntries: DailyEntry[],
  finalIqamaTime: string,
  masjid: MasjidConfig,
): PrayerDebugInfo {
  const config = masjid.iqamaRules[prayer as keyof typeof masjid.iqamaRules] || null;
  const calculationSteps: string[] = [];
  const prayerDate = createDateFromDMY(entry.date.gregorian.date);
  const athanTime = entry.timings[prayer];
  const dateAtAthanTime = createPrayerDateTime(prayerDate, athanTime);
  const isPrayerDST = isDST(dateAtAthanTime, masjid.timezone);
  const isPrayerRamadan = isRamadan(entry.date.hijri);

  if (!config) {
    calculationSteps.push(`No configuration found for ${prayer}`);
    calculationSteps.push('Using athan time as iqama time');

    return {
      config: null,
      calculationSteps,
      isDST: isPrayerDST,
      isRamadan: isPrayerRamadan,
      usedRamadanRules: false,
    };
  }

  const activeRules = isPrayerRamadan && config.ramadanRules
    ? config.ramadanRules
    : config.defaultRules;
  const usedRamadanRules = isPrayerRamadan && !!config.ramadanRules;

  calculationSteps.push(`Starting with Athan time: ${athanTime}`);
  calculationSteps.push(`Prayer configuration found for ${prayer}`);
  calculationSteps.push(`Is Ramadan: ${isPrayerRamadan}`);
  calculationSteps.push(`Using ${usedRamadanRules ? 'Ramadan' : 'Default'} rules`);
  calculationSteps.push(`Rule type: ${activeRules.type}`);

  let intervalDebug: IntervalDebugInfo | undefined;

  switch (activeRules.type) {
    case 'delay':
      calculationSteps.push(`Adding ${activeRules.delay} minutes delay`);
      calculationSteps.push(`Result: ${finalIqamaTime}`);
      break;

    case 'interval':
      intervalDebug = createIntervalDebugInfo(entry, prayer, intervalEntries, config, masjid);
      calculationSteps.push(`Gap time: ${activeRules.gapTime} minutes`);
      calculationSteps.push(`Minimum iqama time for today: ${intervalDebug?.minIqamaTime || addMinutes(athanTime, activeRules.gapTime)}`);
      calculationSteps.push(`Rounding to nearest ${activeRules.interval}-minute interval: ${intervalDebug?.roundedResult || roundToNearestInterval(addMinutes(athanTime, activeRules.gapTime), activeRules.interval)}`);
      if (intervalDebug?.intervalPeriod) {
        calculationSteps.push(`This date is in interval: ${intervalDebug.intervalPeriod.start} to ${intervalDebug.intervalPeriod.end}`);
        calculationSteps.push('For interval prayers, we calculate iqama time for ALL dates in the period');
        calculationSteps.push('Then use the LATEST time to accommodate all dates in the interval');
      }
      if (activeRules.lowerLimit) {
        calculationSteps.push(`Lower limit configured: ${activeRules.lowerLimit}`);
      }
      if (activeRules.upperLimit) {
        calculationSteps.push(`Upper limit configured: ${activeRules.upperLimit}`);
      }
      break;

    case 'dst':
      calculationSteps.push(`Athan time: ${athanTime}`);
      calculationSteps.push(`DST status at athan time: ${isPrayerDST ? 'DST (Spring/Summer)' : 'Standard Time (Fall/Winter)'}`);
      calculationSteps.push(`DST time option: ${activeRules.afterDST}`);
      calculationSteps.push(`Standard time option: ${activeRules.beforeDST}`);
      calculationSteps.push(`Selected time: ${finalIqamaTime}`);
      break;
  }

  calculationSteps.push(`Final iqama time: ${finalIqamaTime}`);

  return {
    config,
    calculationSteps,
    isDST: isPrayerDST,
    isRamadan: isPrayerRamadan,
    usedRamadanRules,
    intervalDebug,
  };
}

/**
 * Format date info from DailyEntry
 */
function formatDateInfo(entry: DailyEntry): DateInfo {
  const date = createDateFromDMY(entry.date.gregorian.date);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  return {
    gregorian: `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    gregorianFormatted: `${dayName}, ${monthName} ${day}, ${year}`,
    hijri: `${entry.date.hijri.day} ${entry.date.hijri.month.en} ${entry.date.hijri.year}`,
  };
}

/**
 * Format prayers for a specific day
 */
function formatDayPrayers(
  entry: DailyEntry,
  masjid: MasjidConfig,
  includeRaw = false,
  monthEntries?: DailyEntry[],
  includeDebug = false
): PrayerData[] {
  const intervalEntries = monthEntries ? findIntervalEntriesForDay(entry, monthEntries) : [entry];

  return PRAYER_NAMES.map((prayer) => {
    const athanTime = entry.timings[prayer];
    const begins = formatTo12Hour(athanTime, createDateFromDMY(entry.date.gregorian.date));

    const config = masjid.iqamaRules[prayer];
    let iqama = begins; // Default to athan time
    let iqamaRaw: string | undefined;

    if (config) {
      if (monthEntries && config.defaultRules.type !== 'delay') {
        const accommodatingIqama = calculateAccommodatingIqama(intervalEntries, prayer, masjid);
        iqama = accommodatingIqama.formatted;
        iqamaRaw = accommodatingIqama.raw;
      } else {
        const iqamaTime = calculateIqamaTime(
          athanTime,
          config,
          entry.date.hijri,
          createDateFromDMY(entry.date.gregorian.date),
          masjid.timezone,
        );
        iqama = formatTo12Hour(iqamaTime, createDateFromDMY(entry.date.gregorian.date));
        iqamaRaw = iqamaTime;
      }
    }

    const result: PrayerData = {
      name: prayer,
      athan: begins,
      iqama,
    };

    if (includeRaw) {
      result.athanRaw = athanTime;
      result.iqamaRaw = iqamaRaw;
    }

    if (includeDebug && iqamaRaw) {
      result.debugInfo = buildPrayerDebugInfo(entry, prayer, intervalEntries, iqamaRaw, masjid);
    }

    return result;
  });
}

/**
 * Calculate accommodating iqama time for an interval
 * Returns both formatted and raw times
 */
function calculateAccommodatingIqama(
  entries: DailyEntry[],
  prayer: string,
  masjid: MasjidConfig,
): { formatted: string; raw: string } {
  const sortedEntries = sortDailyEntriesByGregorianDate(entries);
  if (sortedEntries.length === 0) {
    return {
      formatted: '',
      raw: '',
    };
  }

  const config = masjid.iqamaRules[prayer as keyof typeof masjid.iqamaRules];

  if (!config) {
    const athanTime = sortedEntries[0].timings[prayer];
    return {
      formatted: formatTo12Hour(athanTime, createDateFromDMY(sortedEntries[0].date.gregorian.date)),
      raw: athanTime,
    };
  }

  // For delay-based prayers, use the first day's calculation
  if (config.defaultRules.type === 'delay') {
    const firstEntry = sortedEntries[0];
    const iqamaTime = calculateIqamaTime(
      firstEntry.timings[prayer],
      config,
      firstEntry.date.hijri,
      createDateFromDMY(firstEntry.date.gregorian.date),
      masjid.timezone,
    );
    return {
      formatted: formatTo12Hour(iqamaTime, createDateFromDMY(firstEntry.date.gregorian.date)),
      raw: iqamaTime,
    };
  }

  // For interval/DST-based prayers, find the accommodating time
  const allIqamaTimes = sortedEntries.map((entry) => {
    return calculateIqamaTime(
      entry.timings[prayer],
      config,
      entry.date.hijri,
      createDateFromDMY(entry.date.gregorian.date),
      masjid.timezone,
    );
  });

  // Find the latest time
  const accommodatingIqama = allIqamaTimes.reduce((latest, current) => {
    return compareTime(current, latest) > 0 ? current : latest;
  });

  return {
    formatted: formatTo12Hour(accommodatingIqama, createDateFromDMY(sortedEntries[0].date.gregorian.date)),
    raw: accommodatingIqama,
  };
}

/**
 * Format prayers for an interval.
 * Optionally override the Athan source entry for day-level interval views,
 * while keeping the interval-wide accommodating iqama calculation.
 */
function formatIntervalPrayers(
  entries: DailyEntry[],
  masjid: MasjidConfig,
  includeRaw = false,
  athanSourceEntry?: DailyEntry
): PrayerData[] {
  if (entries.length === 0) return [];

  const sortedEntries = sortDailyEntriesByGregorianDate(entries);
  const firstEntry = sortedEntries[0];
  const athanEntry = athanSourceEntry || firstEntry;

  return PRAYER_NAMES.map((prayer) => {
    const athanTime = athanEntry.timings[prayer];
    const athanDate = createDateFromDMY(athanEntry.date.gregorian.date);
    const begins = formatTo12Hour(athanTime, athanDate);
    const config = masjid.iqamaRules[prayer];
    const activeRules = config
      ? (isRamadan(athanEntry.date.hijri) && config.ramadanRules
          ? config.ramadanRules
          : config.defaultRules)
      : null;
    const iqamaTimes = !config
      ? {
          formatted: begins,
          raw: athanTime,
        }
      : activeRules?.type === 'delay'
        ? (() => {
            const iqamaRaw = calculateIqamaTime(
              athanTime,
              config,
              athanEntry.date.hijri,
              athanDate,
              masjid.timezone,
            );
            return {
              formatted: formatTo12Hour(iqamaRaw, athanDate),
              raw: iqamaRaw,
            };
          })()
        : calculateAccommodatingIqama(sortedEntries, prayer, masjid);

    const result: PrayerData = {
      name: prayer,
      athan: begins,
      iqama: iqamaTimes.formatted,
    };

    if (includeRaw) {
      result.athanRaw = athanTime;
      result.iqamaRaw = iqamaTimes.raw;
    }

    return result;
  });
}

/**
 * Format interval label
 */
function formatIntervalLabel(start: string, end: string): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [startDay, startMonth] = start.split('-').map(Number);
  const [endDay, endMonth] = end.split('-').map(Number);

  if (startMonth === endMonth) {
    return `${MONTHS[startMonth - 1]} ${startDay}–${endDay}`;
  }
  return `${MONTHS[startMonth - 1]} ${startDay} – ${MONTHS[endMonth - 1]} ${endDay}`;
}

/**
 * Find Ramadan days in a year
 */
function findRamadanDays(yearData: ApiResponse): DailyEntry[] {
  const ramadanDays: DailyEntry[] = [];

  Object.values(yearData.data).forEach((monthEntries) => {
    monthEntries.forEach((entry) => {
      if (entry.date.hijri.month.number === 9) {
        ramadanDays.push(entry);
      }
    });
  });

  return sortDailyEntriesByGregorianDate(ramadanDays);
}

/**
 * Generate intervals for data that may span multiple Gregorian months
 * Groups by month first, then generates intervals per month
 * This handles cases like Ramadan which can span Feb-Mar
 */
function generateIntervalsForMultiMonthData(entries: DailyEntry[]): Array<{
  interval: string;
  entries: DailyEntry[];
}> {
  if (entries.length === 0) return [];

  const monthGroups = groupEntriesByGregorianMonth(entries);

  // Generate intervals for each month and combine
  const allIntervals: Array<{ interval: string; entries: DailyEntry[] }> = [];

  monthGroups.forEach((monthEntries) => {
    // Use generateIntervals which properly handles DST and creates correct intervals
    const sortedMonthEntries = sortDailyEntriesByGregorianDate(monthEntries);
    const intervals = generateIntervals(sortedMonthEntries);

    intervals.forEach((interval) => {
      const [start, end] = interval.range;
      const intervalEntries = sortedMonthEntries.filter((entry) => {
        const day = parseInt(entry.date.gregorian.date.split('-')[0]);
        return day >= start && day <= end;
      });

      if (intervalEntries.length > 0) {
        // Create proper interval label using the actual start/end dates
        const startDate = intervalEntries[0].date.gregorian.date;
        const endDate = intervalEntries[intervalEntries.length - 1].date.gregorian.date;

        const intervalLabel = formatIntervalLabel(startDate, endDate);

        allIntervals.push({
          interval: intervalLabel,
          entries: intervalEntries,
        });
      }
    });
  });

  return allIntervals;
}

/**
 * Fetch single day prayer times using the timingsByAddress endpoint
 */
async function getSingleDayPrayerTimes(date: AladhanDateString, masjid: MasjidConfig): Promise<DailyEntry | null> {
  try {
    const response = await fetch(
      `https://api.aladhan.com/v1/timingsByAddress/${date}?address=${encodeURIComponent(masjid.address)}&method=${masjid.calcMethodId}&shafaq=general`
    );

    if (!response.ok) {
      console.error(`Failed to fetch prayer times for ${date}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data && data.data) {
      // Clean up times by removing timezone suffixes
      Object.keys(data.data.timings).forEach((key) => {
        data.data.timings[key] = data.data.timings[key].replace(/\s*\([A-Z]{3}\)/, '');
      });
      return data.data;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching prayer times for ${date}:`, error);
    return null;
  }
}

export interface PrayerTimesPayload {
  status: number;
  body: unknown;
}

function ok(body: unknown): PrayerTimesPayload { return { status: 200, body }; }
function fail(body: unknown, status = 200): PrayerTimesPayload { return { status, body }; }

/**
 * Main handler logic. Called by the GET/POST route handlers and reused by the
 * PDF routes — no mock NextRequest, no self-HTTP.
 */
export async function getPrayerTimesResponse(
  params: PrayerTimesParams,
  masjid: MasjidConfig,
): Promise<PrayerTimesPayload> {
  try {
    const scope = params.scope;
    const date = params.date ?? null;
    const asOf = params.asOf ?? null;
    const month = params.month ?? null;
    const year = params.year || new Date().getFullYear().toString();
    const groupByInterval = !!params.groupByInterval;
    const includeRaw = !!params.includeRaw;
    const includeDebug = !!params.includeDebug;
    const source = aladhanSource(masjid);

    const baseResponse = {
      success: true,
      masjid: {
        name: masjid.name,
        address: masjid.address,
        timezone: masjid.timezone,
        calculationMethod: masjid.calcMethodLabel,
      },
      year,
      scope,
    };

    switch (scope) {
      case 'day': {
        if (includeDebug && !date && asOf) {
          const parsedAsOf = parseDebugAsOf(asOf);

          if (!parsedAsOf) {
            return fail({
              success: false,
              error: 'Invalid asOf. Use an ISO datetime with timezone offset, e.g. 2026-04-24T20:30:00-07:00',
            }, 400);
          }
        }

        const requestedAsOf = includeDebug ? asOf : null;
        const effectiveNow = includeDebug && !date && asOf
          ? parseDebugAsOf(asOf)!
          : new Date();
        const todayISO = date
          ? date
          : getISODateForTimeZone(effectiveNow, masjid.timezone);
        const targetDate = date
          ? createDateFromISO(date)
          : createDateFromISO(todayISO);
        const debugContext: DebugContext | undefined = includeDebug
          ? {
              requestedDate: date,
              requestedAsOf,
              effectiveNowUtc: effectiveNow.toISOString(),
              resolvedDate: todayISO,
              usedAsOfOverride: Boolean(!date && asOf),
            }
          : undefined;

        if (!groupByInterval) {
          // Fetch month data once and use it for both interval labels and accommodating iqama
          const todayStr = dateToAladhan(targetDate);

          // Get interval info for the target day and the first day of the next interval
          const targetMonth = targetDate.getMonth() + 1;
          const targetYear = targetDate.getFullYear();
          const monthStartDate = `01-${String(targetMonth).padStart(2, '0')}-${targetYear}`;
          const lastDay = new Date(targetYear, targetMonth, 0).getDate();
          const monthEndDate = `${String(lastDay).padStart(2, '0')}-${String(targetMonth).padStart(2, '0')}-${targetYear}`;

          const monthData = await getPrayerTimesAPI(monthStartDate, monthEndDate, source);
          if (!monthData?.data) {
            return ok({
              success: false,
              error: 'Failed to fetch prayer times',
            });
          }

          const todayEntry = monthData.data.find((entry) => entry.date.gregorian.date === todayStr)
            || await getSingleDayPrayerTimes(todayStr, masjid);

          const ramadanTransitionDays = getRamadanTransitionDays(monthData.data);
          const todayIntervalDates = getActualIntervalDates(targetDate, undefined, ramadanTransitionDays);
          if (!todayIntervalDates.start || !todayIntervalDates.end) {
            return ok({
              success: false,
              error: 'Failed to determine interval dates',
            });
          }

          const todayInterval = formatIntervalLabel(todayIntervalDates.start, todayIntervalDates.end);
          const nextIntervalAnchor = createDateFromDMY(todayIntervalDates.end);
          nextIntervalAnchor.setDate(nextIntervalAnchor.getDate() + 1);

          const nextIntervalMonth = nextIntervalAnchor.getMonth() + 1;
          const nextIntervalYear = nextIntervalAnchor.getFullYear();

          let nextIntervalMonthEntries = monthData.data;
          let nextIntervalRamadanDays = ramadanTransitionDays;

          if (nextIntervalMonth !== targetMonth || nextIntervalYear !== targetYear) {
            const nextMonthStartDate = `01-${String(nextIntervalMonth).padStart(2, '0')}-${nextIntervalYear}`;
            const nextMonthLastDay = new Date(nextIntervalYear, nextIntervalMonth, 0).getDate();
            const nextMonthEndDate = `${String(nextMonthLastDay).padStart(2, '0')}-${String(nextIntervalMonth).padStart(2, '0')}-${nextIntervalYear}`;

            const nextMonthData = await getPrayerTimesAPI(nextMonthStartDate, nextMonthEndDate, source);
            if (!nextMonthData?.data) {
              return ok({
                success: false,
                error: 'Failed to fetch next month data',
              });
            }

            nextIntervalMonthEntries = nextMonthData.data;
            nextIntervalRamadanDays = getRamadanTransitionDays(nextMonthData.data);
          }

          const nextIntervalDates = getActualIntervalDates(
            nextIntervalAnchor,
            undefined,
            nextIntervalRamadanDays
          );

          if (!nextIntervalDates.start || !nextIntervalDates.end) {
            return ok({
              success: false,
              error: 'Failed to determine next interval dates',
            });
          }

          const nextInterval = formatIntervalLabel(nextIntervalDates.start, nextIntervalDates.end);
          const nextIntervalEntry = nextIntervalMonthEntries.find(
            (entry) => entry.date.gregorian.date === nextIntervalDates.start
          ) || await getSingleDayPrayerTimes(nextIntervalDates.start, masjid);

          if (!todayEntry || !nextIntervalEntry) {
            return ok({
              success: false,
              error: 'Failed to fetch prayer times',
            });
          }

          return ok({
            ...baseResponse,
            groupByInterval: false,
            data: {
              today: {
                interval: todayInterval,
                date: formatDateInfo(todayEntry),
                prayers: formatDayPrayers(todayEntry, masjid, includeRaw, monthData.data, includeDebug),
                meta: createDayMeta(todayEntry, masjid, debugContext),
              },
              tomorrow: {
                interval: nextInterval,
                date: formatDateInfo(nextIntervalEntry),
                prayers: formatDayPrayers(nextIntervalEntry, masjid, includeRaw, nextIntervalMonthEntries, includeDebug),
                meta: createDayMeta(nextIntervalEntry, masjid, debugContext),
              },
            },
          });
        } else {
          // For Ramadan-aware intervals, we need to fetch the full month to detect Ramadan transitions
          const targetMonth = targetDate.getMonth() + 1;
          const targetYear = targetDate.getFullYear();

          const monthStartDate = `01-${String(targetMonth).padStart(2, '0')}-${targetYear}`;
          const lastDay = new Date(targetYear, targetMonth, 0).getDate();
          const monthEndDate = `${String(lastDay).padStart(2, '0')}-${String(targetMonth).padStart(2, '0')}-${targetYear}`;

          // Fetch the full month to detect Ramadan transitions
          const monthData = await getPrayerTimesAPI(monthStartDate, monthEndDate, source);

          if (!monthData?.data) {
            return ok({
              success: false,
              error: 'Failed to fetch month data for Ramadan-aware intervals',
            });
          }

          // Get Ramadan transition days from the month
          const ramadanTransitionDays = getRamadanTransitionDays(monthData.data);

          // Now get intervals with Ramadan awareness
          const actualCurrentInterval = getActualIntervalDates(targetDate, undefined, ramadanTransitionDays);

          if (!actualCurrentInterval.start || !actualCurrentInterval.end) {
            return ok({
              success: false,
              error: 'Failed to determine interval dates',
            });
          }

          let currentIntervalEntries = filterEntriesByDateRange(
            monthData.data,
            actualCurrentInterval.start,
            actualCurrentInterval.end
          );

          if (currentIntervalEntries.length === 0 && actualCurrentInterval.start === actualCurrentInterval.end) {
            const singleDayEntry = await getSingleDayPrayerTimes(actualCurrentInterval.start, masjid);
            if (singleDayEntry) {
              currentIntervalEntries = [singleDayEntry];
            }
          }

          if (currentIntervalEntries.length === 0) {
            return ok({
              success: false,
              error: 'Failed to fetch current interval prayer times',
            });
          }

          // To find the next interval, we need to check if there's another interval in the current month
          // or if we need to move to the next month
          const [currentEndDay, currentEndMonth, currentEndYear] = actualCurrentInterval.end.split('-').map(Number);

          // Try to find next interval in the same month first
          const nextDayInMonth = currentEndDay + 1;
          const lastDayOfMonth = new Date(currentEndYear, currentEndMonth, 0).getDate();

          let actualNextInterval;

          if (nextDayInMonth <= lastDayOfMonth) {
            // Next interval is in the same month
            const nextDayDate = new Date(currentEndYear, currentEndMonth - 1, nextDayInMonth);
            actualNextInterval = getActualIntervalDates(nextDayDate, undefined, ramadanTransitionDays);
          } else {
            // Next interval is in the next month
            const nextMonth = currentEndMonth === 12 ? 1 : currentEndMonth + 1;
            const nextYear = currentEndMonth === 12 ? currentEndYear + 1 : currentEndYear;

            // Fetch next month's data for Ramadan awareness
            const nextMonthStartDate = `01-${String(nextMonth).padStart(2, '0')}-${nextYear}`;
            const nextMonthLastDay = new Date(nextYear, nextMonth, 0).getDate();
            const nextMonthEndDate = `${String(nextMonthLastDay).padStart(2, '0')}-${String(nextMonth).padStart(2, '0')}-${nextYear}`;

            const nextMonthData = await getPrayerTimesAPI(nextMonthStartDate, nextMonthEndDate, source);
            if (!nextMonthData?.data) {
              return ok({
                success: false,
                error: 'Failed to fetch next month data',
              });
            }

            const nextMonthRamadanDays = getRamadanTransitionDays(nextMonthData.data);
            const firstDayOfNextMonth = new Date(nextYear, nextMonth - 1, 1);
            actualNextInterval = getActualIntervalDates(firstDayOfNextMonth, undefined, nextMonthRamadanDays);
          }

          if (!actualNextInterval.start || !actualNextInterval.end) {
            return ok({
              success: false,
              error: 'Failed to determine next interval dates',
            });
          }

          let nextIntervalEntries: DailyEntry[] = [];

          if (actualNextInterval.start && actualNextInterval.end) {
            const nextIntervalMonth = createDateFromDMY(actualNextInterval.start).getMonth();
            const currentIntervalMonth = targetDate.getMonth();

            if (nextIntervalMonth === currentIntervalMonth) {
              nextIntervalEntries = filterEntriesByDateRange(
                monthData.data,
                actualNextInterval.start,
                actualNextInterval.end
              );
            } else {
              const nextMonth = createDateFromDMY(actualNextInterval.start).getMonth() + 1;
              const nextYear = createDateFromDMY(actualNextInterval.start).getFullYear();
              const nextMonthStartDate = `01-${String(nextMonth).padStart(2, '0')}-${nextYear}`;
              const nextMonthLastDay = new Date(nextYear, nextMonth, 0).getDate();
              const nextMonthEndDate = `${String(nextMonthLastDay).padStart(2, '0')}-${String(nextMonth).padStart(2, '0')}-${nextYear}`;

              const nextMonthData = await getPrayerTimesAPI(nextMonthStartDate, nextMonthEndDate, source);
              if (nextMonthData?.data) {
                nextIntervalEntries = filterEntriesByDateRange(
                  nextMonthData.data,
                  actualNextInterval.start,
                  actualNextInterval.end
                );
              }
            }
          }

          if (nextIntervalEntries.length === 0 && actualNextInterval.start === actualNextInterval.end) {
            const singleDayEntry = await getSingleDayPrayerTimes(actualNextInterval.start, masjid);
            if (singleDayEntry) {
              nextIntervalEntries = [singleDayEntry];
            }
          }

          if (nextIntervalEntries.length === 0) {
            return ok({
              success: false,
              error: 'Failed to fetch next interval prayer times',
            });
          }

          // Find today's entry in current interval
          const todayDateStr = dateToAladhan(targetDate);
          const todayEntry = currentIntervalEntries.find(
            (e) => e.date.gregorian.date === todayDateStr
          ) || currentIntervalEntries[0];

          return ok({
            ...baseResponse,
            groupByInterval: true,
            data: {
              currentInterval: {
                interval: formatIntervalLabel(
                  actualCurrentInterval.start!,
                  actualCurrentInterval.end!
                ),
                date: formatDateInfo(todayEntry),
                prayers: formatIntervalPrayers(currentIntervalEntries, masjid, includeRaw, todayEntry),
              },
              nextInterval: {
                interval: formatIntervalLabel(
                  actualNextInterval.start!,
                  actualNextInterval.end!
                ),
                startDate: formatDateInfo(nextIntervalEntries[0]),
                prayers: formatIntervalPrayers(nextIntervalEntries, masjid, includeRaw),
              },
            },
          });
        }
      }

      case 'month': {
        const pacificToday = createDateFromISO(getTodayISOInTimeZone(masjid.timezone));
        const targetMonth = month ? parseInt(month) : pacificToday.getMonth() + 1;
        const targetYear = parseInt(year);

        const startDate = `01-${String(targetMonth).padStart(2, '0')}-${targetYear}`;
        const lastDay = new Date(targetYear, targetMonth, 0).getDate();
        const endDate = `${String(lastDay).padStart(2, '0')}-${String(targetMonth).padStart(2, '0')}-${targetYear}`;

        const data = await getPrayerTimesAPI(startDate, endDate, source);

        if (!data?.data || data.data.length === 0) {
          return ok({
            success: false,
            error: 'Failed to fetch month prayer times',
          });
        }

        const monthEntries = sortDailyEntriesByGregorianDate(data.data);

        if (!groupByInterval) {
          // Return daily entries with interval info
          const ramadanTransitionDays = getRamadanTransitionDays(monthEntries);

          const days = monthEntries.map((entry) => {
            const entryDate = createDateFromDMY(entry.date.gregorian.date);
            const intervalDates = getActualIntervalDates(entryDate, undefined, ramadanTransitionDays);
            const interval = intervalDates.start && intervalDates.end
              ? formatIntervalLabel(intervalDates.start, intervalDates.end)
              : '';

            return {
              interval,
              date: formatDateInfo(entry),
              prayers: formatDayPrayers(entry, masjid, includeRaw, monthEntries),
            };
          });

          return ok({
            ...baseResponse,
            month: String(targetMonth).padStart(2, '0'),
            groupByInterval: false,
            data: days,
          });
        } else {
          // Group by intervals
          const intervals = generateIntervals(monthEntries);
          const groupedData = intervals.map((interval) => {
            const [start, end] = interval.range;
            const intervalEntries = monthEntries.filter((entry) => {
              const day = parseInt(entry.date.gregorian.date.split('-')[0]);
              return day >= start && day <= end;
            });

            // Use formatIntervalLabel for consistent formatting
            const startDate = intervalEntries[0].date.gregorian.date;
            const endDate = intervalEntries[intervalEntries.length - 1].date.gregorian.date;

            return {
              interval: formatIntervalLabel(startDate, endDate),
              startDate: formatDateInfo(intervalEntries[0]),
              endDate: formatDateInfo(intervalEntries[intervalEntries.length - 1]),
              prayers: formatIntervalPrayers(intervalEntries, masjid, includeRaw),
            };
          });

          return ok({
            ...baseResponse,
            month: String(targetMonth).padStart(2, '0'),
            groupByInterval: true,
            data: groupedData,
          });
        }
      }

      case 'ramadan': {
        const targetYear = parseInt(year);

        // Fetch full year to find Ramadan
        const yearData = await getPrayerTimesForYearAPI(targetYear, source);

        if (!yearData?.data) {
          return ok({
            success: false,
            error: 'Failed to fetch year data for Ramadan detection',
          });
        }

        const ramadanDays = findRamadanDays(yearData);

        if (ramadanDays.length === 0) {
          return ok({
            success: false,
            error: 'No Ramadan days found in this year',
          });
        }

        const ramadanInfo = {
          startDate: {
            gregorian: formatDateInfo(ramadanDays[0]).gregorian,
            hijri: formatDateInfo(ramadanDays[0]).hijri,
          },
          endDate: {
            gregorian: formatDateInfo(ramadanDays[ramadanDays.length - 1]).gregorian,
            hijri: formatDateInfo(ramadanDays[ramadanDays.length - 1]).hijri,
          },
        };

        if (!groupByInterval) {
          // Return daily entries for Ramadan with interval info
          const monthGroups = groupEntriesByGregorianMonth(ramadanDays);

          const days = ramadanDays.map((entry) => {
            const monthEntries = monthGroups.get(getGregorianMonthKey(entry)) || [entry];
            const monthRamadanTransitionDays = getRamadanTransitionDays(monthEntries);
            const entryDate = createDateFromDMY(entry.date.gregorian.date);
            const intervalDates = getActualIntervalDates(entryDate, undefined, monthRamadanTransitionDays);
            const interval = intervalDates.start && intervalDates.end
              ? formatIntervalLabel(intervalDates.start, intervalDates.end)
              : '';

            return {
              interval,
              date: formatDateInfo(entry),
              prayers: formatDayPrayers(entry, masjid, includeRaw, monthEntries),
            };
          });

          return ok({
            ...baseResponse,
            groupByInterval: false,
            ramadanInfo,
            data: days,
          });
        } else {
          // Group Ramadan by intervals (handles multi-month Ramadan)
          const intervals = generateIntervalsForMultiMonthData(ramadanDays);
          const groupedData = intervals.map(({ interval, entries }) => {
            return {
              interval: interval,
              startDate: formatDateInfo(entries[0]),
              endDate: formatDateInfo(entries[entries.length - 1]),
              prayers: formatIntervalPrayers(entries, masjid, includeRaw),
            };
          });

          return ok({
            ...baseResponse,
            groupByInterval: true,
            ramadanInfo,
            data: groupedData,
          });
        }
      }

      case 'year': {
        const targetYear = parseInt(year);

        const yearData = await getPrayerTimesForYearAPI(targetYear, source);

        if (!yearData?.data) {
          return ok({
            success: false,
            error: 'Failed to fetch year prayer times',
          });
        }

        const months = Object.entries(yearData.data).map(([monthNum, entries]) => {
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          const sortedEntries = sortDailyEntriesByGregorianDate(entries);

          if (!groupByInterval) {
            // Return daily entries with interval info
            const ramadanTransitionDays = getRamadanTransitionDays(sortedEntries);

            const days = sortedEntries.map((entry) => {
              const entryDate = createDateFromDMY(entry.date.gregorian.date);
              const intervalDates = getActualIntervalDates(entryDate, undefined, ramadanTransitionDays);
              const interval = intervalDates.start && intervalDates.end
                ? formatIntervalLabel(intervalDates.start, intervalDates.end)
                : '';

              return {
                interval,
                date: formatDateInfo(entry),
                prayers: formatDayPrayers(entry, masjid, includeRaw, sortedEntries),
              };
            });

            return {
              month: monthNum,
              monthName: monthNames[parseInt(monthNum) - 1],
              days,
            };
          } else {
            // Group by intervals
            const intervals = generateIntervals(sortedEntries);
            const groupedData = intervals.map((interval) => {
              const [start, end] = interval.range;
              const intervalEntries = sortedEntries.filter((entry) => {
                const day = parseInt(entry.date.gregorian.date.split('-')[0]);
                return day >= start && day <= end;
              });

              // Use formatIntervalLabel for consistent formatting
              const startDate = intervalEntries[0].date.gregorian.date;
              const endDate = intervalEntries[intervalEntries.length - 1].date.gregorian.date;

              return {
                interval: formatIntervalLabel(startDate, endDate),
                startDate: formatDateInfo(intervalEntries[0]),
                endDate: formatDateInfo(intervalEntries[intervalEntries.length - 1]),
                prayers: formatIntervalPrayers(intervalEntries, masjid, includeRaw),
              };
            });

            return {
              month: monthNum,
              monthName: monthNames[parseInt(monthNum) - 1],
              intervals: groupedData,
            };
          }
        });

        return ok({
          ...baseResponse,
          groupByInterval,
          data: months,
        });
      }

      default:
        return fail({
          success: false,
          error: 'Invalid scope. Use: day, month, ramadan, or year',
        }, 400);
    }
  } catch (error) {
    console.error('[prayer-times] handler error:', error);
    return fail({
      success: false,
      error: 'Internal server error',
    }, 500);
  }
}

