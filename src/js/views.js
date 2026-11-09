import { $, $$, esc, flag, flagImg, fmt, toDate, heart, spinner, registry, toast, loading } from './core.js';

const CITIES = { EG: ['Cairo', 'Alexandria', 'Giza', 'Luxor'], US: ['New York', 'Los Angeles', 'Chicago'], GB: ['London', 'Manchester'], FR: ['Paris', 'Lyon'],
  DE: ['Berlin', 'Munich'], ES: ['Madrid', 'Barcelona'], IT: ['Rome', 'Milan'], AE: ['Dubai', 'Abu Dhabi'], SA: ['Riyadh', 'Jeddah'], TR: ['Istanbul', 'Ankara'],
  JP: ['Tokyo', 'Osaka'], CA: ['Toronto', 'Vancouver'] };
const WX = c => c === 0 ? ['Clear sky', 'fa-sun', 'weather-sunny'] : c <= 2 ? ['Partly cloudy', 'fa-cloud-sun', 'weather-sunny'] : c === 3 ? ['Overcast', 'fa-cloud', 'weather-cloudy']
  : c <= 48 ? ['Fog', 'fa-smog', 'weather-foggy'] : c <= 57 ? ['Drizzle', 'fa-cloud-rain', 'weather-rainy'] : c <= 67 ? ['Rain', 'fa-cloud-showers-heavy', 'weather-rainy']
  : c <= 77 ? ['Snow', 'fa-snowflake', 'weather-snowy'] : c <= 82 ? ['Showers', 'fa-cloud-showers-heavy', 'weather-rainy'] : ['Thunderstorm', 'fa-bolt', 'weather-stormy'];

const saveBtn = (p, cls, label) => { registry.set(p.id, p); return `<button class="${cls}" data-save="${esc(p.id)}"${label ? ' data-label="1"' : ''}>${heart(window.app.plans.has(p.id))}${label ? ' ' + (window.app.plans.has(p.id) ? 'Saved' : 'Save') : ''}</button>`; };
const empty = (icon, title, msg) => `<div class="empty-state"><div class="empty-icon"><i class="fa-solid ${icon}"></i></div><h3>${title}</h3><p>${msg}</p></div>`;

