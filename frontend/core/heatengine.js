/* ============================================================
   SwimFest heat engine  ·  core/heatengine.js
   Pure functions (no page, no database) so they can be tested.

     laneOrder(n)              centre-out lane order for any lane count
     SEEDING                   seeding strategies (Strategy pattern):
                               standard  fastest heat last, slowest first
                               circle    top swimmers spread over the
                                         last 3 heats, the rest standard
     relayTeams(entries)       relay entries → academy teams of 4
     compareEvents(a, b)       meet order: age, gender, stroke, distance
     generate(entries, pools, options)
                               → events [{ eventNum, poolId, …, heats }]
     schedule(events, opts)    estimated start per heat, one clock per pool

   Entry shape in:  { entryId, swimId, name, gender, category, event,
                      seedMs (null = NT), academy, isRelay }
   ============================================================ */
(function (root) {
  'use strict';

  const CAT_ORDER = { 'U-10': 0, 'U-12': 1, 'U-14': 2, 'U-16': 3 };
  const STROKES = ['freestyle', 'backstroke', 'breaststroke', 'butterfly', 'individual medley', 'medley'];
  const MIN_PER_HEAT = 3;
  const RELAY_SIZE = 4;

  const distanceOf = name => parseInt(String(name).replace(/^\d+\s*[x×]\s*/i, ''), 10) || 0;
  const strokeRank = name => {
    const n = String(name).toLowerCase();
    if (/relay/.test(n)) return 100;
    const i = STROKES.findIndex(s => n.includes(s));
    return i < 0 ? 50 : i;
  };
  const seedKey = e => (e.seedMs && e.seedMs > 0 ? e.seedMs : Infinity);
  const bySeed = (a, b) => seedKey(a) - seedKey(b) || String(a.name).localeCompare(String(b.name));

  /** Lanes in seed order, centre outwards: 8 → [4,5,3,6,2,7,1,8] */
  function laneOrder(n) {
    const out = [];
    const mid = Math.ceil(n / 2);
    out.push(mid);
    for (let k = 1; out.length < n; k++) {
      if (mid + k <= n) out.push(mid + k);
      if (mid - k >= 1 && out.length < n) out.push(mid - k);
    }
    return out;
  }

  /** Split swimmers (fastest first) into heats; heats[0] = slowest heat */
  function standardHeats(sorted, lanes) {
    const count = Math.ceil(sorted.length / lanes);
    const heats = Array.from({ length: count }, () => []);
    sorted.forEach((e, i) => heats[count - 1 - Math.floor(i / lanes)].push(e));
    // The slowest heat needs at least 3 swimmers: borrow the slowest from the next heat
    if (count > 1) {
      heats[1].sort(bySeed);
      while (heats[0].length < MIN_PER_HEAT && heats[1].length > MIN_PER_HEAT) heats[0].push(heats[1].pop());
    }
    return heats;
  }

  const SEEDING = {
    standard: {
      label: 'Standard (slowest heat first, fastest heat last)',
      heats(sorted, lanes) { return standardHeats(sorted, lanes); },
    },
    circle: {
      label: 'Circle seeding (top swimmers spread over the last 3 heats)',
      heats(sorted, lanes) {
        const total = Math.ceil(sorted.length / lanes);
        const circ = Math.min(3, total);
        if (circ < 2) return standardHeats(sorted, lanes);
        const top = sorted.slice(0, circ * lanes);
        const rest = sorted.slice(circ * lanes);
        const restHeats = rest.length ? standardHeats(rest, lanes) : [];
        const circHeats = Array.from({ length: circ }, () => []);
        // fastest → last heat, 2nd → second-last, 3rd → third-last, 4th → last …
        top.forEach((e, i) => circHeats[circ - 1 - (i % circ)].push(e));
        return [...restHeats, ...circHeats].filter(h => h.length);
      },
    },
  };

  /** Relay entries (one row per swimmer) → teams of up to 4 from one academy */
  function relayTeams(entries) {
    const byAcad = new Map();
    entries.forEach(e => {
      const k = e.academy && e.academy !== 'Unattached' ? e.academy : 'Unattached';
      (byAcad.get(k) || byAcad.set(k, []).get(k)).push(e);
    });
    const teams = [];
    [...byAcad.keys()].sort().forEach(acad => {
      const list = byAcad.get(acad).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
      const n = Math.ceil(list.length / RELAY_SIZE);
      for (let t = 0; t < n; t++) {
        const members = list.slice(t * RELAY_SIZE, (t + 1) * RELAY_SIZE);
        const seeds = members.map(m => m.seedMs).filter(s => s > 0);
        teams.push({
          team: true,
          name: `${acad}${n > 1 ? ' ' + String.fromCharCode(65 + t) : ''}`,
          academy: acad,
          members,
          seedMs: seeds.length === members.length ? seeds.reduce((a, b) => a + b, 0) : null,
          category: members[0].category, gender: members[0].gender, event: members[0].event,
          short: members.length < RELAY_SIZE,
        });
      }
    });
    return teams;
  }

  function compareEvents(a, b) {
    return (a.isRelay - b.isRelay)
      || ((CAT_ORDER[a.category] ?? 9) - (CAT_ORDER[b.category] ?? 9))
      || (a.gender === b.gender ? 0 : a.gender === 'Boy' ? -1 : 1)
      || (strokeRank(a.eventName) - strokeRank(b.eventName))
      || (distanceOf(a.eventName) - distanceOf(b.eventName))
      || String(a.eventName).localeCompare(String(b.eventName));
  }

  /** Put swimmers (or relay teams) of one heat into lanes, fastest in the middle */
  function assignLanes(swimmers, lanes) {
    const order = laneOrder(lanes);
    const out = Array.from({ length: lanes }, (_, i) => ({ lane: i + 1, empty: true }));
    swimmers.slice().sort(bySeed).forEach((s, rank) => {
      const lane = order[rank];
      out[lane - 1] = Object.assign({}, s, { lane, seedRank: rank + 1, empty: false });
    });
    return out;
  }

  /**
   * generate(entries, pools, { seeding: 'standard' | 'circle' })
   * pools: [{ id, label, lanes, categories: ['U-10', …] }]  (a later pool wins an age group ticked twice)
   * Returns { events, unrouted }
   */
  function generate(entries, pools, options = {}) {
    const strat = SEEDING[options.seeding] || SEEDING.standard;
    const unrouted = [];
    const groups = new Map();
    entries.forEach(e => {
      const pool = pools.slice().reverse().find(p => p.categories.includes(e.category));
      if (!pool) { unrouted.push(e); return; }
      const key = `${pool.id}|${e.category}|${e.gender}|${e.event}`;
      if (!groups.has(key)) groups.set(key, { pool, category: e.category, gender: e.gender, eventName: e.event, isRelay: !!e.isRelay, entries: [] });
      groups.get(key).entries.push(e);
      if (e.isRelay) groups.get(key).isRelay = true;
    });

    const events = [];
    pools.forEach(pool => {
      [...groups.values()].filter(g => g.pool === pool).sort(compareEvents).forEach(g => {
        const units = g.isRelay ? relayTeams(g.entries) : g.entries.slice();
        const sorted = units.sort(bySeed);
        const raw = strat.heats(sorted, pool.lanes);
        const heats = raw.map((list, i) => ({
          heatNumber: i + 1,
          totalHeats: raw.length,
          isFastest: i === raw.length - 1,
          lanes: assignLanes(list, pool.lanes),
          count: list.length,
        }));
        events.push({
          poolId: pool.id, poolLabel: pool.label, poolLanes: pool.lanes,
          category: g.category, gender: g.gender, eventName: g.eventName, isRelay: g.isRelay,
          totalEntries: g.entries.length, units: units.length, heats,
        });
      });
    });
    // One event number sequence across all pools
    events.forEach((ev, i) => { ev.eventNum = i + 1; });
    return { events, unrouted };
  }

  /** Minutes per heat for a race (relay / 400 m / 100–200 m / 25–50 m) */
  function bufferFor(ev, b) {
    if (ev.isRelay || /relay/i.test(ev.eventName)) return b.relay;
    const d = distanceOf(ev.eventName);
    if (d >= 400) return b.long != null ? b.long : b.mid * 2;
    if (d >= 100) return b.mid;
    return b.short;
  }

  /** Each pool runs its own clock from the session start (minutes after midnight) */
  function schedule(events, { start = 510, buffers = { short: 2, mid: 3, relay: 3.5 } } = {}) {
    const clocks = {};
    events.forEach(ev => {
      if (clocks[ev.poolId] == null) clocks[ev.poolId] = start;
      const mins = bufferFor(ev, buffers);
      ev.heats.forEach(h => { h.startMin = clocks[ev.poolId]; clocks[ev.poolId] += mins; });
    });
    return clocks;
  }

  function clock12(totalMinutes) {
    const mins = Math.round(totalMinutes) % (24 * 60);
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }

  /** Flatten to heat_rows (relay team members share their team's lane) */
  function toHeatRows(events) {
    const rows = [];
    events.forEach(ev => ev.heats.forEach(h => h.lanes.forEach(l => {
      if (l.empty) return;
      const members = l.team ? l.members : [l];
      members.forEach(m => rows.push({
        event_entry_id: m.entryId, pool_label: ev.poolLabel, event_no: ev.eventNum,
        heat_number: h.heatNumber, lane_number: l.lane,
      }));
    })));
    return rows;
  }

  const api = { laneOrder, SEEDING, relayTeams, compareEvents, generate, schedule, clock12, toHeatRows, distanceOf, MIN_PER_HEAT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.SF = root.SF || {}; root.SF.HeatEngine = api; }
})(typeof window !== 'undefined' ? window : globalThis);
