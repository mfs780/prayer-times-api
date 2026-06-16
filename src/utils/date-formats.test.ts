import { describe, test, expect } from '@jest/globals';
import {
  aladhanToISO,
  isoToAladhan,
  createDateFromAladhan,
  createDateFromISO,
  getTodayISO,
  getTodayAladhan,
  getTomorrowISO,
  dateToISO,
  dateToAladhan,
  formatDateForDisplay,
  formatDateForAPI,
  getHijriDateInEnglish,
  formatTime12Hour,
  isValidAladhanDate,
  isValidISODate,
  parseToISO,
  type ISODateString,
  type AladhanDateString
} from '@/utils/date-formats';

describe('Date Format Utilities', () => {
  describe('aladhanToISO', () => {
    test('should convert valid Aladhan date to ISO format', () => {
      expect(aladhanToISO('10-07-2025')).toBe('2025-07-10');
      expect(aladhanToISO('01-01-2025')).toBe('2025-01-01');
      expect(aladhanToISO('31-12-2024')).toBe('2024-12-31');
    });

    test('should throw error for invalid Aladhan date formats', () => {
      expect(() => aladhanToISO('2025-07-10')).toThrow('Invalid Aladhan date format');
      expect(() => aladhanToISO('10/07/2025')).toThrow('Invalid Aladhan date format');
      expect(() => aladhanToISO('10-7-2025')).toThrow('Invalid Aladhan date format');
      expect(() => aladhanToISO('invalid')).toThrow('Invalid Aladhan date format');
      expect(() => aladhanToISO('')).toThrow('Invalid Aladhan date format');
      expect(() => aladhanToISO(null as any)).toThrow('Invalid Aladhan date format');
    });
  });

  describe('isoToAladhan', () => {
    test('should convert valid ISO date to Aladhan format', () => {
      expect(isoToAladhan('2025-07-10')).toBe('10-07-2025');
      expect(isoToAladhan('2025-01-01')).toBe('01-01-2025');
      expect(isoToAladhan('2024-12-31')).toBe('31-12-2024');
    });

    test('should throw error for invalid ISO date formats', () => {
      expect(() => isoToAladhan('10-07-2025')).toThrow('Invalid ISO date format');
      expect(() => isoToAladhan('2025/07/10')).toThrow('Invalid ISO date format');
      expect(() => isoToAladhan('2025-7-10')).toThrow('Invalid ISO date format');
      expect(() => isoToAladhan('invalid')).toThrow('Invalid ISO date format');
      expect(() => isoToAladhan('')).toThrow('Invalid ISO date format');
      expect(() => isoToAladhan(null as any)).toThrow('Invalid ISO date format');
    });
  });

  describe('createDateFromAladhan', () => {
    test('should create Date object from Aladhan format', () => {
      const date = createDateFromAladhan('10-07-2025');
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(6); // July is month 6 (0-based)
      expect(date.getDate()).toBe(10);
    });
  });

  describe('createDateFromISO', () => {
    test('should create Date object from ISO format', () => {
      const date = createDateFromISO('2025-07-10');
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(6); // July is month 6 (0-based)
      expect(date.getDate()).toBe(10);
    });
  });

  describe('getTodayISO', () => {
    test('should return today\'s date in ISO format', () => {
      const today = getTodayISO();
      expect(isValidISODate(today)).toBe(true);
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getTodayAladhan', () => {
    test('should return today\'s date in Aladhan format', () => {
      const today = getTodayAladhan();
      expect(isValidAladhanDate(today)).toBe(true);
      expect(today).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    });
  });

  describe('getTomorrowISO', () => {
    test('should return tomorrow\'s date in ISO format', () => {
      const tomorrow = getTomorrowISO();
      expect(isValidISODate(tomorrow)).toBe(true);
      expect(tomorrow).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      // Verify it's actually tomorrow using local timezone (not UTC)
      const today = new Date();
      const tomorrowDate = new Date(today);
      tomorrowDate.setDate(today.getDate() + 1);
      const expectedTomorrow = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;
      expect(tomorrow).toBe(expectedTomorrow);
    });
  });

  describe('dateToISO', () => {
    test('should convert Date object to ISO format', () => {
      const date = new Date('2025-07-10');
      expect(dateToISO(date)).toBe('2025-07-10');
    });
  });

  describe('dateToAladhan', () => {
    test('should convert Date object to Aladhan format', () => {
      const date = new Date('2025-07-10');
      expect(dateToAladhan(date)).toBe('10-07-2025');
    });
  });

  describe('formatDateForDisplay', () => {
    test('should format Date object for display', () => {
      // Use explicit date construction to avoid timezone issues
      const date = new Date(2025, 6, 10); // July 10, 2025 (month is 0-based)
      const formatted = formatDateForDisplay(date);
      expect(formatted).toContain('July');
      expect(formatted).toContain('10');
      expect(formatted).toContain('2025');
    });

    test('should format ISO string for display', () => {
      const formatted = formatDateForDisplay('2025-07-10');
      expect(formatted).toContain('July');
      expect(formatted).toContain('10');
      expect(formatted).toContain('2025');
    });
  });

  describe('formatDateForAPI', () => {
    test('should format Date object for API', () => {
      const date = new Date('2025-07-10');
      expect(formatDateForAPI(date)).toBe('2025-07-10');
    });

    test('should format Aladhan string for API', () => {
      expect(formatDateForAPI('10-07-2025')).toBe('2025-07-10');
    });
  });

  describe('formatTime12Hour', () => {
    test('should format 24-hour time to 12-hour format', () => {
      expect(formatTime12Hour('13:30')).toBe('1:30 PM');
      expect(formatTime12Hour('01:15')).toBe('1:15 AM');
      expect(formatTime12Hour('12:00')).toBe('12:00 PM');
      expect(formatTime12Hour('00:00')).toBe('12:00 AM');
      expect(formatTime12Hour('23:59')).toBe('11:59 PM');
    });
  });

  describe('isValidAladhanDate', () => {
    test('should validate Aladhan date format', () => {
      expect(isValidAladhanDate('10-07-2025')).toBe(true);
      expect(isValidAladhanDate('01-01-2025')).toBe(true);
      expect(isValidAladhanDate('31-12-2024')).toBe(true);
      
      expect(isValidAladhanDate('2025-07-10')).toBe(false);
      expect(isValidAladhanDate('10/07/2025')).toBe(false);
      expect(isValidAladhanDate('10-7-2025')).toBe(false);
      expect(isValidAladhanDate('invalid')).toBe(false);
    });
  });

  describe('isValidISODate', () => {
    test('should validate ISO date format', () => {
      expect(isValidISODate('2025-07-10')).toBe(true);
      expect(isValidISODate('2025-01-01')).toBe(true);
      expect(isValidISODate('2024-12-31')).toBe(true);
      
      expect(isValidISODate('10-07-2025')).toBe(false);
      expect(isValidISODate('2025/07/10')).toBe(false);
      expect(isValidISODate('2025-7-10')).toBe(false);
      expect(isValidISODate('invalid')).toBe(false);
    });
  });

  describe('parseToISO', () => {
    test('should parse Date object to ISO', () => {
      const date = new Date('2025-07-10');
      expect(parseToISO(date)).toBe('2025-07-10');
    });

    test('should parse ISO string to ISO', () => {
      expect(parseToISO('2025-07-10')).toBe('2025-07-10');
    });

    test('should parse Aladhan string to ISO', () => {
      expect(parseToISO('10-07-2025')).toBe('2025-07-10');
    });

    test('should parse generic date string to ISO', () => {
      expect(parseToISO('July 10, 2025')).toBe('2025-07-10');
    });

    test('should throw error for unparseable input', () => {
      expect(() => parseToISO('invalid date')).toThrow('Unable to parse date');
    });
  });

  describe('Round-trip conversions', () => {
    test('should maintain consistency in round-trip conversions', () => {
      const aladhanDate = '10-07-2025';
      const isoDate = '2025-07-10';
      
      // Aladhan -> ISO -> Aladhan
      expect(isoToAladhan(aladhanToISO(aladhanDate))).toBe(aladhanDate);
      
      // ISO -> Aladhan -> ISO
      expect(aladhanToISO(isoToAladhan(isoDate))).toBe(isoDate);
    });
  });

  describe('Edge cases', () => {
    test('should handle leap year dates', () => {
      expect(aladhanToISO('29-02-2024')).toBe('2024-02-29'); // 2024 is a leap year
      expect(isoToAladhan('2024-02-29')).toBe('29-02-2024');
    });

    test('should handle end of year dates', () => {
      expect(aladhanToISO('31-12-2024')).toBe('2024-12-31');
      expect(isoToAladhan('2024-12-31')).toBe('31-12-2024');
    });

    test('should handle beginning of year dates', () => {
      expect(aladhanToISO('01-01-2025')).toBe('2025-01-01');
      expect(isoToAladhan('2025-01-01')).toBe('01-01-2025');
    });
  });
});