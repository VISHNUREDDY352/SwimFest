/* ============================================================
   SwimFest repositories  ·  core/repos.js   (Repository pattern)
   Every database read/write the operations pages need, in one
   place, with explicit column lists. Pages ask a repository for
   data instead of building Supabase queries themselves.

   The one-call database functions (backend/db/perf_and_bulk.sql)
   are used when they exist; until that file has been run, each
   repository falls back to the older multi-request way so the
   site keeps working.
   ============================================================ */
(function () {
  'use strict';
  const SF = window.SF;
  const sb = () => SF.db.client;
  const missingFn = e => /function .* does not exist|could not find the function|PGRST202/i.test((e && (e.message || e.code)) || '');

  const MEET_COLS = 'tournament_id, title, city, venue_name, start_date, end_date, status, lane_count, pool_length, pool_lengths, events_offered, max_individual_events, created_by, row_version';

  /* ── Meets ─────────────────────────────────────────────── */
  SF.TournamentRepo = {
    /** Meets a staff member may run, newest first. statuses: array of status values */
    async listForStaff(statuses) {
      let q = sb().from('tournaments').select(MEET_COLS).order('start_date', { ascending: false });
      if (statuses) q = q.in('status', statuses);
      let { data, error } = await q;
      if (error && /pool_lengths|row_version|events_offered/.test(error.message)) {
        ({ data, error } = await sb().from('tournaments').select('*').in('status', statuses || []).order('start_date', { ascending: false }));
      }
      if (error) throw error;
      const mine = window.SwimGov ? await window.SwimGov.assignedMeetIds() : null;
      return { meets: mine ? (data || []).filter(t => mine.has(t.tournament_id)) : (data || []), limited: !!mine };
    },
  };

  /* ── Academies ─────────────────────────────────────────── */
  SF.AcademyRepo = {
    async listApproved() {
      const { data, error } = await sb().from('academies').select('academy_id, academy_name, city, status').order('academy_name');
      if (error) throw error;
      return (data || []).filter(a => !a.status || a.status === 'APPROVED_ACTIVE');
    },
  };

  /* ── Race entries ──────────────────────────────────────── */
  SF.EntryRepo = {
    /**
     * Every entry for a meet with swimmer name + academy (no 1000-row cap).
     * → [{ entryId, swimId, name, gender, category, event, seedMs, academy, isRelay, isIm }]
     */
    async listForMeet(tournamentId) {
      // '*' so a database without approval_status still loads; only approved
      // entries race (parent registrations wait for Admin / Super Admin approval)
      const all = await SF.db.fetchAll(() => sb().from('event_entries')
        .select('*')
        .eq('tournament_id', tournamentId).order('entry_id'));
      const rows = all.filter(r => !r.approval_status || r.approval_status === 'APPROVED');
      const dir = await SF.db.inChunks(rows.map(r => r.swimmer_id),
        chunk => sb().from('swimmer_directory').select('swimmer_id, full_name, academy_name').in('swimmer_id', chunk));
      const names = new Map(dir.map(s => [s.swimmer_id, s]));
      return rows.map(e => {
        const s = names.get(e.swimmer_id) || {};
        return {
          entryId: e.entry_id, swimId: e.swimmer_id, name: s.full_name || 'Unknown swimmer',
          gender: e.gender, category: e.category, event: e.event_name,
          seedMs: e.seed_time_ms && e.seed_time_ms > 0 ? e.seed_time_ms : null,
          academy: s.academy_name || 'Unattached', isRelay: !!e.is_relay, isIm: !!e.is_im,
        };
      });
    },
  };

  /* ── Heats ─────────────────────────────────────────────── */
  SF.HeatRepo = {
    /** { heats: distinct heats saved, results: lanes that already have a result } */
    async savedState(tournamentId) {
      const [heats, results] = await Promise.all([
        SF.db.fetchAll(() => sb().from('heat_rows').select('pool_label, event_no, heat_number')
          .eq('tournament_id', tournamentId).order('heat_row_id')),
        sb().from('heat_rows').select('heat_row_id', { count: 'exact', head: true }).eq('tournament_id', tournamentId)
          .or('finish_time_ms.not.is.null,status.neq.OK'),
      ]);
      return {
        heats: new Set(heats.map(h => `${h.pool_label}|${h.event_no}|${h.heat_number}`)).size,
        results: results.count || 0,
      };
    },

    /** Replace the meet's heats. rows: [{ event_entry_id, pool_label, event_no, heat_number, lane_number }] */
    async save(tournamentId, rows) {
      const { data, error } = await sb().rpc('save_heats', { p_tournament_id: tournamentId, p_rows: rows });
      if (!error) return data;
      if (!missingFn(error)) throw new Error(SF.db.why(error));
      return SF.HeatRepo._legacySave(tournamentId, rows);
    },

    // Before perf_and_bulk.sql: guarded delete + insert from the browser
    async _legacySave(tournamentId, rows) {
      const { count, error: e1 } = await sb().from('heat_rows').select('heat_row_id', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId).or('finish_time_ms.not.is.null,status.neq.OK');
      if (e1) throw e1;
      if (count) throw new Error('Results have already been entered for this meet. Heats can\'t be replaced.');
      const del = await sb().from('heat_rows').delete().eq('tournament_id', tournamentId);
      if (del.error) throw del.error;
      const full = rows.map(r => Object.assign({ tournament_id: tournamentId, status: 'OK' }, r));
      for (let i = 0; i < full.length; i += 500) {
        const { error } = await sb().from('heat_rows').insert(full.slice(i, i + 500));
        if (error) throw new Error('Saving stopped part-way: ' + SF.db.why(error) + ' Generate and save again.');
      }
      return full.length;
    },
  };

  /* ── Results ───────────────────────────────────────────── */
  SF.ResultRepo = {
    /**
     * Save many lanes at once. rows: [{ heat_row_id, prev_time_ms, prev_status,
     *   finish_time_ms, status, dq_code, set_rank, official_rank, points_awarded }]
     * → Set of heat_row_ids that were saved (others changed meanwhile).
     */
    async save(tournamentId, rows) {
      if (!rows.length) return new Set();
      const { data, error } = await sb().rpc('save_results', { p_tournament_id: tournamentId, p_rows: rows });
      if (!error) return new Set((data || []).map(x => (typeof x === 'string' ? x : x.save_results || Object.values(x)[0])));
      if (!missingFn(error)) throw new Error(SF.db.why(error));
      // Before perf_and_bulk.sql: one guarded update per lane
      const done = await Promise.all(rows.map(async r => {
        const patch = {
          finish_time_ms: r.finish_time_ms, status: r.status,
          dq_code: r.status === 'DQ' ? r.dq_code : null, updated_at: new Date().toISOString(),
        };
        if (r.set_rank) { patch.official_rank = r.official_rank; patch.points_awarded = r.points_awarded || 0; }
        let q = sb().from('heat_rows').update(patch).eq('heat_row_id', r.heat_row_id).eq('status', r.prev_status || 'OK');
        q = r.prev_time_ms == null ? q.is('finish_time_ms', null) : q.eq('finish_time_ms', r.prev_time_ms);
        const { data: d, error: e } = await q.select('heat_row_id');
        if (e) { console.error('[SwimFest] save lane:', e.message); return null; }
        return d && d.length ? r.heat_row_id : null;
      }));
      return new Set(done.filter(Boolean));
    },
  };

  /* ── Bulk import ───────────────────────────────────────── */
  SF.ImportRepo = {
    /**
     * rows: [{ row_no, full_name, gender, date_of_birth, category, parent_phone,
     *          academy_id, races: [{ event_name, is_im, seed_time_ms }] }]
     * → { swimmers_added, swimmers_reused, entries_added, entries_skipped }
     */
    async entries(tournamentId, rows) {
      const { data, error } = await sb().rpc('bulk_import_entries', { p_tournament_id: tournamentId, p_rows: rows });
      if (!error) return Array.isArray(data) ? data[0] : data;
      if (!missingFn(error)) throw new Error(SF.db.why(error));
      return SF.ImportRepo._legacy(tournamentId, rows);
    },

    // Before perf_and_bulk.sql: batched inserts (swimmers in one request, entries in one request)
    async _legacy(tournamentId, rows) {
      const swimmers = rows.map(r => ({
        full_name: r.full_name, gender: r.gender, date_of_birth: r.date_of_birth, category: r.category,
        parent_phone: r.parent_phone, academy_id: r.academy_id || null, status: 'APPROVED_ACTIVE',
      }));
      let { data: made, error } = await sb().from('swimmers').insert(swimmers).select('swimmer_id');
      if (error && /status/i.test(error.message)) {
        swimmers.forEach(s => delete s.status);
        ({ data: made, error } = await sb().from('swimmers').insert(swimmers).select('swimmer_id'));
      }
      if (error) throw new Error(SF.db.why(error));
      const entries = [];
      rows.forEach((r, i) => r.races.forEach(x => {
        const d = parseInt(x.event_name, 10);
        entries.push({
          tournament_id: tournamentId, swimmer_id: made[i].swimmer_id, event_name: x.event_name,
          stroke: x.is_im ? 'Medley' : (x.event_name.replace(/^\d+m\s*/i, '') || null),
          distance: [25, 50, 100, 200, 400].includes(d) ? d : null,
          category: r.category, gender: r.gender, seed_time_ms: x.seed_time_ms, is_relay: false, is_im: !!x.is_im,
        });
      }));
      const { error: e2 } = await sb().from('event_entries').insert(entries);
      if (e2) {
        await sb().from('swimmers').delete().in('swimmer_id', made.map(m => m.swimmer_id));
        throw new Error(SF.db.why(e2));
      }
      if (window.SwimGov) window.SwimGov.audit('BULK_IMPORT', 'TOURNAMENT', tournamentId, `${made.length} swimmers, ${entries.length} races`);
      return { swimmers_added: made.length, swimmers_reused: 0, entries_added: entries.length, entries_skipped: 0 };
    },
  };
})();
