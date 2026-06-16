import jsPDF from 'jspdf';

// Public API Response Types
interface PrayerData {
  name: string;
  athan: string;
  iqama: string;
  athanRaw?: string;
  iqamaRaw?: string;
}

interface DateInfo {
  gregorian: string;
  gregorianFormatted: string;
  hijri: string;
}

interface DayData {
  interval: string;
  date: DateInfo;
  prayers: PrayerData[];
}

interface IntervalData {
  interval: string;
  startDate: DateInfo;
  endDate?: DateInfo;
  prayers: PrayerData[];
}

interface DailyMonthData {
  month: string;
  monthName: string;
  days: DayData[];
}

interface IntervalMonthData {
  month: string;
  monthName: string;
  intervals: IntervalData[];
}

type MonthData = DailyMonthData | IntervalMonthData;

interface PublicAPIYearlyResponse {
  success: boolean;
  masjid: {
    name: string;
    address: string;
    timezone: string;
    calculationMethod: string;
  };
  year: string;
  scope: string;
  groupByInterval: boolean;
  data: MonthData[];
}

// PDF Configuration Types
export interface ConsolidatedPDFConfig {
  layout: 'daily' | 'interval' | 'both';
  title?: string;
  includeAthan?: boolean;
  includeIqama?: boolean;
  highlightRamadan?: boolean;
  showChangeIndicators?: boolean;
  colorScheme?: 'default' | 'professional' | 'classic';
  pageBreakStrategy?: 'month' | 'semester' | 'none';
}

// Color Schemes
const COLOR_SCHEMES = {
  default: {
    headerBg: '#2B4162',
    headerText: '#FFFFFF',
    bodyText: '#333333',
    iqamaText: '#1E88E5',
    rowEvenBg: '#F5F5F5',
    ramadanBg: '#008000',
    intervalBg: '#2F5597'
  },
  professional: {
    headerBg: '#708090',
    headerText: '#FFFFFF',
    bodyText: '#264478',
    iqamaText: '#264478',
    rowEvenBg: '#F8F9FA',
    ramadanBg: '#008000',
    intervalBg: '#203764'
  },
  classic: {
    headerBg: '#2B4162',
    headerText: '#FFFFFF',
    bodyText: '#000000',
    iqamaText: '#800080',
    rowEvenBg: '#F0F0F0',
    ramadanBg: '#006400',
    intervalBg: '#191970'
  }
};

// Default configuration
const DEFAULT_CONFIG: ConsolidatedPDFConfig = {
  layout: 'daily',
  title: 'IFCF Prayer Schedule',
  includeAthan: true,
  includeIqama: true,
  highlightRamadan: true,
  showChangeIndicators: true,
  colorScheme: 'default',
  pageBreakStrategy: 'month'
};

function resolveScheduleYear(yearData: PublicAPIYearlyResponse): string {
  return yearData?.year || new Date().getFullYear().toString();
}

function sortDayDataByGregorianDate(days: DayData[]): DayData[] {
  return [...days].sort((left, right) => left.date.gregorian.localeCompare(right.date.gregorian));
}

function buildIntervalFromDays(days: DayData[]): IntervalData {
  const sortedDays = sortDayDataByGregorianDate(days);
  const firstDay = sortedDays[0];
  const lastDay = sortedDays[sortedDays.length - 1];

  return {
    interval: firstDay.interval || firstDay.date.gregorianFormatted,
    startDate: firstDay.date,
    endDate: lastDay.date,
    // Daily responses already carry the interval-accommodated iqama values.
    prayers: firstDay.prayers,
  };
}