class View {
  constructor(app, id, box) { this.app = app; this.id = id; this.box = $(box); this.dirty = true; }
  async show() {
    if (!this.dirty) return;
    this.dirty = false;
    this.box.innerHTML = spinner();
    try { await this.render(); } catch (e) { this.fail(e); }
  }
  fail(e) {
    this.dirty = true;
    this.box.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><h3>Something went wrong</h3><p>${esc(e.message)}</p><button class="btn-primary" data-retry><i class="fa-solid fa-rotate-right"></i> Retry</button></div>`;
    $('[data-retry]', this.box).onclick = () => this.show();
  }
}

export class DashboardView {
  constructor(app) { this.app = app; this.clock = null; }
  async init() {
    const { nager } = this.app.api, s = this.app.store.get();
    const list = (await nager.countries()).sort((a, b) => a.name.localeCompare(b.name));
    $('#global-country').innerHTML = '<option value="">Select Country</option>' + list.map(c => `<option value="${c.countryCode}">${flag(c.countryCode)} ${esc(c.name)}</option>`).join('');
    $('#global-country').value = s.country;
    const y = new Date().getFullYear();
    $('#global-year').innerHTML = [y - 1, y, y + 1, y + 2].map(v => `<option value="${v}">${v}</option>`).join('');
    $('#global-year').value = s.year;
    $('#stat-countries').textContent = list.length;
    $('#global-country').onchange = async e => { if (e.target.value) this.fillCities(e.target.value, await this.app.api.countries.byCode(e.target.value).catch(() => null)); };
    $('#global-search-btn').onclick = () => {
      const country = $('#global-country').value;
      if (!country) return toast('warning', 'Please select a country');
      this.app.select({ country, city: $('#global-city').value, year: +$('#global-year').value });
      toast('success', 'Destination updated');
    };
    $('#clear-selection-btn').onclick = () => this.app.select({ country: 'EG', city: 'Cairo', year: y });
  }
  fillCities(cc, info) {
    const cap = info?.capital?.[0], list = [...new Set([cap, ...(CITIES[cc] || [])].filter(Boolean))];
    $('#global-city').innerHTML = list.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }
  async renderInfo() {
    const s = this.app.store.get();
    $('#global-country').value = s.country; $('#global-year').value = s.year;
    const box = $('#dashboard-country-info');
    box.innerHTML = spinner('Loading country info...');
    try {
      const i = s.info = await this.app.api.countries.byCode(s.country);
      this.fillCities(s.country, i); $('#global-city').value = s.city;
      if ($('#global-city').value !== s.city) s.city = $('#global-city').value;
      $('#selected-country-flag').src = flagImg(s.country, 80);
      $('#selected-country-name').textContent = i.name.common; $('#selected-city-name').textContent = '• ' + s.city;
      const cur = Object.entries(i.currencies || {}).map(([c, v]) => `${esc(v.name)} (${c} ${esc(v.symbol || '')})`);
      const tz = i.timezones?.[0] || 'UTC', det = (ic, l, v) => `<div class="dashboard-country-detail"><i class="fa-solid ${ic}"></i><span class="label">${l}</span><span class="value">${esc(v)}</span></div>`;
      const code = (i.idd?.root || '') + (i.idd?.suffixes?.length === 1 ? i.idd.suffixes[0] : '');
      box.innerHTML = `
        <div class="dashboard-country-header"><img src="${flagImg(s.country, 160)}" alt="${esc(i.name.common)}" class="dashboard-country-flag">
          <div class="dashboard-country-title"><h3>${esc(i.name.common)}</h3><p class="official-name">${esc(i.name.official)}</p>
          <span class="region"><i class="fa-solid fa-location-dot"></i> ${esc(i.region)}${i.subregion ? ' • ' + esc(i.subregion) : ''}</span></div></div>
        <div class="dashboard-local-time"><div class="local-time-display"><i class="fa-solid fa-clock"></i><span class="local-time-value" id="country-local-time"></span><span class="local-time-zone">${esc(tz)}</span></div></div>
        <div class="dashboard-country-grid">
          ${det('fa-building-columns', 'Capital', i.capital?.[0] || 'N/A')}${det('fa-users', 'Population', i.population.toLocaleString())}
          ${det('fa-ruler-combined', 'Area', (i.area || 0).toLocaleString() + ' km²')}${det('fa-globe', 'Continent', i.continents?.[0] || i.region)}
          ${det('fa-phone', 'Calling Code', code || 'N/A')}${det('fa-car', 'Driving Side', (i.car?.side || '').replace(/^./, c => c.toUpperCase()) || 'N/A')}
          ${det('fa-calendar-week', 'Week Starts', (i.startOfWeek || 'monday').replace(/^./, c => c.toUpperCase()))}</div>
        <div class="dashboard-country-extras">
          <div class="dashboard-country-extra"><h4><i class="fa-solid fa-coins"></i> Currency</h4><div class="extra-tags">${cur.map(c => `<span class="extra-tag">${c}</span>`).join('') || 'N/A'}</div></div>
          <div class="dashboard-country-extra"><h4><i class="fa-solid fa-language"></i> Languages</h4><div class="extra-tags">${Object.values(i.languages || {}).map(l => `<span class="extra-tag">${esc(l)}</span>`).join('') || 'N/A'}</div></div>
          <div class="dashboard-country-extra"><h4><i class="fa-solid fa-map-location-dot"></i> Neighbors</h4><div class="extra-tags">${(i.borders || []).map(b => `<span class="extra-tag border-tag">${b}</span>`).join('') || 'None (island or no land borders)'}</div></div></div>
        <div class="dashboard-country-actions"><a href="${esc(i.maps?.googleMaps || '#')}" target="_blank" rel="noopener" class="btn-map-link"><i class="fa-solid fa-map"></i> View on Google Maps</a></div>`;
      this.startClock(tz);
      this.app.api.nager.holidays(s.year, s.country).then(h => { $('#stat-holidays').textContent = h.length; }).catch(() => { $('#stat-holidays').textContent = '–'; });
    } catch (e) {
      box.innerHTML = `<div class="empty-state"><h3>Could not load country info</h3><p>${esc(e.message)}</p><button class="btn-primary" id="dash-retry">Retry</button></div>`;
      $('#dash-retry').onclick = () => this.renderInfo();
    }
  }
  startClock(tz) {
    clearInterval(this.clock);
    const m = /UTC([+-])(\d\d):?(\d\d)?/.exec(tz), off = m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0)) : 0;
    const tick = () => { const el = $('#country-local-time'); if (el) el.textContent = new Date(Date.now() + off * 6e4).toLocaleTimeString('en-US', { timeZone: 'UTC' }); };
    tick(); this.clock = setInterval(tick, 1000);
  }
}

export class HolidaysView extends View {
  constructor(app) { super(app, 'holidays', '#holidays-content'); }
  async render() {
    const s = this.app.store.get(), list = await this.app.api.nager.holidays(s.year, s.country);
    this.box.innerHTML = list.map(h => {
      const p = { id: `h-${s.country}-${h.date}-${h.name}`, type: 'holiday', title: h.localName, sub: h.name, date: h.date, country: s.country };
      return `<div class="holiday-card"><div class="holiday-card-header"><div class="holiday-date-box"><span class="day">${toDate(h.date).getDate()}</span><span class="month">${fmt(h.date, { month: 'short' })}</span></div>${saveBtn(p, 'holiday-action-btn')}</div>
        <h3>${esc(h.localName)}</h3><p class="holiday-name">${esc(h.name)}</p>
        <div class="holiday-card-footer"><span class="holiday-day-badge"><i class="fa-regular fa-calendar"></i> ${fmt(h.date, { weekday: 'long' })}</span><span class="holiday-type-badge">${esc(h.types?.[0] || 'Public')}</span></div></div>`;
    }).join('') || empty('fa-calendar-xmark', 'No holidays found', 'Nothing returned for this country and year.');
  }
}

export class LongWeekendsView extends View {
  constructor(app) { super(app, 'long-weekends', '#lw-content'); }
  async render() {
    const s = this.app.store.get(), list = await this.app.api.nager.longWeekends(s.year, s.country);
    this.box.innerHTML = list.map((w, n) => {
      const days = []; for (let d = toDate(w.startDate); d <= toDate(w.endDate); d = new Date(d.getTime() + 864e5)) days.push(new Date(d));
      const p = { id: `lw-${s.country}-${w.startDate}`, type: 'longweekend', title: `Long Weekend #${n + 1}`, sub: `${fmt(w.startDate)} - ${fmt(w.endDate)}, ${s.year}`, date: w.startDate, country: s.country };
      return `<div class="lw-card"><div class="lw-card-header"><span class="lw-badge"><i class="fa-solid fa-calendar-days"></i> ${w.dayCount} Days</span>${saveBtn(p, 'holiday-action-btn')}</div>
        <h3>Long Weekend #${n + 1}</h3><div class="lw-dates"><i class="fa-regular fa-calendar"></i> ${fmt(w.startDate)} - ${fmt(w.endDate)}, ${s.year}</div>
        ${w.needBridgeDay ? '<div class="lw-info-box warning"><i class="fa-solid fa-info-circle"></i> Requires taking a bridge day off</div>' : '<div class="lw-info-box success"><i class="fa-solid fa-check-circle"></i> No extra days off needed!</div>'}
        <div class="lw-days-visual">${days.map(d => `<div class="lw-day${[0, 6].includes(d.getDay()) ? ' weekend' : ''}"><span class="name">${d.toLocaleDateString('en-US', { weekday: 'short' })}</span><span class="num">${d.getDate()}</span></div>`).join('')}</div></div>`;
    }).join('') || empty('fa-umbrella-beach', 'No long weekends', 'No long weekends found for this country and year.');
  }
}

