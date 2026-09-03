/* ============================================================
   SwimFest — Registration Wizard  (Chapters 4 + 5)
   register.js — Full business logic
   ============================================================ */

'use strict';

// ─── Constants ────────────────────────────────────────────────
const TOURNAMENT_YEAR   = 2026;
const BASE_FEE          = 800;
const RELAY_FEE         = 300;
const PLATFORM_FEE      = 50;
const MAX_INDIV_EVENTS  = 3;

const TOURNAMENT_NAME   = 'Golden Non-Medalist Swimming Championship 2026';
const TOURNAMENT_VENUE  = 'SRM University Pool, Kattankulathur';
const TOURNAMENT_DATES  = 'Oct 15–16, 2026';
const REG_CLOSE_DATE    = '30 Aug 2026';

// Age category map
const CATEGORIES = [
  { label: 'U-10', yobStart: 2016, yobEnd: 2017, minAge: 8,  maxAge: 9  },
  { label: 'U-12', yobStart: 2014, yobEnd: 2015, minAge: 10, maxAge: 11 },
  { label: 'U-14', yobStart: 2012, yobEnd: 2013, minAge: 12, maxAge: 13 },
  { label: 'U-16', yobStart: 2010, yobEnd: 2011, minAge: 14, maxAge: 15 },
];

// Event master list
const EVENT_MASTER = [
  { id:'e1',  gender:'Boy',  category:'U-10', name:'25m Freestyle'     },
  { id:'e2',  gender:'Boy',  category:'U-10', name:'25m Backstroke'    },
  { id:'e3',  gender:'Boy',  category:'U-10', name:'25m Breaststroke'  },
  { id:'e4',  gender:'Girl', category:'U-10', name:'25m Freestyle'     },
  { id:'e5',  gender:'Girl', category:'U-10', name:'25m Backstroke'    },
  { id:'e6',  gender:'Girl', category:'U-10', name:'25m Breaststroke'  },

  { id:'e7',  gender:'Boy',  category:'U-12', name:'50m Freestyle'     },
  { id:'e8',  gender:'Boy',  category:'U-12', name:'100m Freestyle'    },
  { id:'e9',  gender:'Boy',  category:'U-12', name:'50m Backstroke'    },
  { id:'e10', gender:'Boy',  category:'U-12', name:'50m Breaststroke'  },
  { id:'e11', gender:'Boy',  category:'U-12', name:'50m Butterfly'     },
  { id:'e12', gender:'Girl', category:'U-12', name:'50m Freestyle'     },
  { id:'e13', gender:'Girl', category:'U-12', name:'100m Freestyle'    },
  { id:'e14', gender:'Girl', category:'U-12', name:'50m Backstroke'    },
  { id:'e15', gender:'Girl', category:'U-12', name:'50m Breaststroke'  },
  { id:'e16', gender:'Girl', category:'U-12', name:'50m Butterfly'     },

  { id:'e17', gender:'Boy',  category:'U-14', name:'50m Freestyle'     },
  { id:'e18', gender:'Boy',  category:'U-14', name:'100m Freestyle'    },
  { id:'e19', gender:'Boy',  category:'U-14', name:'200m Freestyle'    },
  { id:'e20', gender:'Boy',  category:'U-14', name:'50m Backstroke'    },
  { id:'e21', gender:'Boy',  category:'U-14', name:'100m Backstroke'   },
  { id:'e22', gender:'Boy',  category:'U-14', name:'50m Breaststroke'  },
  { id:'e23', gender:'Boy',  category:'U-14', name:'50m Butterfly'     },
  { id:'e24', gender:'Girl', category:'U-14', name:'50m Freestyle'     },
  { id:'e25', gender:'Girl', category:'U-14', name:'100m Freestyle'    },
  { id:'e26', gender:'Girl', category:'U-14', name:'200m Freestyle'    },
  { id:'e27', gender:'Girl', category:'U-14', name:'50m Backstroke'    },
  { id:'e28', gender:'Girl', category:'U-14', name:'100m Backstroke'   },
  { id:'e29', gender:'Girl', category:'U-14', name:'50m Breaststroke'  },
  { id:'e30', gender:'Girl', category:'U-14', name:'50m Butterfly'     },

  { id:'e31', gender:'Boy',  category:'U-16', name:'50m Freestyle'     },
  { id:'e32', gender:'Boy',  category:'U-16', name:'100m Freestyle'    },
  { id:'e33', gender:'Boy',  category:'U-16', name:'200m Freestyle'    },
  { id:'e34', gender:'Boy',  category:'U-16', name:'50m Backstroke'    },
  { id:'e35', gender:'Boy',  category:'U-16', name:'100m Backstroke'   },
  { id:'e36', gender:'Boy',  category:'U-16', name:'50m Breaststroke'  },
  { id:'e37', gender:'Boy',  category:'U-16', name:'100m Breaststroke' },
  { id:'e38', gender:'Boy',  category:'U-16', name:'50m Butterfly'     },
  { id:'e39', gender:'Girl', category:'U-16', name:'50m Freestyle'     },
  { id:'e40', gender:'Girl', category:'U-16', name:'100m Freestyle'    },
  { id:'e41', gender:'Girl', category:'U-16', name:'200m Freestyle'    },
  { id:'e42', gender:'Girl', category:'U-16', name:'50m Backstroke'    },
  { id:'e43', gender:'Girl', category:'U-16', name:'100m Backstroke'   },
  { id:'e44', gender:'Girl', category:'U-16', name:'50m Breaststroke'  },
  { id:'e45', gender:'Girl', category:'U-16', name:'100m Breaststroke' },
  { id:'e46', gender:'Girl', category:'U-16', name:'50m Butterfly'     },
];

