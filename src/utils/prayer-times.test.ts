import { describe, test, expect, jest } from '@jest/globals';
import {
  addMinutes,
  calculateIqamaTime,
  formatTo12Hour,
  compareTime,
  isRamadan,
  roundToNearestInterval,
  createDateFromDMY,
  DEFAULT_PRAYER_CONFIGS,
  getRamadanTransitionDays,
  generateIntervals,
  getActualIntervalDates,
  getIntervalDates,
  getPrayerTimesAPI,
  getPrayerTimesForYearAPI,
  type DailyEntry,
  type HijriDate
} from '@/utils/prayer-times';

function createApiEntry(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());

  return {
    timings: {
      Fajr: '05:00 (PDT)',
      Sunrise: '06:30 (PDT)',
      Dhuhr: '12:30 (PDT)',
      Asr: '15:30 (PDT)',
      Sunset: '18:00 (PDT)',
      Maghrib: '18:00 (PDT)',
      Isha: '19:30 (PDT)',
      Imsak: '04:50 (PDT)',
      Midnight: '00:00 (PDT)',
      Firstthird: '22:00 (PDT)',
      Lastthird: '02:00 (PDT)',
    },
    date: {
      gregorian: {
        date: `${day}-${month}-${year}`,
      },
      hijri: {
        day,
        month: {
          number: 8,
          en: "Sha'ban",
        },
        year: '1447',
      },
    },
    meta: {},
  };
}

function buildEntriesForRange(start: Date, end: Date) {
  const entries = [];
  const current = new Date(start);

  while (current <= end) {
    entries.push(createApiEntry(current));
    current.setDate(current.getDate() + 1);
  }

  return entries;
}

