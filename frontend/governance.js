/* ============================================================
   SwimFest – role matrix helpers (Section 11)
     SwimGov.audit(action, entity, id, notes)   log a staff action
     SwimGov.save(table, idCol, row, patch)      save only if nobody else
                                                 saved this row first
     SwimGov.isOwner()                           Master Owner or Co-Super Admin
     SwimGov.assignedMeetIds()                   meets an Admin may run
   Works before backend/db/rbac_governance.sql is run: version checks
   and assignments are simply skipped until the columns exist.
   ============================================================ */
(function () {
  'use strict';

  const session = () => (window.SwimAuth ? window.SwimAuth.getSession() : null) || {};

  // The database stamps the admin, time and IP address (rbac_governance.sql)
  async function audit(action, entity, id, notes) {
    if (!window.sb) return;
    try {
      const { error } = await window.sb.from('system_audit_logs').insert({
        admin_id: session().userId || null, action_type: action, target_entity: entity,
        target_entity_id: String(id ?? ''), notes,
      });
      if (error) console.warn('[SwimFest] audit log:', error.message);
    } catch (e) { console.warn('[SwimFest] audit log:', e.message); }
  }

  // Save a row only if it is still the version this page loaded.
  // Returns { error, conflict }: conflict = someone else saved it meanwhile.
  async function save(table, idCol, row, patch) {
    const id = row[idCol];
    let q = window.sb.from(table).update(patch).eq(idCol, id);
    const versioned = row.row_version != null;
    if (versioned) q = q.eq('row_version', row.row_version);
    const res = await q.select(`${idCol}${versioned ? ', row_version' : ''}`);
    if (res.error) return { error: res.error, conflict: false };
    if (!res.data || !res.data.length) {
      if (versioned) {
        // Still there? Then another admin changed it first
        const { data } = await window.sb.from(table).select(idCol).eq(idCol, id).maybeSingle();
        if (data) return { error: { message: 'Someone else changed this a moment ago. Reload to see their change, then try again.' }, conflict: true };
      }
      return { error: { message: 'Your account is not allowed to change this.' }, conflict: false };
    }
    if (versioned) row.row_version = res.data[0].row_version;
    return { error: null, conflict: false };
  }

  // Master Owner (true) or Co-Super Admin (false); null if not a super admin
  let ownerCache;
  async function isOwner() {
    const s = session();
    if (s.role !== 'super_admin') return null;
    if (ownerCache !== undefined) return ownerCache;
    ownerCache = true;   // until the column exists, every super admin is the Owner
    try {
      const { data, error } = await window.sb.from('profiles').select('is_master_owner').eq('id', s.userId).maybeSingle();
      if (!error && data && data.is_master_owner === false) ownerCache = false;
    } catch (_) {}
    return ownerCache;
  }

  // Meets an Admin may run: assigned to them, or created by them.
  // null = no limit (super admin, or assignments not set up yet).
  async function assignedMeetIds() {
    const s = session();
    if (s.role !== 'event_manager' || !window.sb) return null;
    const [asg, own] = await Promise.all([
      window.sb.from('tournament_admins').select('tournament_id').eq('admin_id', s.userId),
      window.sb.from('tournaments').select('tournament_id').eq('created_by', s.userId),
    ]);
    if (asg.error) { console.warn('[SwimFest] assignments not set up yet:', asg.error.message); return null; }
    return new Set([...(asg.data || []), ...(own.data || [])].map(r => r.tournament_id));
  }

  window.SwimGov = { audit, save, isOwner, assignedMeetIds };
})();
