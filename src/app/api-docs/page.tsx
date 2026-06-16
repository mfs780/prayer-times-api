'use client';

import { useState, useEffect } from 'react';

const SERVICE_FALLBACK = 'https://prayer-times-api-nu.vercel.app';

// Default tenant — kept in sync with DEFAULT_MASJID_CONFIG in src/lib/config.ts.
const DEFAULT_CONFIG_DISPLAY = {
  name: 'Islamic Foundation of Clovis and Fresno (ICCF)',
  address: '2111 E Nees Ave, Fresno, CA 93720',
  timezone: 'America/Los_Angeles',
  calcMethodLabel: 'ISNA (Aladhan method 2)',
};

const OTHER_MASJID_EXAMPLE = {
  slug: 'masjid-example',
  name: 'Example Masjid',
  address: '123 Main St, Springfield, IL 62701',
  timezone: 'America/Chicago',
  calcMethodId: 2,
  calcMethodLabel: 'ISNA',
  iqamaRules: {
    Fajr:    { defaultRules: { type: 'interval', interval: 15, gapTime: 10, lowerLimit: '04:45' } },
    Dhuhr:   { defaultRules: { type: 'delay', delay: 15 } },
    Asr:     { defaultRules: { type: 'interval', interval: 15, gapTime: 10, upperLimit: '17:00' } },
    Maghrib: { defaultRules: { type: 'delay', delay: 10 } },
    Isha:    { defaultRules: { type: 'interval', interval: 15, gapTime: 10, upperLimit: '22:00', lowerLimit: '20:00' } },
  },
};

const OTHER_MASJID_QS = `config=${encodeURIComponent(JSON.stringify(OTHER_MASJID_EXAMPLE))}`;