export class EventsView extends View {
  constructor(app) { super(app, 'events', '#events-content'); }
  async render() {
    const s = this.app.store.get(), { events, mock } = await this.app.api.events.search(s.city, s.country);
    const note = mock ? `<div class="empty-state" style="grid-column:1/-1"><p><i class="fa-solid fa-circle-info"></i> Showing sample events. Paste a Ticketmaster API key to load real events.</p><input id="tm-key" class="form-select" placeholder="Ticketmaster API key" style="max-width:320px"> <button class="btn-primary" id="tm-key-save">Save key</button></div>` : '';
    this.box.innerHTML = note + events.map(e => {
      const p = { id: `e-${e.id}`, type: 'event', title: e.name, sub: `${e.venue}`, date: e.date, country: s.country };
      return `<div class="event-card"><div class="event-card-image"><img src="${esc(e.image || '')}" alt="${esc(e.name)}" loading="lazy" onerror="this.style.display='none'"><span class="event-card-category">${esc(e.category)}</span>${saveBtn(p, 'event-card-save')}</div>
        <div class="event-card-body"><h3>${esc(e.name)}</h3><div class="event-card-info"><div><i class="fa-regular fa-calendar"></i>${e.date ? fmt(e.date, { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}${e.time ? ' at ' + e.time : ''}</div><div><i class="fa-solid fa-location-dot"></i>${esc(e.venue)}</div></div>
        <div class="event-card-footer">${saveBtn(p, 'btn-event', true)}<a href="${esc(e.url || '#')}" target="_blank" rel="noopener" class="btn-buy-ticket"><i class="fa-solid fa-ticket"></i> Buy Tickets</a></div></div></div>`;
    }).join('') || empty('fa-ticket', 'No events found', 'Try another city.');
    $('#stat-events').textContent = events.length + (mock ? '' : '+');
    const b = $('#tm-key-save');
    if (b) b.onclick = () => { const k = $('#tm-key').value.trim(); if (!k) return toast('warning', 'Enter a key first'); try { localStorage.setItem('wl_tm_key', k); } catch { /* ignore */ } this.dirty = true; this.show(); };
  }
}

