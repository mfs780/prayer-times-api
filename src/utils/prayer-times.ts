import { 
  createDateFromAladhan, 
  formatTime12Hour, 
  type AladhanDateString,
  type ISODateString,
  isoToAladhan,
  aladhanToISO,
  dateToAladhan,
} from './date-formats';

export type DailyEntry = {
  timings: Timings;
  date: DateInfo;
  meta: Meta;
};

type Timings = {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Sunset: string;
  Maghrib: string;
  Isha: string;
  Imsak: string;
  Midnight: string;
  Firstthird: string;
  Lastthird: string;
};

type DateInfo = {
  readable: string;
  timestamp: string;
  gregorian: GregorianDate;
  hijri: HijriDate;
};

type GregorianDate = {
  date: string;
  format: string;
  day: string;
  weekday: {
    en: string;
  };
  month: {
    number: number;
    en: string;
  };
  year: string;
  designation: {
    abbreviated: string;
    expanded: string;
  };
  lunarSighting: boolean;
};

export type HijriDate = {
  date: string;
  format: string;
  day: string;
  weekday: {
    en: string;
    ar: string;
  };
  month: {
    number: number;
    en: string;
    ar: string;
    days: number;
  };
  year: string;
  designation: {
    abbreviated: string;
    expanded: string;
  };
  holidays: string[];
  adjustedHolidays: string[];
  method: string;
};

type Meta = {
  latitude: number;
  longitude: number;
  timezone: string;
  method: Method;
  latitudeAdjustmentMethod: string;
  midnightMode: string;
  school: string;
  offset: {
    [key: string]: string | number;
  };
};

type Method = {
  id: number;
  name: string;
  params: {
    Fajr: number;
    Isha: number;
  };
  location: {
    latitude: number;
    longitude: number;
  };
};


export type PrayerTimesResponse = {
  code: number;
  status: string;
  data: DailyEntry[];
};

export type ApiResponse = {
  code: number;
  status: string;
  data: {
    [month: string]: DailyEntry[];
  };
};

export function sortDailyEntriesByGregorianDate(entries: DailyEntry[]): DailyEntry[] {
  return [...entries].sort((left, right) => {
    const leftDate = createDateFromAladhan(left.date.gregorian.date).getTime();
    const rightDate = createDateFromAladhan(right.date.gregorian.date).getTime();
    return leftDate - rightDate;
  });
}

function shiftAladhanDate(date: AladhanDateString, offsetDays: number): AladhanDateString {
  const shiftedDate = createDateFromAladhan(date);
  shiftedDate.setDate(shiftedDate.getDate() + offsetDays);
  return dateToAladhan(shiftedDate);
}

function filterEntriesToRequestedRange(
  entries: DailyEntry[],
  start: AladhanDateString,
  end: AladhanDateString
): DailyEntry[] {
  const startDate = createDateFromAladhan(start).getTime();
  const endDate = createDateFromAladhan(end).getTime();

  return sortDailyEntriesByGregorianDate(entries).filter((entry) => {
    const entryDate = createDateFromAladhan(entry.date.gregorian.date).getTime();
    return entryDate >= startDate && entryDate <= endDate;
  });
}

export interface IqamaRule {
  start: string;
  end: string;
  times: {
    [key: string]: string;
  };
  maghribRule?: 'after';
  fajrRule?: 'after';
}

export interface IqamaRules {
  rules: IqamaRule[];
}

export interface DelayMethod {
  type: 'delay';
  delay: number; // minutes after athan
}

export interface CalculationMethod {
  type: 'interval';
  interval: number; // time interval
  gapTime: number; // minimum minutes between athan and iqama
  upperLimit?: string; // 24h format "HH:MM"
  lowerLimit?: string; // 24h format "HH:MM"
}

export interface DSTMethod {
  type: 'dst';
  gapTime: number; // minimum minutes between athan and iqama
  afterDST: string; // time during DST in 24h format "HH:MM" (used during spring/summer)
  beforeDST: string; // time without DST in 24h format "HH:MM" (used during fall/winter)
}

