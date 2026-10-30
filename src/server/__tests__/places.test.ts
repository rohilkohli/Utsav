import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchVendorsByCategory } from '../services/places.js';

function makeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Places service — searchVendorsByCategory', () => {
  describe('successful responses', () => {
    it('returns mapped PlaceSuggestion array from valid API response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({
        places: [{
          displayName: { text: 'Royal Banquet Hall' },
          formattedAddress: 'MG Road, Bengaluru',
          nationalPhoneNumber: '+91 98765 43210',
          rating: 4.5,
          googleMapsUri: 'https://maps.google.com/?cid=123',
          websiteUri: 'https://royalbanquet.in',
          businessStatus: 'OPERATIONAL',
        }],
      })));

      const results = await searchVendorsByCategory('venue', 'Bengaluru', 'test-key');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Royal Banquet Hall');
      expect(results[0].phone).toBe('+91 98765 43210');
      expect(results[0].rating).toBe(4.5);
      expect(results[0].address).toBe('MG Road, Bengaluru');
    });

    it('returns empty array when API returns no places', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({ places: [] })));
      const results = await searchVendorsByCategory('catering', 'Delhi', 'test-key');
      expect(results).toEqual([]);
    });

    it('returns empty array when API response has no "places" key', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({})));
      const results = await searchVendorsByCategory('photographer', 'Mumbai', 'test-key');
      expect(results).toEqual([]);
    });

    it('filters out permanently closed businesses', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({
        places: [
          { displayName: { text: 'Open Studio' }, businessStatus: 'OPERATIONAL' },
          { displayName: { text: 'Closed Hall' }, businessStatus: 'CLOSED_PERMANENTLY' },
        ],
      })));
      const results = await searchVendorsByCategory('venue', 'Pune', 'test-key');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Open Studio');
    });

    it('falls back to internationalPhoneNumber when nationalPhoneNumber is absent', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({
        places: [{ displayName: { text: 'Int Vendor' }, internationalPhoneNumber: '+91 22 1234 5678' }],
      })));
      const results = await searchVendorsByCategory('dj', 'Chennai', 'test-key');
      expect(results[0].phone).toBe('+91 22 1234 5678');
    });

    it('uses "Unknown" when displayName is absent', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({
        places: [{ formattedAddress: 'Some Road' }],
      })));
      const results = await searchVendorsByCategory('catering', 'Kolkata', 'test-key');
      expect(results[0].name).toBe('Unknown');
    });

    it('leaves phone undefined when no phone number fields exist', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({
        places: [{ displayName: { text: 'No Phone Vendor' } }],
      })));
      const results = await searchVendorsByCategory('makeup', 'Surat', 'test-key');
      expect(results[0].phone).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('throws an error when the API returns a non-OK status', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: vi.fn().mockResolvedValue('API key invalid'),
      }));
      await expect(searchVendorsByCategory('venue', 'Agra', 'bad-key')).rejects.toThrow(/403/);
    });

    it('throws when network fetch itself fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      await expect(searchVendorsByCategory('catering', 'Nagpur', 'test-key')).rejects.toThrow('Network error');
    });
  });

  describe('category query mapping', () => {
    it('maps "photographer" category to a wedding photographer query', async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeResponse({ places: [] }));
      vi.stubGlobal('fetch', fetchMock);
      await searchVendorsByCategory('photographer', 'Jaipur', 'test-key');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.textQuery).toContain('wedding photographer');
      expect(body.textQuery).toContain('Jaipur');
    });

    it('maps "catering" to a wedding catering query', async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeResponse({ places: [] }));
      vi.stubGlobal('fetch', fetchMock);
      await searchVendorsByCategory('catering service', 'Udaipur', 'test-key');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.textQuery).toContain('catering');
    });

    it('maps "mehendi" to a mehendi artist query', async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeResponse({ places: [] }));
      vi.stubGlobal('fetch', fetchMock);
      await searchVendorsByCategory('Mehendi Artist', 'Lucknow', 'test-key');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.textQuery).toContain('mehendi');
    });

    it('includes subEvent in query when provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeResponse({ places: [] }));
      vi.stubGlobal('fetch', fetchMock);
      await searchVendorsByCategory('decor', 'Varanasi', 'test-key', 'Sangeet');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.textQuery).toContain('Sangeet');
    });

    it('sends regionCode IN and languageCode en to target Indian results', async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeResponse({ places: [] }));
      vi.stubGlobal('fetch', fetchMock);
      await searchVendorsByCategory('venue', 'Mysore', 'test-key');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.regionCode).toBe('IN');
      expect(body.languageCode).toBe('en');
    });

    it('sends X-Goog-Api-Key header with the provided API key', async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeResponse({ places: [] }));
      vi.stubGlobal('fetch', fetchMock);
      await searchVendorsByCategory('venue', 'Kochi', 'my-secret-key');
      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers['X-Goog-Api-Key']).toBe('my-secret-key');
    });
  });
});
