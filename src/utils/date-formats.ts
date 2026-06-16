/**
 * Centralized Date Format Utilities
 * 
 * This module standardizes all date operations across the application:
 * - Internal Standard: ISO format (YYYY-MM-DD)
 * - Aladhan API: DD-MM-YYYY format
 * - Display: Various user-friendly formats
 */

// Type definitions for different date formats
export type ISODateString = string; // YYYY-MM-DD
export type AladhanDateString = string; // DD-MM-YYYY
export type DisplayDateString = string; // Various display formats

/**
 * Convert Aladhan API date (DD-MM-YYYY) to ISO format (YYYY-MM-DD)
 */
export function aladhanToISO(aladhanDate: AladhanDateString): ISODateString {
  if (!aladhanDate || typeof aladhanDate !== 'string') {
    throw new Error(`Invalid Aladhan date format: ${aladhanDate}`);
  }
  
  const parts = aladhanDate.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid Aladhan date format: ${aladhanDate}. Expected DD-MM-YYYY`);
  }
  
  const [day, month, year] = parts;
  
  // Validate parts
  if (!day || !month || !year || day.length !== 2 || month.length !== 2 || year.length !== 4) {
    throw new Error(`Invalid Aladhan date format: ${aladhanDate}. Expected DD-MM-YYYY`);
  }
  
  return `${year}-${month}-${day}`;
}

/**
 * Convert ISO format (YYYY-MM-DD) to Aladhan API format (DD-MM-YYYY)
 */
export function isoToAladhan(isoDate: ISODateString): AladhanDateString {
  if (!isoDate || typeof isoDate !== 'string') {
    throw new Error(`Invalid ISO date format: ${isoDate}`);
  }
  
  const parts = isoDate.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid ISO date format: ${isoDate}. Expected YYYY-MM-DD`);
  }
  
  const [year, month, day] = parts;
  
  // Validate parts
  if (!year || !month || !day || year.length !== 4 || month.length !== 2 || day.length !== 2) {
    throw new Error(`Invalid ISO date format: ${isoDate}. Expected YYYY-MM-DD`);
  }
  
  return `${day}-${month}-${year}`;
}

/**
 * Create a JavaScript Date object from Aladhan format (DD-MM-YYYY)
 */
export function createDateFromAladhan(aladhanDate: AladhanDateString): Date {
  const [day, month, year] = aladhanDate.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-based in JavaScript
}

/**
 * Create a JavaScript Date object from ISO format (YYYY-MM-DD)
 * Uses explicit date construction to avoid timezone issues
 */
export function createDateFromISO(isoDate: ISODateString): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-based in JavaScript
}

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 * Uses local timezone to avoid UTC/local discrepancies
 */
export function getTodayISO(): ISODateString {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date in ISO format for a specific timezone.
 * Uses Intl parts to avoid locale-specific parsing quirks.
 */
export function getTodayISOInTimeZone(timeZone: string): ISODateString {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Unable to derive current date for timezone: ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

/**
 * Get today's date in Aladhan format (DD-MM-YYYY)
 */
export function getTodayAladhan(): AladhanDateString {
  return isoToAladhan(getTodayISO());
}

/**
 * Get tomorrow's date in ISO format (YYYY-MM-DD)
 * Uses local timezone to match getTodayISO() behavior
 */
export function getTomorrowISO(): ISODateString {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert a Date object to ISO format (YYYY-MM-DD)
 */
export function dateToISO(date: Date): ISODateString {
  return date.toISOString().split('T')[0];
}

/**
 * Convert a Date object to Aladhan format (DD-MM-YYYY)
 */
export function dateToAladhan(date: Date): AladhanDateString {
  return isoToAladhan(dateToISO(date));
}

/**
 * Format date for display (e.g., "Friday, July 10, 2025")
 * Uses explicit date construction to avoid timezone issues
 */
export function formatDateForDisplay(date: Date | ISODateString): DisplayDateString {
  let dateObj: Date;
  if (typeof date === 'string') {
    const [year, month, day] = date.split('-').map(Number);
    dateObj = new Date(year, month - 1, day); // month is 0-based
  } else {
    dateObj = date;
  }
  
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format date for API response (YYYY-MM-DD)
 */
export function formatDateForAPI(date: Date | AladhanDateString): ISODateString {
  if (typeof date === 'string') {
    return aladhanToISO(date);
  }
  return dateToISO(date);
}

/**
 * Get Hijri date in English format
 */
export function getHijriDateInEnglish(date?: Date): string {
  const dateObj = date || new Date();
  const options = { year: "numeric", month: "long", day: "numeric" } as const;
  return dateObj.toLocaleDateString("en-US-u-ca-islamic", options);
}

/**
 * Format time for 12-hour display (e.g., "4:30 PM")
 */
export function formatTime12Hour(time24: string, date?: Date): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Validate if a string is a valid Aladhan date format (DD-MM-YYYY)
 */
export function isValidAladhanDate(date: string): boolean {
  try {
    aladhanToISO(date);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate if a string is a valid ISO date format (YYYY-MM-DD)
 */
export function isValidISODate(date: string): boolean {
  try {
    const dateObj = new Date(date);
    return dateObj.toISOString().split('T')[0] === date;
  } catch {
    return false;
  }
}

/**
 * Parse date from various formats and return ISO format
 */
export function parseToISO(dateInput: string | Date): ISODateString {
  if (dateInput instanceof Date) {
    return dateToISO(dateInput);
  }
  
  if (typeof dateInput === 'string') {
    // Try ISO format first
    if (isValidISODate(dateInput)) {
      return dateInput;
    }
    
    // Try Aladhan format
    if (isValidAladhanDate(dateInput)) {
      return aladhanToISO(dateInput);
    }
    
    // Try parsing as generic date string
    const parsed = new Date(dateInput);
    if (!isNaN(parsed.getTime())) {
      return dateToISO(parsed);
    }
  }
  
  throw new Error(`Unable to parse date: ${dateInput}`);
}

// Legacy compatibility - replace these gradually
export const createDateFromDMY = createDateFromAladhan;
export const formatTo12Hour = formatTime12Hour;
