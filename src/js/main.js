import { NagerClient, CountryClient, GeoClient, WeatherClient, EventsClient, CurrencyClient, SunClient } from './api.js';
import { $, $$, esc, flagImg, heart, toast, loading, registry, Store, PlanManager, Router } from './core.js';
import { DashboardView, HolidaysView, LongWeekendsView, EventsView, WeatherView, SunView, CurrencyView, PlansView } from './views.js';

const ROUTES = {
  dashboard: ['Dashboard', 'Welcome back! Ready to plan your next adventure?'],
  holidays: ['Holidays', 'Public holidays for your destination'],
  events: ['Events', 'Concerts, sports, theatre and more'],
  weather: ['Weather', '7-day forecast for your destination'],
  'long-weekends': ['Long Weekends', 'Plan mini-trips around holidays'],
  currency: ['Currency', 'Convert with live exchange rates'],
  'sun-times': ['Sun Times', 'Sunrise and sunset for golden hour'],
  'my-plans': ['My Plans', 'Everything you saved in one place']
};

class App {
  constructor() {
    window.app = this;
    this.store = new Store(); this.plans = new PlanManager();
    this.api = { nager: new NagerClient(), countries: new CountryClient(), geo: new GeoClient(), weather: new WeatherClient(), events: new EventsClient(), currency: new CurrencyClient(), sun: new SunClient() };
    this.dash = new DashboardView(this);
    this.views = { holidays: new HolidaysView(this), events: new EventsView(this), weather: new WeatherView(this), 'long-weekends': new LongWeekendsView(this), currency: new CurrencyView(this), 'sun-times': new SunView(this), 'my-plans': new PlansView(this) };
    this.current = 'dashboard'; this.coordsCache = {};
  }

  async coords() {
    const s = this.store.get(), key = s.country + s.city;
    if (this.coordsCache[key]) return this.coordsCache[key];
    let c = null;
    try { c = await this.api.geo.find(s.city, s.country); } catch { /* use capital below */ }
    if (!c) { const ll = s.info?.capitalInfo?.latlng || s.info?.latlng; if (!ll) throw new Error('Could not locate this city'); c = { lat: ll[0], lng: ll[1] }; }
    return (this.coordsCache[key] = c);
  }

  badges() {
    const s = this.store.get(), name = s.info?.name?.common || s.country;
    $$('.view-header-selection .current-selection-badge').forEach(b => {
      const view = b.closest('.view').id.replace('-view', ''), byCity = ['events', 'weather', 'sun-times'].includes(view);
      b.innerHTML = `<img src="${flagImg(s.country)}" alt="" class="selection-flag"><span>${esc(name)}</span><span class="${byCity ? 'selection-city' : 'selection-year'}">${byCity ? '• ' + esc(s.city) : s.year}</span>`;
    });
    const sub = { holidays: `Browse public holidays for ${name}`, events: `Discover events in ${s.city}`, weather: `7-day weather forecast for ${s.city}` };
    $$('.view-header-content p').forEach(p => { const v = p.closest('.view').id.replace('-view', ''); if (sub[v]) p.textContent = sub[v]; });
  }

  async select(sel) {
    this.store.set(sel);
    Object.values(this.views).forEach(v => { if (v.id !== 'my-plans') v.dirty = true; });
    await this.dash.renderInfo();
    this.badges();
    this.open(this.current);
  }

  open(v) {
    this.current = v;
    $$('.view').forEach(x => x.classList.toggle('active', x.id === v + '-view'));
    $$('.nav-item').forEach(x => x.classList.toggle('active', x.dataset.view === v));
    $('#page-title').textContent = ROUTES[v][0]; $('#page-subtitle').textContent = ROUTES[v][1];
    this.closeSidebar();
    if (this.views[v]) this.views[v].show();
    scrollTo(0, 0);
  }

  closeSidebar() { $('#sidebar').classList.remove('open'); $('#sidebar-overlay').classList.remove('active'); }

  syncPlans() {
    const n = this.plans.count(), b = $('#plans-count');
    b.textContent = n; b.classList.toggle('hidden', !n); $('#stat-saved').textContent = n;
    const pv = this.views['my-plans']; if (this.current === 'my-plans') pv.refresh(); else pv.dirty = true;
  }

  bind() {
    document.addEventListener('click', e => {
      const save = e.target.closest('[data-save]');
      if (save) {
        const p = registry.get(save.dataset.save); if (!p) return;
        const on = this.plans.toggle(p);
        $$(`[data-save]`).filter(x => x.dataset.save === p.id).forEach(x => { x.innerHTML = heart(on) + (x.dataset.label ? ' ' + (on ? 'Saved' : 'Save') : ''); });
        toast(on ? 'success' : 'info', on ? 'Saved to My Plans' : 'Removed from My Plans');
      }
      const rm = e.target.closest('[data-remove]');
      if (rm) { this.plans.remove(rm.dataset.remove); toast('info', 'Plan removed'); }
      const f = e.target.closest('.plan-filter');
      if (f) { const pv = this.views['my-plans']; pv.filter = f.dataset.filter; pv.refresh(); }
    });
    $('#clear-all-plans-btn').onclick = async () => {
      if (!this.plans.count()) return toast('info', 'Nothing to clear');
      const r = await Swal.fire({ title: 'Clear all plans?', text: 'This cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, clear all' });
      if (r.isConfirmed) { this.plans.clear(); $$('[data-save]').forEach(x => { x.innerHTML = heart(false) + (x.dataset.label ? ' Save' : ''); }); }
    };
    $('#mobile-menu-btn').onclick = () => { $('#sidebar-overlay').classList.remove('hidden'); const o = $('#sidebar').classList.toggle('open'); $('#sidebar-overlay').classList.toggle('active', o); };
    $('#sidebar-overlay').onclick = () => this.closeSidebar();
    this.plans.onChange(() => this.syncPlans());
    const tick = () => { $('#current-datetime').textContent = new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
    tick(); setInterval(tick, 30000);
  }

  async start() {
    this.bind(); this.syncPlans();
    loading(true, 'Loading destinations...');
    try { await this.dash.init(); await this.dash.renderInfo(); this.badges(); }
    catch (e) { toast('error', e.message); }
    finally { loading(false); }
    this.router = new Router(ROUTES, v => this.open(v));
    this.router.resolve();
  }
}

new App().start();
