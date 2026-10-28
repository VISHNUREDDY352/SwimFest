/* ============================================================
   SwimFest – bulk walk-in upload (player list)
   Staff fill in the template (Excel or CSV), upload it, check the
   preview and add every valid swimmer in one go. Each row goes
   through the same checks and saving as the walk-in form
   (addWalkIn in admin.js): age group from date of birth, races this
   meet offers, at most 3 races plus the medley, valid seed times.
   ============================================================ */
(function () {
  'use strict';

  // Reads .xlsx / .xls / .csv; loaded only when someone uploads a file
  const SHEETJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

  const TEMPLATE_HEADERS = ['Full name', 'Gender', 'Date of birth', 'Academy', 'Parent phone',
    'Race 1', 'Seed 1', 'Race 2', 'Seed 2', 'Race 3', 'Seed 3', 'Medley', 'Medley seed'];
  const TEMPLATE_EXAMPLE = ['Arjun Kumar', 'Boy', '2015-04-12', '', '9876543210',
    '50m Freestyle', '00:38.50', '50m Backstroke', 'NT', '', '', 'Yes', 'NT'];

  // Header text → field, ignoring case, spaces and punctuation
  const ALIASES = {
    fullname: 'name', name: 'name', swimmer: 'name', swimmername: 'name',
    gender: 'gender', sex: 'gender',
    dateofbirth: 'dob', dob: 'dob', birthdate: 'dob',
    academy: 'academy', club: 'academy',
    parentphone: 'phone', phone: 'phone', mobile: 'phone', contact: 'phone',
    race1: 'race1', event1: 'race1', seed1: 'seed1',
    race2: 'race2', event2: 'race2', seed2: 'seed2',
    race3: 'race3', event3: 'race3', seed3: 'seed3',
    medley: 'im', im: 'im', individualmedley: 'im', medleyseed: 'imseed', imseed: 'imseed',
  };
  const key = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  let ROWS = [];          // checked rows from the last file
  let ACADEMIES = [];     // approved academies, for matching names

  function loadSheetJs() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = SHEETJS; s.onload = ok; s.onerror = () => fail(new Error('Could not load the spreadsheet reader. Check your internet connection.'));
      document.head.appendChild(s);
    });
  }

  // Excel date cell, "2015-04-12", "12/04/2015" or "12-04-2015" → "2015-04-12"
  function toIsoDate(v) {
    if (v instanceof Date && !isNaN(v)) {
      return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    }
    const s = String(v || '').trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);   // Indian order: day first
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return '';
  }
  const validDate = iso => iso && !isNaN(new Date(iso)) && new Date(iso).toISOString().slice(0, 10) === iso;

  function toGender(v) {
    const s = key(v);
    if (['boy', 'b', 'male', 'm', 'boys'].includes(s)) return 'Boy';
    if (['girl', 'g', 'female', 'f', 'girls'].includes(s)) return 'Girl';
    return '';
  }
  const yes = v => ['yes', 'y', 'true', '1', 'x'].includes(key(v));
  const seedOf = v => String(v ?? '').trim() || 'NT';

  // Check one spreadsheet row; returns { ...fields, races, problems[] }
  function checkRow(raw, seen) {
    const f = {};
    Object.entries(raw).forEach(([h, v]) => { const k = ALIASES[key(h)]; if (k) f[k] = v instanceof Date ? v : String(v ?? '').trim(); });
    const problems = [];
    const r = { name: f.name || '', gender: toGender(f.gender), dob: toIsoDate(f.dob), phone: f.phone || '', academyName: f.academy || '', races: [] };

    if (!r.name) problems.push('Name missing');
    if (!r.gender) problems.push('Gender must be Boy or Girl');
    if (!validDate(r.dob)) problems.push('Date of birth not understood (use 2015-04-12 or 12/04/2015)');
    const cat = validDate(r.dob) ? deriveCategoryFromDob(r.dob) : null;
    if (validDate(r.dob) && !cat) problems.push('Age is outside U-10 to U-16 for this meet');
    r.category = cat ? cat.label : '';
    if (!r.phone) problems.push('Parent phone missing');

    if (r.academyName) {
      const a = ACADEMIES.find(x => key(x.academy_name) === key(r.academyName))
        || ACADEMIES.find(x => key(x.academy_name).includes(key(r.academyName)));
      if (a) { r.academyId = a.academy_id; r.academyName = a.academy_name; }
      else problems.push(`Academy "${r.academyName}" not found (leave blank for unattached)`);
    }

    if (r.gender && cat) {
      const { races, im } = racesFor(r.gender, cat.label);
      [1, 2, 3].forEach(n => {
        const name = f[`race${n}`];
        if (!name) return;
        const match = races.find(x => key(x) === key(name));
        if (!match) { problems.push(`"${name}" isn't a ${r.gender === 'Girl' ? 'girls' : 'boys'} ${cat.label} race at this meet`); return; }
        if (r.races.some(x => x.name === match)) { problems.push(`${match} is listed twice`); return; }
        const ms = seedToMs(seedOf(f[`seed${n}`]));
        if (ms === undefined) problems.push(`Seed for ${match} must look like 00:39.20 or NT`);
        r.races.push({ name: match, im: false, ms });
      });
      if (yes(f.im)) {
        if (!im) problems.push('This meet has no medley');
        else {
          const ms = seedToMs(seedOf(f.imseed));
          if (ms === undefined) problems.push('Medley seed must look like 01:39.20 or NT');
          r.races.push({ name: IM_RACE, im: true, ms });
        }
      }
      if (!r.races.length) problems.push('No races');
    }

    // Already entered in this meet, or twice in the file
    const id = `${key(r.name)}|${r.dob}`;
    if (r.name && r.dob) {
      if (ROSTER.some(x => key(x.name) === key(r.name) && x.dob === r.dob)) problems.push('Already in this meet');
      else if (seen.has(id)) problems.push('Listed twice in the file');
      seen.add(id);
    }
    r.problems = problems;
    return r;
  }

  function renderPreview() {
    const ready = ROWS.filter(r => !r.problems.length);
    $('bulkSummary').innerHTML = ROWS.length
      ? `<strong>${ready.length}</strong> ready to add · <strong style="color:${ROWS.length - ready.length ? '#b91c1c' : 'inherit'};">${ROWS.length - ready.length}</strong> with problems (these are skipped)`
      : '';
    $('bulkPreview').innerHTML = ROWS.length ? `<table class="ac-table" style="font-size:0.8rem;">
      <thead><tr><th>#</th><th>Swimmer</th><th>Category</th><th>Races</th><th>Check</th></tr></thead>
      <tbody>${ROWS.map((r, i) => `<tr>
        <td>${i + 2}</td>
        <td><strong>${escHtml(r.name || '—')}</strong><div class="pl-sub">${escHtml(r.dob || '')}${r.academyName ? ' · ' + escHtml(r.academyName) : ''}</div></td>
        <td>${r.category ? `${r.gender === 'Girl' ? 'Girls' : 'Boys'} ${escHtml(r.category)}` : '—'}</td>
        <td>${r.races.map(x => escHtml(x.name)).join('<br>') || '—'}</td>
        <td>${r.problems.length
          ? `<span style="color:#b91c1c;">${r.problems.map(escHtml).join('<br>')}</span>`
          : '<span style="color:#15803d;font-weight:600;"><i class="fas fa-check"></i> Ready</span>'}</td>
      </tr>`).join('')}</tbody></table>` : '';
    $('bulkAddBtn').disabled = !ready.length;
    $('bulkAddBtn').innerHTML = `<i class="fas fa-users"></i> Add ${ready.length} swimmer${ready.length === 1 ? '' : 's'}`;
  }

  async function readFile(file) {
    $('bulkError').textContent = '';
    ROWS = []; renderPreview();
    if (!file) return;
    $('bulkSummary').textContent = 'Reading the file…';
    try {
      await loadSheetJs();
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true })
        .filter(r => Object.values(r).some(v => String(v).trim()));
      if (!raw.length) { $('bulkSummary').textContent = ''; $('bulkError').textContent = 'The file has no swimmer rows.'; return; }
      if (!Object.keys(raw[0]).some(h => ALIASES[key(h)] === 'name')) {
        $('bulkSummary').textContent = '';
        $('bulkError').textContent = 'No "Full name" column found. Start from the template so the columns are named correctly.';
        return;
      }
      const seen = new Set();
      ROWS = raw.map(r => checkRow(r, seen));
      renderPreview();
    } catch (e) {
      $('bulkSummary').textContent = '';
      $('bulkError').textContent = `Could not read the file: ${e.message}`;
    }
  }

  async function addAll() {
    const ready = ROWS.filter(r => !r.problems.length);
    if (!ready.length || !MEET) return;
    const btn = $('bulkAddBtn');
    btn.disabled = true;
    let added = 0;
    for (const [i, r] of ready.entries()) {
      $('bulkSummary').textContent = `Adding ${i + 1} of ${ready.length}…`;
      const problem = await addWalkIn({ name: r.name, gender: r.gender, dob: r.dob, academyId: r.academyId,
        phone: r.phone, category: r.category, races: r.races });
      if (problem) r.problems = [problem]; else { r.added = true; added++; }
    }
    ROWS = ROWS.filter(r => !r.added);
    renderPreview();
    $('bulkSummary').innerHTML = `<strong style="color:#15803d;">Added ${added} swimmer${added === 1 ? '' : 's'}.</strong>`
      + (ROWS.length ? ` ${ROWS.length} row${ROWS.length === 1 ? '' : 's'} still need fixing (below).` : '');
    showToast(`Added ${added} walk-in swimmer${added === 1 ? '' : 's'}`, 'success');
    loadRoster(MEET.tournament_id, true);
  }

  function downloadTemplate() {
    const csv = [TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'SwimFest_walk-in_template.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function open() {
    if (isReadOnly()) return;
    ROWS = [];
    $('bulkFile').value = '';
    $('bulkError').textContent = '';
    renderPreview();
    openModal('bulkModal');
    try {
      const { data } = await window.sb.from('academies').select('academy_id, academy_name, status');
      ACADEMIES = (data || []).filter(a => !a.status || a.status === 'APPROVED_ACTIVE');
    } catch (_) { ACADEMIES = []; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('bulkBtn').addEventListener('click', open);
    $('bulkTemplate').addEventListener('click', downloadTemplate);
    $('bulkFile').addEventListener('change', e => readFile(e.target.files[0]));
    $('bulkAddBtn').addEventListener('click', addAll);
    ['bulkClose', 'bulkCancel'].forEach(id => $(id).addEventListener('click', () => closeModal('bulkModal')));
    // From Race control's "Upload walk-ins": open once the meet has loaded
    if (new URLSearchParams(location.search).get('bulk') === '1') {
      const wait = setInterval(() => { if (MEET && !LOADING) { clearInterval(wait); if (!isReadOnly()) open(); } }, 200);
      setTimeout(() => clearInterval(wait), 15000);
    }
  });

  window.SwimBulk = { _checkRow: checkRow, _toIsoDate: toIsoDate, _setAcademies: a => { ACADEMIES = a; } };
})();
