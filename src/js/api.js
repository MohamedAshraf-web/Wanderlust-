// Paste your Ticketmaster key (from the Postman collection) here. Without it, Events fall back to mock data.
export const CONFIG = { TICKETMASTER_KEY: '' };

export class ApiError extends Error {
  constructor(type, msg) { super(msg); this.type = type; }
}

export class ApiClient {
  static cache = new Map();
  constructor(base) { this.base = base; }
  async get(path, { ttl = 300000, retries = 2 } = {}) {
    const url = this.base + path, hit = ApiClient.cache.get(url);
    if (hit && Date.now() - hit.t < ttl) return hit.d;
    for (let i = 0; ; i++) {
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
        const r = await fetch(url, { signal: ctl.signal });
        clearTimeout(t);
        if (r.status === 429) throw new ApiError('rate', 'Rate limit reached, try again soon');
        if (!r.ok) throw new ApiError('http', `Request failed (${r.status})`);
        const d = await r.json();
        ApiClient.cache.set(url, { t: Date.now(), d });
        return d;
      } catch (e) {
        if (i >= retries || e.type === 'rate') {
          if (hit) return hit.d; // stale cache beats nothing
          throw e.type ? e : new ApiError(e.name === 'AbortError' ? 'timeout' : 'network', e.name === 'AbortError' ? 'Request timed out' : 'Network problem, check your connection');
        }
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
      }
    }
  }
}

export class NagerClient extends ApiClient {
  constructor() { super('https://date.nager.at/api/v3'); }
  countries() { return this.get('/AvailableCountries', { ttl: 864e5 }); }
  holidays(y, cc) { return this.get(`/PublicHolidays/${y}/${cc}`); }
  longWeekends(y, cc) { return this.get(`/LongWeekend/${y}/${cc}`); }
}

export class CountryClient extends ApiClient {
  constructor() { super('https://countries.dev'); }
  async byCode(cc) {
    const d = await this.get(`/alpha/${encodeURIComponent(cc)}?full=true`, { ttl: 864e5 });
    const currencies = Object.fromEntries((d.currencies || []).map(c => [c.code, { name: c.name, symbol: c.symbol }]));
    const languages = Object.fromEntries((d.languages || []).map((l, i) => [l.iso639_1 || `lang${i}`, l.name]));
    const callingCode = d.callingCodes?.[0] || '';
    return {
      ...d,
      name: { common: d.name, official: d.name },
      capital: d.capital ? [d.capital] : [],
      currencies,
      languages,
      continents: d.region ? [d.region] : [],
      idd: { root: callingCode ? `+${callingCode}` : '', suffixes: [] },
      car: { side: d.car?.side || 'right' },
      maps: { googleMaps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.name)}` },
      flags: { png: d.flags?.png || d.flag, svg: d.flags?.svg || d.flag }
    };
  }
}

export class GeoClient extends ApiClient {
  constructor() { super('https://geocoding-api.open-meteo.com/v1'); }
  async find(city, cc) {
    const d = await this.get(`/search?name=${encodeURIComponent(city)}&count=1&countryCode=${cc}`, { ttl: 864e5 });
    const r = d.results?.[0];
    return r ? { lat: r.latitude, lng: r.longitude } : null;
  }
}

export class WeatherClient extends ApiClient {
  constructor() { super('https://api.open-meteo.com/v1'); }
  forecast(lat, lng) {
    return this.get(`/forecast?latitude=${lat}&longitude=${lng}&timezone=auto&forecast_days=7` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation` +
      `&hourly=temperature_2m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max`, { ttl: 600000 });
  }
}

export class EventsClient extends ApiClient {
  constructor() { super('https://app.ticketmaster.com/discovery/v2'); }
  async search(city, cc) {
    const key = EventsClient.key();
    if (key) {
      try {
        const d = await this.get(`/events.json?apikey=${encodeURIComponent(key)}&city=${encodeURIComponent(city)}&countryCode=${cc}&size=12&sort=date,asc`, { retries: 1 });
        const list = (d._embedded?.events || []).map(e => ({
          id: e.id, name: e.name, date: e.dates?.start?.localDate, time: e.dates?.start?.localTime?.slice(0, 5),
          category: e.classifications?.[0]?.segment?.name || 'Event', image: e.images?.[0]?.url,
          venue: e._embedded?.venues?.[0]?.name || city, url: e.url
        }));
        if (list.length) return { mock: false, events: list };
      } catch { /* fall through to mock */ }
    }
    return { mock: true, events: EventsClient.mock(city) };
  }
  static key() { try { return CONFIG.TICKETMASTER_KEY || localStorage.getItem('wl_tm_key') || ''; } catch { return CONFIG.TICKETMASTER_KEY; } }
  static mock(city) {
    const img = id => `https://images.unsplash.com/${id}?w=400&h=200&fit=crop`;
    const base = [['Jazz Night Live', 'Music', 'photo-1493225457124-a3eb161ffa5f', 'Opera House'],
      ['Football Match', 'Sports', 'photo-1461896836934-ffe607ba8211', 'City Stadium'],
      ['Theatre Play', 'Arts', 'photo-1507676184212-d03ab07a01bf', 'Cultural Center'],
      ['Symphony Orchestra', 'Music', 'photo-1514320291840-2e0a9bf2a9ae', 'Opera House']];
    return base.map(([n, category, image, v], i) => {
      const d = new Date(Date.now() + (7 + i * 9) * 864e5);
      return { id: `mock-${city}-${i}`, name: `${n} in ${city}`, date: d.toISOString().slice(0, 10), time: '20:00', category, image: img(image), venue: `${city} ${v}`, url: '#' };
    });
  }
}

export class CurrencyClient extends ApiClient {
  constructor() { super('https://open.er-api.com/v6'); }
  latest(base = 'USD') { return this.get(`/latest/${base}`, { ttl: 3600000 }); }
}

export class SunClient extends ApiClient {
  constructor() { super('https://api.sunrise-sunset.org'); }
  async day(lat, lng, date) {
    const d = await this.get(`/json?lat=${lat}&lng=${lng}&date=${date}&formatted=0`);
    if (d.status !== 'OK') throw new ApiError('http', 'Sun data unavailable');
    return d.results;
  }
}