export class WeatherView extends View {
  constructor(app) { super(app, 'weather', '#weather-content'); }
  async render() {
    const c = await this.app.coords(), w = await this.app.api.weather.forecast(c.lat, c.lng), cur = w.current, d = w.daily;
    const [txt, ic, cls] = WX(cur.weather_code), t = Math.round;
    const i0 = Math.max(0, w.hourly.time.findIndex(x => x >= cur.time.slice(0, 13)));
    this.box.innerHTML = `
      <div class="weather-hero-card ${cls}"><div class="weather-location"><i class="fa-solid fa-location-dot"></i><span>${esc(this.app.store.get().city)}</span><span class="weather-time">${fmt(cur.time, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span></div>
        <div class="weather-hero-main"><div class="weather-hero-left"><div class="weather-hero-icon"><i class="fa-solid ${ic}"></i></div><div class="weather-hero-temp"><span class="temp-value">${t(cur.temperature_2m)}</span><span class="temp-unit">°C</span></div></div>
        <div class="weather-hero-right"><div class="weather-condition">${txt}</div><div class="weather-feels">Feels like ${t(cur.apparent_temperature)}°C</div>
        <div class="weather-high-low"><span class="high"><i class="fa-solid fa-arrow-up"></i> ${t(d.temperature_2m_max[0])}°</span><span class="low"><i class="fa-solid fa-arrow-down"></i> ${t(d.temperature_2m_min[0])}°</span></div></div></div></div>
      <div class="weather-details-grid">${[['humidity', 'fa-droplet', 'Humidity', cur.relative_humidity_2m + '%'], ['wind', 'fa-wind', 'Wind', t(cur.wind_speed_10m) + ' km/h'], ['uv', 'fa-sun', 'UV Index', t(d.uv_index_max[0])], ['precip', 'fa-cloud-rain', 'Precipitation', (d.precipitation_probability_max[0] ?? 0) + '%']]
        .map(([k, i, l, v]) => `<div class="weather-detail-card"><div class="detail-icon ${k}"><i class="fa-solid ${i}"></i></div><div class="detail-info"><span class="detail-label">${l}</span><span class="detail-value">${v}</span></div></div>`).join('')}</div>
      <div class="weather-section"><h3 class="weather-section-title"><i class="fa-solid fa-clock"></i> Hourly Forecast</h3><div class="hourly-scroll">
        ${w.hourly.time.slice(i0, i0 + 9).map((h, k) => `<div class="hourly-item${k ? '' : ' now'}"><span class="hourly-time">${k ? toDate(h).toLocaleTimeString('en-US', { hour: 'numeric' }) : 'Now'}</span><div class="hourly-icon"><i class="fa-solid ${WX(w.hourly.weather_code[i0 + k])[1]}"></i></div><span class="hourly-temp">${t(w.hourly.temperature_2m[i0 + k])}°</span></div>`).join('')}</div></div>
      <div class="weather-section"><h3 class="weather-section-title"><i class="fa-solid fa-calendar-week"></i> 7-Day Forecast</h3><div class="forecast-list">
        ${d.time.map((day, k) => `<div class="forecast-day${k ? '' : ' today'}"><div class="forecast-day-name"><span class="day-label">${k ? fmt(day, { weekday: 'short' }) : 'Today'}</span><span class="day-date">${fmt(day)}</span></div><div class="forecast-icon"><i class="fa-solid ${WX(d.weather_code[k])[1]}"></i></div><div class="forecast-temps"><span class="temp-max">${t(d.temperature_2m_max[k])}°</span><span class="temp-min">${t(d.temperature_2m_min[k])}°</span></div><div class="forecast-precip">${d.precipitation_probability_max[k] > 0 ? `<i class="fa-solid fa-droplet"></i><span>${d.precipitation_probability_max[k]}%</span>` : ''}</div></div>`).join('')}</div></div>`;
  }
}