// ─── App State ────────────────────────────────────────────────
const state = {
  currentStep    : 1,
  swimmerId      : generateSwimmerId(),
  tournamentName : TOURNAMENT_NAME,

  swimmerData : {
    fullName       : '',
    gender         : 'Boy',
    dob            : '',
    yob            : null,
    competitionAge : null,
    category       : null,
    serialNo       : '',
    parentContact  : '',
    academy        : '',
    coach          : '',
  },

  selectedEvents : {},   // { id: { name, seedTime } }
  imSelected     : false,
  imSeedTime     : '',
  relaySelected  : false,

  // Declaration state machine (Rule 5.1)
  declarations   : { 1: false, 2: false, 3: false, 4: false },

  // Payment gateway state
  paymentState   : 'idle', // idle | processing | success | failed
  bookingRefNo   : null,
};

// ─── Utilities ────────────────────────────────────────────────
function generateSwimmerId() {
  return `SWM-${TOURNAMENT_YEAR}-` + Math.floor(10000 + Math.random() * 90000);
}

function generateBookingRef() {
  return `BK-${TOURNAMENT_YEAR}-` + Math.floor(10000 + Math.random() * 90000);
}

function formatCurrency(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

/** Rule 5.2: Total = BASE + RELAY? + PLATFORM */
function calcSubtotal()   { return BASE_FEE + (state.relaySelected ? RELAY_FEE : 0); }
function calcGrandTotal() { return calcSubtotal() + PLATFORM_FEE; }

function isValidSeedTime(val) {
  if (!val) return false;
  const v = val.trim().toUpperCase();
  if (v === 'NT') return true;
  return /^\d{1,2}:\d{2}\.\d{1,2}$/.test(v);
}

function deriveCategory(dob) {
  if (!dob) return null;
  const yob     = new Date(dob).getFullYear();
  const compAge = TOURNAMENT_YEAR - yob;
  return CATEGORIES.find(c => compAge >= c.minAge && compAge <= c.maxAge) || null;
}

function getFilteredEvents(gender, category) {
  return EVENT_MASTER.filter(e => e.gender === gender && e.category === category);
}

function countSelectedEvents() { return Object.keys(state.selectedEvents).length; }

function genderLabel(g) { return g === 'Girl' ? 'GIRLS' : 'BOYS'; }
function catLabel(g, c) { return `${genderLabel(g)} ${c}`; }

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── DOM helpers ──────────────────────────────────────────────
const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function show(id) { const e = $(id); if (e) e.style.display = ''; }
function hide(id) { const e = $(id); if (e) e.style.display = 'none'; }

function showError(el, msg) {
  clearError(el);
  el.classList.add('error');
  const div = document.createElement('div');
  div.className = 'field-error';
  div.dataset.errorFor = el.id;
  div.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
  el.parentNode.insertBefore(div, el.nextSibling);
}

function clearError(el) {
  el.classList.remove('error');
  el.parentNode.querySelector(`[data-error-for="${el.id}"]`)?.remove();
}

function clearAllErrors() {
  $$('.field-error').forEach(e => e.remove());
  $$('.reg-input.error, .reg-select.error').forEach(e => e.classList.remove('error'));
}

// ─── Stepper ──────────────────────────────────────────────────
function updateStepper(step) {
  [1, 2, 3].forEach(n => {
    const el     = $(`step-indicator-${n}`);
    const circle = el.querySelector('.step-circle');
    el.classList.remove('active', 'completed');
    if (n < step)  { el.classList.add('completed'); circle.innerHTML = '<i class="fas fa-check"></i>'; }
    if (n === step){ el.classList.add('active');    circle.textContent = n; }
    if (n > step)  { circle.textContent = n; }
  });
  $$('.step-connector').forEach((c, i) => c.classList.toggle('completed', i + 1 < step));
}

function goToStep(n) {
  state.currentStep = n;
  ['1','2','3','Processing','Failed','Success'].forEach(s => {
    const el = $(`step${s}`);
    if (el) el.style.display = 'none';
  });
  const target = $(`step${n}`);
  if (target) {
    target.style.display = '';
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
  }
  updateStepper(n);
  if (n === 2) renderEventGrid();
  if (n === 3) renderCheckout();
}

// ─── STEP 1 ───────────────────────────────────────────────────
function initStep1() {
  $('swimmerIdDisplay').textContent = state.swimmerId;
  $('dob').max = `${TOURNAMENT_YEAR - 8}-12-31`;

  $$('.gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.gender-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.swimmerData.gender = btn.dataset.gender;
      // Re-derive category label if DOB already set
      if ($('dob').value) onDobChange();
    });
  });

  $('dob').addEventListener('change', onDobChange);
  $('step1Next').addEventListener('click', validateStep1);
}

function onDobChange() {
  const dob = $('dob').value;
  hide('derivedMetrics'); hide('ineligibleMsg');
  if (!dob) return;
  const cat = deriveCategory(dob);
  const yob = new Date(dob).getFullYear();
  const age = TOURNAMENT_YEAR - yob;
  if (!cat) { show('ineligibleMsg'); return; }
  $('derivedYob').textContent      = yob;
  $('derivedAge').textContent      = age;
  $('derivedCategory').textContent = catLabel(state.swimmerData.gender, cat.label);
  show('derivedMetrics');
  Object.assign(state.swimmerData, { dob, yob, competitionAge: age, category: cat.label });
}

