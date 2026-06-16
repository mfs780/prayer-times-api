import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-md p-8 sm:p-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Prayer Times API</h1>
        <p className="mt-3 text-gray-600">
          Multi-tenant prayer times + iqama API. Calls without a{' '}
          <code className="font-mono bg-gray-100 px-1 rounded text-sm">config</code>{' '}
          param return ICCF (Islamic Foundation of Clovis and Fresno) data.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/api-docs"
            className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            View API Docs →
          </Link>
          <a
            href="/api/v1/prayer-times?scope=day"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Try a request
          </a>
          <a
            href="https://github.com/mfs780/prayer-times-api"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-5 py-2.5 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            GitHub
          </a>
        </div>

        <div className="mt-10 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Endpoints</h2>
          <ul className="mt-3 space-y-2 font-mono text-sm text-gray-700">
            <li><span className="text-green-700 font-semibold">GET/POST</span> /api/v1/prayer-times</li>
            <li><span className="text-green-700 font-semibold">GET/POST</span> /api/v1/pdf/full-schedule</li>
            <li><span className="text-green-700 font-semibold">GET/POST</span> /api/v1/pdf/iqama-schedule</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
