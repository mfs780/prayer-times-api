export default function Home() {
  return (
    <pre style={{ padding: 24, fontFamily: 'ui-monospace, monospace' }}>
{`prayer-times-api

  GET  /api/v1/prayer-times?config=<url-encoded JSON>&scope=day|month|ramadan|year
  POST /api/v1/prayer-times              body: { config, params }

  GET  /api/v1/pdf/full-schedule?config=...&year=YYYY
  GET  /api/v1/pdf/iqama-schedule?config=...&year=YYYY

See README.md for the MasjidConfig shape.`}
    </pre>
  );
}
