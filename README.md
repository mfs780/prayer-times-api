# prayer-times-api

Standalone, stateless, multi-tenant prayer times + iqama API.

Extracted from the IFCF site. Every request carries a `MasjidConfig` describing
the masjid (address, name, timezone, calculation method, iqama rules). The
service has no per-tenant state — any site can call it by sending its own
config.

## Endpoints

All under `/api/v1`. Both `GET` (with `?config=<url-encoded JSON>`) and `POST`
(with body `{ "config": ..., "params": ... }`) are supported.

| Method | Path | Returns |
|---|---|---|
| GET, POST | `/api/v1/prayer-times` | JSON prayer/iqama times |
| GET, POST | `/api/v1/pdf/full-schedule` | PDF of yearly daily athan times |
| GET, POST | `/api/v1/pdf/iqama-schedule` | PDF of yearly iqama interval schedule |

## `MasjidConfig`

```ts
interface MasjidConfig {
  slug: string;                  // /^[a-z0-9-]+$/, used in PDF filenames + logs
  name: string;                  // shown in JSON masjid metadata
  address: string;               // raw, encoded at the Aladhan URL boundary
  timezone: string;              // IANA, e.g. "America/Los_Angeles"
  calcMethodId: number;          // Aladhan method id (e.g. 2 for ISNA)
  calcMethodLabel: string;       // display string (e.g. "ISNA")
  iqamaRules: Record<'Fajr'|'Dhuhr'|'Asr'|'Maghrib'|'Isha', PrayerTimeConfig>;
}
```

See `src/utils/prayer-times.ts` for `PrayerTimeConfig` (delay/interval/dst rule
shapes plus optional `ramadanRules`).

## Local dev

```bash
npm install
npm run dev   # http://localhost:3010
npm test
```

## Known limitations

- DST helpers implement the US rule only (2nd-Sun-Mar → 1st-Sun-Nov). For
  non-`America/*` timezones, `isDST` is short-circuited to `false`.
- Date helpers in `src/utils/date-formats.ts` use process-local `TZ`. Run with
  `TZ=America/Los_Angeles` (or the masjid's representative timezone) until the
  helpers are refactored to be IANA-aware.
- CORS defaults to `Access-Control-Allow-Origin: *` so any site can call the
  service. Lock down via `ALLOWED_ORIGINS=https://a.example,https://b.example`.
- No rate limiting or auth yet — add before public use.
