/* ============================================================
   SwimFest core  ·  core/sf.js
   One shared namespace (window.SF) instead of the helpers that
   used to be copied into every page:
     SF.esc / SF.fmt   escaping and formatting   (utility module)
     SF.bus            publish / subscribe       (Observer)
     SF.toast          status messages           (single live region)
     SF.db             the Supabase client       (Singleton) plus
                       fetchAll() for > 1000 rows and inChunks()
                       for long id lists
     SF.csv            build / download CSV files
     SF.loadScript     load a library only when it's needed
   Load order on a page: core/sf.js → core/components.js →
   core/help.js → core/repos.js → page scripts.
   ============================================================ */
(function () {
  'use strict';
  const SF = window.SF = window.SF || {};

  // ── Escaping ────────────────────────────────────────────────
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  SF.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

  // ── Formatting ──────────────────────────────────────────────
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  SF.fmt = {
    /** 'YYYY-MM-DD' or Date → '08 Nov 2026' */
    date(d, opts) {
      if (!d) return '—';
      const dt = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00') : new Date(d);
      if (isNaN(dt)) return '—';
      return dt.toLocaleDateString('en-IN', opts || { day: '2-digit', month: 'short', year: 'numeric' });
    },
    /** 'YYYY-MM-DD' → 'DD/MM/YYYY' */
    dmy(d) {
      if (!d) return '—';
      const [y, m, day] = String(d).slice(0, 10).split('-');
      return day ? `${day}/${m}/${y}` : '—';
    },
    /** 39200 → '00:39.20'; null/0 → 'NT' */
    seed(ms) {
      if (!ms || ms <= 0) return 'NT';
      return `${pad(Math.floor(ms / 60000))}:${((ms % 60000) / 1000).toFixed(2).padStart(5, '0')}`;
    },
    /** 39200 → '39.20', 92340 → '1:32.34' (race result style); null → '' */
    time(ms) {
      if (ms == null || ms === '') return '';
      const m = Math.floor(ms / 60000), s = (ms % 60000) / 1000;
      return m ? `${m}:${s.toFixed(2).padStart(5, '0')}` : s.toFixed(2);
    },
    /** '00:39.20' | '39.20' | '1:02.5' | 'NT' → ms; 'NT'/'' → null; invalid → undefined */
    parseTime(text) {
      const t = String(text ?? '').trim().toUpperCase();
      if (!t || t === 'NT') return null;
      const m = /^(?:(\d{1,2}):)?(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(t);
      if (!m) return undefined;
      const min = Number(m[1] || 0), sec = Number(m[2]);
      if (sec > 59 && m[1] != null) return undefined;
      const frac = m[3] ? Number((m[3] + '00').slice(0, 3)) : 0;
      return min * 60000 + sec * 1000 + frac;
    },
    money(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); },
    plural(n, one, many) { return `${n} ${n === 1 ? one : (many || one + 's')}`; },
  };

  // ── Observer: tiny publish / subscribe bus ──────────────────
  const topics = new Map();
  SF.bus = {
    on(topic, fn) { (topics.get(topic) || topics.set(topic, new Set()).get(topic)).add(fn); return () => SF.bus.off(topic, fn); },
    off(topic, fn) { const s = topics.get(topic); if (s) s.delete(fn); },
    emit(topic, data) { const s = topics.get(topic); if (s) [...s].forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); },
  };

  // ── Utilities ───────────────────────────────────────────────
  SF.debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  SF.$ = (sel, root = document) => root.querySelector(sel);
  SF.$$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  SF.param = name => new URLSearchParams(location.search).get(name);
  SF.norm = s => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

  /** Load a script once (e.g. SheetJS only when an .xlsx is chosen) */
  const loaded = {};
  SF.loadScript = src => loaded[src] || (loaded[src] = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = res;
    s.onerror = () => { delete loaded[src]; rej(new Error('Could not load ' + src)); };
    document.head.appendChild(s);
  }));
  SF.XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  SF.loadXLSX = () => window.XLSX ? Promise.resolve(window.XLSX) : SF.loadScript(SF.XLSX_URL).then(() => window.XLSX);

  // ── Toasts (one polite live region for the whole page) ──────
  let region;
  function toastRegion() {
    if (region && document.body.contains(region)) return region;
    region = document.createElement('div');
    region.className = 'sf-toasts';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
    return region;
  }
  SF.toast = function (msg, type = 'info', ms) {
    const kind = type === 'error' || type === 'danger' ? 'error' : type;
    const el = document.createElement('div');
    el.className = `sf-toast sf-toast-${kind}`;
    if (kind === 'error') el.setAttribute('role', 'alert');
    el.textContent = msg;
    const r = toastRegion();
    while (r.children.length > 2) r.firstChild.remove();
    r.appendChild(el);
    setTimeout(() => el.remove(), ms || (kind === 'error' || kind === 'warn' ? 7000 : 4000));
  };

  // ── Data access (Singleton client + paging helpers) ─────────
  SF.db = {
    /** The one Supabase client (created by supabase.js) */
    get client() {
      if (!window.sb) throw new Error('Supabase is not loaded');
      return window.sb;
    },
    /**
     * Read every row of a query, 1000 at a time (Supabase returns at most
     * ~1000 rows per request, so bigger meets were silently cut short).
     * build: () => a fresh query builder, e.g. () => sb.from('x').select('a,b').eq(...)
     * Add an .order() in build so the pages are stable.
     */
    async fetchAll(build, pageSize = 1000) {
      const out = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await build().range(from, from + pageSize - 1);
        if (error) throw error;
        out.push(...(data || []));
        if (!data || data.length < pageSize) return out;
      }
    },
    /**
     * Run an .in(column, ids) query in chunks (long id lists make the
     * request URL too long). build: chunk => query.
     */
    async inChunks(ids, build, size = 150) {
      const uniq = [...new Set(ids.filter(Boolean))];
      const parts = [];
      for (let i = 0; i < uniq.length; i += size) parts.push(uniq.slice(i, i + size));
      const results = await Promise.all(parts.map(async chunk => {
        const { data, error } = await build(chunk);
        if (error) throw error;
        return data || [];
      }));
      return results.flat();
    },
    /** Call a database function; throws a readable Error */
    async rpc(name, args) {
      const { data, error } = await SF.db.client.rpc(name, args);
      if (error) throw new Error(SF.db.why(error));
      return data;
    },
    /** Human message for a failed request */
    why(e) {
      const m = (e && e.message) || String(e || 'Unknown error');
      if (/failed to fetch|network/i.test(m)) return 'Could not reach the server. Check your internet (or pause ad blockers for this site) and try again.';
      if (/function .* does not exist|could not find the function/i.test(m)) return 'The database is missing an update (backend/db/perf_and_bulk.sql). Ask the site owner to run it.';
      if (/row-level security|permission denied|42501/i.test(m)) return 'Your account is not allowed to do this.';
      return m;
    },
  };

  // ── CSV ─────────────────────────────────────────────────────
  SF.csv = {
    cell(v) {
      const s = String(v ?? '');
      // Leading = + - @ would run as a formula in Excel: prefix with '
      const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? "'" + s : s;
      return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    },
    build(rows) { return rows.map(r => r.map(SF.csv.cell).join(',')).join('\r\n'); },
    download(filename, rows) {
      const blob = new Blob(['﻿' + SF.csv.build(rows)], { type: 'text/csv;charset=utf-8' });
      SF.downloadBlob(filename, blob);
    },
    /** Parse CSV text into rows of strings (handles quotes, commas, newlines) */
    parse(text) {
      const rows = []; let row = [], cur = '', q = false;
      text = String(text).replace(/^﻿/, '');
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
          if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
          else cur += c;
        } else if (c === '"') q = true;
        else if (c === ',') { row.push(cur); cur = ''; }
        else if (c === '\n' || c === '\r') {
          if (c === '\r' && text[i + 1] === '\n') i++;
          row.push(cur); rows.push(row); row = []; cur = '';
        } else cur += c;
      }
      if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
      return rows.filter(r => r.some(c => String(c).trim() !== ''));
    },
  };
  SF.downloadBlob = (filename, blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // ── Page landmarks: skip link + <main> id ───────────────────
  function landmarks() {
    const main = document.querySelector('main') ||
      document.querySelector('.ac-main, .sa-main, .dashboard-main, .container, section');
    if (!main) return;
    if (!main.id) main.id = 'main';
    if (main.tagName !== 'MAIN' && !main.getAttribute('role')) main.setAttribute('role', 'main');
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    if (!document.querySelector('.sf-skip')) {
      const a = document.createElement('a');
      a.className = 'sf-skip'; a.href = '#' + main.id; a.textContent = 'Skip to main content';
      document.body.prepend(a);
    }
    // Icon-only buttons need a name for screen readers
    document.querySelectorAll('button:not([aria-label]), a:not([aria-label])').forEach(b => {
      if (!b.textContent.trim() && b.title) b.setAttribute('aria-label', b.title);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', landmarks); else landmarks();
})();