function normalizeMonthToIntervals(monthData: MonthData): IntervalMonthData | null {
  if ('intervals' in monthData) {
    return monthData;
  }

  if (!monthData.days.length) {
    return null;
  }

  const sortedDays = sortDayDataByGregorianDate(monthData.days);
  const groupedIntervals: IntervalData[] = [];
  let currentGroup: DayData[] = [];

  sortedDays.forEach((day) => {
    if (currentGroup.length === 0 || currentGroup[0].interval === day.interval) {
      currentGroup.push(day);
      return;
    }

    groupedIntervals.push(buildIntervalFromDays(currentGroup));
    currentGroup = [day];
  });

  if (currentGroup.length > 0) {
    groupedIntervals.push(buildIntervalFromDays(currentGroup));
  }

  return {
    month: monthData.month,
    monthName: monthData.monthName,
    intervals: groupedIntervals,
  };
}

export class ConsolidatedPDFGenerator {
  private doc: jsPDF;
  private config: ConsolidatedPDFConfig;
  private colors: any;
  private pageWidth: number;
  private margin: number = 7;

  constructor(config: Partial<ConsolidatedPDFConfig> = {}) {
    this.doc = new jsPDF({ orientation: 'portrait' });
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.colors = COLOR_SCHEMES[this.config.colorScheme || 'default'];
    this.pageWidth = this.doc.internal.pageSize.width;
  }

  /**
   * Main entry point - generates PDF from public API yearly data
   */
  async generatePDF(yearlyData: PublicAPIYearlyResponse): Promise<Buffer> {
    this.addTitle();

    switch (this.config.layout) {
      case 'daily':
        await this.generateDailyLayout(yearlyData);
        break;
      case 'interval':
        await this.generateIntervalLayout(yearlyData);
        break;
      case 'both':
        await this.generateDailyLayout(yearlyData);
        this.doc.addPage();
        await this.generateIntervalLayout(yearlyData);
        break;
    }

    this.addFooter();
    return Buffer.from(this.doc.output('arraybuffer'));
  }

  /**
   * Add PDF title
   */
  private addTitle(): void {
    this.doc.setTextColor(this.colors.headerText);
    this.doc.setFillColor(this.colors.headerBg);
    this.doc.rect(this.margin, this.margin, this.pageWidth - (2 * this.margin), 12, 'F');
    
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(14);
    this.doc.setTextColor('#595959');
    this.doc.text(
      this.config.title || 'IFCF Prayer Schedule',
      this.pageWidth / 2,
      this.margin + 8,
      { align: 'center' }
    );
  }