function validateStep1() {
  clearAllErrors();
  let ok = true;

  const name = $('fullName').value.trim();
  if (!name) { showError($('fullName'), 'Full name is required.'); ok = false; }

  const dob = $('dob').value;
  if (!dob) {
    showError($('dob'), 'Date of birth is required.'); ok = false;
  } else {
    const cat = deriveCategory(dob);
    if (!cat) { showError($('dob'), 'Age not within eligible range (U-10 to U-16).'); ok = false; }
    else {
      Object.assign(state.swimmerData, {
        dob, yob: new Date(dob).getFullYear(),
        competitionAge: TOURNAMENT_YEAR - new Date(dob).getFullYear(),
        category: cat.label,
      });
    }
  }

  const phone = $('parentContact').value.trim();
  if (!phone) { showError($('parentContact'), 'Parent / Guardian contact is required.'); ok = false; }
  else if (!/^[\d\s\+\-]{8,15}$/.test(phone)) { showError($('parentContact'), 'Enter a valid phone number.'); ok = false; }

  if (!ok) return;

  Object.assign(state.swimmerData, {
    fullName: name, dob,
    serialNo: $('serialNo').value.trim(),
    parentContact: phone,
    academy: $('affiliatedAcademy').value,
    coach:   $('assignedCoach').value,
  });

  // Reset downstream state
  state.selectedEvents = {};
  state.imSelected = false; state.imSeedTime = '';
  state.relaySelected = false;
  state.declarations = { 1:false, 2:false, 3:false, 4:false };

  goToStep(2);
}

// ─── STEP 2 ───────────────────────────────────────────────────
function renderEventGrid() {
  const { gender, category } = state.swimmerData;
  $('tagGender').textContent   = genderLabel(gender);
  $('tagCategory').textContent = `CATEGORY: ${category}`;

  const events = getFilteredEvents(gender, category);
  const list   = $('eventsList');
  list.innerHTML = '';

  events.forEach(ev => {
    const isSelected  = !!state.selectedEvents[ev.id];
    const isCapped    = !isSelected && countSelectedEvents() >= MAX_INDIV_EVENTS;
    const savedSeed   = state.selectedEvents[ev.id]?.seedTime || '';
    const isNT        = savedSeed.toUpperCase() === 'NT';

    const row = document.createElement('div');
    row.className = ['event-row', isSelected ? 'selected-row' : '', isCapped ? 'disabled-row' : ''].join(' ').trim();
    row.dataset.eventId = ev.id;

    row.innerHTML = `
      <label class="event-check-label">
        <input type="checkbox" class="event-checkbox" data-event-id="${ev.id}"
               ${isSelected ? 'checked' : ''} ${isCapped ? 'disabled' : ''}>
        <span class="event-name">${ev.name}</span>
      </label>
      <div class="event-right">
        ${isCapped
          ? `<span class="disabled-reason">Max ${MAX_INDIV_EVENTS} events selected</span>`
          : isSelected
            ? `<div class="seed-time-group">
                 <input type="text" class="seed-input${isNT ? ' nt-mode' : ''}"
                        data-seed-for="${ev.id}" placeholder="MM:SS.ms or NT"
                        maxlength="10" value="${escHtml(savedSeed)}">
               </div>`
            : `<span class="seed-placeholder-text">Select to enter seed time</span>`
        }
      </div>`;

    row.querySelector('.event-checkbox').addEventListener('change', e =>
      onEventCheck(ev.id, ev.name, e.target.checked));

    const seedInput = row.querySelector(`[data-seed-for="${ev.id}"]`);
    if (seedInput) {
      seedInput.addEventListener('input', () => onSeedInput(ev.id, seedInput));
      seedInput.addEventListener('blur',  () => onSeedBlur(ev.id, seedInput));
    }
    list.appendChild(row);
  });

  updateEventCounter();
  syncIMRow();
  syncRelayRow();
  updateStep2FeeSummary();
}

function onEventCheck(id, name, checked) {
  if (checked) {
    if (countSelectedEvents() >= MAX_INDIV_EVENTS) return;
    state.selectedEvents[id] = { name, seedTime: '' };
  } else {
    delete state.selectedEvents[id];
  }
  renderEventGrid();
}

function onSeedInput(id, input) {
  const v = input.value.trim().toUpperCase();
  input.classList.toggle('nt-mode', v === 'NT');
  if (state.selectedEvents[id]) state.selectedEvents[id].seedTime = input.value.trim();
}

function onSeedBlur(id, input) {
  if (input.value.trim().toUpperCase() === 'NT') {
    input.value = 'NT'; input.classList.add('nt-mode');
  }
  if (state.selectedEvents[id]) state.selectedEvents[id].seedTime = input.value.trim();
}

function updateEventCounter() {
  const n  = countSelectedEvents();
  const el = $('eventCounter');
  el.textContent = `${n} / ${MAX_INDIV_EVENTS} selected`;
  el.style.background = n === MAX_INDIV_EVENTS ? 'var(--primary)' : 'var(--accent-light)';
  el.style.color      = n === MAX_INDIV_EVENTS ? 'var(--white)'   : 'var(--primary)';
}

function syncIMRow() {
  const cb = $('imCheckbox');
  cb.checked = state.imSelected;
  if (state.imSelected) { show('imSeedGroup'); $('imSeedTime').value = state.imSeedTime; }
  else                  { hide('imSeedGroup'); }

  cb.onchange = () => {
    state.imSelected = cb.checked;
    cb.checked ? show('imSeedGroup') : hide('imSeedGroup');
  };
  $('imSeedTime').oninput = () => {
    state.imSeedTime = $('imSeedTime').value.trim();
    $('imSeedTime').classList.toggle('nt-mode', state.imSeedTime.toUpperCase() === 'NT');
  };
}

