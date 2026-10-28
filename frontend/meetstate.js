/* ============================================================
   SwimFest – where a meet stands right now, from its dates
   The stored status says what officials have done (published,
   player list locked, completed); the dates say where the meet is
   in time. Public pages use this so a meet that ended yesterday is
   never shown as "Live" or open for registration.

     SwimMeetState.phase(t)  → 'upcoming' | 'ongoing' | 'past' | null (not public)
     SwimMeetState.badge(t)  → { key, label, cls } for cards and filters
   Dates are whole local days: a meet on 15–16 Oct runs from
   15 Oct 00:00 until 16 Oct 23:59:59; entries close at the end
   of the deadline day.
   ============================================================ */
(function () {
  'use strict';

  const PUBLIC = ['PUBLISHED', 'CLOSED', 'LOCKED', 'CLOSURE_REQUESTED', 'COMPLETED'];
  const CLOSING_SOON_DAYS = 3;

  // "2026-10-16" → that day's start / end in local time
  const dayStart = d => { const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, dd); };
  const dayEnd = d => { const s = dayStart(d); s.setDate(s.getDate() + 1); return new Date(s - 1); };

  function phase(t, now = new Date()) {
    if (!t || !PUBLIC.includes(t.status)) return null;
    if (t.status === 'COMPLETED') return 'past';
    if (t.end_date && now > dayEnd(t.end_date)) return 'past';
    if (t.start_date && now >= dayStart(t.start_date)) return 'ongoing';
    return 'upcoming';
  }

  // Can a parent still register? Only before racing, while published, up to the end of the deadline day
  function entriesOpen(t, now = new Date()) {
    if (phase(t, now) !== 'upcoming' || t.status !== 'PUBLISHED') return false;
    return !t.registration_deadline || now <= dayEnd(t.registration_deadline);
  }

  function badge(t, now = new Date()) {
    const p = phase(t, now);
    if (p === 'past') return { key: 'completed', label: 'Completed', cls: 'status-completed' };
    if (p === 'ongoing') return { key: 'live-now', label: 'Live Now', cls: 'status-live' };
    if (entriesOpen(t, now)) {
      const left = t.registration_deadline ? (dayEnd(t.registration_deadline) - now) / 864e5 : Infinity;
      return left <= CLOSING_SOON_DAYS
        ? { key: 'closing-soon', label: 'Closing Soon', cls: 'status-closing-soon' }
        : { key: 'entries-open', label: 'Entries Open', cls: 'status-open' };
    }
    return { key: 'entries-closed', label: 'Entries Closed', cls: 'status-closing-soon' };
  }

  window.SwimMeetState = { phase, entriesOpen, badge, dayStart, dayEnd, PUBLIC };
})();
