/* ============================================================
   SwimFest – simple date picker
   Replaces every <input type="date"> with a plain calendar:
   one month at a time, tap the title to jump by year → month.
   The original input stays in the page (hidden) and keeps its
   value as YYYY-MM-DD, so page code and listeners work as before.
   ============================================================ */
(function () {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                  'August', 'September', 'October', 'November', 'December'];
  const SHORT = MONTHS.map(m => m.slice(0, 3));
  const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const pad = n => String(n).padStart(2, '0');
  const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const parse = s => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
  };
  const now = new Date();
  const TODAY = iso(now.getFullYear(), now.getMonth(), now.getDate());
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

  const css = `
  .sfd-btn{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;text-align:left;cursor:pointer;font:inherit}
  .sfd-btn .sfd-ph{color:#94a3b8}
  .sfd-btn svg{flex:none;opacity:.55}
  .sfd-pop{position:fixed;z-index:100000;width:280px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;
    box-shadow:0 12px 32px rgba(15,23,42,.18);padding:12px;font-family:inherit;color:#1e293b;user-select:none}
  .sfd-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
  .sfd-title{border:0;background:none;font:600 15px/1.2 inherit;font-family:inherit;color:#1e293b;padding:6px 10px;border-radius:8px;cursor:pointer}
  .sfd-title:hover{background:#f1f5f9}
  .sfd-nav{border:0;background:none;width:32px;height:32px;border-radius:8px;cursor:pointer;color:#475569;font-size:18px;line-height:1}
  .sfd-nav:hover{background:#f1f5f9}
  .sfd-nav:disabled{opacity:.25;cursor:default;background:none}
  .sfd-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
  .sfd-grid.sfd-wide{grid-template-columns:repeat(3,1fr);gap:6px}
  .sfd-wd{font-size:11px;font-weight:600;color:#94a3b8;text-align:center;padding:4px 0}
  .sfd-cell{border:0;background:none;height:34px;border-radius:8px;font:500 14px inherit;font-family:inherit;color:#1e293b;cursor:pointer}
  .sfd-wide .sfd-cell{height:44px}
  .sfd-cell:hover{background:#e0f2fe}
  .sfd-cell.sfd-today{box-shadow:inset 0 0 0 1.5px #0077b6;color:#0077b6}
  .sfd-cell.sfd-on{background:#0077b6;color:#fff;box-shadow:none}
  .sfd-cell:disabled{color:#cbd5e1;cursor:default;background:none}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';

  let pop = null, active = null;

  function close() {
    if (pop) pop.remove();
    pop = null;
    active = null;
  }

  function enhance(input) {
    if (input.dataset.sfd) return;
    input.dataset.sfd = '1';
    const isDob = /dob|birth/i.test(input.id + ' ' + (input.name || ''));

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('style', input.getAttribute('style') || '');
    const syncClass = () => { btn.className = `${input.className} sfd-btn`; };
    syncClass();
    input.parentNode.insertBefore(btn, input.nextSibling);
    input.type = 'hidden';

    const label = input.id && document.querySelector(`label[for="${input.id}"]`);
    if (label) label.addEventListener('click', e => { e.preventDefault(); btn.click(); });

    const show = () => {
      const p = parse(nativeValue.get.call(input));
      btn.innerHTML = p
        ? `<span>${pad(p.d)} ${SHORT[p.m]} ${p.y}</span>${ICON}`
        : `<span class="sfd-ph">${isDob ? 'Select date of birth' : 'Select a date'}</span>${ICON}`;
    };

    // Page code sets .value directly; keep the button text in step
    Object.defineProperty(input, 'value', {
      get() { return nativeValue.get.call(this); },
      set(v) { nativeValue.set.call(this, v); show(); },
    });
    input.focus = () => btn.focus();
    new MutationObserver(syncClass).observe(input, { attributes: true, attributeFilter: ['class'] });
    show();

    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (active === input) return close();
      open(input, btn, isDob);
    });
  }

  function open(input, btn, isDob) {
    close();
    active = input;
    let min = input.getAttribute('min') || '', max = input.getAttribute('max') || '';
    // A date of birth is never in the future; default to the U-10 – U-16 swimmer ages (8–15)
    if (isDob) {
      const y = now.getFullYear();
      if (!min) min = `${y - 15}-01-01`;
      if (!max || max > TODAY) max = `${y - 8}-12-31`;
    }
    const sel = parse(input.value);
    const start = sel || parse(max && max < TODAY ? max : TODAY);
    const view = {
      y: sel ? sel.y : start.y,
      m: start.m,
      mode: sel || !isDob ? 'days' : 'years',
    };

    pop = document.createElement('div');
    pop.className = 'sfd-pop';
    pop.addEventListener('click', e => e.stopPropagation());
    document.body.appendChild(pop);

    const outOfRange = (from, to) => (min && to < min) || (max && from > max);

    const pick = v => {
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      close();
      btn.focus();
    };

    function render() {
      let title, cells = '', grid = 'sfd-grid', prevOff, nextOff;
      if (view.mode === 'days') {
        title = `${MONTHS[view.m]} ${view.y}`;
        cells = DAYS.map(d => `<div class="sfd-wd">${d}</div>`).join('');
        const first = new Date(view.y, view.m, 1).getDay();
        const count = new Date(view.y, view.m + 1, 0).getDate();
        cells += '<div></div>'.repeat(first);
        for (let d = 1; d <= count; d++) {
          const v = iso(view.y, view.m, d);
          const cls = ['sfd-cell', v === TODAY && 'sfd-today', v === input.value && 'sfd-on'].filter(Boolean).join(' ');
          cells += `<button type="button" class="${cls}" data-v="${v}" ${outOfRange(v, v) ? 'disabled' : ''}>${d}</button>`;
        }
        const prev = new Date(view.y, view.m - 1, 1), next = new Date(view.y, view.m + 1, 1);
        prevOff = outOfRange(iso(prev.getFullYear(), prev.getMonth(), 1), iso(prev.getFullYear(), prev.getMonth(), 31));
        nextOff = outOfRange(iso(next.getFullYear(), next.getMonth(), 1), iso(next.getFullYear(), next.getMonth(), 31));
      } else if (view.mode === 'months') {
        title = String(view.y);
        grid += ' sfd-wide';
        cells = SHORT.map((s, i) => {
          const on = sel && sel.y === view.y && sel.m === i;
          return `<button type="button" class="sfd-cell${on ? ' sfd-on' : ''}" data-m="${i}" ${outOfRange(iso(view.y, i, 1), iso(view.y, i, 31)) ? 'disabled' : ''}>${s}</button>`;
        }).join('');
        prevOff = outOfRange(`${view.y - 1}-01-01`, `${view.y - 1}-12-31`);
        nextOff = outOfRange(`${view.y + 1}-01-01`, `${view.y + 1}-12-31`);
      } else {
        // Pages of 12 years, lined up with the earliest allowed year when there is one
        const base = min ? parse(min).y : 0;
        const from = base + Math.floor((view.y - base) / 12) * 12;
        grid += ' sfd-wide';
        const shown = [];
        for (let y = from; y < from + 12; y++) {
          if (outOfRange(`${y}-01-01`, `${y}-12-31`)) continue;  // only years that can be picked
          shown.push(y);
          const on = sel && sel.y === y;
          cells += `<button type="button" class="sfd-cell${on ? ' sfd-on' : ''}" data-y="${y}">${y}</button>`;
        }
        title = shown.length ? `${shown[0]} – ${shown[shown.length - 1]}` : `${from} – ${from + 11}`;
        prevOff = outOfRange(`${from - 12}-01-01`, `${from - 1}-12-31`);
        nextOff = outOfRange(`${from + 12}-01-01`, `${from + 23}-12-31`);
      }

      pop.innerHTML = `
        <div class="sfd-head">
          <button type="button" class="sfd-nav" data-step="-1" aria-label="Previous" ${prevOff ? 'disabled' : ''}>‹</button>
          <button type="button" class="sfd-title" aria-label="Change view">${title} ▾</button>
          <button type="button" class="sfd-nav" data-step="1" aria-label="Next" ${nextOff ? 'disabled' : ''}>›</button>
        </div>
        <div class="${grid}">${cells}</div>`;
      place();
    }

    pop.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.step) {
        const s = +b.dataset.step;
        if (view.mode === 'days') {
          view.m += s;
          if (view.m < 0) { view.m = 11; view.y--; }
          if (view.m > 11) { view.m = 0; view.y++; }
        } else view.y += view.mode === 'months' ? s : s * 12;
      } else if (b.classList.contains('sfd-title')) {
        view.mode = view.mode === 'days' ? 'months' : view.mode === 'months' ? 'years' : 'days';
      } else if (b.dataset.y) {
        view.y = +b.dataset.y; view.mode = 'months';
      } else if (b.dataset.m) {
        view.m = +b.dataset.m; view.mode = 'days';
      } else if (b.dataset.v) {
        return pick(b.dataset.v);
      }
      render();
    });

    function place() {
      const r = btn.getBoundingClientRect();
      const w = pop.offsetWidth, h = pop.offsetHeight;
      const left = Math.max(8, Math.min(r.left, innerWidth - w - 8));
      const below = r.bottom + 6 + h <= innerHeight || r.top < h + 6;
      pop.style.left = `${left}px`;
      pop.style.top = `${below ? Math.min(r.bottom + 6, innerHeight - h - 8) : r.top - h - 6}px`;
    }

    render();
  }

  document.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', close);
  document.addEventListener('scroll', e => { if (pop && !pop.contains(e.target)) close(); }, true);

  document.querySelectorAll('input[type="date"]').forEach(enhance);
  window.SwimDate = { enhance };
})();