function syncRelayRow() {
  const cb = $('relayCheckbox');
  cb.checked = state.relaySelected;
  cb.onchange = () => {
    state.relaySelected = cb.checked;
    state.relaySelected ? show('relayFeeRow') : hide('relayFeeRow');
    updateStep2FeeSummary();
  };
}

function updateStep2FeeSummary() {
  $('totalAmount').textContent = formatCurrency(calcSubtotal());
  state.relaySelected ? show('relayFeeRow') : hide('relayFeeRow');
}

function validateStep2() {
  const errors = [];
  Object.entries(state.selectedEvents).forEach(([, ev]) => {
    if (!ev.seedTime) errors.push(`${ev.name} — seed time required`);
    else if (!isValidSeedTime(ev.seedTime)) errors.push(`${ev.name} — invalid format (use MM:SS.ms or NT)`);
  });
  if (state.imSelected) {
    const v = $('imSeedTime').value.trim();
    if (v && !isValidSeedTime(v)) errors.push('100m IM — invalid seed time format');
    else if (!v) { state.imSeedTime = 'NT'; }
  }
  if (errors.length) {
    alert(`Please fix seed time entries:\n\n• ${errors.join('\n• ')}`);
    return;
  }
  if (countSelectedEvents() === 0) {
    alert('Select at least one individual event before proceeding.');
    return;
  }
  if (countSelectedEvents() < MAX_INDIV_EVENTS) {
    $('subCapCount').textContent = countSelectedEvents();
    $('subCapMsg').innerHTML =
      `Your ₹800 package covers up to <strong>${MAX_INDIV_EVENTS}</strong> individual events. ` +
      `You've selected <strong>${countSelectedEvents()}</strong>. Proceed or add more?`;
    openModal('subCapModal');
    return;
  }
  goToStep(3);
}

