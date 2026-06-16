import type { PrayerTimeConfig, IqamaCalculationMethod } from '@/utils/prayer-times';

export const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type PrayerName = typeof PRAYER_NAMES[number];

export type MasjidIqamaRules = Record<PrayerName, PrayerTimeConfig>;

export interface MasjidConfig {
  slug: string;
  name: string;
  address: string;
  timezone: string;
  calcMethodId: number;
  calcMethodLabel: string;
  iqamaRules: MasjidIqamaRules;
}

// Backward-compat default tenant — callers who hit the service with no `config`
// param get ICCF data back. Other masjids must send their own config.
export const DEFAULT_MASJID_CONFIG: MasjidConfig = {
  slug: 'iccf',
  name: 'Islamic Foundation of Clovis and Fresno (ICCF)',
  address: '2111 E Nees Ave, Fresno, CA 93720',
  timezone: 'America/Los_Angeles',
  calcMethodId: 2,
  calcMethodLabel: 'ISNA',
  iqamaRules: {
    Fajr:    { defaultRules: { type: 'interval', interval: 15, gapTime: 10, lowerLimit: '04:45' } },
    Dhuhr:   { defaultRules: { type: 'dst', gapTime: 15, afterDST: '13:30', beforeDST: '12:30' } },
    Asr:     { defaultRules: { type: 'interval', interval: 15, gapTime: 10, upperLimit: '17:00' } },
    Maghrib: { defaultRules: { type: 'delay', delay: 10 } },
    Isha:    {
      defaultRules: { type: 'interval', interval: 15, gapTime: 10, upperLimit: '22:00', lowerLimit: '20:00' },
      ramadanRules: { type: 'dst', gapTime: 10, afterDST: '20:30', beforeDST: '20:00' },
    },
  },
};

export interface PrayerTimesParams {
  scope: 'day' | 'month' | 'ramadan' | 'year';
  date?: string;
  asOf?: string;
  month?: string;
  year?: string;
  groupByInterval?: boolean;
  includeRaw?: boolean;
  includeDebug?: boolean;
}

export interface ParsedRequest {
  config: MasjidConfig;
  params: PrayerTimesParams;
}

export class ConfigError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const SLUG_RE = /^[a-z0-9-]+$/;
const RULE_TYPES = new Set(['delay', 'interval', 'dst']);

function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function validateRule(rule: unknown, path: string): IqamaCalculationMethod {
  if (!rule || typeof rule !== 'object') {
    throw new ConfigError(path, `expected object, got ${typeof rule}`);
  }
  const r = rule as Record<string, unknown>;
  if (typeof r.type !== 'string' || !RULE_TYPES.has(r.type)) {
    throw new ConfigError(`${path}.type`, `must be one of: delay, interval, dst`);
  }
  switch (r.type) {
    case 'delay':
      if (typeof r.delay !== 'number') throw new ConfigError(`${path}.delay`, 'must be a number');
      break;
    case 'interval':
      if (typeof r.interval !== 'number') throw new ConfigError(`${path}.interval`, 'must be a number');
      if (typeof r.gapTime !== 'number') throw new ConfigError(`${path}.gapTime`, 'must be a number');
      break;
    case 'dst':
      if (typeof r.gapTime !== 'number') throw new ConfigError(`${path}.gapTime`, 'must be a number');
      if (typeof r.afterDST !== 'string') throw new ConfigError(`${path}.afterDST`, 'must be a string');
      if (typeof r.beforeDST !== 'string') throw new ConfigError(`${path}.beforeDST`, 'must be a string');
      break;
  }
  return r as unknown as IqamaCalculationMethod;
}

function validatePrayerConfig(cfg: unknown, prayer: string): PrayerTimeConfig {
  if (!cfg || typeof cfg !== 'object') {
    throw new ConfigError(`iqamaRules.${prayer}`, `expected object, got ${typeof cfg}`);
  }
  const c = cfg as Record<string, unknown>;
  const defaultRules = validateRule(c.defaultRules, `iqamaRules.${prayer}.defaultRules`);
  const ramadanRules = c.ramadanRules !== undefined
    ? validateRule(c.ramadanRules, `iqamaRules.${prayer}.ramadanRules`)
    : undefined;
  return ramadanRules ? { defaultRules, ramadanRules } : { defaultRules };
}

