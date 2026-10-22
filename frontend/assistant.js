/* ============================================================
   SwimFest — "Ask SwimFest" chat   assistant.js
   A floating chat button, read-only (it looks things up, never edits).
   - Staff pages: <script src="assistant.js"> — only shown to signed-in
     Admins and super admins.
   - Public pages: <script src="assistant.js" data-mode="public"> — shown
     to everyone; a signed-in parent can also ask about their own swimmers.
   Questions go to /api/agent with the user's own sign-in (if any).
   ============================================================ */
'use strict';

(function () {
  const STAFF_ROLES = ['event_manager', 'super_admin'];
  const MODE = (document.currentScript && document.currentScript.dataset.mode) === 'public' ? 'public' : 'staff';
  const STORE_KEY = MODE === 'public' ? 'swimfest_helper_chat' : 'swimfest_assistant_chat';
  const MAX_KEEP = 12;

  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  if (MODE === 'staff' && (!session || !STAFF_ROLES.includes(session.role))) return;

  const COPY = MODE === 'public' ? {
    subtitle: 'Help with meets, entries and academies',
    intro: name => `Hi${name ? ' ' + name : ''}! Ask me about open meets, deadlines, fees, which age group your child is in, academies near you, or how to register.`,
    placeholder: 'Ask about meets, age groups, academies…',
    note: 'Answers come from SwimFest\'s meet listings. Check the meet page before you pay or travel.',
    suggestions: [
      'Which meets are open for entries?',
      'My child was born in 2014. Which age group?',
      'Which academies in Chennai have a 50 m pool?',
      'How do I register my swimmer?',
      ...(session ? ['How did my swimmer do?'] : []),
    ],
  } : {
    subtitle: 'Staff assistant · looks things up, never edits',
    intro: name => `Hi ${name || 'there'}. Ask me about meets, entries, payments, heats, results, approvals, academies or swimmers.`,
    placeholder: 'Ask about meets, entries, payments, results…',
    note: 'Answers come from SwimFest\'s database. Check important figures before acting on them.',
    suggestions: [
      'What is waiting for approval?',
      'Summarise the upcoming meets',
      'Which meets close entries in the next 2 weeks?',
      'How many swimmers have entered each open meet?',
    ],
  };

  let history = [];
  try { history = JSON.parse(sessionStorage.getItem(STORE_KEY) || '[]'); } catch (_) { history = []; }
  let busy = false;

  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Escaped text with this site's own links made clickable
  function linkify(escaped) {
    return escaped.replace(/https?:\/\/[^\s<)]+/g, url => {
      let u;
      try { u = new URL(url.replace(/&amp;/g, '&')); } catch (_) { return url; }
      if (u.origin !== location.origin && !/swim-fest/.test(u.hostname)) return url;
      const path = u.pathname + u.search;
      const label = /\/register/.test(u.pathname) ? 'Register' : /\/event/.test(u.pathname) ? 'Open meet page' : /\/academy/.test(u.pathname) ? 'Academy directory' : path;
      return `<a href="${esc(path)}">${label}</a>`;
    });
  }

  // Plain text with "- " lists → safe HTML
  function format(text) {
    const lines = String(text || '').split('\n');
    let html = '', inList = false;
    lines.forEach(line => {
      const item = /^\s*[-•]\s+(.*)$/.exec(line);
      if (item) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${linkify(esc(item[1]))}</li>`;
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        if (line.trim()) html += `<p>${linkify(esc(line))}</p>`;
      }
    });
    if (inList) html += '</ul>';
    return html || '<p></p>';
  }

  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-MAX_KEEP))); } catch (_) {}
  }

  // ── Styles ──
  const css = document.createElement('style');
  css.textContent = `
    .sfa-fab { position:fixed; right:calc(20px + env(safe-area-inset-right, 0px)); bottom:calc(20px + env(safe-area-inset-bottom, 0px)); z-index:9000;
      display:flex; align-items:center; gap:8px; height:52px; padding:0 20px; border:0; border-radius:999px; background:#0b3a53; color:#fff;
      font:600 0.92rem Inter, system-ui, sans-serif; cursor:pointer; box-shadow:0 8px 24px rgba(11,27,51,0.3); }
    .sfa-fab:hover { background:#082c40; }
    .sfa-fab:focus-visible, .sfa-panel :focus-visible { outline:2px solid #38bdf8; outline-offset:2px; }
    .sfa-fab[hidden], .sfa-panel[hidden] { display:none; }
    .sfa-panel { position:fixed; right:calc(20px + env(safe-area-inset-right, 0px)); bottom:calc(20px + env(safe-area-inset-bottom, 0px)); z-index:9001;
      width:min(26rem, calc(100vw - 40px)); height:min(36rem, calc(100vh - 40px)); display:flex; flex-direction:column;
      background:#fff; border:1px solid #dde7ec; border-radius:18px; box-shadow:0 18px 48px rgba(11,27,51,0.28); overflow:hidden;
      font-family:Inter, system-ui, sans-serif; color:#0b2233; }
    .sfa-head { display:flex; align-items:center; gap:10px; padding:14px 16px; background:#0b3a53; color:#fff; }
    .sfa-head-text { flex:1; min-width:0; }
    .sfa-head b { display:block; font-size:0.98rem; }
    .sfa-head small { font-size:0.74rem; color:#c9e3ec; }
    .sfa-icon-btn { width:36px; height:36px; border:0; border-radius:8px; background:transparent; color:#fff; cursor:pointer; font-size:0.95rem; }
    .sfa-icon-btn:hover { background:rgba(255,255,255,0.12); }
    .sfa-log { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px; background:#f4f8fa; }
    .sfa-msg { max-width:88%; padding:10px 14px; border-radius:14px; font-size:0.88rem; line-height:1.5; overflow-wrap:anywhere; }
    .sfa-msg p { margin:0 0 6px; } .sfa-msg p:last-child { margin-bottom:0; }
    .sfa-bot a { color:#0369a1; font-weight:600; }
    .sfa-msg ul { margin:4px 0 6px; padding-left:18px; } .sfa-msg li { margin:2px 0; }
    .sfa-user { align-self:flex-end; background:#0b3a53; color:#fff; border-bottom-right-radius:4px; }
    .sfa-bot { align-self:flex-start; background:#fff; border:1px solid #dde7ec; border-bottom-left-radius:4px; }
    .sfa-err { align-self:flex-start; background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; }
    .sfa-wait { align-self:flex-start; color:#5b7383; font-size:0.84rem; display:flex; align-items:center; gap:8px; }
    .sfa-intro { color:#33495a; font-size:0.88rem; line-height:1.55; }
    .sfa-intro p { margin:0 0 10px; }
    .sfa-chips { display:flex; flex-direction:column; gap:6px; }
    .sfa-chip { text-align:left; padding:9px 12px; border-radius:10px; border:1px solid #cfe6ee; background:#fff; color:#0b3a53;
      font:500 0.84rem Inter, system-ui, sans-serif; cursor:pointer; }
    .sfa-chip:hover { background:#e3f2f6; }
    .sfa-form { display:flex; gap:8px; padding:12px; border-top:1px solid #dde7ec; background:#fff; }
    .sfa-input { flex:1; min-width:0; resize:none; height:44px; max-height:120px; padding:11px 12px; border:1px solid #cbd5e1; border-radius:10px;
      font:0.9rem Inter, system-ui, sans-serif; color:#0b2233; }
    .sfa-input:focus { border-color:#0369a1; outline:none; box-shadow:0 0 0 3px #e0f2fe; }
    .sfa-send { width:44px; height:44px; flex:none; border:0; border-radius:10px; background:#0b3a53; color:#fff; cursor:pointer; }
    .sfa-send:disabled { opacity:0.5; cursor:not-allowed; }
    .sfa-note { padding:0 12px 10px; font-size:0.72rem; color:#5b7383; background:#fff; }
    @media (prefers-reduced-motion: reduce) { .sfa-wait i { animation:none !important; } }
  `;
  document.head.appendChild(css);

  // ── Markup ──
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'sfa-fab';
  fab.setAttribute('aria-haspopup', 'dialog');
  fab.innerHTML = '<i class="fas fa-comments" aria-hidden="true"></i> Ask SwimFest';

  const panel = document.createElement('section');
  panel.className = 'sfa-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', MODE === 'public' ? 'Ask SwimFest' : 'SwimFest staff assistant');
  panel.innerHTML = `
    <div class="sfa-head">
      <i class="fas fa-comments" aria-hidden="true"></i>
      <div class="sfa-head-text"><b>Ask SwimFest</b><small>${COPY.subtitle}</small></div>
      <button type="button" class="sfa-icon-btn" data-act="clear" aria-label="Start a new chat" title="New chat"><i class="fas fa-rotate-left"></i></button>
      <button type="button" class="sfa-icon-btn" data-act="close" aria-label="Close"><i class="fas fa-times"></i></button>
    </div>
    <div class="sfa-log" aria-live="polite"></div>
    <form class="sfa-form">
      <label for="sfaInput" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);">Your question</label>
      <textarea id="sfaInput" class="sfa-input" rows="1" maxlength="1000" placeholder="${COPY.placeholder}"></textarea>
      <button type="submit" class="sfa-send" aria-label="Send"><i class="fas fa-paper-plane"></i></button>
    </form>
    <div class="sfa-note">${COPY.note}</div>`;

  document.body.appendChild(fab);
  document.body.appendChild(panel);
  const bottomBar = document.querySelector('.mobile-register-btn, .checkout-footer-bar, .mobile-bottom-bar');
  if (bottomBar) {
    const lift = () => {
      const shown = getComputedStyle(bottomBar).display !== 'none' && bottomBar.getBoundingClientRect().height > 0;
      fab.style.bottom = shown ? `calc(${Math.round(bottomBar.getBoundingClientRect().height) + 28}px + env(safe-area-inset-bottom, 0px))` : '';
    };
    lift();
    window.addEventListener('resize', lift);
  }

  const log = panel.querySelector('.sfa-log');
  const form = panel.querySelector('.sfa-form');
  const input = panel.querySelector('#sfaInput');
  const sendBtn = panel.querySelector('.sfa-send');

  function render(waiting) {
    if (!history.length && !waiting) {
      log.innerHTML = `<div class="sfa-intro">
        <p>${esc(COPY.intro(session && session.name ? session.name.replace(/\s*\(Parent\)$/i, '').split(' ')[0] : ''))}</p>
        <div class="sfa-chips">${COPY.suggestions.map(s => `<button type="button" class="sfa-chip">${esc(s)}</button>`).join('')}</div>
      </div>`;
      log.querySelectorAll('.sfa-chip').forEach(b => b.addEventListener('click', () => ask(b.textContent)));
      return;
    }
    log.innerHTML = history.map(m => m.role === 'user'
      ? `<div class="sfa-msg sfa-user">${format(m.content)}</div>`
      : `<div class="sfa-msg ${m.error ? 'sfa-err' : 'sfa-bot'}">${format(m.content)}</div>`).join('')
      + (waiting ? '<div class="sfa-wait"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Looking it up…</div>' : '');
    log.scrollTop = log.scrollHeight;
  }

  async function ask(text) {
    const question = String(text || '').trim();
    if (!question || busy) return;
    busy = true;
    sendBtn.disabled = true;
    history.push({ role: 'user', content: question });
    input.value = '';
    render(true);

    let reply;
    try {
      let token = null;
      if (window.sb && window.sb.auth) {
        const { data } = await window.sb.auth.getSession();
        token = data && data.session && data.session.access_token;
      }
      if (!token && MODE === 'staff') throw new Error('Your sign-in has expired. Sign in again to use the assistant.');
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        // Only past questions and answers are sent, never error notes
        body: JSON.stringify({
          mode: MODE,
          messages: history.filter(m => !m.error).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `The assistant couldn't answer (error ${res.status}).`);
      reply = { role: 'assistant', content: body.answer || 'No answer came back.' };
    } catch (e) {
      reply = { role: 'assistant', content: e.message || 'Something went wrong. Try again.', error: true };
    }
    history.push(reply);
    save();
    busy = false;
    sendBtn.disabled = false;
    render(false);
    input.focus();
  }

  function open() {
    panel.hidden = false;
    fab.hidden = true;
    render(false);
    input.focus();
  }
  function close() {
    panel.hidden = true;
    fab.hidden = false;
    fab.focus();
  }

  fab.addEventListener('click', open);
  panel.querySelector('[data-act="close"]').addEventListener('click', close);
  panel.querySelector('[data-act="clear"]').addEventListener('click', () => {
    history = [];
    save();
    render(false);
    input.focus();
  });
  form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); }
  });
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();