// ─── STEP 3 — renderCheckout ──────────────────────────────────
function renderCheckout() {
  const d = state.swimmerData;

  /* ── A. Booking Summary ── */
  const tourName = state.tournamentName || TOURNAMENT_NAME;
  $('bsTournament').textContent  = tourName;
  $('bsRegClose').textContent    = `Registration closes ${REG_CLOSE_DATE}`;
  $('bsSwimmerName').textContent = d.fullName || '—';
  $('bsSwimmerMeta').innerHTML   =
    `${genderLabel(d.gender)} ${d.category} &nbsp;·&nbsp; ID: ${state.swimmerId}`;
  $('bsAcademy').textContent = d.academy || 'None / Unattached';
  $('bsCoach').textContent   = d.coach   ? `Coach: ${d.coach}` : 'None / Self-Coached';

  /* ── B. Itemized Cart ── */
  const eventEntries = Object.values(state.selectedEvents);
  let cartHtml = '';
  eventEntries.forEach((ev, i) => {
    const seed  = ev.seedTime || 'NT';
    const isNT  = seed.toUpperCase() === 'NT';
    cartHtml += `
      <div class="cart-event-row">
        <span class="cart-event-number">${i + 1}</span>
        <span class="cart-event-name">${escHtml(d.gender === 'Girl' ? 'Girls' : 'Boys')} ${escHtml(d.category)} ${escHtml(ev.name)}</span>
        <span class="cart-event-seed${isNT ? ' nt-seed' : ''}">
          <i class="fas fa-stopwatch"></i> Seed: ${escHtml(seed)}
        </span>
      </div>`;
  });

  if (state.imSelected) {
    const imSeed = state.imSeedTime || 'NT';
    const isNT   = imSeed.toUpperCase() === 'NT';
    cartHtml += `
      <div class="cart-event-row">
        <span class="cart-event-number">${eventEntries.length + 1}</span>
        <span class="cart-event-name">100m Individual Medley</span>
        <span class="cart-event-im-tag">IM — Included</span>
        <span class="cart-event-seed${isNT ? ' nt-seed' : ''}">
          <i class="fas fa-stopwatch"></i> Seed: ${escHtml(imSeed)}
        </span>
      </div>`;
  }

  if (!cartHtml) {
    cartHtml = `<div style="padding:14px 20px;color:var(--gray);font-size:0.85rem;">No individual events selected.</div>`;
  }

  $('cartEventsList').innerHTML = cartHtml;

  // Slots badge
  const slotsEl = $('cartSlotsBadge');
  slotsEl.textContent = `${eventEntries.length} of ${MAX_INDIV_EVENTS} events used`;
  slotsEl.classList.toggle('full', eventEntries.length === MAX_INDIV_EVENTS);

  // Relay row
  if (state.relaySelected) {
    $('cartRelaySub').textContent = `${genderLabel(d.gender)} 4×50m Relay`;
    show('cartRelayRow');
  } else {
    hide('cartRelayRow');
  }

  // Fee totals
  const subtotal   = calcSubtotal();
  const grandTotal = calcGrandTotal();
  $('cartSubtotal').textContent  = formatCurrency(subtotal);
  $('cartGrandTotal').textContent = formatCurrency(grandTotal);
  $('footerTotal').textContent    = formatCurrency(grandTotal);

  /* ── C. Declarations — re-sync ── */
  syncDeclarations();

  /* ── D. Retry button ── */
  $('retryPayBtn').onclick = () => {
    hide('stepFailed');
    show('step3');
    $('step3').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

// ─── Declaration State Machine (Rule 5.1) ────────────────────
function syncDeclarations() {
  // Attach listeners once (guard via dataset)
  $$('.decl-checkbox').forEach(cb => {
    if (cb.dataset.bound) return;
    cb.dataset.bound = '1';
    cb.addEventListener('change', onDeclChange);
  });

  // Restore any prior state
  Object.keys(state.declarations).forEach(k => {
    const cb = $(`decl${k}`);
    if (cb) cb.checked = state.declarations[k];
  });

  refreshDeclUI();
}

function onDeclChange(e) {
  const key = parseInt(e.target.dataset.decl);
  state.declarations[key] = e.target.checked;
  refreshDeclUI();
}

function refreshDeclUI() {
  const count  = Object.values(state.declarations).filter(Boolean).length;
  const allSet = count === 4;

  // Progress bar
  $('declProgressText').textContent = `${count} of 4 declarations accepted`;
  $('declProgressFill').style.width = `${count * 25}%`;

  // Gate the payment button (Rule 5.1 — state machine guard)
  const btn = $('confirmPay');
  btn.disabled = !allSet;
  btn.classList.toggle('unlocked', allSet);

  // Highlight unchecked declarations in amber when attempted
  $$('.declaration-item').forEach(item => {
    const cb  = item.querySelector('.decl-checkbox');
    const key = parseInt(cb.dataset.decl);
    item.classList.toggle('decl-pending', !state.declarations[key]);
  });
}

function allDeclarationsAccepted() {
  return Object.values(state.declarations).every(Boolean);
}

// ─── Payment Gateway State Engine (Rule 5.3) ─────────────────
function initiatePayment() {
  if (!allDeclarationsAccepted()) {
    // Flash unchecked boxes
    $$('.declaration-item').forEach(item => {
      const cb = item.querySelector('.decl-checkbox');
      if (!cb.checked) {
        item.style.background = '#fff3cd';
        setTimeout(() => { item.style.background = ''; }, 800);
      }
    });
    $('declarationsCard') && $('declarationsCard').scrollIntoView({ behavior:'smooth', block:'center' });
    return;
  }

  // Transition → PROCESSING
  state.paymentState = 'processing';
  hide('step3');
  show('stepProcessing');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Simulate gateway callback after 2.5s (Rule 5.3)
  setTimeout(() => {
    // 90% success simulation — in production this is replaced by Razorpay callback
    const success = Math.random() < 0.9;
    if (success) {
      handlePaymentSuccess();
    } else {
      handlePaymentFailure('Payment declined by bank. Please try a different method.');
    }
  }, 2500);
}

// ── SUCCESS callback ──
async function handlePaymentSuccess() {
  state.paymentState = 'success';
  state.bookingRefNo = generateBookingRef();

  // Persist the registration to Supabase (best-effort; UI proceeds regardless)
  try { await saveRegistrationToDB(); }
  catch (e) { console.error('[SwimFest] DB save failed:', e); }

  hide('stepProcessing');
  renderSuccessReceipt();
  show('stepSuccess');
  updateStepper(4);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Persist swimmer + booking + event_entries to Supabase ─────
function seedTimeToMs(t) {
  if (!t || t.toUpperCase() === 'NT') return null;
  const m = t.match(/^(\d{1,2}):(\d{2})\.(\d{1,2})$/);
  if (!m) return null;
  return parseInt(m[1])*60000 + parseInt(m[2])*1000 + parseInt(m[3].padEnd(2,'0'));
}

function parseEventName(name) {
  // "50m Freestyle" → { distance:50, stroke:'Freestyle' }
  const m = name.match(/(\d+)m\s+(.+)/i);
  return m ? { distance: parseInt(m[1]), stroke: m[2] } : { distance: null, stroke: name };
}

async function saveRegistrationToDB() {
  if (!window.sb) { console.warn('[SwimFest] Supabase not loaded — skipping DB save.'); return; }
  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  const userId  = session ? session.userId : null;
  const d = state.swimmerData;

  // 1. Resolve academy_id (optional)
  let academyId = null;
  if (d.academy) {
    try {
      const { data: ac } = await window.sb.from('academies')
        .select('academy_id').eq('academy_name', d.academy).maybeSingle();
      if (ac) academyId = ac.academy_id;
    } catch (_) {}
  }

  // 2. Upsert swimmer (find existing for this account+name, else create)
  let swimmerId = null;
  try {
    let existing = null;
    if (userId) {
      const { data } = await window.sb.from('swimmers')
        .select('swimmer_id').eq('owner_id', userId).eq('full_name', d.fullName).maybeSingle();
      existing = data;
    }
    if (existing) {
      swimmerId = existing.swimmer_id;
      await window.sb.from('swimmers').update({
        gender: d.gender, date_of_birth: d.dob, category: d.category,
        sfi_serial_no: d.serialNo || null, parent_name: d.fullName,
        parent_phone: d.parentContact, parent_email: session ? session.email : null,
        academy_id: academyId,
      }).eq('swimmer_id', swimmerId);
    } else {
      const { data, error } = await window.sb.from('swimmers').insert({
        owner_id: userId,
        full_name: d.fullName, gender: d.gender, date_of_birth: d.dob,
        category: d.category, sfi_serial_no: d.serialNo || null,
        parent_name: d.fullName, parent_phone: d.parentContact,
        parent_email: session ? session.email : null, academy_id: academyId,
      }).select('swimmer_id').single();
      if (error) throw error;
      swimmerId = data.swimmer_id;
    }
  } catch (e) { console.error('[SwimFest] swimmer save error:', e.message); return; }

  // 3. Find tournament_id by title
  let tournamentId = null;
  try {
    const { data: tr } = await window.sb.from('tournaments')
      .select('tournament_id').eq('title', state.tournamentName || TOURNAMENT_NAME).maybeSingle();
    if (tr) tournamentId = tr.tournament_id;
  } catch (_) {}

  // 4. Create booking
  let bookingId = null;
  try {
    const { data, error } = await window.sb.from('bookings').insert({
      tournament_id: tournamentId, swimmer_id: swimmerId, booked_by: userId,
      base_fee: BASE_FEE, relay_fee: state.relaySelected ? RELAY_FEE : 0,
      platform_fee: PLATFORM_FEE, total_amount: calcGrandTotal(),
      relay_selected: state.relaySelected, im_selected: state.imSelected,
      payment_status: 'PAID', payment_ref: 'pay_' + Math.random().toString(36).slice(2,12),
      booking_ref: state.bookingRefNo,
    }).select('booking_id').single();
    if (error) throw error;
    bookingId = data.booking_id;
  } catch (e) { console.error('[SwimFest] booking save error:', e.message); return; }

  // 5. Insert event entries
  const rows = [];
  Object.values(state.selectedEvents).forEach(ev => {
    const p = parseEventName(ev.name);
    rows.push({
      booking_id: bookingId, swimmer_id: swimmerId, tournament_id: tournamentId,
      event_name: ev.name, stroke: p.stroke, distance: p.distance,
      category: d.category, gender: d.gender,
      seed_time_ms: seedTimeToMs(ev.seedTime), is_relay: false, is_im: false,
    });
  });
  if (state.imSelected) {
    rows.push({
      booking_id: bookingId, swimmer_id: swimmerId, tournament_id: tournamentId,
      event_name: '100m Individual Medley', stroke: 'Medley', distance: 100,
      category: d.category, gender: d.gender,
      seed_time_ms: seedTimeToMs(state.imSeedTime), is_relay: false, is_im: true,
    });
  }
  if (state.relaySelected) {
    rows.push({
      booking_id: bookingId, swimmer_id: swimmerId, tournament_id: tournamentId,
      event_name: '4×50m Freestyle Relay', stroke: 'Freestyle', distance: 50,
      category: d.category, gender: d.gender,
      seed_time_ms: null, is_relay: true, is_im: false,
    });
  }
  if (rows.length) {
    try {
      const { error } = await window.sb.from('event_entries').insert(rows);
      if (error) throw error;
    } catch (e) { console.error('[SwimFest] entries save error:', e.message); }
  }

  console.info(`[SwimFest] Registration saved ✓ swimmer=${swimmerId} booking=${bookingId} entries=${rows.length}`);
}

// ── FAILURE callback ──
function handlePaymentFailure(reason) {
  state.paymentState = 'failed';
  hide('stepProcessing');
  $('failureReason').textContent = reason || 'Payment could not be processed. Please try again.';
  show('stepFailed');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Success Receipt (Rule 5.4) ───────────────────────────────
function renderSuccessReceipt() {
  const d    = state.swimmerData;
  const ref  = state.bookingRefNo;
  const grand = calcGrandTotal();

  // Banner
  $('successRefNo').textContent = ref;
  $('receiptRef').textContent   = ref;

  // Notification contact
  $('notifContact').textContent = d.parentContact || '—';

  // Swimmer details grid
  const swimmerFields = [
    { label: 'Full Name',       value: d.fullName },
    { label: 'Swimmer ID',      value: state.swimmerId },
    { label: 'Category',        value: catLabel(d.gender, d.category) },
    { label: 'Date of Birth',   value: formatDate(d.dob) },
    { label: 'Parent Contact',  value: d.parentContact },
    { label: 'Serial No.',      value: d.serialNo || '—' },
    { label: 'Academy',         value: d.academy  || 'None / Unattached' },
    { label: 'Coach',           value: d.coach    || 'None / Self-Coached' },
  ];
  $('receiptSwimmerDetails').innerHTML = swimmerFields.map(f => `
    <div class="receipt-field">
      <div class="receipt-field-label">${f.label}</div>
      <div class="receipt-field-value">${escHtml(f.value)}</div>
    </div>`).join('');

  // Tournament details
  const tourFields = [
    { label: 'Tournament', value: state.tournamentName || TOURNAMENT_NAME },
    { label: 'Venue',      value: TOURNAMENT_VENUE },
    { label: 'Dates',      value: TOURNAMENT_DATES },
    { label: 'Reg Closed', value: REG_CLOSE_DATE },
  ];
  $('receiptTournamentDetails').innerHTML = tourFields.map(f => `
    <div class="receipt-field">
      <div class="receipt-field-label">${f.label}</div>
      <div class="receipt-field-value">${escHtml(f.value)}</div>
    </div>`).join('');

  // Events list
  const evEntries = Object.values(state.selectedEvents);
  let evHtml = '';
  evEntries.forEach((ev, i) => {
    const seed = ev.seedTime || 'NT';
    evHtml += `
      <div class="receipt-event-row">
        <span class="receipt-event-num">${i + 1}</span>
        <span class="receipt-event-name">
          ${escHtml(d.gender === 'Girl' ? 'Girls' : 'Boys')} ${escHtml(d.category)} ${escHtml(ev.name)}
        </span>
        <span class="receipt-event-seed">${escHtml(seed)}</span>
      </div>`;
  });
  if (state.imSelected) {
    const imSeed = state.imSeedTime || 'NT';
    evHtml += `
      <div class="receipt-event-row">
        <span class="receipt-event-num">${evEntries.length + 1}</span>
        <span class="receipt-event-name">100m Individual Medley (IM)</span>
        <span class="receipt-event-seed">${escHtml(imSeed)}</span>
      </div>`;
  }
  if (state.relaySelected) {
    evHtml += `
      <div class="receipt-event-row">
        <span class="receipt-event-num" style="background:var(--warning)">R</span>
        <span class="receipt-event-name">4×50m Freestyle Relay Entry</span>
        <span class="receipt-event-seed" style="background:#fff3cd;color:#856404;">Add-on</span>
      </div>`;
  }
  $('receiptEventsList').innerHTML = evHtml || '<div style="padding:10px 20px;color:var(--gray);font-size:0.84rem;">—</div>';

  // Fee summary
  const subtotal = calcSubtotal();
  let feeHtml = `
    <div class="receipt-fee-row">
      <span>Swimmer Registration Package Fee (up to 3 events + IM)</span>
      <span>${formatCurrency(BASE_FEE)}</span>
    </div>`;
  if (state.relaySelected) {
    feeHtml += `
    <div class="receipt-fee-row">
      <span>Optional Relay Add-On (${genderLabel(d.gender)} 4×50m)</span>
      <span>${formatCurrency(RELAY_FEE)}</span>
    </div>`;
  }
  feeHtml += `
    <div class="receipt-fee-row">
      <span>Subtotal Payable</span>
      <span>${formatCurrency(subtotal)}</span>
    </div>
    <div class="receipt-fee-row">
      <span>Platform &amp; Technology Fee (Incl. GST)</span>
      <span>${formatCurrency(PLATFORM_FEE)}</span>
    </div>
    <div class="receipt-fee-row receipt-fee-total">
      <span>Total Amount Paid</span>
      <span>${formatCurrency(grand)}</span>
    </div>`;
  $('receiptFeeSummary').innerHTML = feeHtml;

  // Dashboard button
  $('dashboardBtn').onclick = () => {
    alert(`Swimmer Dashboard for ${d.fullName} — feature coming soon!`);
  };
}

// Exposed for print button in HTML
function printReceipt() {
  window.print();
}

// ─── Sub-cap Modal ────────────────────────────────────────────
function openModal(id) {
  const m = $(id);
  if (!m) return;
  m.classList.add('active');
  m.style.display = 'flex';
}

function closeModal(id) {
  const m = $(id);
  if (!m) return;
  m.classList.remove('active');
  m.style.display = 'none';
}

function initSubCapModal() {
  $('subCapClose').addEventListener('click',   () => closeModal('subCapModal'));
  $('subCapGoBack').addEventListener('click',  () => closeModal('subCapModal'));
  $('subCapProceed').addEventListener('click', () => { closeModal('subCapModal'); goToStep(3); });
  $('subCapModal').addEventListener('click',   e => { if (e.target === $('subCapModal')) closeModal('subCapModal'); });
}

// ─── Nav Buttons ──────────────────────────────────────────────
function initNavButtons() {
  $('step2Back').addEventListener('click', () => goToStep(1));
  $('step2Next').addEventListener('click', validateStep2);
  $('step3Back').addEventListener('click', () => goToStep(2));
  $('confirmPay').addEventListener('click', initiatePayment);
}

// ─── URL Params ───────────────────────────────────────────────
function applyUrlParams() {
  const params   = new URLSearchParams(window.location.search);
  const tourName = params.get('tournament');
  if (tourName) {
    state.tournamentName = decodeURIComponent(tourName);
    const el = $('tournamentName');
    if (el) el.textContent = state.tournamentName;
    return true;
  }
  return false;
}

// ─── Tournament Picker (when no tournament pre-selected) ──────
function fmtPickDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

async function showTournamentPicker() {
  const picker = $('tournamentPicker');
  const wrap   = $('wizardWrap');
  picker.style.display = '';
  wrap.style.display   = 'none';

  const grid = $('pickerGrid');
  let list = [];

  if (window.sb) {
    try {
      const { data } = await window.sb.from('tournaments')
        .select('*').in('status', ['PUBLISHED','CLOSED']).order('start_date');
      if (data) list = data;
    } catch (e) { console.warn('[SwimFest] picker load:', e.message); }
  }

  if (!list.length) {
    grid.innerHTML = `<div class="reg-picker-empty">
      <i class="fas fa-calendar-times"></i>
      No open tournaments right now. Check back soon!</div>`;
    return;
  }

  grid.innerHTML = list.map((t, i) => `
    <div class="reg-pick-card" data-title="${escHtml(t.title)}"
         data-venue="${escHtml(t.venue_name)}, ${escHtml(t.city)}"
         data-dates="${fmtPickDate(t.start_date)} – ${fmtPickDate(t.end_date)}">
      <div class="reg-pick-poster t${i % 4}"><i class="fas fa-trophy"></i></div>
      <div class="reg-pick-body">
        <span class="reg-pick-status">Entries Open</span>
        <div class="reg-pick-name">${escHtml(t.title)}</div>
        <div class="reg-pick-meta">
          <p><i class="fas fa-map-marker-alt"></i> ${escHtml(t.venue_name)}, ${escHtml(t.city)}</p>
          <p><i class="fas fa-calendar-alt"></i> ${fmtPickDate(t.start_date)} – ${fmtPickDate(t.end_date)}</p>
          <p><i class="fas fa-rupee-sign"></i> ₹${Number(t.reg_fee_amount||800).toLocaleString('en-IN')} package</p>
        </div>
        <button class="reg-pick-btn">Register for this <i class="fas fa-arrow-right"></i></button>
      </div>
    </div>`).join('');

  // Card click → choose tournament and start wizard
  grid.querySelectorAll('.reg-pick-card').forEach(card => {
    card.addEventListener('click', () => {
      chooseTournament(card.dataset.title, card.dataset.venue, card.dataset.dates);
    });
  });
}

function chooseTournament(title, venue, dates) {
  state.tournamentName = title;
  $('tournamentName').textContent = title;
  // Update the context banner meta
  const metaEl = document.querySelector('.reg-tour-meta');
  if (metaEl && venue) {
    metaEl.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${escHtml(venue)} &nbsp;|&nbsp; <i class="fas fa-calendar-alt"></i> ${escHtml(dates)}`;
  }
  // Came via the picker → back buttons return to the picker
  setBackTargets('picker');
  $('tournamentPicker').style.display = 'none';
  $('wizardWrap').style.display = '';
  startWizard();
}

// ── Configure the two "back" links based on entry path ────────
function setBackTargets(mode) {
  const top   = $('backTop');
  const step1 = $('backStep1');
  if (mode === 'event') {
    // Came from the event details page → return there
    if (top)   { top.setAttribute('href', 'event.html');   top.innerHTML   = '<i class="fas fa-arrow-left"></i> Back to Event'; }
    if (step1) { step1.setAttribute('href', 'event.html'); step1.innerHTML = '<i class="fas fa-arrow-left"></i> Back to Details'; }
  } else {
    // Came via the tournament picker (hero banner / generic register)
    // → return to the picker instead of a specific event page
    if (top)   { top.setAttribute('href', '#'); top.innerHTML = '<i class="fas fa-arrow-left"></i> Change Tournament'; top.onclick = backToPicker; }
    if (step1) { step1.setAttribute('href', '#'); step1.innerHTML = '<i class="fas fa-arrow-left"></i> Change Tournament'; step1.onclick = backToPicker; }
  }
}

function backToPicker(e) {
  if (e) e.preventDefault();
  wizardStarted = false;             // allow wizard to re-init for a new choice
  $('wizardWrap').style.display = 'none';
  $('tournamentPicker').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Rule 6.2: Dynamic Academy & Coach Dropdowns ─────────────
// Reads from window.SWIMFEST_ACADEMIES / window.SWIMFEST_COACHES
// populated by academy.js which is loaded first.

let ACADEMIES_CACHE = [];
let COACHES_CACHE   = [];

async function populateAcademyDropdown() {
  const sel = $('affiliatedAcademy');
  if (!sel) return;

  if (window.sb) {
    try {
      const { data: acs } = await window.sb.from('academies')
        .select('academy_id, academy_name, city').eq('status','APPROVED_ACTIVE').order('academy_name');
      if (acs) ACADEMIES_CACHE = acs;
      const { data: cs } = await window.sb.from('coaches')
        .select('coach_id, full_name, designation, academy_id').eq('status','APPROVED_ACTIVE');
      if (cs) COACHES_CACHE = cs;
    } catch (e) { console.warn('[SwimFest] academy/coach load:', e.message); }
  }

  ACADEMIES_CACHE.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.academy_name;
    opt.dataset.id = a.academy_id;
    opt.textContent = `${a.academy_name} (${a.city})`;
    sel.appendChild(opt);
  });
}

function populateCoachDropdown(academyName) {
  const sel = $('assignedCoach');
  sel.innerHTML = '<option value="">None / Self-Coached</option>';
  if (!academyName) return;

  const academy = ACADEMIES_CACHE.find(a => a.academy_name === academyName);
  if (!academy) return;

  const linked = COACHES_CACHE.filter(c => c.academy_id === academy.academy_id);
  linked.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.full_name;
    opt.textContent = `${c.full_name} — ${c.designation}`;
    sel.appendChild(opt);
  });
  if (linked.length === 1) sel.value = linked[0].full_name;
}

async function initAcademyCoachLinking() {
  await populateAcademyDropdown();

  $('affiliatedAcademy').addEventListener('change', function () {
    populateCoachDropdown(this.value);
    state.swimmerData.coach   = '';
    state.swimmerData.academy = this.value;
  });
}

// ─── Wizard init (runs once a tournament is chosen) ───────────
let wizardStarted = false;
function startWizard() {
  if (wizardStarted) return;
  wizardStarted = true;
  const session = window.SwimAuth ? window.SwimAuth.getSession() : null;
  prefillFromSession(session);
  initStep1();
  initAcademyCoachLinking();
  initSubCapModal();
  initNavButtons();
  updateStepper(1);
}

// ─── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // ── AUTH GUARD: must be logged in to register for a tournament ──
  const session = window.SwimAuth && window.SwimAuth.requireLogin();
  if (!session) return; // redirected to login — stop initializing

  const hasTournament = applyUrlParams();
  const params = new URLSearchParams(window.location.search);
  const from = params.get('from');   // 'event' when coming from a details page

  if (hasTournament) {
    // A specific tournament was passed in the URL → go straight to the wizard.
    // Back button behaviour depends on where they came from.
    setBackTargets(from === 'event' ? 'event' : 'picker');
    $('tournamentPicker').style.display = 'none';
    $('wizardWrap').style.display = '';
    startWizard();
  } else {
    // Generic "Register for Tournament" (hero banner) → pick a tournament first
    showTournamentPicker();
  }
});

// ─── Prefill Step 1 from logged-in session ────────────────────
function prefillFromSession(session) {
  if (!session) return;
  // Only prefill for swimmer/parent accounts
  const nameEl  = document.getElementById('fullName');
  const phoneEl = document.getElementById('parentContact');
  if (nameEl && !nameEl.value && session.name && session.role === 'swimmer') {
    nameEl.value = session.name.replace(/\s*\(Parent\)$/i, '');
  }
  if (phoneEl && !phoneEl.value && session.phone) {
    phoneEl.value = session.phone;
  }
}
