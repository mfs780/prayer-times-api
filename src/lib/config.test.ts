import { describe, test, expect } from '@jest/globals';
import { parseMasjidRequest, DEFAULT_MASJID_CONFIG, ConfigError } from '@/lib/config';

function get(url: string): Request {
  return new Request(url, { method: 'GET' });
}

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('parseMasjidRequest', () => {
  describe('default config fallback', () => {
    test('GET with no config returns DEFAULT_MASJID_CONFIG (ICCF)', async () => {
      const { config, params } = await parseMasjidRequest(get('http://x/api/v1/prayer-times?scope=day'));
      expect(config).toEqual(DEFAULT_MASJID_CONFIG);
      expect(config.slug).toBe('iccf');
      expect(params.scope).toBe('day');
    });

    test('POST with no config field returns DEFAULT_MASJID_CONFIG', async () => {
      const { config, params } = await parseMasjidRequest(post('http://x/api/v1/prayer-times', { params: { scope: 'month', month: '3', year: '2026' } }));
      expect(config).toEqual(DEFAULT_MASJID_CONFIG);
      expect(params.scope).toBe('month');
      expect(params.month).toBe('3');
    });
  });

  describe('explicit config', () => {
    test('GET with valid config overrides default', async () => {
      const cfg = { ...DEFAULT_MASJID_CONFIG, slug: 'other', name: 'Other Masjid' };
      const url = `http://x/api/v1/prayer-times?scope=day&config=${encodeURIComponent(JSON.stringify(cfg))}`;
      const { config } = await parseMasjidRequest(get(url));
      expect(config.slug).toBe('other');
      expect(config.name).toBe('Other Masjid');
    });

    test('GET with malformed config still throws', async () => {
      const url = `http://x/api/v1/prayer-times?scope=day&config=${encodeURIComponent('{"bad":')}`;
      await expect(parseMasjidRequest(get(url))).rejects.toThrow(ConfigError);
    });

    test('GET with invalid slug still throws ConfigError on slug field', async () => {
      const bad = { ...DEFAULT_MASJID_CONFIG, slug: 'BAD SLUG' };
      const url = `http://x/api/v1/prayer-times?scope=day&config=${encodeURIComponent(JSON.stringify(bad))}`;
      try {
        await parseMasjidRequest(get(url));
        throw new Error('expected ConfigError');
      } catch (e) {
        expect(e).toBeInstanceOf(ConfigError);
        expect((e as ConfigError).field).toBe('slug');
      }
    });
  });
});
