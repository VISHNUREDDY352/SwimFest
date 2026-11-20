/* ============================================================
   SwimFest help text  ·  core/help.js
   What the ⓘ buttons show. One entry per tab / section:
     title, what (one or two sentences), actions [], rules [], tip
   Pages point at an entry with data-help="key" on a heading, or
   SF.Info.attach(el, 'key') when the tab changes.
   ============================================================ */
(function () {
  'use strict';
  const H = window.SF.help = window.SF.help || {};

  /* ── Admin console ── */
  H.overview = {
    title: 'Overview',
    what: 'Your starting point: the meets you run and anything waiting for approval.',
    actions: ['Open a meet to manage its player list, heats, results or race control.', 'Jump to approvals waiting for you.'],
    rules: ['Admins only see meets they created or were assigned to by a super admin.'],
  };
  H.myMeets = {
    title: 'My meets',
    what: 'Every meet you can run, with where it is in the meet process: registration → player list locked → heats → results → completed.',
    actions: ['Filter by stage.', 'Open the next step for a meet from its row.'],
    rules: ['A meet moves forward one stage at a time; for example heats need the player list locked first.'],
  };
  H.approvals = {
    title: 'Approvals',
    what: 'New swimmers, coaches, academies and organizer meets waiting to be checked.',
    actions: ['Switch tabs to see each kind of record.', 'Search inside the current tab — the search follows the tab (swimmer name or ID, coach name, academy name, meet title).', 'Approve, or send back with a reason.'],
    rules: ['Sending back needs a reason; the person who submitted it sees that reason.', 'Only a super admin can make the final decision on organizer meets.'],
  };
  H.qSwimmers = { title: 'Swimmers waiting', what: 'Swimmer profiles that need checking before they can race.', actions: ['Search by swimmer name or SFI / swimmer ID.', 'Approve, or send back with a reason.'], rules: ['Check the name and date of birth against the ID document.', 'Age group is worked out from the date of birth.'] };
  H.qCoaches = { title: 'Coaches waiting', what: 'Coach profiles that need checking.', actions: ['Search by coach name.', 'Approve, or send back with a reason.'], rules: ['A coach can belong to one academy, or be independent.'] };
  H.qAcademies = { title: 'Academies waiting', what: 'Swim academies that asked to be listed.', actions: ['Search by academy name.', 'Approve, or send back with a reason.'], rules: ['Academy names are unique.', 'Only approved academies appear in the directory and earn leaderboard points.'] };
  H.qEvents = { title: 'Organizer meets', what: 'Meets created by outside organizers.', actions: ['Search by meet title.', 'Review the details; a super admin makes the final decision.'], rules: ['Meet titles are unique.'] };

  /* ── Player list ── */
  H.roster = {
    title: 'Player list (entries)',
    what: 'Every swimmer entered in this meet and their races. This is the list heats are drawn from.',
    actions: ['Search by swimmer name; filter by age group, gender or academy.', 'Fix a seed time or remove a race.', 'Add a walk-in swimmer, or import many from a spreadsheet.', 'Download the list.'],
    rules: ['Up to 3 individual races per swimmer (the 100m medley is an extra).', 'A race must be one the meet offers for the swimmer\'s age group.', 'Seed time is mm:ss.hh, or NT for no time.', 'Once locked, the list can\'t change.'],
  };
  H.lock = {
    title: 'Lock the player list',
    what: 'Freezes the entries so heats can be drawn.',
    actions: ['Type the confirmation phrase and lock.'],
    rules: ['After locking nobody can add, change or remove entries.', 'Heat generation only works on a locked list.'],
  };
  H.bulkImport = {
    title: 'Import swimmers from a spreadsheet',
    what: 'Add many walk-in swimmers and their races in one go.',
    actions: ['Download the template (.xlsx or .csv) and fill one row per swimmer per race.', 'Choose the file: every row is checked and shown before anything is saved.', 'Press Import to save all rows at once.'],
    rules: ['Required: full name, gender, date of birth, parent phone, race.', 'Date of birth as YYYY-MM-DD; age group comes from it.', 'Seed time mm:ss.hh or NT.', 'If any row has a problem, nothing is saved — fix the file and choose it again.', 'Existing swimmers (same name + date of birth) are reused.'],
  };

  /* ── Heat generation ── */
  H.heatgen = {
    title: 'Heat generation',
    what: 'Draws the heats and lanes for a meet from its locked player list.',
    actions: ['Pick the meet.', 'Set up the pools and timing, choose a seeding method, then Generate.', 'Check the heats table (search by swimmer), swap lanes if needed, then Save.', 'Export the heats for the timing system or print them.', 'Download the entries template and import swimmers before the list is locked.'],
    rules: ['The player list must be locked before heats can be generated.', 'Heats can\'t be replaced once any result has been entered.', 'Swimmers are seeded by seed time; NT swimmers go in the slowest heat.', 'The fastest swimmer of a heat swims in the centre lane.', 'Every heat has at least 3 swimmers when possible.', 'Relay swimmers are put in teams of up to 4 from the same academy; a team shares one lane.'],
  };
  H.pools = {
    title: 'Pools',
    what: 'Which age groups swim in which pool, and how many lanes each pool has.',
    actions: ['Turn a second pool on or off.', 'Choose 6, 8 or 10 lanes.', 'Tick the age groups for each pool.'],
    rules: ['At least one pool stays on.', 'Every age group needs a pool, or its entries are left out.', 'An age group ticked in both pools swims in pool 2.'],
  };
  H.timing = {
    title: 'Session timing',
    what: 'Used to estimate when each heat starts. Each pool runs its own clock.',
    actions: ['Set the session start and minutes per heat for each race length.'],
    rules: ['400m races use twice the 100–200m time.', 'Times are estimates for the schedule only.'],
  };
  H.heatsPreview = {
    title: 'Heats',
    what: 'The lane draw, one row per lane, grouped by event and heat. Nothing is saved until you press Save heats.',
    actions: ['Search by swimmer name, or filter by pool, race or age group.', 'Press Swap on two lanes of the same event to swap them.', 'Save, print or export.'],
    rules: ['Saving replaces any heats already saved for this meet.', 'Event numbers run in one sequence across both pools.'],
  };

  /* ── Results ── */
  H.enterTimes = {
    title: 'Enter times',
    what: 'Type each swimmer\'s finish time or status, heat by heat.',
    actions: ['Search by swimmer name.', 'Type a time (39.20 or 1:02.45) and press Enter to go to the next lane.', 'Set DNS, DNF or DQ (DQ needs a code).', 'Import times from the timing system file.', 'Save — all changed lanes are saved together.'],
    rules: ['A lane only saves if nobody else changed it since you loaded the page.', 'Times must be under 10 minutes and in the format ss.hh or m:ss.hh.'],
  };
  H.officialResults = {
    title: 'Official results',
    what: 'Ranks every swimmer of an event across all heats and awards academy points when you publish.',
    actions: ['Publish an event to make its results public.', 'Re-publish if a time changes.'],
    rules: ['Equal times share a rank.', 'Points 9-7-6-5-4-3-2-1 (relays double), best 2 per academy per event.', 'Unattached swimmers don\'t score.', 'A relay team scores once.'],
  };

  /* ── Race control ── */
  H.rcRoster = { title: 'Roster', what: 'The meet\'s entries, ready for check-in.', actions: ['Open the player list for this meet.', 'Download the roster.'], rules: ['Only staff of this meet can see it.'] };
  H.rcTiming = { title: 'Timing', what: 'Move heats to the timing system and results back.', actions: ['Export heats for the timing system.', 'Import results into Live results.'], rules: ['Heats must be saved first.'] };
  H.rcResults = { title: 'Heat results', what: 'Lane-by-lane view of what has been entered so far.', actions: ['Filter by event and heat.', 'Request closure when every event is published.'], rules: ['Closing a meet needs every event published.'] };

  /* ── Organizer ── */
  H.payouts = { title: 'Payouts', what: 'Entry fees collected for your meets and what is due to you.', actions: ['Download the payout summary.'], rules: ['Platform fees are deducted before payout.'] };
  H.createMeet = { title: 'Create a meet', what: 'Set up a new meet; a super admin approves it before it is public.', actions: ['Fill in details, races and payment.', 'Submit for approval.'], rules: ['Meet titles are unique.', 'End date can\'t be before the start date.', 'Registration closes before the meet starts.'] };

  /* ── Super admin ── */
  H.saApprovals = { title: 'Approvals', what: 'Every queue waiting for a super admin decision.', actions: ['Switch queue with the tabs; the search follows the queue.', 'Approve or send back with a reason.'], rules: ['Sending back needs a reason.', 'Every decision is written to the audit log.'] };
  H.s2 = { title: 'Verifications', what: 'Coaches, academies and organizers waiting to be verified.', actions: ['Filter by type, search by name or ID.'], rules: ['Check documents before approving.', 'Swimmer accounts don\'t need verifying; their event entries are approved instead.'] };
  H.entries = { title: 'Event entries', what: 'Each registration a parent makes for a meet. It only goes into heats once approved.', actions: ['Open the age proof and undertaking to check them.', 'Approve, or decline with a reason the parent will see.'], rules: ['Super Admins decide any meet; Admins decide the meets they run.', 'The parent sees the decision on their profile.', 'Every decision is written to History.'] };
  H.saLogs = { title: 'Logs', what: 'Every sign-in to SwimFest, newest first.', actions: ['Search by name or email.', 'Narrow by role and time period.', 'Download what you see as a CSV file.'], rules: ['Only Super Admins can see this.', 'The time and network address are recorded by the database.'] };
  H.s1a = { title: 'Internal meets', what: 'Meets created by Admins, waiting for approval.', actions: ['Search by meet title.'], rules: ['Approved meets open for registration.'] };
  H.s1b = { title: 'Third-party meets', what: 'Meets created by outside organizers.', actions: ['Search by meet title or organizer.'], rules: ['Check the organizer is verified first.'] };
  H.reopen = { title: 'Reopen requests', what: 'Organizers asking to reopen a completed meet.', actions: ['Search by meet title.', 'Approve (meet goes back to published) or deny.'], rules: [] };
  H.sentback = { title: 'Sent back', what: 'Items you returned with a reason, waiting for the submitter.', actions: ['Search by name or title.'], rules: [] };
  H.saMeets = { title: 'All meets', what: 'Every meet on the platform at any stage.', actions: ['Search by meet title (also city and venue).', 'Filter by status, state or city.', 'Open a meet\'s roster, heats, results or race control.'], rules: [] };
  H.saHistory = { title: 'History', what: 'Everything staff have done on SwimFest, newest first: approvals, meet changes, entries, results and team changes.', actions: ['Search by person, meet or note.', 'Narrow by kind of activity and time period.', 'Download what you see as a CSV file.'], rules: ['History can\'t be edited or deleted.', 'The person, time and network address are recorded by the database, so they can\'t be faked.'] };
  H.saAcademies = { title: 'Academies & coaches', what: 'Directory of academies and their coaches.', actions: ['Switch between academies and coaches; the search follows the tab.'], rules: [] };
  H.saFinancials = { title: 'Financials', what: 'Fees collected and payouts across meets.', actions: ['Download reports.'], rules: [] };
  H.saTeam = { title: 'Team', what: 'Who can run SwimFest: Owner, Co-Super Admins and Admins.', actions: ['Find an account by name or email and change its role.'], rules: ['Only the Owner can change roles.', 'The Owner role can\'t be removed.'] };

  /* ── Public pages ── */
  H.directory = { title: 'Academy directory', what: 'Find swim academies, coaches and swimmers.', actions: ['Switch tabs: the search follows the tab (academy name, coach name, swimmer name).', 'Filter by city.'], rules: ['Only verified academies are listed.'] };
  H.swimmerSearch = { title: 'Swimmer search', what: 'Look up swimmers who have raced in published meets.', actions: ['Search by swimmer name or swimmer ID.', 'Filter by age group, gender or academy.'], rules: ['Only swimmers entered in a published meet are shown publicly.'] };
  H.leaderboard = { title: 'Academy leaderboard', what: 'Academy points from published results.', actions: ['Filter by meet.'], rules: ['Points 9-7-6-5-4-3-2-1 (relays double), best 2 per academy per event.'] };
  H.heatsheets = { title: 'Heat sheets', what: 'Published heats and lanes for a meet.', actions: ['Search by swimmer name, filter by event.', 'Print or download.'], rules: [] };
  H.live = { title: 'Live timing', what: 'Results as they are entered at the pool.', actions: ['Pick an event.'], rules: ['Updates automatically.'] };
})();
