/* ============================================================
   SwimFest — event registration approvals   entryapprovals.js
   Shared by the Super Admin and Admin consoles.

   A parent's registration (booking + its races) starts PENDING.
   Super Admin decides any meet; an Admin decides the meets they are
   assigned to or created. The database enforces this in
   decide_booking() (backend/db/entry_approvals_and_login_logs.sql).
   ============================================================ */
(function () {
  const esc = s => (window.SF && SF.esc ? SF.esc(s) : String(s ?? ''));
  let onDecided = null;

  const day = d => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '';
  };

  // Meets this user may decide: null = all (super admin), else a Set of ids
  async function decidableMeets(session) {
    if (!session || session.role === 'super_admin') return null;
    const ids = new Set();
    const [assigned, created] = await Promise.all([
      window.sb.from('tournament_admins').select('tournament_id').eq('admin_id', session.userId),
      window.sb.from('tournaments').select('tournament_id').eq('created_by', session.userId),
    ]);
    (assigned.data || []).forEach(r => ids.add(r.tournament_id));
    (created.data || []).forEach(r => ids.add(r.tournament_id));
    return ids;
  }

  /** Pending registrations this user can decide → [{ booking, swimmer, meet, races }] */
  async function loadPending() {
    if (!window.sb) return { items: [], error: 'Not connected' };
    const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
    const { data, error } = await window.sb.from('bookings')
      .select('*, swimmers(*), tournaments(title, start_date, end_date, city, venue_name), event_entries(event_name, is_relay, is_im)')
      .eq('approval_status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(1000);
    if (error) {
      // Before the SQL migration runs there is no approval_status column
      if (/approval_status/i.test(error.message)) return { items: [], error: null, notReady: true };
      return { items: [], error: error.message };
    }
    const allowed = await decidableMeets(session);
    const items = (data || [])
      .filter(b => !allowed || allowed.has(b.tournament_id))
      .map(b => ({
        booking: b,
        swimmer: b.swimmers || {},
        meet: b.tournaments || {},
        races: (b.event_entries || []).map(e => e.event_name),
      }));
    return { items, error: null };
  }

  function rowHtml(it) {
    const b = it.booking, s = it.swimmer, m = it.meet;
    const cat = [s.gender === 'Girl' ? 'Girls' : s.gender === 'Boy' ? 'Boys' : '', s.category].filter(Boolean).join(' ');
    const dates = [day(m.start_date), day(m.end_date)].filter(Boolean).join(' – ');
    const sub = 'font-size:0.75rem;color:#64748b;margin-top:2px;';
    return `<tr id="ent-row-${esc(b.booking_id)}">
      <td>
        <div style="font-weight:700;">${esc(s.full_name || 'Swimmer')}</div>
        <div style="${sub}">${esc(cat || '—')}${s.date_of_birth ? ' · DOB ' + esc(s.date_of_birth) : ''}</div>
        <div style="${sub}">Parent: ${esc(s.parent_name || '—')}${s.parent_phone ? ' · ' + esc(s.parent_phone) : ''}</div>
      </td>
      <td>
        <div style="font-weight:600;">${esc(m.title || 'Meet')}</div>
        <div style="${sub}">${esc(dates)}${b.booking_ref ? ' · ' + esc(b.booking_ref) : ''}</div>
      </td>
      <td style="font-size:0.8rem;">${it.races.length ? it.races.map(esc).join('<br>') : '—'}</td>
      <td>${window.SwimDocs ? window.SwimDocs.linksHtml(s, 'sa-doc-link') : '—'}</td>
      <td class="ent-act" style="white-space:nowrap;">
        <button class="sa-btn-approve" onclick="SwimEntries.act(this, '${esc(b.booking_id)}', true)"><i class="fas fa-check"></i> Approve</button>
        <button class="sa-btn-reject" onclick="SwimEntries.act(this, '${esc(b.booking_id)}', false)"><i class="fas fa-times"></i> Decline</button>
      </td>
    </tr>`;
  }

  // Button handler: approve straight away; declining asks for a reason the parent will see
  async function act(btn, bookingId, approve) {
    const cell = btn.closest('td');
    const row = btn.closest('tr');
    const name = row ? (row.cells[0].querySelector('div') || {}).textContent : '';
    let notes = null;
    if (!approve) {
      notes = window.SwimReason
        ? await SwimReason.ask({ title: 'Decline this registration', subject: name, action: 'Decline',
            placeholder: 'e.g. Age proof does not match the date of birth entered. The parent will see this.' })
        : prompt('Reason for declining (the parent will see this):');
      if (!notes) return;
    }
    cell.querySelectorAll('button').forEach(b => { b.disabled = true; });
    const { error } = await window.sb.rpc('decide_booking', { p_booking_id: bookingId, p_approve: approve, p_notes: notes });
    if (error) {
      cell.querySelectorAll('button').forEach(b => { b.disabled = false; });
      if (window.SF) SF.toast((approve ? 'Approve' : 'Decline') + ' failed: ' + error.message, 'warn');
      return;
    }
    cell.innerHTML = approve
      ? '<span class="sa-action-done approved-tag"><i class="fas fa-check-circle"></i> Approved</span>'
      : '<span class="sa-action-done rejected-tag"><i class="fas fa-times-circle"></i> Declined</span>';
    if (window.SF) SF.toast(`${approve ? 'Approved' : 'Declined'}: ${name}`, approve ? 'success' : 'warn');
    if (onDecided) onDecided(bookingId, approve);
  }

  // Rows still showing buttons are still waiting
  const stillPending = tbody => tbody ? tbody.querySelectorAll('.ent-act button.sa-btn-approve').length : 0;

  window.SwimEntries = { loadPending, rowHtml, act, stillPending, onDecided: fn => { onDecided = fn; } };
})();