export type IqamaCalculationMethod = DelayMethod | CalculationMethod | DSTMethod;

export interface PrayerTimeConfig {
  defaultRules: IqamaCalculationMethod;
  ramadanRules?: IqamaCalculationMethod;
}

export const DEFAULT_PRAYER_CONFIGS: Record<string, PrayerTimeConfig> = {
  Fajr: {
    defaultRules: { type: 'interval', interval: 15, gapTime: 10, lowerLimit: "04:45" },
  },
  Dhuhr: {
    defaultRules: {
      type: 'dst',
      gapTime: 15,
      afterDST: "13:30",
      beforeDST: "12:30"
    }
  },
  Asr: {
    defaultRules: { type: 'interval', interval: 15, gapTime: 10, upperLimit: "17:00" }
  },
  Maghrib: {
    defaultRules: { type: 'delay', delay: 10 }
  },
  Isha: {
    defaultRules: {
      type: 'interval', interval: 15, gapTime: 10,
      upperLimit: "22:00",
      lowerLimit: "20:00"
    },
    ramadanRules: {
      type: 'dst',
      gapTime: 10,
      afterDST: "20:30",
      beforeDST: "20:00"
    },
  }
};

export function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24; // Ensure 24-hour format
  const newMinutes = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
}

export function isRamadan(hijriData: HijriDate): boolean {
  return hijriData.month.number === 9; // Ramadan is the 9th month
}