  /**
   * Generate daily prayer times layout using public API data
   */
  private async generateDailyLayout(yearlyData: PublicAPIYearlyResponse): Promise<void> {
    const tableWidth = this.pageWidth - (2 * this.margin);
    const colWidth = tableWidth / 7;
    const rowHeight = 8;

    for (const monthData of yearlyData.data) {
      if (!('days' in monthData)) {
        continue;
      }

      if (parseInt(monthData.month) > 1 && this.config.pageBreakStrategy === 'month') {
        this.doc.addPage();
      }

      const monthName = monthData.monthName || this.getMonthName(parseInt(monthData.month));

      // Month header
      const yStart = this.margin;
      this.doc.setFillColor(this.colors.headerBg);
      this.doc.rect(this.margin, yStart, tableWidth, 10, 'F');
      this.doc.setTextColor(this.colors.headerText);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(12);
      this.doc.text(monthName, this.pageWidth / 2, yStart + 6.5, { align: 'center' });

      // Table headers
      const headers = ['Date', 'Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
      this.drawTableHeader(yStart + 15, headers, colWidth);

      let yPos = yStart + 28;

      // Data rows
      monthData.days.forEach((dayData, index) => {
        const cells = this.generateDailyCellsFromConsolidated(dayData, yPos, colWidth);
        this.drawDailyRow(cells, index % 2 === 0);
        yPos += rowHeight;
      });

      // Draw table border
      this.doc.setDrawColor(this.colors.headerBg);
      this.doc.setLineWidth(0.1);
      this.doc.rect(this.margin, yStart + 15, tableWidth, yPos - (yStart + 15));
    }
  }

  /**
   * Generate interval prayer times layout using public API data
   */
  private async generateIntervalLayout(yearlyData: PublicAPIYearlyResponse): Promise<void> {
    const tableWidth = this.pageWidth - (2 * this.margin);
    const firstColWidth = tableWidth * 0.2;
    const otherColWidth = (tableWidth - firstColWidth) / 5;
    const rowHeight = 10;
    let yPos = this.margin + 40;

    // Table headers
    this.doc.setFillColor(this.colors.headerBg);
    this.doc.rect(this.margin, this.margin + 25, tableWidth, rowHeight, 'F');
    this.doc.setTextColor(this.colors.headerText);
    this.doc.setFontSize(10);
    this.doc.text('MTH/DATE', this.margin + firstColWidth / 2, this.margin + 31, { align: 'center' });
    this.doc.text('IQAMA TIMES', this.margin + firstColWidth + (otherColWidth * 2.5), this.margin + 31, { align: 'center' });

    for (const monthData of yearlyData.data) {
      const intervalMonthData = normalizeMonthToIntervals(monthData);

      if (!intervalMonthData || intervalMonthData.intervals.length === 0) {
        continue;
      }

      // Handle page breaks
      if (intervalMonthData.month === '7' && this.config.pageBreakStrategy !== 'none') {
        this.addFooter();
        this.doc.addPage();
        this.addTitle();
        yPos = this.margin + 40;

        // Re-add headers
        this.doc.setFillColor(this.colors.headerBg);
        this.doc.rect(this.margin, this.margin + 25, tableWidth, rowHeight, 'F');
        this.doc.setTextColor(this.colors.headerText);
        this.doc.setFontSize(10);
        this.doc.text('MTH/DATE', this.margin + firstColWidth / 2, this.margin + 31, { align: 'center' });
        this.doc.text('IQAMA TIMES', this.margin + firstColWidth + (otherColWidth * 2.5), this.margin + 31, { align: 'center' });
      }

      yPos = await this.drawIntervalMonthConsolidated(intervalMonthData, yPos, firstColWidth, otherColWidth, rowHeight);
    }
  }

  /**
   * Draw table header for daily layout
   */
  private drawTableHeader(y: number, headers: string[], colWidth: number): void {
    const tableWidth = this.pageWidth - (2 * this.margin);
    this.doc.setFillColor(this.colors.headerBg);
    this.doc.rect(this.margin, y, tableWidth, 8, 'F');

    this.doc.setTextColor(this.colors.headerText);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8);

    headers.forEach((header, i) => {
      this.doc.text(
        header, 
        this.margin + (i * colWidth) + (colWidth / 2), 
        y + 5.5, 
        { align: 'center' }
      );
    });
  }

  /**
   * Generate cells for daily row using public API data
   */
  private generateDailyCellsFromConsolidated(
    dayData: DayData,
    yPos: number,
    colWidth: number
  ): Array<{text: string, x: number, y: number, width: number}> {
    const cells = [];

    // Date cell - extract day from YYYY-MM-DD format
    const dateParts = dayData.date.gregorian.split('-');
    const dayNum = parseInt(dateParts[2]);
    const dayText = dayNum.toString().padStart(2, '0');

    cells.push({
      text: dayText,
      x: this.margin,
      y: yPos,
      width: colWidth
    });

    // Prayer time cells - directly use public API data
    ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach((prayerName, i) => {
      const prayer = dayData.prayers.find(p => p.name === prayerName);
      let timeText = '';

      if (this.config.includeAthan && prayer) {
        timeText = prayer.athan;
      }

      if (this.config.includeIqama && prayer && prayer.iqama) {
        timeText += timeText ? `\nIqama: ${prayer.iqama}` : prayer.iqama;
      }

      cells.push({
        text: timeText || 'N/A',
        x: this.margin + ((i + 1) * colWidth),
        y: yPos,
        width: colWidth
      });
    });

    return cells;
  }