export class SunView extends View {
  constructor(app) { super(app, 'sun-times', '#sun-times-content'); }
  async render() {
    const c = await this.app.coords(), w = await this.app.api.weather.forecast(c.lat, c.lng), tz = w.timezone;
    const date = w.current.time.slice(0, 10), r = await this.app.api.sun.day(c.lat, c.lng, date);
    const tm = iso => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: tz });
    const len = r.day_length, h = Math.floor(len / 3600), m = Math.floor(len % 3600 / 60), pct = (len / 864).toFixed(1);
    const card = (k, ic, l, v, sub) => `<div class="sun-time-card ${k}"><div class="icon"><i class="fa-solid ${ic}"></i></div><div class="label">${l}</div><div class="time">${v}</div><div class="sub-label">${sub}</div></div>`;
    this.box.innerHTML = `<div class="sun-main-card"><div class="sun-main-header"><div class="sun-location"><h2><i class="fa-solid fa-location-dot"></i> ${esc(this.app.store.get().city)}</h2><p>Sun times for your selected location</p></div>
      <div class="sun-date-display"><div class="date">${fmt(date, { month: 'long', day: 'numeric', year: 'numeric' })}</div><div class="day">${fmt(date, { weekday: 'long' })}</div></div></div>
      <div class="sun-times-grid">${card('dawn', 'fa-moon', 'Dawn', tm(r.civil_twilight_begin), 'Civil Twilight')}${card('sunrise', 'fa-sun', 'Sunrise', tm(r.sunrise), 'Golden Hour Start')}${card('noon', 'fa-sun', 'Solar Noon', tm(r.solar_noon), 'Sun at Highest')}
      ${card('sunset', 'fa-sun', 'Sunset', tm(r.sunset), 'Golden Hour End')}${card('dusk', 'fa-moon', 'Dusk', tm(r.civil_twilight_end), 'Civil Twilight')}${card('daylight', 'fa-hourglass-half', 'Day Length', `${h}h ${m}m`, 'Total Daylight')}</div></div>
      <div class="day-length-card"><h3><i class="fa-solid fa-chart-pie"></i> Daylight Distribution</h3><div class="day-progress"><div class="day-progress-bar"><div class="day-progress-fill" style="width:${pct}%"></div></div></div>
      <div class="day-length-stats"><div class="day-stat"><div class="value">${h}h ${m}m</div><div class="label">Daylight</div></div><div class="day-stat"><div class="value">${pct}%</div><div class="label">of 24 Hours</div></div><div class="day-stat"><div class="value">${Math.floor((86400 - len) / 3600)}h ${Math.floor((86400 - len) % 3600 / 60)}m</div><div class="label">Darkness</div></div></div></div>`;
  }
}