export function splitTime(timeStr: string): { hours: number, minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

export function compareTime(time1: string, time2: string): number {
  const t1 = splitTime(time1);
  const t2 = splitTime(time2);

  const minutes1 = t1.hours * 60 + t1.minutes;
  const minutes2 = t2.hours * 60 + t2.minutes;

  return minutes1 - minutes2;
}

export function formatTo12Hour(time24: string, date?: Date): string {
  // Use the new standardized function
  return formatTime12Hour(time24, date);
}

export interface AladhanSource {
  address: string;
  methodId: number;
}

export function getPrayerTimesAPI(
  start: string,
  end: string,
  source: AladhanSource,
): Promise<PrayerTimesResponse | null> {
  const bufferedStart = shiftAladhanDate(start, -1);
  const bufferedEnd = shiftAladhanDate(end, 1);
  const url = `https://api.aladhan.com/v1/calendarByAddress/from/${bufferedStart}/to/${bufferedEnd}?address=${encodeURIComponent(source.address)}&method=${source.methodId}&shafaq=general`;
  console.log(`[getPrayerTimesAPI] Requesting buffered range ${bufferedStart} to ${bufferedEnd} for requested range ${start} to ${end}: ${url}`);

  return fetch(url, { cache: 'no-store' })
    .then((response) => {
      console.log(`[getPrayerTimesAPI] Response status: ${response.status}`);
      if (!response.ok) {
        console.error(`[getPrayerTimesAPI] HTTP error: ${response.status} ${response.statusText}`);
        return null;
      }
      return response.json();
    })
    .then((data: PrayerTimesResponse | null) => {
      if (!data) {
        console.error(`[getPrayerTimesAPI] No data returned from API`);
        return null;
      }

      console.log(`[getPrayerTimesAPI] Response code: ${data.code}, status: ${data.status}`);

      if (data && data.data) {
        // Clean up times by removing timezone suffixes like "(PDT)" or "(PST)"
        data.data.forEach((entry) => {
          Object.keys(entry.timings).forEach((key) => {
            entry.timings[key] = entry.timings[key].replace(/\s*\([A-Z]{3}\)/, '');
          });
        });

        data.data = filterEntriesToRequestedRange(data.data, start, end);
        console.log(`[getPrayerTimesAPI] Requested ${start} to ${end}, normalized to ${data.data.length} days: ${data.data[0]?.date.gregorian.date} to ${data.data[data.data.length - 1]?.date.gregorian.date}`);
      } else {
        console.error(`[getPrayerTimesAPI] Data object has no data array`);
      }
      return data;
    })
    .catch((error) => {
      console.error(`[getPrayerTimesAPI] Error:`, error);
      return null;
    });
}

export function getPrayerTimesForYearAPI(
  year: number | string = new Date().getFullYear(),
  source?: AladhanSource,
): Promise<ApiResponse | null> {
  const targetYear = typeof year === 'string' ? parseInt(year, 10) : year;

  if (Number.isNaN(targetYear)) {
    console.error(`[getPrayerTimesForYearAPI] Invalid year: ${year}`);
    return Promise.resolve(null);
  }
  if (!source) {
    console.error('[getPrayerTimesForYearAPI] Missing required `source` arg');
    return Promise.resolve(null);
  }

  const monthRequests = Array.from({ length: 12 }, async (_, index) => {
    const month = index + 1;
    const monthKey = String(month);
    const monthNumber = monthKey.padStart(2, '0');
    const lastDay = new Date(targetYear, month, 0).getDate();
    const startDate = `01-${monthNumber}-${targetYear}`;
    const endDate = `${String(lastDay).padStart(2, '0')}-${monthNumber}-${targetYear}`;
    const monthData = await getPrayerTimesAPI(startDate, endDate, source);

    if (!monthData?.data) {
      console.error(`[getPrayerTimesForYearAPI] Failed to fetch month ${monthNumber}-${targetYear}`);
      return null;
    }

    return {
      monthKey,
      entries: monthData.data,
    };
  });

  return Promise.all(monthRequests)
    .then((months) => {
      if (months.some((month) => month === null)) {
        return null;
      }

      const data: ApiResponse['data'] = {};

      months.forEach((month) => {
        if (!month) {
          return;
        }

        data[month.monthKey] = month.entries;
      });

      return {
        code: 200,
        status: 'OK',
        data,
      };
    })
    .catch((error) => {
      console.error(`[getPrayerTimesForYearAPI] Error:`, error);
      return null;
    });
}

/**
 * Rounds time to the nearest specified interval
 * e.g., for interval = 15, 12:07 becomes 12:15, 12:23 becomes 12:30
 */
export function roundToNearestInterval(time: string, interval: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;

  // Round to the next specified interval
  const roundedMinutes = Math.ceil(totalMinutes / interval) * interval;

  const newHours = Math.floor(roundedMinutes / 60) % 24;
  const newMinutes = roundedMinutes % 60;

  return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
}

export function calculateIqamaTime(
  athanTime: string,
  config: PrayerTimeConfig,
  hijriDate: HijriDate,
  date: Date,
  timezone?: string,
): string {
  if (!config) return athanTime;

  const isRamadanMonth = isRamadan(hijriDate);
  const { defaultRules, ramadanRules } = config;
  let calculatedIqama = athanTime;

  // Calculate iqama time based on the calculation method
  const configRules = isRamadanMonth && ramadanRules ? ramadanRules : defaultRules;
  switch (configRules.type) {
    case 'delay': {
      calculatedIqama = addMinutes(athanTime, configRules.delay);
      break;
    }

    case 'interval': {
      // First ensure minimum gap time is met
      const minIqamaTime = addMinutes(athanTime, configRules.gapTime);

      // Round to nearest minute interval
      calculatedIqama = roundToNearestInterval(minIqamaTime, configRules.interval);

      if (configRules.lowerLimit && compareTime(calculatedIqama, configRules.lowerLimit) < 0) {
        return configRules.lowerLimit;
      }

      if (configRules.upperLimit && compareTime(calculatedIqama, configRules.upperLimit) > 0 && athanTime < configRules.upperLimit) {
        return configRules.upperLimit;
      }
      break;
    }

    case 'dst': {
      // Use the athan time to determine DST status (not midnight)
      // This is important for DST transition days when athan happens after the transition
      const [athanHours, athanMinutes] = athanTime.split(':').map(Number);
      const dateAtAthanTime = new Date(date);
      dateAtAthanTime.setHours(athanHours, athanMinutes, 0, 0);

      const isCurrentlyDST = isDST(dateAtAthanTime, timezone);

      // Determine iqama time based on DST status
      calculatedIqama = isCurrentlyDST ? configRules.afterDST : configRules.beforeDST;
      break;
    }
  }

  return calculatedIqama;
}

/**
 * Configuration-driven interval generation system
 * Replaces complex conditional logic with clear, maintainable configuration
 */

interface IntervalConfig {
  baseIntervals: number[];
  dstHandling: {
    enabled: boolean;
    minDstIntervalDays: number;
    mergeWithNext: boolean;
  };
  monthEndHandling: 'auto' | 'fixed';
}

interface IntervalBreakpoint {
  day: number;
  type: 'base' | 'dst' | 'ramadan' | 'month-end';
  isDstTransition?: boolean;
  isRamadanTransition?: boolean;
}

interface Interval {
  label: string;
  range: [number, number];
  isDstInterval?: boolean;
}

/**
 * Default configuration for interval generation
 * Easily customizable without changing core logic
 */
const DEFAULT_INTERVAL_CONFIG: IntervalConfig = {
  baseIntervals: [1, 11, 21], // Standard 10-day intervals
  dstHandling: {
    enabled: true,
    minDstIntervalDays: 5, // Replaces magic number - minimum days for DST interval
    mergeWithNext: false, // DST transitions create their own interval boundary
  },
  monthEndHandling: 'auto', // Automatically handle month boundaries
};

/**
 * Create ordinal suffix for day numbers (1st, 2nd, 3rd, etc.)
 */
function createOrdinalSuffix(n: number): string {
  if (n >= 11 && n <= 13) return 'th';
  const last = n % 10;
  if (last === 1) return 'st';
  if (last === 2) return 'nd';
  if (last === 3) return 'rd';
  return 'th';
}

/**
 * Generate interval label with proper formatting
 */
function createIntervalLabel(start: number, end: number, isDstInterval: boolean = false): string {
  let label = '';
  
  if (start === end) {
    label = `${start}${createOrdinalSuffix(start)}`;
  } else {
    label = `${start}${createOrdinalSuffix(start)} to ${end}${createOrdinalSuffix(end)}`;
  }

  return isDstInterval ? `${label} DST` : label;
}

/**
 * Generate breakpoints for interval creation
 */
function generateBreakpoints(
  lastDay: number,
  dstTransitionDays: number[],
  ramadanTransitionDays: number[],
  config: IntervalConfig
): IntervalBreakpoint[] {
  const breakpoints: IntervalBreakpoint[] = [];

  // Add base interval breakpoints
  config.baseIntervals.forEach(day => {
    if (day <= lastDay) {
      breakpoints.push({ day, type: 'base' });
    }
  });

  // Add DST transition breakpoints if enabled
  if (config.dstHandling.enabled) {
    dstTransitionDays.forEach(day => {
      if (day >= 1 && day <= lastDay) {
        breakpoints.push({
          day,
          type: 'dst',
          isDstTransition: true
        });
      }
    });
  }

  // Add Ramadan transition breakpoints
  ramadanTransitionDays.forEach(day => {
    if (day >= 1 && day <= lastDay) {
      breakpoints.push({
        day,
        type: 'ramadan',
        isRamadanTransition: true
      });
    }
  });

  // Add month end breakpoint
  if (config.monthEndHandling === 'auto') {
    breakpoints.push({ day: lastDay + 1, type: 'month-end' });
  }

  // Sort and deduplicate breakpoints
  const uniqueBreakpoints = Array.from(
    new Map(breakpoints.map(bp => [bp.day, bp])).values()
  ).sort((a, b) => a.day - b.day);

  return uniqueBreakpoints;
}

/**
 * Create intervals from breakpoints using a single canonical boundary engine.
 * Breakpoints are authoritative and are never merged away.
 */
function createIntervalsFromBreakpoints(
  breakpoints: IntervalBreakpoint[],
  _config: IntervalConfig
): Interval[] {
  const intervals: Interval[] = [];

  for (let i = 0; i < breakpoints.length - 1; i++) {
    const start = breakpoints[i].day;
    const end = breakpoints[i + 1].day - 1;
    const isDstTransition = breakpoints[i].isDstTransition;
    intervals.push({
      label: createIntervalLabel(start, end, isDstTransition),
      range: [start, end],
      isDstInterval: isDstTransition,
    });
  }

  return intervals;
}

/**
 * Simplified interval generation using configuration-driven approach
 * Replaces the complex conditional logic with clear, maintainable code
 */
export function generateIntervals(
  days: DailyEntry[],
  config: IntervalConfig = DEFAULT_INTERVAL_CONFIG
): Interval[] {
  if (days.length === 0) return [];

  const sortedDays = sortDailyEntriesByGregorianDate(days);
  const lastDay = sortedDays.reduce((latestDay, entry) => {
    const entryDay = parseInt(entry.date.gregorian.date.split('-')[0], 10);
    return Math.max(latestDay, entryDay);
  }, 0);
  const firstDayDate = createDateFromAladhan(sortedDays[0].date.gregorian.date);

  // Get DST transition days using optimized detection
  const dstTransitionDays = getDSTTransitionDays(firstDayDate);

  // Get Ramadan transition days by checking Hijri dates
  const ramadanTransitionDays = getRamadanTransitionDays(sortedDays);

  // Generate breakpoints (now includes Ramadan transitions)
  const breakpoints = generateBreakpoints(lastDay, dstTransitionDays, ramadanTransitionDays, config);

  // Create intervals from breakpoints
  const intervals = createIntervalsFromBreakpoints(breakpoints, config);

  return intervals;
}

/**
 * Get the actual interval dates for display purposes.
 * This returns the true interval that a date belongs to.
 */
export function getActualIntervalDates(
  date = new Date(),
  config: IntervalConfig = DEFAULT_INTERVAL_CONFIG,
  ramadanTransitionDays: number[] = []
) {
  const today = date;
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = today.getDate();

  // Calculate month boundaries
  const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();

  // Get DST transition days
  const dstTransitionDays = getDSTTransitionDays(today);

  // Generate breakpoints using the same logic as generateIntervals
  const breakpoints = generateBreakpoints(lastDay, dstTransitionDays, ramadanTransitionDays, config);

  // Create intervals from the canonical breakpoint engine
  const intervals = createIntervalsFromBreakpoints(breakpoints, config);

  // Find which interval contains this day
  for (const interval of intervals) {
    const [start, end] = interval.range;
    if (day >= start && day <= end) {
      return {
        start: `${start.toString().padStart(2, '0')}-${month}-${year}`,
        end: `${end.toString().padStart(2, '0')}-${month}-${year}`,
      };
    }
  }

  // Fallback to month boundaries if no interval found
  return {
    start: `01-${month}-${year}`,
    end: `${lastDay.toString().padStart(2, '0')}-${month}-${year}`,
  };
}

/**
 * Returns the same canonical interval boundaries as getActualIntervalDates.
 * Kept for backwards compatibility with older callers.
 */
export function getIntervalDates(
  date = new Date(),
  config: IntervalConfig = DEFAULT_INTERVAL_CONFIG,
  ramadanTransitionDays: number[] = []
) {
  return getActualIntervalDates(date, config, ramadanTransitionDays);
}

/**
 * Efficient DST detection and utilities for Pacific timezone (Fresno, CA)
 * Replaces the inefficient loop-based detection with predefined DST transition dates
 */

/**
 * Get DST transition dates for a given year in Pacific timezone
 * Returns the exact dates when DST starts and ends
 */
export function getDSTTransitionDates(year: number): { start: Date; end: Date } {
  // DST in Pacific timezone: Second Sunday in March to First Sunday in November
  const dstStart = getNthSundayOfMonth(year, 2, 2); // Second Sunday in March
  const dstEnd = getNthSundayOfMonth(year, 10, 1);   // First Sunday in November
  
  // DST transitions happen at 2:00 AM
  dstStart.setHours(2, 0, 0, 0);
  dstEnd.setHours(2, 0, 0, 0);
  
  return { start: dstStart, end: dstEnd };
}

/**
 * Efficiently checks if a given date falls within DST period.
 * The DST transition table implements the US rule (2nd Sunday March -> 1st
 * Sunday November). For non-`America/*` timezones, returns `false`. Until the
 * helper is reworked to be timezone-aware, masjids outside the US should not
 * rely on `dst`-type iqama rules.
 */
export function isDST(date: Date = new Date(), timezone?: string): boolean {
  if (timezone && !timezone.startsWith('America/')) {
    return false;
  }
  const year = date.getFullYear();
  const { start, end } = getDSTTransitionDates(year);

  return date >= start && date < end;
}

/**
 * Get DST transition days for a specific month
 * Returns array of day numbers when DST transitions occur
 * Optimized replacement for the inefficient loop-based method
 */
function getDSTTransitionDays(date: Date): number[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const { start, end } = getDSTTransitionDates(year);
  
  const dstDays: number[] = [];
  
  // Check if DST start date falls in this month
  if (start.getFullYear() === year && start.getMonth() === month) {
    dstDays.push(start.getDate());
  }
  
  // Check if DST end date falls in this month
  if (end.getFullYear() === year && end.getMonth() === month) {
    dstDays.push(end.getDate());
  }
  
  return dstDays;
}

/**
 * Helper function to find the nth occurrence of a specific weekday in a month
 * Used for calculating DST transition dates
 */
function getNthSundayOfMonth(year: number, month: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstSunday = new Date(year, month, 1 + (7 - firstDay.getDay()) % 7);
  return new Date(year, month, firstSunday.getDate() + (n - 1) * 7);
}

/**
 * Get Ramadan transition days for a specific month
 * Returns array of day numbers when Ramadan starts or ends within the given month
 *
 * This function checks the Hijri calendar for the entire month to detect
 * when Ramadan (month 9) begins or ends.
 *
 * @param monthEntries - Array of daily entries for the month (with Hijri dates from API)
 * @returns Array of day numbers where Ramadan transitions occur
 */
export function getRamadanTransitionDays(monthEntries: DailyEntry[]): number[] {
  if (monthEntries.length === 0) return [];

  const sortedEntries = sortDailyEntriesByGregorianDate(monthEntries);
  const ramadanDays: number[] = [];

  for (let i = 0; i < sortedEntries.length; i++) {
    const currentEntry = sortedEntries[i];
    const isCurrentRamadan = isRamadan(currentEntry.date.hijri);

    if (i === 0) {
      // Only add day 1 if Ramadan STARTS on day 1 (not if we're in the middle of Ramadan)
      // We can't determine this without looking ahead, so we check if it's truly the start
      // by comparing the Hijri date - if it's 1st of Ramadan, it's a start
      if (isCurrentRamadan && currentEntry.date.hijri.day === '1') {
        const day = parseInt(currentEntry.date.gregorian.date.split('-')[0]);
        ramadanDays.push(day);
      }
      continue;
    }

    // Check for transitions by comparing with previous day
    const previousEntry = sortedEntries[i - 1];
    const wasPreviousRamadan = isRamadan(previousEntry.date.hijri);

    // Ramadan starts: previous day was not Ramadan, current day is Ramadan
    if (!wasPreviousRamadan && isCurrentRamadan) {
      const day = parseInt(currentEntry.date.gregorian.date.split('-')[0]);
      ramadanDays.push(day);
    }

    // Ramadan ends: previous day was Ramadan, current day is not Ramadan
    if (wasPreviousRamadan && !isCurrentRamadan) {
      const day = parseInt(currentEntry.date.gregorian.date.split('-')[0]);
      ramadanDays.push(day);
    }
  }

  return ramadanDays;
}

export function createDateFromDMY(dateStr: AladhanDateString): Date {
  // Use the new standardized function
  return createDateFromAladhan(dateStr);
}