  /**
   * Draw daily row
   */
  private drawDailyRow(cells: Array<{text: string, x: number, y: number, width: number}>, isEven: boolean): void {
    const tableWidth = this.pageWidth - (2 * this.margin);
    const rowHeight = 8;

    if (isEven) {
      this.doc.setFillColor(this.colors.rowEvenBg);
      this.doc.rect(this.margin, cells[0].y - 4, tableWidth, rowHeight, 'F');
    }

    this.doc.setFontSize(7.5);
    cells.forEach(cell => {
      if (cell.text.includes('Iqama:')) {
        const [time, iqama] = cell.text.split('Iqama:');
        this.doc.setTextColor(this.colors.bodyText);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(time.trim(), cell.x + (cell.width / 2), cell.y, { align: 'center' });
        this.doc.setTextColor(this.colors.iqamaText);
        this.doc.text(`(${iqama.trim()})`, cell.x + (cell.width / 2), cell.y + 3, { align: 'center' });
      } else {
        this.doc.setTextColor(this.colors.bodyText);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(cell.text, cell.x + (cell.width / 2), cell.y, { align: 'center' });
      }
    });
  }

  /**
   * Draw interval month section using public API data
   */
  private async drawIntervalMonthConsolidated(
    monthData: IntervalMonthData,
    yPos: number,
    firstColWidth: number,
    otherColWidth: number,
    rowHeight: number
  ): Promise<number> {
    const monthName = monthData.monthName || this.getMonthName(parseInt(monthData.month));

    // Month header
    this.doc.setFillColor('#7F7F7F');
    this.doc.rect(this.margin, yPos, firstColWidth, rowHeight, 'F');
    this.doc.setTextColor(this.colors.headerText);
    this.doc.setFontSize(10);
    this.doc.text(monthName, this.margin + firstColWidth / 2, yPos + 6, { align: 'center' });

    // Prayer headers
    this.doc.setFillColor('#203764');
    this.doc.rect(this.margin + firstColWidth, yPos, this.pageWidth - (2 * this.margin) - firstColWidth, rowHeight, 'F');
    ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach((prayer, i) => {
      this.doc.text(
        prayer, 
        this.margin + firstColWidth + (i * otherColWidth) + otherColWidth / 2, 
        yPos + 6, 
        { align: 'center' }
      );
    });

    yPos += rowHeight;

    let previousIqamaTimes: string[] | null = null;

    for (const interval of monthData.intervals) {
      const isIntervalRamadan = this.config.highlightRamadan &&
        (
          this.isRamadanFromHijriDate(interval.startDate.hijri) ||
          this.isRamadanFromHijriDate(interval.endDate?.hijri || '')
        );
      
      // Interval header
      this.doc.setFillColor(isIntervalRamadan ? this.colors.ramadanBg : this.colors.intervalBg);
      this.doc.rect(this.margin, yPos, this.pageWidth - (2 * this.margin), rowHeight, 'F');
      this.doc.setTextColor(this.colors.headerText);
      this.doc.text(interval.interval, this.margin + firstColWidth / 2, yPos + 6, { align: 'center' });

      const currentIqamaTimes: string[] = [];
      
      ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach((prayerName, i) => {
        const finalIqama = interval.prayers.find((prayer) => prayer.name === prayerName)?.iqama || 'N/A';

        currentIqamaTimes.push(finalIqama);

        // Draw cell
        this.doc.setFillColor('#FFFFFF');
        this.doc.rect(this.margin + firstColWidth + (i * otherColWidth), yPos, otherColWidth, rowHeight, 'F');
        this.doc.setTextColor(this.colors.bodyText);
        this.doc.text(finalIqama, this.margin + firstColWidth + (i * otherColWidth) + otherColWidth / 2, yPos + 6, { align: 'center' });

        // Underline if changed
        if (this.config.showChangeIndicators && previousIqamaTimes && previousIqamaTimes[i] !== finalIqama) {
          const textWidth = this.doc.getTextWidth(finalIqama);
          const underlineX = this.margin + firstColWidth + (i * otherColWidth) + (otherColWidth - textWidth) / 2;
          const underlineY = yPos + 8;
          this.doc.line(underlineX, underlineY, underlineX + textWidth, underlineY);
        }
      });

      previousIqamaTimes = currentIqamaTimes;
      yPos += rowHeight;
    }

    return yPos;
  }

