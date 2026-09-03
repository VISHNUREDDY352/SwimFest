/* ============================================================
   SwimFest — Auth Helper (Supabase-backed)   auth.js
   Falls back to the local 'swimfest_session' mirror so pages
   that read synchronously still work. On pages that load the
   Supabase SDK + supabase.js, real auth is used.
   ============================================================ */
'use strict';

const SESSION_KEY = 'swimfest_session';

const SwimAuth = {
  // ── Local session mirror (fast, synchronous) ──────────────
  getSession() {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  },

  setSession(session, remember = true) {
    const store = remember ? localStorage : sessionStorage;
    store.setItem(SESSION_KEY, JSON.stringify(session));
  },

  isLoggedIn() { return this.getSession() !== null; },
  getRole()    { const s = this.getSession(); return s ? s.role : null; },

  // ── Supabase availability ─────────────────────────────────
  hasSupabase() { return !!(window.sb && window.sb.auth); },

  // ── Sign up (Supabase Auth + profile role via metadata) ───
  async signUp({ email, password, fullName, phone, role = 'swimmer' }) {
    if (!this.hasSupabase()) {
      // Demo fallback
      const session = { role, roleLabel: role, email, name: fullName, phone, loginAt: new Date().toISOString(), demo: true };
      this.setSession(session, true);
      return { ok: true, session, demo: true };
    }
    const { data, error } = await window.sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone, role } },
    });
    if (error) return { ok: false, error: error.message };

    let session = data.session;
    let user    = data.user;

    // If signup didn't return a session (confirmation off but no auto-session),
    // sign the user in immediately so they get a usable session + redirect.
    if (!session) {
      const signInRes = await window.sb.auth.signInWithPassword({ email, password });
      if (!signInRes.error && signInRes.data.session) {
        session = signInRes.data.session;
        user    = signInRes.data.user;
      }
    }

    // Ensure a profile row exists (in case the DB trigger didn't run)
    if (user) {
      try {
        await window.sb.from('profiles').upsert(
          { id: user.id, full_name: fullName, phone, role },
          { onConflict: 'id' }
        );
      } catch (_) {}
    }

    const localSession = {
      role, roleLabel: role, email,
      name: fullName, phone,
      userId: user ? user.id : null,
      loginAt: new Date().toISOString(),
    };
    this.setSession(localSession, true);

    // needsConfirm only if we truly couldn't get a session (email confirm still on)
    return { ok: true, session: localSession, needsConfirm: !session };
  },

  // ── Sign in ───────────────────────────────────────────────
  async signIn({ email, password, role, remember = true }) {
    if (!this.hasSupabase()) {
      const session = { role, roleLabel: role, email, name: email.split('@')[0], loginAt: new Date().toISOString(), demo: true };
      this.setSession(session, remember);
      return { ok: true, session, demo: true };
    }
    const { data, error } = await window.sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };

    // Pull role from profile (fallback to the role chosen on the form)
    let resolvedRole = role;
    let fullName = email.split('@')[0];
    let phone = '';
    try {
      const { data: prof } = await window.sb
        .from('profiles').select('role, full_name, phone').eq('id', data.user.id).single();
      if (prof) {
        resolvedRole = prof.role || role;
        fullName = prof.full_name || fullName;
        phone = prof.phone || '';
      }
    } catch (_) {}

    const session = {
      role: resolvedRole, roleLabel: resolvedRole, email,
      name: fullName, phone,
      userId: data.user.id,
      loginAt: new Date().toISOString(),
    };
    this.setSession(session, remember);
    return { ok: true, session };
  },

  // ── Add organizer capability to an EXISTING account ───────
  // Used when someone who already signed up (e.g. as a swimmer)
  // wants to also become an organizer with the SAME email.
  // Verifies ownership by signing in with the given password,
  // then upgrades the profile role to 'organizer'.
  async becomeOrganizer({ email, password, fullName, phone }) {
    if (!this.hasSupabase()) return { ok: false, error: 'Auth unavailable.' };

    const signInRes = await window.sb.auth.signInWithPassword({ email, password });
    if (signInRes.error || !signInRes.data.session) {
      return { ok: false, error: 'wrong_password' };
    }
    const user = signInRes.data.user;

    // Upgrade the profile role to organizer via the safe RPC
    // (direct profile update is blocked by the no-self-escalate policy).
    try { await window.sb.rpc('become_organizer'); } catch (_) {}
    // Best-effort keep name/phone current (allowed by self-update policy)
    try {
      await window.sb.from('profiles').update({ full_name: fullName || user.email, phone }).eq('id', user.id);
    } catch (_) {}

    const session = {
      role: 'organizer', roleLabel: 'organizer', email,
      name: fullName || (user.user_metadata && user.user_metadata.full_name) || email.split('@')[0],
      phone, userId: user.id, loginAt: new Date().toISOString(),
    };
    this.setSession(session, true);
    return { ok: true, session, upgraded: true };
  },

  // ── Logout, then route to the right place ─────────────────
  // Staff (super_admin / organizer / event_manager) → login.html
  // Swimmers / public → index.html
  async logoutAndRedirect() {
    const role = this.getRole();
    const staff = ['super_admin', 'organizer', 'event_manager'];
    await this.logout();
    window.location.href = staff.includes(role) ? 'login.html' : 'index.html';
  },

  // ── Logout ────────────────────────────────────────────────
  async logout() {
    if (this.hasSupabase()) { try { await window.sb.auth.signOut(); } catch (_) {} }
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  },

  // ── Guard ─────────────────────────────────────────────────
  requireLogin(opts = {}) {
    const session = this.getSession();
    const loginPage = opts.redirect || 'login.html';
    if (!session) {
      const returnTo = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
      window.location.href = `${loginPage}?returnTo=${returnTo}&reason=login_required`;
      return null;
    }
    if (opts.allowedRoles && !opts.allowedRoles.includes(session.role)) {
      window.location.href = `${loginPage}?returnTo=${encodeURIComponent(window.location.pathname.split('/').pop())}&reason=wrong_role`;
      return null;
    }
    return session;
  },

  // ── Nav button updater ────────────────────────────────────
  updateNavButtons() {
    const session = this.getSession();
    // Each role's profile page (organizer has its own; EM/super_admin use dashboards)
    const profilePage = {
      swimmer:'profile.html', organizer:'orgprofile.html',
      event_manager:'emdashboard.html', super_admin:'superadmin.html',
    };

    document.querySelectorAll('.btn-profile').forEach(btn => {
      if (session) {
        btn.setAttribute('href', profilePage[session.role] || 'profile.html');
        const label = (session.role === 'swimmer' || session.role === 'organizer') ? 'Profile' : 'Dashboard';
        btn.innerHTML = `<i class="fas fa-user"></i> ${label}`;
      } else {
        btn.setAttribute('href', 'profile.html');
        btn.innerHTML = `<i class="fas fa-user"></i> Profile`;
      }
    });

    document.querySelectorAll('.btn-register-login').forEach(btn => {
      if (session) {
        btn.setAttribute('href', '#');
        btn.innerHTML = `<i class="fas fa-sign-out-alt"></i> Logout`;
        btn.onclick = async (e) => { e.preventDefault(); await SwimAuth.logoutAndRedirect(); };
      } else {
        btn.setAttribute('href', 'login.html');
        btn.textContent = 'Register / Login';
        btn.onclick = null;
      }
    });
  },
};

window.SwimAuth = SwimAuth;

document.addEventListener('DOMContentLoaded', () => {
  try { SwimAuth.updateNavButtons(); } catch (_) {}

  // Wire any staff-page logout control to a real logout + redirect.
  // Covers superadmin (.sa-logout), admin (.admin-logout-btn),
  // and dashboards (.dash-logout).
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.sa-logout, .admin-logout-btn, .dash-logout, [data-logout]');
    if (!btn) return;
    e.preventDefault();
    SwimAuth.logoutAndRedirect();
  });
});