describe('Prayer Times Utilities', () => {
  describe('addMinutes', () => {
    test('should add minutes to time correctly', () => {
      expect(addMinutes('20:12', 10)).toBe('20:22');
      expect(addMinutes('23:50', 20)).toBe('00:10'); // Cross midnight
      expect(addMinutes('12:30', 45)).toBe('13:15');
    });

    test('should handle edge cases', () => {
      expect(addMinutes('00:00', 60)).toBe('01:00');
      expect(addMinutes('23:59', 1)).toBe('00:00');
    });
  });

  describe('compareTime', () => {
    test('should compare times correctly', () => {
      expect(compareTime('12:30', '12:45')).toBeLessThan(0);
      expect(compareTime('15:20', '15:20')).toBe(0);
      expect(compareTime('18:00', '17:30')).toBeGreaterThan(0);
    });
  });

  describe('formatTo12Hour', () => {
    test('should format 24-hour time to 12-hour format', () => {
      const testDate = new Date('2025-05-31');
      
      expect(formatTo12Hour('04:14', testDate)).toBe('4:14 AM');
      expect(formatTo12Hour('12:57', testDate)).toBe('12:57 PM');
      expect(formatTo12Hour('20:12', testDate)).toBe('8:12 PM');
      expect(formatTo12Hour('00:57', testDate)).toBe('12:57 AM');
    });
  });

  describe('roundToNearestInterval', () => {
    test('should round time to nearest interval', () => {
      expect(roundToNearestInterval('04:07', 15)).toBe('04:15');
      expect(roundToNearestInterval('04:23', 15)).toBe('04:30');
      expect(roundToNearestInterval('04:30', 15)).toBe('04:30');
      expect(roundToNearestInterval('04:38', 15)).toBe('04:45');
    });
  });

  describe('isRamadan', () => {
    test('should correctly identify Ramadan month', () => {
      const ramadanDate = { month: { number: 9 } };
      const nonRamadanDate = { month: { number: 5 } };
      
      expect(isRamadan(ramadanDate as any)).toBe(true);
      expect(isRamadan(nonRamadanDate as any)).toBe(false);
    });
  });

  describe('createDateFromDMY', () => {
    test('should create date from DD-MM-YYYY format', () => {
      const date = createDateFromDMY('31-05-2025');
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(4); // May is month 4 (0-indexed)
      expect(date.getDate()).toBe(31);
    });
  });

  describe('getPrayerTimesForYearAPI', () => {
    test('should build yearly data from monthly range requests', async () => {
      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockReset();
      fetchMock.mockImplementation(async (url: string) => {
        const match = url.match(/from\/(\d{2}-\d{2}-\d{4})\/to\/(\d{2}-\d{2}-\d{4})/);

        if (!match) {
          throw new Error(`Unexpected URL: ${url}`);
        }

        const [, start, end] = match;
        const [startDay, startMonth, startYear] = start.split('-').map(Number);
        const [endDay, endMonth, endYear] = end.split('-').map(Number);

        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            code: 200,
            status: 'OK',
            data: buildEntriesForRange(
              new Date(startYear, startMonth - 1, startDay),
              new Date(endYear, endMonth - 1, endDay)
            ),
          }),
        };
      });

      const result = await getPrayerTimesForYearAPI(2026, {
        address: '2111 E Nees Ave, Fresno, CA 93720',
        methodId: 2,
      });

      expect(fetchMock).toHaveBeenCalledTimes(12);
      expect(result?.status).toBe('OK');
      expect(Object.keys(result?.data || {})).toEqual([
        '1', '2', '3', '4', '5', '6',
        '7', '8', '9', '10', '11', '12',
      ]);
      expect(result?.data['4'][0].date.gregorian.date).toBe('01-04-2026');
      expect(result?.data['4'][0].timings.Isha).toBe('19:30');
    });

    test('should clamp shifted upstream dates back to the requested Gregorian range', async () => {
      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockReset();
      fetchMock.mockImplementation(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          code: 200,
          status: 'OK',
          data: buildEntriesForRange(
            new Date(2026, 2, 30),
            new Date(2026, 3, 30)
          ),
        }),
      }));

      const result = await getPrayerTimesAPI('01-04-2026', '30-04-2026', {
        address: '2111 E Nees Ave, Fresno, CA 93720',
        methodId: 2,
      });

      expect(result?.data).toHaveLength(30);
      expect(result?.data[0].date.gregorian.date).toBe('01-04-2026');
      expect(result?.data[result.data.length - 1].date.gregorian.date).toBe('30-04-2026');
      expect(result?.data.some((entry) => entry.date.gregorian.date === '31-03-2026')).toBe(false);
    });
  });

  describe('calculateIqamaTime', () => {
    const mockHijriDate = {
      month: { number: 5 }, // Non-Ramadan month
      day: '31',
      year: '1446'
    };
    const testDate = new Date('2025-05-31');

    test('should calculate delay-based Iqama (Maghrib)', () => {
      const config = DEFAULT_PRAYER_CONFIGS.Maghrib;
      const result = calculateIqamaTime('20:12', config, mockHijriDate as any, testDate);
      expect(result).toBe('20:22'); // 20:12 + 10 minutes
    });

    test('should calculate interval-based Iqama (Fajr) with 4:45 AM floor', () => {
      const config = DEFAULT_PRAYER_CONFIGS.Fajr;
      const result = calculateIqamaTime('04:14', config, mockHijriDate as any, testDate);
      // 04:14 + 10 min gap = 04:24, rounded to 04:30; floored at 04:45
      expect(result).toBe('04:45');
    });

    test('should floor early Fajr Iqama at 4:45 AM', () => {
      const config = DEFAULT_PRAYER_CONFIGS.Fajr;
      // Very early athan: 04:00 + 10 = 04:10, rounded to 04:15, would be below floor
      const result = calculateIqamaTime('04:00', config, mockHijriDate as any, testDate);
      expect(result).toBe('04:45');
    });

    test('should not affect later Fajr Iqama times above 4:45 AM', () => {
      const config = DEFAULT_PRAYER_CONFIGS.Fajr;
      // 04:40 + 10 = 04:50, rounded to 05:00 — above floor, unchanged
      const result = calculateIqamaTime('04:40', config, mockHijriDate as any, testDate);
      expect(result).toBe('05:00');
    });

    test('should calculate DST-based Iqama (Dhuhr)', () => {
      const config = DEFAULT_PRAYER_CONFIGS.Dhuhr;
      const result = calculateIqamaTime('12:57', config, mockHijriDate as any, testDate);
      // Should use DST time (afterDST: "13:30")
      expect(result).toBe('13:30');
    });

    test('should use correct DST status on DST transition day', () => {
      // November 2, 2025 - DST ends at 2:00 AM
      const nov2Date = new Date(2025, 10, 2); // Month 10 = November (0-indexed)
      const config = DEFAULT_PRAYER_CONFIGS.Dhuhr;

      // Dhuhr at 11:43 AM happens AFTER DST ended at 2:00 AM
      // Should use standard time (beforeDST: "12:30")
      const result = calculateIqamaTime('11:43', config, mockHijriDate as any, nov2Date);
      expect(result).toBe('12:30');
    });

    test('should use default rules for Fajr during Ramadan', () => {
      const ramadanHijriDate = {
        month: { number: 9 }, // Ramadan
        day: '15',
        year: '1446'
      };

      const config = DEFAULT_PRAYER_CONFIGS.Fajr;
      const result = calculateIqamaTime('04:14', config, ramadanHijriDate as any, testDate);
      // Fajr no longer has Ramadan-specific rules, uses default interval rules; floored at 04:45
      expect(result).toBe('04:45');
    });

    test('should use fixed 8:00 PM Isha in Ramadan before DST', () => {
      const ramadanHijriDate = {
        month: { number: 9 }, // Ramadan
        day: '1',
        year: '1446'
      };

      const preDstDate = new Date(2025, 2, 1); // March 1, 2025 (before DST starts)
      const config = DEFAULT_PRAYER_CONFIGS.Isha;
      const result = calculateIqamaTime('19:20', config, ramadanHijriDate as any, preDstDate);

      expect(result).toBe('20:00');
    });

    test('should use fixed 8:30 PM Isha in Ramadan after DST', () => {
      const ramadanHijriDate = {
        month: { number: 9 }, // Ramadan
        day: '10',
        year: '1446'
      };

      const postDstDate = new Date(2025, 2, 15); // March 15, 2025 (after DST starts)
      const config = DEFAULT_PRAYER_CONFIGS.Isha;
      const result = calculateIqamaTime('19:40', config, ramadanHijriDate as any, postDstDate);

      expect(result).toBe('20:30');
    });

    test('should respect upper and lower limits', () => {
      const config = DEFAULT_PRAYER_CONFIGS.Isha;
      
      // Test with very early Isha time (should hit lower limit)
      const earlyResult = calculateIqamaTime('19:30', config, mockHijriDate as any, testDate);
      expect(earlyResult).toBe('20:00'); // Should use lower limit
      
      // Test with very late Isha time (should hit upper limit if before it)
      const lateResult = calculateIqamaTime('21:50', config, mockHijriDate as any, testDate);
      expect(lateResult).toBe('22:00'); // Should use upper limit
    });
  });

  describe('DEFAULT_PRAYER_CONFIGS', () => {
    test('should have configurations for all prayers', () => {
      const requiredPrayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
      
      requiredPrayers.forEach(prayer => {
        expect(DEFAULT_PRAYER_CONFIGS[prayer]).toBeDefined();
        expect(DEFAULT_PRAYER_CONFIGS[prayer].defaultRules).toBeDefined();
      });
    });

    test('should have correct Maghrib delay configuration', () => {
      const maghribConfig = DEFAULT_PRAYER_CONFIGS.Maghrib;
      expect(maghribConfig.defaultRules.type).toBe('delay');
      if (maghribConfig.defaultRules.type === 'delay') {
        expect(maghribConfig.defaultRules.delay).toBe(10);
      }
    });

    test('should have correct Fajr interval configuration', () => {
      const fajrConfig = DEFAULT_PRAYER_CONFIGS.Fajr;
      expect(fajrConfig.defaultRules.type).toBe('interval');
      if (fajrConfig.defaultRules.type === 'interval') {
        expect(fajrConfig.defaultRules.interval).toBe(15);
        expect(fajrConfig.defaultRules.gapTime).toBe(10);
        expect(fajrConfig.defaultRules.lowerLimit).toBe('04:45');
      }
    });

    test('should have correct Dhuhr DST configuration', () => {
      const dhuhrConfig = DEFAULT_PRAYER_CONFIGS.Dhuhr;
      expect(dhuhrConfig.defaultRules.type).toBe('dst');
      if (dhuhrConfig.defaultRules.type === 'dst') {
        expect(dhuhrConfig.defaultRules.afterDST).toBe('13:30');
        expect(dhuhrConfig.defaultRules.beforeDST).toBe('12:30');
      }
    });

    test('should not have Ramadan rules for Fajr', () => {
      const fajrConfig = DEFAULT_PRAYER_CONFIGS.Fajr;
      // Fajr no longer has special Ramadan rules - uses default interval rules year-round
      expect(fajrConfig.ramadanRules).toBeUndefined();
    });

    test('should have Ramadan DST rules for Isha', () => {
      const ishaConfig = DEFAULT_PRAYER_CONFIGS.Isha;
      expect(ishaConfig.ramadanRules).toBeDefined();
      expect(ishaConfig.ramadanRules!.type).toBe('dst');
      if (ishaConfig.ramadanRules!.type === 'dst') {
        expect(ishaConfig.ramadanRules!.beforeDST).toBe('20:00');
        expect(ishaConfig.ramadanRules!.afterDST).toBe('20:30');
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle midnight crossover in addMinutes', () => {
      expect(addMinutes('23:45', 30)).toBe('00:15');
      expect(addMinutes('23:30', 90)).toBe('01:00');
    });

    test('should handle invalid time formats gracefully', () => {
      // These should not throw errors
      expect(() => addMinutes('25:00', 10)).not.toThrow();
      expect(() => formatTo12Hour('25:00', new Date())).not.toThrow();
    });

    test('should handle boundary conditions in rounding', () => {
      expect(roundToNearestInterval('04:00', 15)).toBe('04:00');
      expect(roundToNearestInterval('04:14', 15)).toBe('04:15');
      expect(roundToNearestInterval('04:15', 15)).toBe('04:15');
      expect(roundToNearestInterval('04:16', 15)).toBe('04:30');
    });
  });

  describe('Ramadan Interval Splitting', () => {
    // Helper function to create mock DailyEntry
    function createMockEntry(
      day: number,
      month: number,
      year: number,
      hijriMonth: number,
      hijriDay: number = day
    ): DailyEntry {
      const hijriMonthNames: Record<number, { en: string; ar: string }> = {
        8: { en: "Sha'ban", ar: 'شعبان' },
        9: { en: 'Ramadan', ar: 'رمضان' },
        10: { en: 'Shawwal', ar: 'شوال' }
      };

      const monthName = hijriMonthNames[hijriMonth] || { en: 'Unknown', ar: 'Unknown' };

      return {
        timings: {
          Fajr: '05:00',
          Sunrise: '06:30',
          Dhuhr: '12:30',
          Asr: '15:30',
          Sunset: '18:00',
          Maghrib: '18:00',
          Isha: '19:30',
          Imsak: '04:50',
          Midnight: '00:00',
          Firstthird: '22:00',
          Lastthird: '02:00'
        },
        date: {
          readable: `${day}-${month}-${year}`,
          timestamp: '0',
          gregorian: {
            date: `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`,
            format: 'DD-MM-YYYY',
            day: String(day),
            weekday: { en: 'Monday' },
            month: { number: month, en: 'March' },
            year: String(year),
            designation: { abbreviated: 'AD', expanded: 'Anno Domini' },
            lunarSighting: false
          },
          hijri: {
            date: `${hijriDay}`,
            format: 'DD-MM-YYYY',
            day: String(hijriDay),
            weekday: { en: 'Monday', ar: 'الإثنين' },
            month: {
              number: hijriMonth,
              en: monthName.en,
              ar: monthName.ar,
              days: 30
            },
            year: '1446',
            designation: { abbreviated: 'AH', expanded: 'Anno Hegirae' },
            holidays: [],
            adjustedHolidays: [],
            method: 'ISNA'
          } as HijriDate
        },
        meta: {
          latitude: 36.8,
          longitude: -119.8,
          timezone: 'America/Los_Angeles',
          method: {
            id: 2,
            name: 'ISNA',
            params: { Fajr: 15, Isha: 15 },
            location: { latitude: 36.8, longitude: -119.8 }
          },
          latitudeAdjustmentMethod: 'ANGLE_BASED',
          midnightMode: 'STANDARD',
          school: 'STANDARD',
          offset: {}
        }
      };
    }

    describe('getRamadanTransitionDays', () => {
      test('should detect when Ramadan starts mid-month', () => {
        // Create a month where Ramadan starts on day 15
        const entries: DailyEntry[] = [];
        for (let day = 1; day <= 31; day++) {
          const hijriMonth = day >= 15 ? 9 : 8; // Ramadan starts on 15th
          entries.push(createMockEntry(day, 3, 2025, hijriMonth));
        }

        const ramadanDays = getRamadanTransitionDays(entries);
        expect(ramadanDays).toContain(15); // Ramadan starts on 15th
        expect(ramadanDays.length).toBe(1); // Only one transition
      });

      test('should detect when Ramadan ends mid-month', () => {
        // Create a month where Ramadan ends on day 12 (Gregorian day 12 = Shawwal starts)
        const entries: DailyEntry[] = [];
        for (let day = 1; day <= 30; day++) {
          const hijriMonth = day < 12 ? 9 : 10; // Ramadan ends on 12th (Shawwal starts)
          const hijriDay = day < 12 ? (20 + day) : (day - 11); // Ramadan 21-30, then Shawwal 1+
          entries.push(createMockEntry(day, 4, 2025, hijriMonth, hijriDay));
        }

        const ramadanDays = getRamadanTransitionDays(entries);
        expect(ramadanDays).toContain(12); // Shawwal starts (Ramadan ends)
        expect(ramadanDays.length).toBe(1);
      });

      test('should detect both Ramadan start and end in same month', () => {
        // Rare case: Ramadan starts and ends in the same Gregorian month
        const entries: DailyEntry[] = [];
        for (let day = 1; day <= 31; day++) {
          let hijriMonth = 8; // Shaban
          if (day >= 15 && day < 25) {
            hijriMonth = 9; // Ramadan from 15th to 24th
          } else if (day >= 25) {
            hijriMonth = 10; // Shawwal starts on 25th
          }
          entries.push(createMockEntry(day, 3, 2025, hijriMonth));
        }

        const ramadanDays = getRamadanTransitionDays(entries);
        expect(ramadanDays).toContain(15); // Ramadan starts
        expect(ramadanDays).toContain(25); // Ramadan ends
        expect(ramadanDays.length).toBe(2);
      });

      test('should handle month fully in Ramadan', () => {
        const entries: DailyEntry[] = [];
        for (let day = 1; day <= 30; day++) {
          // Month fully in Ramadan, starting with 1st of Ramadan on Gregorian day 1
          entries.push(createMockEntry(day, 3, 2025, 9, day)); // All Ramadan, day 1 = 1st Ramadan
        }

        const ramadanDays = getRamadanTransitionDays(entries);
        expect(ramadanDays).toContain(1); // Starts on day 1 (1st of Ramadan)
        expect(ramadanDays.length).toBe(1);
      });

      test('should handle month with no Ramadan', () => {
        const entries: DailyEntry[] = [];
        for (let day = 1; day <= 30; day++) {
          entries.push(createMockEntry(day, 1, 2025, 5)); // No Ramadan
        }

        const ramadanDays = getRamadanTransitionDays(entries);
        expect(ramadanDays.length).toBe(0);
      });

      test('should handle empty entries', () => {
        const ramadanDays = getRamadanTransitionDays([]);
        expect(ramadanDays).toEqual([]);
      });
    });

    describe('generateIntervals with Ramadan', () => {
      test('should split interval when Ramadan starts mid-interval', () => {
        // Create March with Ramadan starting on 15th
        // Note: March 2025 has DST on 9th, so intervals will be: 1-8 (DST), 9-14, 15-20 (Ramadan), 21-31
        const entries: DailyEntry[] = [];
        for (let day = 1; day <= 31; day++) {
          const hijriMonth = day >= 15 ? 9 : 8;
          const hijriDay = day >= 15 ? (day - 14) : (16 + day); // Sha'ban 17-30, then Ramadan 1+
          entries.push(createMockEntry(day, 3, 2025, hijriMonth, hijriDay));
        }

        const intervals = generateIntervals(entries);

        // The key test: verify that day 15 (Ramadan start) creates a breakpoint
        // We should have separate intervals before and after day 15
        const beforeRamadan = intervals.find(i => i.range[0] <= 14 && i.range[1] === 14);
        const duringRamadan = intervals.find(i => i.range[0] === 15);

        expect(beforeRamadan).toBeDefined();
        expect(duringRamadan).toBeDefined();

        // Verify the split happens at day 15
        expect(beforeRamadan!.range[1]).toBe(14);
        expect(duringRamadan!.range[0]).toBe(15);
      });

      test('should split interval when Ramadan ends mid-interval', () => {
        // Create April with Ramadan ending on 12th (Shawwal starts)
        const entries: DailyEntry[] = [];
        for (let day = 1; day <= 30; day++) {
          const hijriMonth = day < 12 ? 9 : 10;
          entries.push(createMockEntry(day, 4, 2025, hijriMonth));
        }

        const intervals = generateIntervals(entries);

        // Find intervals around day 12
        const interval1_10 = intervals.find(i => i.range[0] === 1 && i.range[1] <= 11);
        const interval12_20 = intervals.find(i => i.range[0] >= 12 && i.range[1] <= 20);

        expect(interval1_10).toBeDefined();
        expect(interval12_20).toBeDefined();
      });

      test('should handle multiple transitions in one month', () => {
        // Month with Ramadan starting on 15th and ending on 25th
        const entries: DailyEntry[] = [];
        for (let day = 1; day <= 31; day++) {
          let hijriMonth = 8;
          let hijriDay = day;
          if (day >= 15 && day < 25) {
            hijriMonth = 9;
            hijriDay = day - 14; // Ramadan 1-10
          } else if (day >= 25) {
            hijriMonth = 10;
            hijriDay = day - 24; // Shawwal 1+
          }
          entries.push(createMockEntry(day, 3, 2025, hijriMonth, hijriDay));
        }

        const intervals = generateIntervals(entries);

        // Key tests: verify breaks at both Ramadan start (15) and end (25)
        // Note: Ramadan period (15-24) will be split by base interval 21
        // So we get: [15-20] and [21-24] - both during Ramadan
        const beforeRamadan = intervals.find(i => i.range[1] === 14);
        const ramadanInterval1 = intervals.find(i => i.range[0] === 15 && i.range[1] === 20);
        const ramadanInterval2 = intervals.find(i => i.range[0] === 21 && i.range[1] === 24);
        const afterRamadan = intervals.find(i => i.range[0] === 25);

        // Verify breakpoints exist at Ramadan start and end
        expect(beforeRamadan).toBeDefined();
        expect(ramadanInterval1).toBeDefined(); // First part of Ramadan
        expect(ramadanInterval2).toBeDefined(); // Second part of Ramadan
        expect(afterRamadan).toBeDefined();
      });

      test('should preserve separate DST and Ramadan intervals for March 2026 rules', () => {
        const entries: DailyEntry[] = [];
        for (let day = 1; day <= 31; day++) {
          let hijriMonth = 8;
          let hijriDay = day;

          if (day >= 11 && day <= 19) {
            hijriMonth = 9;
            hijriDay = day - 10;
          } else if (day >= 20) {
            hijriMonth = 10;
            hijriDay = day - 19;
          }

          entries.push(createMockEntry(day, 3, 2026, hijriMonth, hijriDay));
        }

        const ramadanDays = getRamadanTransitionDays(entries);
        const intervals = generateIntervals(entries);

        expect(ramadanDays).toEqual([11, 20]);
        expect(intervals.map((interval) => interval.range)).toEqual([
          [1, 7],
          [8, 10],
          [11, 19],
          [20, 20],
          [21, 31],
        ]);

        expect(
          getActualIntervalDates(new Date(2026, 2, 11), undefined, ramadanDays)
        ).toEqual({
          start: '11-03-2026',
          end: '19-03-2026',
        });

        expect(
          getIntervalDates(new Date(2026, 2, 11), undefined, ramadanDays)
        ).toEqual({
          start: '11-03-2026',
          end: '19-03-2026',
        });
      });

      test('should generate the same intervals for unsorted month data', () => {
        const entries: DailyEntry[] = [];
        for (let day = 1; day <= 30; day++) {
          entries.push(createMockEntry(day, 4, 2026, 10, day));
        }

        const unsortedEntries = [
          ...entries.slice(0, 28),
          entries[29],
          entries[28],
        ];

        expect(generateIntervals(unsortedEntries).map((interval) => interval.range)).toEqual([
          [1, 10],
          [11, 20],
          [21, 30],
        ]);
      });

      test('should detect Ramadan transitions even when entries are unsorted', () => {
        const entries: DailyEntry[] = [];
        for (let day = 1; day <= 30; day++) {
          const hijriMonth = day < 12 ? 9 : 10;
          const hijriDay = day < 12 ? day + 10 : day - 11;
          entries.push(createMockEntry(day, 4, 2026, hijriMonth, hijriDay));
        }

        const unsortedEntries = [
          ...entries.slice(0, 10),
          entries[12],
          entries[11],
          ...entries.slice(13),
          entries[10],
        ];

        expect(getRamadanTransitionDays(unsortedEntries)).toEqual([12]);
      });
    });
  });
});