  /**
   * Get month name from number
   */
  private getMonthName(monthNum: number): string {
    const months = [
      '', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNum] || '';
  }

  /**
   * Check if a hijri date string indicates Ramadan
   */
  private isRamadanFromHijriDate(hijriDate: string): boolean {
    // Parse hijri date string like "15 Ramadan 1446"
    const parts = hijriDate.split(' ');
    if (parts.length >= 2) {
      return parts[1].toLowerCase().includes('ramadan');
    }
    return false;
  }

  /**
   * Add footer
   */
  private addFooter(): void {
    const footerY = this.doc.internal.pageSize.height - this.margin;
    
    if (this.config.layout === 'daily' || this.config.layout === 'both') {
      const footerText = "IQAMA TIMES ARE INSIDE ";
      const footerNote = "(BRACKETS)";
      const textWidth = this.doc.getTextWidth(footerText + footerNote);
      const startX = (this.pageWidth - textWidth) / 2;

      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(8);
      this.doc.setTextColor(this.colors.bodyText);
      this.doc.text(footerText, startX, footerY);
      this.doc.setTextColor(this.colors.iqamaText);
      this.doc.text(footerNote, startX + this.doc.getTextWidth(footerText), footerY);
    } else {
      this.doc.setFontSize(8);
      this.doc.setTextColor('#000000');
      this.doc.text(
        'TIME CHANGES ARE UNDERLINED. GREEN HIGHLIGHT IS RAMADAN. FOR DAILY AZAN TIMES GO TO IFCF.NET',
        this.pageWidth / 2,
        footerY,
        { align: 'center' }
      );
    }
  }
}

/**
 * Convenience function for generating daily prayer schedule PDF from public API data
 */
export async function generateConsolidatedDailyPDF(yearData: PublicAPIYearlyResponse): Promise<Buffer> {
  const scheduleYear = resolveScheduleYear(yearData);
  const generator = new ConsolidatedPDFGenerator({
    layout: 'daily',
    title: `IFCF Athan Times ${scheduleYear}`,
    includeAthan: true,
    includeIqama: true,
    colorScheme: 'default'
  });
  return generator.generatePDF(yearData);
}

/**
 * Convenience function for generating interval prayer schedule PDF from public API data
 */
export async function generateConsolidatedIntervalPDF(yearData: PublicAPIYearlyResponse): Promise<Buffer> {
  const scheduleYear = resolveScheduleYear(yearData);
  const generator = new ConsolidatedPDFGenerator({
    layout: 'interval',
    title: `${scheduleYear} ISLAMIC FOUNDATION OF CLOVIS AND FRESNO IQAMA TIMES`,
    includeIqama: true,
    highlightRamadan: true,
    showChangeIndicators: true,
    colorScheme: 'professional'
  });
  return generator.generatePDF(yearData);
}

/**
 * Convenience function for generating combined prayer schedule PDF from public API data
 */
export async function generateConsolidatedCombinedPDF(yearData: PublicAPIYearlyResponse): Promise<Buffer> {
  const scheduleYear = resolveScheduleYear(yearData);
  const generator = new ConsolidatedPDFGenerator({
    layout: 'both',
    title: `IFCF Complete Prayer Schedule ${scheduleYear}`,
    includeAthan: true,
    includeIqama: true,
    highlightRamadan: true,
    showChangeIndicators: true,
    colorScheme: 'default'
  });
  return generator.generatePDF(yearData);
}