export default function ApiDocumentationPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState(SERVICE_FALLBACK);
  const currentYear = new Date().getFullYear();

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const base = `${origin}/api/v1/prayer-times`;
  const pdfFull = `${origin}/api/v1/pdf/full-schedule`;
  const pdfIqama = `${origin}/api/v1/pdf/iqama-schedule`;

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const ParamTable = ({ rows }: { rows: { name: string; type: string; required: boolean; description: string }[] }) => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parameter</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="px-4 py-2 text-sm font-mono text-gray-900">{r.name}</td>
              <td className="px-4 py-2 text-sm text-gray-600">{r.type}</td>
              <td className={`px-4 py-2 text-sm ${r.required ? 'text-red-600' : 'text-gray-600'}`}>{r.required ? 'Yes' : 'No'}</td>
              <td className="px-4 py-2 text-sm text-gray-600">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const Example = ({ id, url }: { id: string; url: string }) => (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-900 text-gray-100 rounded-lg p-3 font-mono text-xs overflow-x-auto">
        <code>{url}</code>
      </div>
      <button onClick={() => copy(url, id)} className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm transition-colors">
        {copied === id ? '✓' : 'Copy'}
      </button>
      <a href={url} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
        Try
      </a>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Prayer Times API</h1>
          <p className="mt-2 text-gray-600">Multi-tenant prayer times + iqama API. Default tenant: <span className="font-semibold">ICCF</span>.</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Quick Start */}
        <section className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Start</h2>
          <p className="text-gray-600 mb-4">Call without a <code className="font-mono bg-gray-100 px-1 rounded">config</code> param to get ICCF data:</p>
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <code>{base}?scope=day</code>
          </div>
          <div className="mt-4 flex gap-4">
            <a href={`${base}?scope=day`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              Try it now →
            </a>
          </div>
        </section>

        {/* Default Tenant */}
        <section className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Default Tenant</h2>
          <p className="text-gray-600 mb-6">Requests without a <code className="font-mono bg-gray-100 px-1 rounded">config</code> param return data for the following masjid. To use a different masjid, see <a href="#custom-config" className="text-blue-600 underline">Custom Config</a>.</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900">Name</h3>
              <p className="text-gray-600">{DEFAULT_CONFIG_DISPLAY.name}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900">Address</h3>
              <p className="text-gray-600">{DEFAULT_CONFIG_DISPLAY.address}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900">Timezone</h3>
              <p className="text-gray-600 font-mono text-sm">{DEFAULT_CONFIG_DISPLAY.timezone}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900">Calculation Method</h3>
              <p className="text-gray-600">{DEFAULT_CONFIG_DISPLAY.calcMethodLabel}</p>
            </div>
          </div>
          <div className="mt-6">
            <h3 className="font-semibold text-gray-900 mb-2">Iqama Rules</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li><strong>Fajr:</strong> interval (15 min), gap 10 min, lower bound 04:45</li>
              <li><strong>Dhuhr:</strong> DST-aware — 13:30 during DST, 12:30 otherwise</li>
              <li><strong>Asr:</strong> interval (15 min), gap 10 min, upper bound 17:00</li>
              <li><strong>Maghrib:</strong> athan + 10 min delay</li>
              <li><strong>Isha:</strong> interval (15 min), gap 10 min, bounds 20:00–22:00; Ramadan: DST-aware (20:30/20:00)</li>
            </ul>
          </div>
        </section>

        {/* Custom Config */}
        <section id="custom-config" className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Custom Config (Other Masjids)</h2>
          <p className="text-gray-600 mb-4">
            Send a <code className="font-mono bg-gray-100 px-1 rounded">MasjidConfig</code> JSON object via the
            {' '}<code className="font-mono bg-gray-100 px-1 rounded">config</code> query param (URL-encoded) or the POST body to override the default.
          </p>

          <h3 className="font-semibold text-gray-900 mt-6 mb-2">Type Definition</h3>
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs overflow-x-auto">
            <pre>{`interface MasjidConfig {
  slug: string;              // /^[a-z0-9-]+$/, used in PDF filenames
  name: string;
  address: string;
  timezone: string;          // IANA, e.g. "America/Los_Angeles"
  calcMethodId: number;      // Aladhan method id (1-17). 2 = ISNA.
  calcMethodLabel: string;   // Display string, e.g. "ISNA"
  iqamaRules: Record<'Fajr'|'Dhuhr'|'Asr'|'Maghrib'|'Isha', PrayerTimeConfig>;
}

interface PrayerTimeConfig {
  defaultRules: IqamaRule;
  ramadanRules?: IqamaRule;  // overrides defaultRules during Ramadan
}

type IqamaRule =
  | { type: 'delay';    delay: number }                                       // athan + N minutes
  | { type: 'interval'; interval: number; gapTime: number;
      lowerLimit?: string; upperLimit?: string }                              // round to nearest interval, bounded
  | { type: 'dst';      gapTime: number; afterDST: string; beforeDST: string };// fixed time, DST-aware (US rule only)`}</pre>
          </div>

          <h3 className="font-semibold text-gray-900 mt-6 mb-2">Example Config</h3>
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs overflow-x-auto">
            <pre>{JSON.stringify(OTHER_MASJID_EXAMPLE, null, 2)}</pre>
          </div>

          <h3 className="font-semibold text-gray-900 mt-6 mb-2">Try It (with the example above)</h3>
          <Example id="custom-config-example" url={`${base}?scope=day&${OTHER_MASJID_QS}`} />

          <p className="text-sm text-gray-600 mt-4">
            Validation errors return HTTP 400 with a structured body:
            {' '}<code className="font-mono bg-gray-100 px-1 rounded">{'{ success: false, error: { code: "INVALID_CONFIG", field, message } }'}</code>.
          </p>
        </section>

        {/* Base URL */}
        <section className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Base URL</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <code className="text-blue-900 font-mono text-sm break-all">{base}</code>
          </div>
        </section>

        {/* JSON Endpoints */}
        <section className="space-y-8">
          <h2 className="text-3xl font-bold text-gray-900">JSON Endpoints</h2>

          {/* Day */}
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded">GET</span>
              <h3 className="text-xl font-bold text-gray-900">Single Day</h3>
            </div>
            <p className="text-gray-600 mb-6">Prayer times for today (or a given date) plus the first day of the next interval.</p>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Parameters</h4>
                <ParamTable rows={[
                  { name: 'scope', type: 'string', required: true, description: 'Must be "day"' },
                  { name: 'date', type: 'string', required: false, description: 'ISO date (YYYY-MM-DD). Defaults to today in the masjid timezone.' },
                  { name: 'config', type: 'JSON', required: false, description: 'MasjidConfig (URL-encoded). Defaults to ICCF.' },
                  { name: 'includeRaw', type: 'boolean', required: false, description: 'Include 24-hour raw times alongside the formatted ones.' },
                  { name: 'groupByInterval', type: 'boolean', required: false, description: 'Return current/next interval instead of today/tomorrow.' },
                ]}/>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Examples</h4>
                <div className="space-y-2">
                  <Example id="day-today" url={`${base}?scope=day`} />
                  <Example id="day-date"  url={`${base}?scope=day&date=${currentYear}-03-10`} />
                  <Example id="day-raw"   url={`${base}?scope=day&includeRaw=true`} />
                </div>
              </div>
            </div>
          </div>

          {/* Month */}
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded">GET</span>
              <h3 className="text-xl font-bold text-gray-900">Monthly</h3>
            </div>
            <p className="text-gray-600 mb-6">Prayer times for an entire month.</p>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Parameters</h4>
                <ParamTable rows={[
                  { name: 'scope', type: 'string', required: true, description: 'Must be "month"' },
                  { name: 'month', type: 'number', required: false, description: 'Month 1–12. Defaults to current month.' },
                  { name: 'year',  type: 'number', required: true,  description: 'Year (YYYY)' },
                  { name: 'config', type: 'JSON', required: false, description: 'MasjidConfig (URL-encoded). Defaults to ICCF.' },
                  { name: 'groupByInterval', type: 'boolean', required: false, description: 'Group by interval instead of day-by-day.' },
                ]}/>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Examples</h4>
                <div className="space-y-2">
                  <Example id="month-current" url={`${base}?scope=month&year=${currentYear}`} />
                  <Example id="month-specific" url={`${base}?scope=month&month=3&year=${currentYear}`} />
                </div>
              </div>
            </div>
          </div>

          {/* Ramadan */}
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded">GET</span>
              <h3 className="text-xl font-bold text-gray-900">Ramadan</h3>
            </div>
            <p className="text-gray-600 mb-6">All days of Ramadan in the given Gregorian year.</p>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Parameters</h4>
                <ParamTable rows={[
                  { name: 'scope', type: 'string', required: true, description: 'Must be "ramadan"' },
                  { name: 'year',  type: 'number', required: true, description: 'Year (YYYY)' },
                  { name: 'config', type: 'JSON', required: false, description: 'MasjidConfig (URL-encoded). Defaults to ICCF.' },
                  { name: 'groupByInterval', type: 'boolean', required: false, description: 'Group by interval (handles cross-month Ramadan).' },
                ]}/>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Examples</h4>
                <div className="space-y-2">
                  <Example id="ramadan-1" url={`${base}?scope=ramadan&year=${currentYear}`} />
                  <Example id="ramadan-2" url={`${base}?scope=ramadan&year=${currentYear}&groupByInterval=true`} />
                </div>
              </div>
            </div>
          </div>

          {/* Year */}
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded">GET</span>
              <h3 className="text-xl font-bold text-gray-900">Year</h3>
            </div>
            <p className="text-gray-600 mb-6">Prayer times for an entire year, month by month. Fans out 12 Aladhan requests — can be slow.</p>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Parameters</h4>
                <ParamTable rows={[
                  { name: 'scope', type: 'string', required: true, description: 'Must be "year"' },
                  { name: 'year',  type: 'number', required: true, description: 'Year (YYYY)' },
                  { name: 'config', type: 'JSON', required: false, description: 'MasjidConfig (URL-encoded). Defaults to ICCF.' },
                  { name: 'groupByInterval', type: 'boolean', required: false, description: 'Group each month by interval.' },
                ]}/>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Examples</h4>
                <div className="space-y-2">
                  <Example id="year-1" url={`${base}?scope=year&year=${currentYear}`} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PDF Endpoints */}
        <section className="space-y-8 mt-8">
          <h2 className="text-3xl font-bold text-gray-900">PDF Endpoints</h2>
          <p className="text-gray-600 -mt-4">Each PDF endpoint returns <code className="font-mono bg-gray-100 px-1 rounded">application/pdf</code> with <code className="font-mono bg-gray-100 px-1 rounded">Content-Disposition: attachment; filename=&quot;&lt;slug&gt;-&lt;kind&gt;-&lt;year&gt;.pdf&quot;</code>.</p>

          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded">GET</span>
              <h3 className="text-xl font-bold text-gray-900">Full Daily Schedule (PDF)</h3>
            </div>
            <p className="text-gray-600 mb-6">A year of athan times rendered as a printable PDF.</p>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Parameters</h4>
                <ParamTable rows={[
                  { name: 'year', type: 'number', required: false, description: 'Year (YYYY). Defaults to current year.' },
                  { name: 'config', type: 'JSON', required: false, description: 'MasjidConfig (URL-encoded). Defaults to ICCF.' },
                ]}/>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Example</h4>
                <Example id="pdf-full" url={pdfFull} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded">GET</span>
              <h3 className="text-xl font-bold text-gray-900">Iqama Interval Schedule (PDF)</h3>
            </div>
            <p className="text-gray-600 mb-6">A compact iqama schedule grouped into intervals (the format printed for the masjid wall).</p>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Parameters</h4>
                <ParamTable rows={[
                  { name: 'year', type: 'number', required: false, description: 'Year (YYYY). Defaults to current year.' },
                  { name: 'config', type: 'JSON', required: false, description: 'MasjidConfig (URL-encoded). Defaults to ICCF.' },
                ]}/>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Example</h4>
                <Example id="pdf-iqama" url={pdfIqama} />
              </div>
            </div>
          </div>
        </section>

        {/* Response Structure */}
        <section className="bg-white rounded-lg shadow-md p-8 mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Response Structure</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Prayer Object</h3>
              <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre>{`{ "name": "Fajr", "athan": "6:06 AM", "iqama": "6:30 AM" }`}</pre>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Prayer names: <span className="font-mono">Fajr</span>, <span className="font-mono">Dhuhr</span>, <span className="font-mono">Asr</span>, <span className="font-mono">Maghrib</span>, <span className="font-mono">Isha</span>. With <code className="font-mono">includeRaw=true</code>, each entry also includes <code className="font-mono">athanRaw</code> and <code className="font-mono">iqamaRaw</code> as 24-hour HH:MM strings.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Date Object</h3>
              <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre>{`{
  "gregorian": "${currentYear}-03-10",
  "gregorianFormatted": "Tuesday, March 10, ${currentYear}",
  "hijri": "21 Ramaḍān 1447"
}`}</pre>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Interval Format</h3>
              <p className="text-gray-600 mb-3">All responses include an <span className="font-mono bg-gray-100 px-1 rounded">interval</span> field showing which interval each date belongs to.</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-blue-50 text-blue-900 px-2 py-1 rounded text-sm">Mar 8–19</span>
                  <span className="text-sm text-gray-600">Standard interval format</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-blue-50 text-blue-900 px-2 py-1 rounded text-sm">Feb 18 – Mar 19</span>
                  <span className="text-sm text-gray-600">Cross-month interval (Ramadan)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-blue-50 text-blue-900 px-2 py-1 rounded text-sm">Mar 20–20</span>
                  <span className="text-sm text-gray-600">Single-day interval</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Code Examples */}
        <section className="bg-white rounded-lg shadow-md p-8 mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Code Examples</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">JavaScript / TypeScript (default = ICCF)</h3>
              <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre>{`const res = await fetch('${base}?scope=day');
const data = await res.json();
if (data.success) console.log(data.data.today);`}</pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">JavaScript / TypeScript (custom masjid)</h3>
              <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre>{`const config = ${JSON.stringify(OTHER_MASJID_EXAMPLE, null, 2)};

const url = new URL('${base}');
url.searchParams.set('scope', 'day');
url.searchParams.set('config', JSON.stringify(config));

const res = await fetch(url);
const data = await res.json();`}</pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Python</h3>
              <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre>{`import requests, json

# Default (ICCF)
r = requests.get('${base}', params={'scope': 'ramadan', 'year': ${currentYear}})

# Custom masjid
config = {...}  # your MasjidConfig dict
r = requests.get('${base}', params={
  'scope': 'day',
  'config': json.dumps(config),
})`}</pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">cURL</h3>
              <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre>{`# Default (ICCF)
curl "${base}?scope=day" | jq

# Specific month
curl "${base}?scope=month&month=3&year=${currentYear}" | jq

# Download an iqama-schedule PDF
curl "${pdfIqama}?year=${currentYear}" -o iqama.pdf`}</pre>
              </div>
            </div>
          </div>
        </section>

        {/* Error Handling */}
        <section className="bg-white rounded-lg shadow-md p-8 mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Error Handling</h2>
          <p className="text-gray-600 mb-4">All errors return JSON with <code className="font-mono bg-gray-100 px-1 rounded">success: false</code>.</p>

          <h3 className="font-semibold text-gray-900 mb-2">Upstream / runtime errors</h3>
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre>{`{ "success": false, "error": "Failed to fetch prayer times" }`}</pre>
          </div>

          <h3 className="font-semibold text-gray-900 mt-6 mb-2">Config validation (HTTP 400)</h3>
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre>{`{
  "success": false,
  "error": {
    "code": "INVALID_CONFIG",
    "field": "timezone",
    "message": "must be a valid IANA timezone identifier"
  }
}`}</pre>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-600">
          <p>Prayer Times API · v1</p>
          <p className="text-sm mt-2">
            Source: <a href="https://github.com/mfs780/prayer-times-api" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">github.com/mfs780/prayer-times-api</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