export class CurrencyView extends View {
  constructor(app) { super(app, 'currency', '#currency-result'); this.rates = null; this.ready = false; }
  async render() {
    const d = await this.app.api.currency.latest('USD'); this.rates = d.rates; this.updated = d.time_last_update_utc;
    const names = new Intl.DisplayNames(['en'], { type: 'currency' }), codes = Object.keys(this.rates).sort();
    const opts = codes.map(c => `<option value="${c}">${c} - ${esc((() => { try { return names.of(c); } catch { return c; } })())}</option>`).join('');
    $('#currency-from').innerHTML = opts; $('#currency-to').innerHTML = opts;
    const own = Object.keys(this.app.store.get().info?.currencies || {})[0];
    $('#currency-from').value = 'USD'; $('#currency-to').value = this.rates[own] ? own : 'EGP';
    if (!this.ready) {
      this.ready = true;
      $('#convert-btn').onclick = () => this.convert();
      $('#swap-currencies-btn').onclick = () => { const f = $('#currency-from'), t = $('#currency-to'); [f.value, t.value] = [t.value, f.value]; this.convert(); };
      $('#currency-amount').oninput = () => this.convert();
      $('#currency-from').onchange = $('#currency-to').onchange = () => this.convert();
    }
    this.convert();
  }
  convert() {
    if (!this.rates) return;
    const amt = Math.max(0, parseFloat($('#currency-amount').value) || 0), f = $('#currency-from').value, t = $('#currency-to').value, rate = this.rates[t] / this.rates[f];
    const n = (v, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    this.box.innerHTML = `<div class="conversion-display"><div class="conversion-from"><span class="amount">${n(amt)}</span><span class="currency-code">${f}</span></div><div class="conversion-equals"><i class="fa-solid fa-equals"></i></div><div class="conversion-to"><span class="amount">${n(amt * rate)}</span><span class="currency-code">${t}</span></div></div>
      <div class="exchange-rate-info"><p>1 ${f} = ${n(rate, 4)} ${t}</p><small>Last updated: ${esc(this.updated || '')}</small></div>`;
    const names = new Intl.DisplayNames(['en'], { type: 'currency' });
    $('#popular-currencies').innerHTML = ['USD', 'EUR', 'GBP', 'EGP', 'AED', 'SAR', 'JPY', 'CAD', 'INR'].filter(c => c !== f && this.rates[c]).slice(0, 8)
      .map(c => `<div class="popular-currency-card"><img src="${flagImg(c.slice(0, 2), 40)}" alt="${c}" class="flag"><div class="info"><div class="code">${c}</div><div class="name">${esc(names.of(c))}</div></div><div class="rate">${n(this.rates[c] / this.rates[f], 4)}</div></div>`).join('');
  }
}

const TYPES = { holiday: 'Holiday', event: 'Event', longweekend: 'Long Weekend' };
export class PlansView extends View {
  constructor(app) { super(app, 'my-plans', '#plans-content'); this.filter = 'all'; this.dirty = false; }
  async render() {
    const p = this.app.plans;
    $('#filter-all-count').textContent = p.count(); $('#filter-holiday-count').textContent = p.count('holiday');
    $('#filter-event-count').textContent = p.count('event'); $('#filter-lw-count').textContent = p.count('longweekend');
    $$('.plan-filter').forEach(b => b.classList.toggle('active', b.dataset.filter === this.filter));
    const items = p.items.filter(x => this.filter === 'all' || x.type === this.filter).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    this.box.innerHTML = items.map(x => `<div class="holiday-card"><div class="holiday-card-header"><div class="holiday-date-box"><span class="day">${x.date ? toDate(x.date).getDate() : '–'}</span><span class="month">${x.date ? fmt(x.date, { month: 'short' }) : ''}</span></div>
      <button class="holiday-action-btn" data-remove="${esc(x.id)}" title="Remove"><i class="fa-solid fa-trash"></i></button></div><h3>${esc(x.title)}</h3><p class="holiday-name">${esc(x.sub || '')}</p>
      <div class="holiday-card-footer"><span class="holiday-day-badge">${x.country ? flag(x.country) : ''} ${esc(x.country || '')}</span><span class="holiday-type-badge">${TYPES[x.type] || x.type}</span></div></div>`).join('')
      || `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-heart-crack"></i></div><h3>No Saved Plans Yet</h3><p>Start exploring and save holidays, events, or long weekends you like!</p><button class="btn-primary" id="start-exploring-btn" data-view="holidays"><i class="fa-solid fa-compass"></i> Start Exploring</button></div>`;
  }
  async refresh() { this.dirty = true; await this.show(); }
}
