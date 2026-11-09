export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const flag = cc => [...cc.toUpperCase()].map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('');
export const flagImg = (cc, w = 40) => `https://flagcdn.com/w${w}/${cc.toLowerCase()}.png`;
export const toDate = d => new Date(d.length === 10 ? d + 'T00:00:00' : d);
export const fmt = (d, o = { day: 'numeric', month: 'short' }) => toDate(d).toLocaleDateString('en-US', o);
export const heart = on => `<i class="fa-${on ? 'solid' : 'regular'} fa-heart"></i>`;
export const spinner = t => `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-spinner fa-spin"></i></div><p>${t || 'Loading...'}</p></div>`;
export const toast = (icon, title) => window.Swal ? Swal.fire({ toast: true, position: 'top-end', icon, title, timer: 2200, showConfirmButton: false }) : console.log(title);
export const loading = (on, text = 'Loading...') => { $('#loading-text').textContent = text; $('#loading-overlay').classList.toggle('hidden', !on); };
export const registry = new Map(); // id -> plan object for the save buttons

export class Store {
  constructor() {
    this.s = { country: 'EG', city: 'Cairo', year: new Date().getFullYear(), info: null, coords: null };
    try { Object.assign(this.s, JSON.parse(localStorage.getItem('wl_selection') || '{}')); } catch { /* ignore */ }
    this.subs = [];
  }
  get() { return this.s; }
  set(p) {
    Object.assign(this.s, p);
    try { localStorage.setItem('wl_selection', JSON.stringify({ country: this.s.country, city: this.s.city, year: this.s.year })); } catch { /* ignore */ }
    this.subs.forEach(f => f(this.s));
  }
  subscribe(f) { this.subs.push(f); }
}

export class PlanManager {
  constructor(key = 'wanderlust_plans') { this.key = key; this.subs = []; this.items = this.#read(); }
  #read() { try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch { return []; } }
  #write() {
    try { localStorage.setItem(this.key, JSON.stringify(this.items)); } catch { toast('error', 'Could not save, storage unavailable'); }
    this.subs.forEach(f => f(this.items));
  }
  onChange(f) { this.subs.push(f); }
  has(id) { return this.items.some(p => p.id === id); }
  toggle(p) {
    if (this.has(p.id)) { this.items = this.items.filter(x => x.id !== p.id); this.#write(); return false; }
    this.items.push({ ...p, savedAt: Date.now() }); this.#write(); return true;
  }
  remove(id) { this.items = this.items.filter(p => p.id !== id); this.#write(); }
  clear() { this.items = []; this.#write(); }
  count(type) { return type ? this.items.filter(p => p.type === type).length : this.items.length; }
}

export class Router {
  constructor(routes, onRoute) {
    this.routes = routes; this.onRoute = onRoute;
    addEventListener('hashchange', () => this.resolve());
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-view]');
      if (a) { e.preventDefault(); this.go(a.dataset.view); }
    });
  }
  go(v) { location.hash = '#/' + v; }
  resolve() {
    const v = location.hash.replace('#/', '') || 'dashboard';
    this.onRoute(this.routes[v] ? v : 'dashboard');
  }
}
