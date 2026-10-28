/* ============================================================
   SwimFest – Create meet: Host club and Venue pickers
   Host club suggests registered organizations (organizers and
   academies); Venue suggests pools already on SwimFest (past meets
   and academy pools) and fills in City, State, pool lengths and
   lanes. Typing something new is still allowed: the last option
   adds it as a new organization / venue.

   SwimPickers.attach(input, { items, describe, onPick, newLabel })
   SwimPickers.load() → { hosts, venues } from the database
   ============================================================ */
(function () {
  'use strict';

  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const css = `
  .ocp-wrap{position:relative}
  .ocp-list{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:50;background:#fff;border:1px solid #e2e8f0;border-radius:10px;
    box-shadow:0 12px 28px rgba(15,23,42,.14);max-height:16rem;overflow-y:auto;padding:4px}
  .ocp-opt{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;border:0;background:none;padding:8px 10px;border-radius:8px;cursor:pointer;font:inherit}
  .ocp-opt:hover,.ocp-opt.is-active{background:#e0f2fe}
  .ocp-main{font-size:.88rem;font-weight:600;color:#0f172a}
  .ocp-sub{font-size:.75rem;color:#64748b}
  .ocp-new .ocp-main{color:#0077b6}
  .ocp-head{font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;padding:6px 10px 2px}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function attach(input, { items, describe, onPick, newLabel, group }) {
    const wrap = document.createElement('div');
    wrap.className = 'ocp-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const list = document.createElement('div');
    list.className = 'ocp-list';
    list.hidden = true;
    list.setAttribute('role', 'listbox');
    wrap.appendChild(list);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('autocomplete', 'off');

    let shown = [], active = -1;

    function render() {
      document.querySelectorAll('.ocp-list').forEach(l => { if (l !== list) l.hidden = true; });   // one list open at a time
      const q = norm(input.value);
      const all = items();
      shown = all.filter(it => !q || norm(it.name).includes(q) || norm(describe(it)).includes(q)).slice(0, 12);
      const exact = all.some(it => norm(it.name) === q);
      let html = '', lastGroup = null;
      shown.forEach((it, i) => {
        const g = group ? group(it) : null;
        if (g && g !== lastGroup) { html += `<div class="ocp-head">${esc(g)}</div>`; lastGroup = g; }
        html += `<button type="button" class="ocp-opt${i === active ? ' is-active' : ''}" data-i="${i}" role="option">
          <span class="ocp-main">${esc(it.name)}</span>${describe(it) ? `<span class="ocp-sub">${esc(describe(it))}</span>` : ''}</button>`;
      });
      if (q && !exact) {
        html += `<button type="button" class="ocp-opt ocp-new" data-new="1" role="option"><span class="ocp-main">+ ${esc(newLabel)}: "${esc(input.value.trim())}"</span><span class="ocp-sub">Not on SwimFest yet. It is saved with this meet.</span></button>`;
      }
      list.innerHTML = html;
      list.hidden = !html;
      input.setAttribute('aria-expanded', String(!list.hidden));
    }
    const close = () => { list.hidden = true; active = -1; input.setAttribute('aria-expanded', 'false'); };
    const choose = i => { const it = shown[i]; if (!it) return; input.value = it.name; close(); onPick(it); };

    input.addEventListener('focus', render);
    input.addEventListener('input', () => { active = -1; render(); });
    input.addEventListener('keydown', e => {
      if (list.hidden) return;
      if (e.key === 'ArrowDown') { active = Math.min(active + 1, shown.length - 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); render(); e.preventDefault(); }
      else if (e.key === 'Enter' && active >= 0) { choose(active); e.preventDefault(); }
      else if (e.key === 'Escape') close();
    });
    list.addEventListener('mousedown', e => e.preventDefault());   // keep focus in the input
    list.addEventListener('click', e => {
      const b = e.target.closest('.ocp-opt');
      if (!b) return;
      if (b.dataset.new) { close(); onPick(null); } else choose(Number(b.dataset.i));
    });
    input.addEventListener('blur', () => setTimeout(close, 120));
  }

  // Registered organizations and known pools
  async function load() {
    const sb = window.sb;
    const [orgs, acads, meets] = await Promise.all([
      sb.from('organizer_directory').select('org_name, city, state, status'),
      sb.from('academies').select('academy_name, address_line, city, state, pool_length, lane_count, pool_type, status'),
      sb.from('tournaments').select('host_organization, venue_name, city, state, pool_length, lane_count, start_date').order('start_date', { ascending: false }),
    ]);
    const ok = r => !r.status || r.status === 'APPROVED_ACTIVE';
    const hosts = new Map(), venues = new Map();
    const addHost = (name, sub, kind) => { const k = norm(name); if (name && !hosts.has(k)) hosts.set(k, { name: name.trim(), sub, kind }); };
    (orgs.data || []).filter(ok).forEach(o => addHost(o.org_name, [o.city, o.state].filter(Boolean).join(', '), 'Registered organizers'));
    (acads.data || []).filter(ok).forEach(a => addHost(a.academy_name, [a.city, a.state].filter(Boolean).join(', '), 'Academies'));
    (meets.data || []).forEach(m => addHost(m.host_organization, 'Has hosted a meet', 'Past hosts'));

    // Venues: a pool is the same place even when typed with or without the city at the end
    const addVenue = (v, kind) => {
      if (!v.name) return;
      const k = norm(v.name.replace(new RegExp(`,?\\s*${(v.city || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), ''));
      if (!venues.has(k)) venues.set(k, { ...v, kind });
    };
    (meets.data || []).forEach(m => addVenue({ name: m.venue_name, city: m.city, state: m.state, pools: m.pool_length ? [m.pool_length] : [], lanes: m.lane_count }, 'Used for past meets'));
    (acads.data || []).filter(ok).forEach(a => addVenue({
      name: `${a.academy_name} pool${a.address_line ? `, ${a.address_line}` : ''}`, city: a.city, state: a.state,
      pools: a.pool_length ? [a.pool_length] : [], lanes: a.lane_count, type: a.pool_type,
    }, 'Academy pools'));
    return { hosts: [...hosts.values()], venues: [...venues.values()] };
  }

  window.SwimPickers = { attach, load, norm };
})();
