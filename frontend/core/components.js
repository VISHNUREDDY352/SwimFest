/* ============================================================
   SwimFest components  ·  core/components.js
     SF.Dialog          accessible modal on native <dialog>
     SF.Info            ⓘ button → "what is this tab" dialog
                        (text comes from SF.help, core/help.js)
     SF.Search          search strategies (Strategy pattern):
                        each tab says which field is its key
     SF.TabbedSearch    one search box shared by several tabs; the
                        placeholder, key field and typed text follow
                        the active tab
     SF.Tabs            ARIA tablist + arrow keys for tab buttons
     SF.Table           sortable, paged, phone-friendly table
                        (Factory: SF.Table.create(el, options))
     SF.Importer        spreadsheet import (Template Method):
                        parse → validate → preview → commit
   Needs core/sf.js first.
   ============================================================ */
(function () {
  'use strict';
  const SF = window.SF;
  const esc = SF.esc;

  /* ── Dialog ─────────────────────────────────────────────── */
  let dlgSeq = 0;
  SF.Dialog = {
    /**
     * open({ title, body (html), wide, actions: [{label, primary, danger, onClick}] })
     * Returns the <dialog>. Esc / backdrop / × close it; focus returns to the opener.
     */
    open({ title, body, wide, actions = [], onClose } = {}) {
      const opener = document.activeElement;
      const id = 'sfdlg' + (++dlgSeq);
      const d = document.createElement('dialog');
      d.className = 'sf-dialog' + (wide ? ' sf-dialog-wide' : '');
      d.setAttribute('aria-labelledby', id + 't');
      d.innerHTML = `
        <div class="sf-dialog-head">
          <h2 class="sf-dialog-title" id="${id}t">${esc(title)}</h2>
          <button type="button" class="sf-close" data-close aria-label="Close">${SF.icon ? SF.icon('times') : '×'}</button>
        </div>
        <div class="sf-dialog-body">${body || ''}</div>
        ${actions.length ? '<div class="sf-dialog-foot"></div>' : ''}`;
      const foot = d.querySelector('.sf-dialog-foot');
      actions.forEach(a => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sf-btn' + (a.primary ? ' sf-btn-primary' : '') + (a.danger ? ' sf-btn-danger' : '');
        b.textContent = a.label;
        b.addEventListener('click', () => (a.onClick ? a.onClick(d, b) : d.close()));
        foot.appendChild(b);
      });
      d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
      d.addEventListener('close', () => {
        d.remove();
        if (onClose) onClose();
        if (opener && opener.focus) opener.focus();
      });
      document.body.appendChild(d);
      d.showModal();
      return d;
    },
  };

  /* ── Info button ────────────────────────────────────────── */
  SF.help = SF.help || {};
  SF.Info = {
    /** Dialog with the help text registered under key */
    show(key) {
      const h = SF.help[key];
      if (!h) return;
      const list = (title, items) => items && items.length
        ? `<h3>${esc(title)}</h3><ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '';
      SF.Dialog.open({
        title: h.title,
        body: `<h3>What this is</h3><p style="margin:0">${esc(h.what)}</p>
               ${list('What you can do', h.actions)}
               ${list('Rules and checks', h.rules)}
               ${h.tip ? `<p class="sf-note" style="margin-top:14px">${esc(h.tip)}</p>` : ''}`,
        actions: [{ label: 'Got it', primary: true }],
      });
    },
    /** An ⓘ button element for key */
    button(key) {
      const h = SF.help[key];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sf-info';
      b.textContent = 'i';
      b.setAttribute('aria-label', `About ${h ? h.title : 'this section'}`);
      b.title = `About ${h ? h.title : 'this section'}`;
      b.dataset.helpBtn = key;
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); SF.Info.show(key); });
      return b;
    },
    /**
     * Put an ⓘ button right after a heading (heading + button are wrapped
     * so they sit on one line; the heading's own text is unchanged).
     * Calling again with another key re-points the existing button.
     */
    attach(el, key) {
      if (!el) return;
      el.dataset.help = key;
      const wrap = el.parentElement && el.parentElement.classList.contains('sf-info-wrap') ? el.parentElement : null;
      const old = wrap && wrap.querySelector(':scope > .sf-info');
      if (old) { old.replaceWith(SF.Info.button(key)); return; }
      const w = document.createElement('span');
      w.className = 'sf-info-wrap';
      el.parentNode.insertBefore(w, el);
      w.appendChild(el);
      w.appendChild(SF.Info.button(key));
    },
    /** Give every [data-help="key"] element an ⓘ button (once) */
    scan(root = document) {
      root.querySelectorAll('[data-help]').forEach(el => {
        const wrap = el.parentElement;
        if (wrap && wrap.classList.contains('sf-info-wrap')) return;
        SF.Info.attach(el, el.dataset.help);
      });
    },
  };

  /* ── Search strategies ──────────────────────────────────── */
  // A strategy turns (row, query) into a score: 0 = no match.
  // Matches on the key field rank above matches on fallback fields.
  SF.Search = {
    /**
     * by(keyFields, fallbackFields): fields are property names or functions row => text
     */
    by(keyFields, fallbackFields = []) {
      const get = (row, f) => SF.norm(typeof f === 'function' ? f(row) : row[f]);
      return (row, q) => {
        if (!q) return 1;
        const terms = SF.norm(q).split(' ');
        let score = 0;
        for (const t of terms) {
          let best = 0;
          for (const f of keyFields) {
            const v = get(row, f);
            if (v === t) best = Math.max(best, 100);
            else if (v.startsWith(t)) best = Math.max(best, 80);
            else if (v.includes(' ' + t)) best = Math.max(best, 60);
            else if (v.includes(t)) best = Math.max(best, 40);
          }
          if (!best) for (const f of fallbackFields) if (get(row, f).includes(t)) { best = 10; break; }
          if (!best) return 0;          // every word must match something
          score += best;
        }
        return score;
      };
    },
    /** Filter + rank rows with a strategy (stable for equal scores) */
    run(rows, strategy, q) {
      if (!q || !q.trim()) return rows.slice();
      return rows.map((r, i) => ({ r, i, s: strategy(r, q) }))
        .filter(x => x.s > 0)
        .sort((a, b) => b.s - a.s || a.i - b.i)
        .map(x => x.r);
    },
  };

  /**
   * One search box for several tabs.
   *   new SF.TabbedSearch({ input, tabs: { swimmers: { placeholder, label }, … }, onChange(tabId, q) })
   *   .setTab(id)  → swaps placeholder + aria-label, restores that tab's text
   *   .query       → current text
   */
  SF.TabbedSearch = class {
    constructor({ input, tabs, onChange, delay = 200 }) {
      this.input = input; this.tabs = tabs; this.onChange = onChange;
      this.memory = {}; this.tab = null;
      const fire = SF.debounce(() => this.onChange && this.onChange(this.tab, this.query), delay);
      input.addEventListener('input', () => { this.memory[this.tab] = input.value; fire(); });
      input.addEventListener('keydown', e => {
        if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; this.memory[this.tab] = ''; this.onChange(this.tab, ''); }
      });
    }
    get query() { return this.input.value.trim(); }
    setTab(id) {
      this.tab = id;
      const t = this.tabs[id] || {};
      this.input.placeholder = t.placeholder || 'Search…';
      this.input.setAttribute('aria-label', t.label || t.placeholder || 'Search');
      this.input.value = this.memory[id] || '';
      if (t.hidden) this.input.closest('.sf-search, label, div').hidden = true;
    }
  };

  /* ── Tabs: ARIA + keyboard for any group of tab buttons ── */
  SF.Tabs = {
    /**
     * enhance(listEl, { tabSelector, onSelect(tabEl) })
     * Adds role=tab / aria-selected / roving tabindex and ←/→/Home/End.
     */
    enhance(list, { tabSelector = 'button', onSelect } = {}) {
      if (!list || list.dataset.sfTabs) return;
      list.dataset.sfTabs = '1';
      list.setAttribute('role', 'tablist');
      const tabs = () => [...list.querySelectorAll(tabSelector)].filter(t => !t.hidden);
      const sync = () => tabs().forEach(t => {
        const on = t.classList.contains('active') || t.getAttribute('aria-selected') === 'true';
        t.setAttribute('role', 'tab');
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      sync();
      if (!tabs().some(t => t.tabIndex === 0) && tabs()[0]) tabs()[0].tabIndex = 0;
      list.addEventListener('click', e => {
        const t = e.target.closest(tabSelector);
        if (!t || !list.contains(t)) return;
        setTimeout(() => { sync(); if (onSelect) onSelect(t); }, 0);
      });
      list.addEventListener('keydown', e => {
        const all = tabs(); const i = all.indexOf(document.activeElement);
        if (i < 0) return;
        let n = null;
        if (e.key === 'ArrowRight') n = (i + 1) % all.length;
        else if (e.key === 'ArrowLeft') n = (i - 1 + all.length) % all.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = all.length - 1;
        if (n == null) return;
        e.preventDefault();
        all[n].focus(); all[n].click();
      });
      // Class changes made by older page code keep aria-selected in step
      new MutationObserver(sync).observe(list, { attributes: true, subtree: true, attributeFilter: ['class'] });
    },
  };

  /* ── Table ──────────────────────────────────────────────── */
  /**
   * SF.Table.create(container, {
   *   columns: [{ key, label, num, sortable, render(row) → html, value(row) → sort value, className }],
   *   rows, rowKey: 'id', pageSize: 50, empty: 'Nothing here yet.',
   *   rowClass(row) → '', caption, stack: true (phone list view)
   * })  →  { setRows(rows), rows }
   */
  SF.Table = {
    create(container, opts) {
      const o = Object.assign({ pageSize: 50, empty: 'Nothing to show.', stack: true }, opts);
      const state = { rows: o.rows || [], page: 0, sort: o.sort || null, dir: o.dir || 1 };
      const cellText = (c, r) => c.render ? c.render(r) : esc(r[c.key] ?? '');
      const sortVal = (c, r) => c.value ? c.value(r) : r[c.key];

      function sorted() {
        if (!state.sort) return state.rows;
        const c = o.columns.find(x => x.key === state.sort);
        if (!c) return state.rows;
        return state.rows.slice().sort((a, b) => {
          const x = sortVal(c, a), y = sortVal(c, b);
          if (x == null || x === '') return 1;
          if (y == null || y === '') return -1;
          return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * state.dir;
        });
      }

      function render() {
        const all = sorted();
        const pages = Math.max(1, Math.ceil(all.length / o.pageSize));
        state.page = Math.min(state.page, pages - 1);
        const slice = all.slice(state.page * o.pageSize, (state.page + 1) * o.pageSize);
        const head = o.columns.map(c => {
          const s = state.sort === c.key ? (state.dir > 0 ? 'ascending' : 'descending') : 'none';
          const label = esc(c.label);
          return `<th scope="col"${c.num ? ' class="num"' : ''}${c.sortable ? ` aria-sort="${s}"` : ''}>${
            c.sortable ? `<button type="button" class="sf-sort" data-sort="${esc(c.key)}">${label}<span aria-hidden="true">${s === 'ascending' ? '▲' : s === 'descending' ? '▼' : ''}</span></button>` : label}</th>`;
        }).join('');
        const body = slice.length ? slice.map(r => {
          const cls = o.rowClass ? o.rowClass(r) : '';
          const key = o.rowKey ? ` data-key="${esc(r[o.rowKey])}"` : '';
          return `<tr${cls ? ` class="${cls}"` : ''}${key}>${o.columns.map(c =>
            `<td data-label="${esc(c.label)}"${c.num || c.className ? ` class="${[c.num ? 'num' : '', c.className || ''].join(' ').trim()}"` : ''}>${cellText(c, r)}</td>`).join('')}</tr>`;
        }).join('') : `<tr><td class="sf-empty" colspan="${o.columns.length}">${esc(o.empty)}</td></tr>`;
        container.innerHTML = `
          <div class="sf-table-wrap">
            <table class="sf-table${o.stack ? ' sf-stack' : ''}">
              ${o.caption ? `<caption>${esc(o.caption)}</caption>` : ''}
              <thead><tr>${head}</tr></thead><tbody>${body}</tbody>
            </table>
          </div>
          ${pages > 1 ? `<div class="sf-pager">
            <span>${state.page * o.pageSize + 1}–${Math.min(all.length, (state.page + 1) * o.pageSize)} of ${all.length}</span>
            <span>
              <button type="button" class="sf-btn sf-btn-sm" data-page="-1"${state.page === 0 ? ' disabled' : ''}>Previous</button>
              <button type="button" class="sf-btn sf-btn-sm" data-page="1"${state.page >= pages - 1 ? ' disabled' : ''}>Next</button>
            </span></div>` : ''}`;
      }

      container.addEventListener('click', e => {
        const s = e.target.closest('[data-sort]');
        if (s) {
          state.dir = state.sort === s.dataset.sort ? -state.dir : 1;
          state.sort = s.dataset.sort;
          render();
          container.querySelector(`[data-sort="${CSS.escape(s.dataset.sort)}"]`).focus();
          return;
        }
        const p = e.target.closest('[data-page]');
        if (p) { state.page += Number(p.dataset.page); render(); }
      });
      render();
      return {
        setRows(rows, keepPage) { state.rows = rows || []; if (!keepPage) state.page = 0; render(); },
        get rows() { return state.rows; },
        render,
      };
    },
  };

  /* ── Importer (Template Method) ─────────────────────────── */
  /**
   * Subclass and fill in the steps:
   *   columns      [{ key, label, required, aliases: [] , example }]
   *   validate(rows, ctx) → rows with .errors [] and .warnings []   (async ok)
   *   commit(goodRows, ctx) → { message }                           (async)
   *   templateName  file name for the downloadable template
   * Then call importer.open(ctx). The base class does the rest:
   * file pick → parse (CSV here, XLSX via SheetJS on demand) →
   * header matching → validate → preview table → commit.
   */
  SF.Importer = class {
    constructor() {
      this.title = 'Import'; this.columns = []; this.templateName = 'template';
      this.templateRows = []; this.notes = [];
    }

    // ── Steps a subclass overrides ──
    async validate(rows) { return rows; }
    async commit() { throw new Error('commit() not implemented'); }

    // ── Template: downloadable CSV + XLSX ──
    templateHeader() { return this.columns.map(c => c.label + (c.required ? ' *' : '')); }
    downloadTemplate(kind = 'csv') {
      const rows = [this.templateHeader(), ...this.templateRows];
      if (kind === 'csv') return SF.csv.download(this.templateName + '.csv', rows);
      return SF.loadXLSX().then(X => {
        const ws = X.utils.aoa_to_sheet(rows);
        ws['!cols'] = this.columns.map(c => ({ wch: Math.max(14, c.label.length + 4) }));
        // Keep times / phones / dates as text so Excel doesn't convert them
        const range = X.utils.decode_range(ws['!ref']);
        for (let R = 1; R <= range.e.r; R++) for (let C = 0; C <= range.e.c; C++) {
          const cell = ws[X.utils.encode_cell({ r: R, c: C })];
          if (cell) { cell.t = 's'; cell.v = String(cell.v); cell.z = '@'; }
        }
        const wb = X.utils.book_new();
        X.utils.book_append_sheet(wb, ws, 'Entries');
        if (this.notes.length) X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['How to fill this in'], ...this.notes.map(n => [n])]), 'Instructions');
        X.writeFile(wb, this.templateName + '.xlsx');
      }).catch(e => SF.toast(SF.db.why(e), 'error'));
    }

    // ── Parse a file into rows of { _row, key: value } ──
    async parse(file) {
      let table;
      if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
        table = SF.csv.parse(await file.text());
      } else {
        const X = await SF.loadXLSX();
        // raw:false + no cellDates: times like 00:38.50 arrive as the text the user sees
        const wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Date cells come out as YYYY-MM-DD whatever the sheet's display format
        table = X.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false, dateNF: 'yyyy-mm-dd' });
      }
      if (!table.length) throw new Error('The file is empty.');
      const header = table[0].map(h => SF.norm(String(h).replace(/\*/g, '')));
      const map = {};
      const missing = [];
      this.columns.forEach(c => {
        const names = [c.label, c.key, ...(c.aliases || [])].map(SF.norm);
        const idx = header.findIndex(h => names.includes(h));
        if (idx >= 0) map[c.key] = idx;
        else if (c.required) missing.push(c.label);
      });
      if (missing.length) throw new Error(`Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Download the template to see the expected headings.`);
      return table.slice(1).map((r, i) => {
        const o = { _row: i + 2, errors: [], warnings: [] };
        this.columns.forEach(c => { o[c.key] = map[c.key] != null ? String(r[map[c.key]] ?? '').trim() : ''; });
        return o;
      }).filter(o => this.columns.some(c => o[c.key] !== ''));
    }

    // ── The fixed algorithm (UI + steps) ──
    open(ctx = {}) {
      this.ctx = ctx;
      const cols = this.columns.map(c => `<li><strong>${esc(c.label)}</strong>${c.required ? ' (required)' : ''}${c.hint ? ` — ${esc(c.hint)}` : ''}</li>`).join('');
      const d = SF.Dialog.open({
        title: this.title, wide: true,
        body: `
          <ol class="sf-steps" aria-label="Import steps">
            <li data-step="1" aria-current="step">1. Choose file</li><li data-step="2">2. Check</li><li data-step="3">3. Import</li>
          </ol>
          <div data-pane="pick">
            <p style="margin:0 0 10px">Fill in the template, then choose the file (.xlsx, .xls or .csv). Nothing is saved until you press <strong>Import</strong>.</p>
            <p style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px">
              <button type="button" class="sf-btn" data-tpl="xlsx">${SF.icon('file-excel')} Download template (.xlsx)</button>
              <button type="button" class="sf-btn" data-tpl="csv">${SF.icon('file-csv')} Download template (.csv)</button>
            </p>
            <label class="sf-drop" data-drop>
              ${SF.icon('upload')}
              <span><strong>Choose a file</strong> or drop it here</span>
              <input type="file" accept=".xlsx,.xls,.csv" class="sf-visually-hidden" data-file>
            </label>
            <details style="margin-top:12px"><summary>Columns in the template</summary><ul>${cols}</ul></details>
          </div>
          <div data-pane="check" hidden>
            <div data-summary aria-live="polite"></div>
            <div data-preview style="margin-top:10px;border:1px solid var(--sf-line);border-radius:8px;max-height:50vh;overflow:auto"></div>
          </div>`,
        actions: [
          { label: 'Cancel' },
          { label: 'Import', primary: true, onClick: (dlg, btn) => this._commit(dlg, btn) },
        ],
      });
      this.dlg = d;
      const importBtn = d.querySelector('.sf-dialog-foot .sf-btn-primary');
      importBtn.disabled = true;
      d.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => this.downloadTemplate(b.dataset.tpl)));
      const file = d.querySelector('[data-file]');
      const drop = d.querySelector('[data-drop]');
      file.addEventListener('change', () => file.files[0] && this._load(file.files[0]));
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('is-over'); }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('is-over'); }));
      drop.addEventListener('drop', e => e.dataTransfer.files[0] && this._load(e.dataTransfer.files[0]));
      return d;
    }

    _step(n) {
      this.dlg.querySelectorAll('.sf-steps li').forEach(li =>
        li.dataset.step === String(n) ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current'));
    }

    async _load(file) {
      const d = this.dlg;
      const sum = d.querySelector('[data-summary]');
      d.querySelector('[data-pane="check"]').hidden = false;
      sum.innerHTML = `<p class="sf-note">${SF.icon('spinner', 'is-spin')} Reading ${esc(file.name)}…</p>`;
      const btn = d.querySelector('.sf-dialog-foot .sf-btn-primary');
      btn.disabled = true;
      try {
        let rows = await this.parse(file);
        if (!rows.length) throw new Error('No rows found under the heading row.');
        rows = await this.validate(rows, this.ctx);
        this.rows = rows;
        this._step(2);
        const bad = rows.filter(r => r.errors.length);
        const warn = rows.filter(r => !r.errors.length && r.warnings.length);
        sum.innerHTML = bad.length
          ? `<p class="sf-note sf-note-bad" role="alert">${bad.length} of ${rows.length} rows have problems (marked in red). Fix them in the file and choose it again — nothing has been saved.</p>`
          : `<p class="sf-note sf-note-ok">All ${rows.length} rows look good${warn.length ? ` (${warn.length} with warnings, shown in amber)` : ''}. Press <strong>Import</strong> to save them in one go.</p>`;
        const preview = d.querySelector('[data-preview]');
        SF.Table.create(preview, {
          rows, pageSize: 100, stack: false,
          rowClass: r => r.errors.length ? 'is-bad' : r.warnings.length ? 'is-warn' : '',
          columns: [
            { key: '_row', label: 'Row', num: true },
            ...this.columns.filter(c => !c.hideInPreview).map(c => ({ key: c.key, label: c.label })),
            { key: 'errors', label: 'Problems', render: r => [...r.errors.map(e => `<span class="sf-err">${esc(e)}</span>`), ...r.warnings.map(w => `<span style="color:var(--sf-warn)">${esc(w)}</span>`)].join('<br>') || '✓' },
          ],
        });
        btn.disabled = !!bad.length;
      } catch (e) {
        sum.innerHTML = `<p class="sf-note sf-note-bad" role="alert">${esc(SF.db.why(e))}</p>`;
      }
    }

    async _commit(dlg, btn) {
      if (!this.rows || this.rows.some(r => r.errors.length)) return;
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = 'Importing…';
      try {
        const res = await this.commit(this.rows, this.ctx);
        this._step(3);
        SF.toast((res && res.message) || 'Import finished.', 'success');
        dlg.close();
      } catch (e) {
        dlg.querySelector('[data-summary]').innerHTML = `<p class="sf-note sf-note-bad" role="alert">Nothing was saved: ${esc(SF.db.why(e))}</p>`;
        btn.disabled = false; btn.textContent = label;
      }
    }
  };

  // Info buttons for anything marked data-help (pages can also call SF.Info.scan)
  const boot = () => SF.Info.scan();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
