/* ============================================================
   SwimFest entry import  ·  core/entryimport.js
   Spreadsheet → swimmers + race entries for one meet.
   Builds on SF.Importer (Template Method): this file only supplies
   the columns, the checks and the save. Used on Heat generation
   and on the Player list.

   One row = one swimmer in one race. A swimmer in three races has
   three rows with the same name and date of birth.
   Needs: core/sf.js, core/components.js, core/repos.js, events.js
   ============================================================ */
(function () {
  'use strict';
  const SF = window.SF;
  const IM_RACE = '100m Individual Medley';
  const CATEGORIES = [
    { label: 'U-10', min: 8, max: 9 }, { label: 'U-12', min: 10, max: 11 },
    { label: 'U-14', min: 12, max: 13 }, { label: 'U-16', min: 14, max: 15 },
  ];

  /** 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'DD-MM-YYYY' | Excel serial → 'YYYY-MM-DD' or null */
  function parseDob(v) {
    const s = String(v || '').trim();
    let y, m, d, x;
    if ((x = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s))) [, y, m, d] = x;
    else if ((x = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s))) [, d, m, y] = x;
    else if (/^\d{5}$/.test(s)) {                      // Excel day number
      const dt = new Date(Date.UTC(1899, 11, 30) + Number(s) * 864e5);
      return dt.toISOString().slice(0, 10);
    } else return null;
    const dt = new Date(Date.UTC(+y, +m - 1, +d));
    if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +m - 1 || dt.getUTCDate() !== +d) return null;
    return dt.toISOString().slice(0, 10);
  }

  function parseGender(v) {
    const s = SF.norm(v);
    if (['boy', 'boys', 'b', 'm', 'male'].includes(s)) return 'Boy';
    if (['girl', 'girls', 'g', 'f', 'female'].includes(s)) return 'Girl';
    return null;
  }

  function racesFor(meet, gender, category) {
    const offered = meet && Array.isArray(meet.events_offered) && meet.events_offered.length ? new Set(meet.events_offered) : null;
    const races = (window.SWIMFEST_EVENT_MASTER || [])
      .filter(e => e.gender === gender && e.category === category && (!offered || offered.has(e.name)))
      .map(e => e.name);
    if (!offered || offered.has(IM_RACE)) races.push(IM_RACE);
    return races;
  }

  SF.EntryImporter = class extends SF.Importer {
    constructor() {
      super();
      this.title = 'Import swimmers and races';
      this.templateName = 'swimfest_entries_template';
      this.columns = [
        { key: 'name', label: 'Full name', required: true, aliases: ['name', 'swimmer', 'swimmer name'], hint: 'as it should appear on heat sheets' },
        { key: 'gender', label: 'Gender', required: true, aliases: ['sex'], hint: 'Boy or Girl' },
        { key: 'dob', label: 'Date of birth', required: true, aliases: ['dob', 'birth date'], hint: 'YYYY-MM-DD, e.g. 2014-05-21' },
        { key: 'phone', label: 'Parent phone', required: true, aliases: ['phone', 'mobile', 'contact', 'parent mobile'], hint: 'up to 15 digits' },
        { key: 'academy', label: 'Academy', aliases: ['club', 'team'], hint: 'exact academy name, or leave blank' },
        { key: 'race', label: 'Race', required: true, aliases: ['event', 'event name', 'race name'], hint: 'e.g. 50m Freestyle' },
        { key: 'seed', label: 'Seed time', aliases: ['seed', 'entry time', 'best time'], hint: 'mm:ss.hh (00:38.50) or NT' },
      ];
      this.templateRows = [
        ['Arjun Kumar', 'Boy', '2014-05-21', '9876543210', '', '50m Freestyle', '00:38.50'],
        ['Arjun Kumar', 'Boy', '2014-05-21', '9876543210', '', '50m Backstroke', 'NT'],
        ['Meera S', 'Girl', '2012-11-02', '9123456780', '', '100m Freestyle', '01:22.10'],
      ];
      this.notes = [
        'One row per swimmer per race. A swimmer in 3 races has 3 rows with the same name and date of birth.',
        'Required: Full name, Gender (Boy/Girl), Date of birth (YYYY-MM-DD), Parent phone, Race.',
        'Age group is worked out from the date of birth and the meet year (U-10 to U-16).',
        'Race must be one this meet offers for the swimmer\'s age group and gender.',
        'Seed time: mm:ss.hh such as 00:38.50, or NT if the swimmer has no time.',
        'Academy must match an approved academy name exactly, or be left blank.',
        'A swimmer who already exists (same name and date of birth) is reused, not created twice.',
        'Delete these example rows before importing.',
      ];
    }

    // Rules of the selected meet, written into the template and shown in the dialog,
    // so a wrong age group or a race the meet doesn't offer is easy to spot in Excel.
    templateFileName() {
      const m = this.ctx && this.ctx.meet;
      return m && m.title ? `${m.title.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '')}_entries_template` : this.templateName;
    }

    templateRules() {
      const meet = this.ctx && this.ctx.meet;
      if (!meet) return [];
      const year = meet.start_date ? new Date(meet.start_date).getFullYear() : new Date().getFullYear();
      const maxInd = meet.max_individual_events || 3;
      const day = d => (window.SwimNav && SwimNav.day ? SwimNav.day(d) : String(d || '').slice(0, 10));
      const rules = [
        ['Meet', meet.title + (meet.start_date ? ` (${day(meet.start_date)}${meet.end_date && meet.end_date !== meet.start_date ? ' to ' + day(meet.end_date) : ''})` : '')],
        ['Age group', `Worked out from the year of birth and the meet year (${year}). Swimmers outside U-10 to U-16 can't be entered.`],
      ];
      CATEGORIES.forEach(c => rules.push([`  ${c.label}`, `born in ${year - c.max} or ${year - c.min} (age ${c.min}-${c.max} in ${year})`]));
      rules.push(['Races per swimmer', `Up to ${maxInd} individual races; the 100m Individual Medley doesn't count towards this. Relays can't be imported.`]);
      CATEGORIES.forEach(c => ['Boy', 'Girl'].forEach(g => {
        const races = racesFor(meet, g, c.label);
        rules.push([`${c.label} ${g === 'Girl' ? 'girls' : 'boys'} races`, races.length ? races.join(', ') : 'none offered at this meet']);
      }));
      rules.push(['Race names', 'Must be written exactly as listed above, e.g. 50m Freestyle.']);
      rules.push(['Gender', 'Boy or Girl']);
      rules.push(['Date of birth', 'YYYY-MM-DD, e.g. 2014-05-21']);
      rules.push(['Seed time', 'mm:ss.hh such as 00:38.50, or NT if the swimmer has no time']);
      rules.push(['Academy', 'Exact name of an approved academy, or leave blank']);
      return rules;
    }

    async validate(rows, { meet, academies }) {
      const year = meet && meet.start_date ? new Date(meet.start_date).getFullYear() : new Date().getFullYear();
      const maxInd = (meet && meet.max_individual_events) || 3;
      const acad = new Map((academies || []).map(a => [SF.norm(a.academy_name), a]));
      const seenRace = new Map(); const swimmerInfo = new Map(); const indCount = new Map();

      rows.forEach(r => {
        const err = m => r.errors.push(m);
        r.name = r.name.replace(/\s+/g, ' ');
        if (!r.name) err('Name is missing.');
        else if (r.name.length > 120) err('Name is longer than 120 characters.');

        r._gender = parseGender(r.gender);
        if (!r._gender) err('Gender must be Boy or Girl.');

        r._dob = parseDob(r.dob);
        if (!r._dob) err('Date of birth must look like 2014-05-21.');
        else {
          const age = year - Number(r._dob.slice(0, 4));
          const cat = CATEGORIES.find(c => age >= c.min && age <= c.max);
          if (!cat) err(`Age ${age} in ${year} is outside U-10 to U-16.`);
          else r._category = cat.label;
        }

        const phone = r.phone.replace(/[\s()-]/g, '');
        if (!phone) err('Parent phone is missing.');
        else if (!/^\+?\d{7,14}$/.test(phone)) err('Parent phone must be 7–15 digits.');
        r._phone = phone;

        if (r.academy) {
          const a = acad.get(SF.norm(r.academy));
          if (a) r._academyId = a.academy_id;
          else r.warnings.push(`Academy "${r.academy}" not found — saved as unattached.`);
        }

        const raceName = (window.SWIMFEST_EVENT_MASTER || []).map(e => e.name).concat(IM_RACE)
          .find(n => SF.norm(n) === SF.norm(r.race).replace(/\s*m\s+/, 'm ')) || r.race;
        r._race = raceName;
        if (!r.race) err('Race is missing.');
        else if (/relay/i.test(r.race)) err('Relays can\'t be imported; add them on the Register page.');
        else if (r._gender && r._category && !racesFor(meet, r._gender, r._category).includes(raceName)) {
          err(`"${r.race}" isn't offered for ${r._gender === 'Girl' ? 'girls' : 'boys'} ${r._category} at this meet.`);
        }

        const ms = SF.fmt.parseTime(r.seed);
        if (ms === undefined) err('Seed time must look like 00:38.50 or NT.');
        r._seed = ms || null;

        if (r.name && r._dob) {
          const key = SF.norm(r.name) + '|' + r._dob;
          r._key = key;
          const prev = swimmerInfo.get(key);
          if (prev && r._gender && prev.gender !== r._gender) err(`Gender differs from row ${prev.row} for the same swimmer.`);
          if (!prev) swimmerInfo.set(key, { gender: r._gender, row: r._row });
          const raceKey = key + '|' + SF.norm(raceName);
          if (seenRace.has(raceKey)) err(`Same swimmer and race as row ${seenRace.get(raceKey)}.`);
          else seenRace.set(raceKey, r._row);
          if (raceName !== IM_RACE) {
            const n = (indCount.get(key) || 0) + 1;
            indCount.set(key, n);
            if (n > maxInd) err(`More than ${maxInd} individual races for this swimmer (the medley doesn't count).`);
          }
        }
      });
      return rows;
    }

    async commit(rows, { meet }) {
      const bySwimmer = new Map();
      rows.forEach(r => {
        if (!bySwimmer.has(r._key)) bySwimmer.set(r._key, {
          row_no: r._row, full_name: r.name, gender: r._gender, date_of_birth: r._dob, category: r._category,
          parent_phone: r._phone, academy_id: r._academyId || null, races: [],
        });
        bySwimmer.get(r._key).races.push({ event_name: r._race, is_im: r._race === IM_RACE, seed_time_ms: r._seed });
      });
      const res = await SF.ImportRepo.entries(meet.tournament_id, [...bySwimmer.values()]);
      const parts = [`${res.entries_added} race entries added`];
      if (res.swimmers_added) parts.push(`${res.swimmers_added} new swimmers`);
      if (res.swimmers_reused) parts.push(`${res.swimmers_reused} existing swimmers reused`);
      if (res.entries_skipped) parts.push(`${res.entries_skipped} already entered (skipped)`);
      SF.bus.emit('entries:imported', { meet, result: res });
      return { message: parts.join(', ') + '.' };
    }
  };

  SF.EntryImporter.parseDob = parseDob;
  SF.EntryImporter.racesFor = racesFor;
})();