export function validateMasjidConfig(input: unknown): MasjidConfig {
  if (!input || typeof input !== 'object') {
    throw new ConfigError('config', `expected JSON object, got ${typeof input}`);
  }
  const c = input as Record<string, unknown>;

  if (typeof c.slug !== 'string' || !SLUG_RE.test(c.slug)) {
    throw new ConfigError('slug', 'must match /^[a-z0-9-]+$/');
  }
  if (typeof c.name !== 'string' || c.name.length === 0) {
    throw new ConfigError('name', 'must be a non-empty string');
  }
  if (typeof c.address !== 'string' || c.address.length === 0) {
    throw new ConfigError('address', 'must be a non-empty string');
  }
  if (!isValidTimezone(c.timezone)) {
    throw new ConfigError('timezone', 'must be a valid IANA timezone identifier');
  }
  if (typeof c.calcMethodId !== 'number' || !Number.isInteger(c.calcMethodId)) {
    throw new ConfigError('calcMethodId', 'must be an integer (Aladhan method id)');
  }
  if (typeof c.calcMethodLabel !== 'string' || c.calcMethodLabel.length === 0) {
    throw new ConfigError('calcMethodLabel', 'must be a non-empty string');
  }
  if (!c.iqamaRules || typeof c.iqamaRules !== 'object') {
    throw new ConfigError('iqamaRules', 'must be an object keyed by prayer name');
  }
  const rulesIn = c.iqamaRules as Record<string, unknown>;
  const iqamaRules = {} as MasjidIqamaRules;
  for (const prayer of PRAYER_NAMES) {
    if (!(prayer in rulesIn)) {
      throw new ConfigError(`iqamaRules.${prayer}`, 'missing required prayer config');
    }
    iqamaRules[prayer] = validatePrayerConfig(rulesIn[prayer], prayer);
  }

  return {
    slug: c.slug,
    name: c.name,
    address: c.address,
    timezone: c.timezone as string,
    calcMethodId: c.calcMethodId,
    calcMethodLabel: c.calcMethodLabel,
    iqamaRules,
  };
}

function parseScope(value: string | null | undefined): PrayerTimesParams['scope'] {
  const v = value || 'day';
  if (v !== 'day' && v !== 'month' && v !== 'ramadan' && v !== 'year') {
    throw new ConfigError('scope', 'must be one of: day, month, ramadan, year');
  }
  return v;
}

function paramsFromSearch(searchParams: URLSearchParams): PrayerTimesParams {
  return {
    scope: parseScope(searchParams.get('scope')),
    date: searchParams.get('date') ?? undefined,
    asOf: searchParams.get('asOf') ?? undefined,
    month: searchParams.get('month') ?? undefined,
    year: searchParams.get('year') ?? undefined,
    groupByInterval: searchParams.get('groupByInterval') === 'true',
    includeRaw: searchParams.get('includeRaw') === 'true',
    includeDebug: searchParams.get('includeDebug') === 'true',
  };
}

function paramsFromObject(input: unknown): PrayerTimesParams {
  if (input === undefined || input === null) {
    return { scope: 'day' };
  }
  if (typeof input !== 'object') {
    throw new ConfigError('params', `expected object, got ${typeof input}`);
  }
  const p = input as Record<string, unknown>;
  return {
    scope: parseScope(p.scope as string | undefined),
    date: typeof p.date === 'string' ? p.date : undefined,
    asOf: typeof p.asOf === 'string' ? p.asOf : undefined,
    month: typeof p.month === 'string' ? p.month : typeof p.month === 'number' ? String(p.month) : undefined,
    year: typeof p.year === 'string' ? p.year : typeof p.year === 'number' ? String(p.year) : undefined,
    groupByInterval: p.groupByInterval === true || p.groupByInterval === 'true',
    includeRaw: p.includeRaw === true || p.includeRaw === 'true',
    includeDebug: p.includeDebug === true || p.includeDebug === 'true',
  };
}

function parseConfigJSON(raw: string): MasjidConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new ConfigError('config', `must be valid JSON: ${(e as Error).message}`);
  }
  return validateMasjidConfig(parsed);
}

export async function parseMasjidRequest(request: Request): Promise<ParsedRequest> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === 'POST') {
    let body: unknown;
    try {
      body = await request.json();
    } catch (e) {
      throw new ConfigError('body', `expected JSON body: ${(e as Error).message}`);
    }
    if (!body || typeof body !== 'object') {
      throw new ConfigError('body', 'expected JSON object with { config, params }');
    }
    const b = body as Record<string, unknown>;
    const config = b.config === undefined ? DEFAULT_MASJID_CONFIG : validateMasjidConfig(b.config);
    const params = paramsFromObject(b.params);
    return { config, params };
  }

  const configRaw = url.searchParams.get('config');
  const config = configRaw === null ? DEFAULT_MASJID_CONFIG : parseConfigJSON(configRaw);
  const params = paramsFromSearch(url.searchParams);
  return { config, params };
}
