/* ============================================================
   SwimFest — Login / Auth   login.js
   Session persisted in localStorage under 'swimfest_session'
   ============================================================ */
'use strict';

// ── Role → landing page + demo credential map ────────────────
const ROLE_CONFIG = {
  swimmer:       { label:'Swimmer / Parent',      landing:'profile.html',     demoEmail:'arun.parent@gmail.com',   demoName:'Arun Kumar (Parent)' },
  event_manager: { label:'Event Manager',         landing:'emdashboard.html', demoEmail:'em04@swimfest.in',        demoName:'Event Manager EM-TN-04' },
  organizer:     { label:'Tournament Organizer',  landing:'orgdashboard.html',demoEmail:'kovai@swimclub.org',      demoName:'Kovai Amateur Aquatic Club' },
  super_admin:   { label:'Super Admin',           landing:'superadmin.html',  demoEmail:'admin@swimfest.in',       demoName:'Super Admin' },
};

let selectedRole   = 'swimmer';
let selectedGender = 'Boy';
let accountType    = 'swimmer';  // 'swimmer' | 'organizer' (signup form)

const TOURNAMENT_YEAR = 2026;
const AGE_CATEGORIES = [
  { label:'U-10', minAge:8,  maxAge:9  },
  { label:'U-12', minAge:10, maxAge:11 },
  { label:'U-14', minAge:12, maxAge:13 },
  { label:'U-16', minAge:14, maxAge:15 },
];
function deriveCategory(dob) {
  if (!dob) return null;
  const age = TOURNAMENT_YEAR - new Date(dob).getFullYear();
  const cat = AGE_CATEGORIES.find(c => age >= c.minAge && age <= c.maxAge);
  return cat ? { label: cat.label, age } : null;
}

// ── Utilities ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function showError(fieldId, msg) {
  const input = $(fieldId);
  const err   = $(fieldId + 'Err');
  if (input) input.classList.add('error');
  if (err)   err.textContent = msg;
}

function clearError(fieldId) {
  const input = $(fieldId);
  const err   = $(fieldId + 'Err');
  if (input) input.classList.remove('error');
  if (err)   err.textContent = '';
}

function clearAllErrors() {
  document.querySelectorAll('.login-error').forEach(e => e.textContent = '');
  document.querySelectorAll('.login-input.error').forEach(e => e.classList.remove('error'));
}

// ── Tab switching ─────────────────────────────────────────────
window.switchTab = function(tab) {
  const isLogin = tab === 'login';
  $('tabLogin').classList.toggle('active', isLogin);
  $('tabSignup').classList.toggle('active', !isLogin);
  $('loginForm').style.display  = isLogin ? '' : 'none';
  $('signupForm').style.display = isLogin ? 'none' : '';
  clearAllErrors();
};

// ── Password toggle ───────────────────────────────────────────
window.togglePassword = function(fieldId, btn) {
  const input = $(fieldId);
  const icon  = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
  }
};

// ── Role selection ────────────────────────────────────────────
function initRoleButtons() {
  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRole = btn.dataset.role;
    });
  });
}

// ── Signup gender toggle + DOB category derive ────────────────
function initSignupExtras() {
  // Gender toggle (scoped so it doesn't clash with the account-type toggle)
  document.querySelectorAll('#signupGenderToggle .signup-gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#signupGenderToggle .signup-gender-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedGender = btn.dataset.gender;
      updateSignupDerived();
    });
  });

  // Account-type toggle: Swimmer vs Organizer
  document.querySelectorAll('#signupTypeToggle .signup-gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#signupTypeToggle .signup-gender-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      accountType = btn.dataset.acctype;
      applyAccountType();
    });
  });

  const dob = $('signupDob');
  if (dob) {
    dob.max = `${TOURNAMENT_YEAR - 8}-12-31`;   // youngest eligible
    dob.addEventListener('change', updateSignupDerived);
  }
}

// Show/hide fields + relabel based on the chosen account type
function applyAccountType() {
  const isOrg = accountType === 'organizer';
  const swimmerFields   = $('swimmerFields');
  const organizerFields = $('organizerFields');
  if (swimmerFields)   swimmerFields.style.display   = isOrg ? 'none' : '';
  if (organizerFields) organizerFields.style.display = isOrg ? '' : 'none';

  if ($('signupSub'))        $('signupSub').textContent        = isOrg
    ? 'Register as an organizer to host and manage your own swimming events.'
    : 'Join SwimFest to register for competitions.';
  if ($('signupPhoneLabel')) $('signupPhoneLabel').textContent = isOrg ? 'Contact Phone' : 'Phone (Parent / Guardian)';
  if ($('signupNameLabel'))  $('signupNameLabel').textContent  = isOrg ? 'Contact Person Name' : 'Full Name';
}

function updateSignupDerived() {
  const dobVal = $('signupDob').value;
  const box = $('signupDerived');
  if (!dobVal) { box.style.display = 'none'; return; }
  const cat = deriveCategory(dobVal);
  if (!cat) {
    box.style.display = '';
    box.innerHTML = `<span class="sd-pill err"><i class="fas fa-exclamation-triangle"></i> Age not within U-10 to U-16</span>`;
    return;
  }
  const yob = new Date(dobVal).getFullYear();
  box.style.display = '';
  box.innerHTML = `
    <span class="sd-pill"><i class="fas fa-calendar"></i> YOB: <strong>${yob}</strong></span>
    <span class="sd-pill"><i class="fas fa-birthday-cake"></i> Age: <strong>${cat.age}</strong></span>
    <span class="sd-pill cat">${selectedGender === 'Girl' ? 'GIRLS' : 'BOYS'} ${cat.label}</span>`;
}

// ── Auto-fill demo ────────────────────────────────────────────
window.fillDemo = function() {
  const cfg = ROLE_CONFIG[selectedRole];
  $('loginEmail').value    = cfg.demoEmail;
  $('loginPassword').value = 'demo1234';
  clearAllErrors();
  showToast(`Demo credentials for ${cfg.label} filled in.`, 'info');
};

// ── Login ─────────────────────────────────────────────────────
window.handleLogin = async function(e) {
  e.preventDefault();
  clearAllErrors();

  const email = $('loginEmail').value.trim();
  const pass  = $('loginPassword').value;
  let ok = true;

  if (!email) { showError('loginEmail', 'Email or username is required.'); ok = false; }
  if (!pass)  { showError('loginPassword', 'Password is required.'); ok = false; }
  if (!ok) return;

  const cfg = ROLE_CONFIG[selectedRole];
  const remember = $('rememberMe').checked;
  const btn = e.target.querySelector('.login-submit-btn');
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Signing in…';
  btn.disabled = true;

  if (!window.SwimAuth) { showError('loginPassword', 'Auth not loaded — refresh the page.'); btn.innerHTML=orig; btn.disabled=false; return; }
  if (!window.SwimAuth.hasSupabase()) { console.warn('[SwimFest] Supabase SDK not loaded — using demo mode.'); }

  const res = await window.SwimAuth.signIn({ email, password: pass, role: selectedRole, remember });
  console.log('[SwimFest] signIn result:', res);

  btn.innerHTML = orig; btn.disabled = false;

  if (!res.ok) {
    showError('loginPassword', res.error || 'Invalid email or password.');
    return;
  }

  // The real role comes from the account's profile, not the picked button.
  const role = res.session.role || selectedRole;

  // If the user picked a role that doesn't match their account, tell them.
  // (swimmer<->organizer can coexist on one account, so allow that pair.)
  const dualOk = (selectedRole === 'organizer' && role === 'swimmer')
              || (selectedRole === 'swimmer'   && role === 'organizer');
  if (selectedRole !== role && !dualOk) {
    const nice = { swimmer:'Swimmer / Parent', event_manager:'Event Manager', organizer:'Tournament Organizer', super_admin:'Super Admin' };
    showError('loginPassword',
      `This account is registered as ${nice[role] || role}, not ${nice[selectedRole] || selectedRole}. ` +
      `Pick the correct role above.`);
    // Sign back out so a wrong-role session isn't left behind
    if (window.SwimAuth) { try { await window.SwimAuth.logout(); } catch (_) {} }
    return;
  }

  const returnTo = getReturnTo();
  const landing = (ROLE_CONFIG[role] && ROLE_CONFIG[role].landing) || cfg.landing;
  const dest = returnTo || landing;

  showToast(`Signed in. Redirecting…`, 'success');
  setTimeout(() => { window.location.href = dest; }, 800);
};

// ── Read ?returnTo= param (only allow same-site relative pages) ──
function getReturnTo() {
  const params = new URLSearchParams(window.location.search);
  const rt = params.get('returnTo');
  if (!rt) return null;
  const decoded = decodeURIComponent(rt);
  // Safety: only allow local .html targets, no protocol/host
  if (/^[\w.\-]+\.html(\?[^#]*)?$/.test(decoded)) return decoded;
  return null;
}

// ── Signup ────────────────────────────────────────────────────
window.handleSignup = async function(e) {
  e.preventDefault();
  clearAllErrors();

  const name  = $('signupName').value.trim();
  const email = $('signupEmail').value.trim();
  const phone = $('signupPhone').value.trim();
  const dob   = $('signupDob').value;
  const pass  = $('signupPassword').value;
  const terms = $('agreeTerms').checked;
  let ok = true;

  if (!name)  { showError('signupName', 'Full name is required.'); ok = false; }
  if (!email) { showError('signupEmail', 'Email is required.'); ok = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('signupEmail', 'Enter a valid email.'); ok = false; }
  if (!phone) { showError('signupPhone', 'Phone number is required.'); ok = false; }
  else if (!/^[\d\s\+\-]{8,15}$/.test(phone)) { showError('signupPhone', 'Enter a valid phone number.'); ok = false; }
  const isOrg = accountType === 'organizer';
  if (isOrg) {
    // Organizer path: require org name, skip swimmer DOB/gender checks
    if (!$('signupOrgName') || !$('signupOrgName').value.trim()) { showError('signupOrgName', 'Organization / club name is required.'); ok = false; }
  } else {
    if (!dob) { showError('signupDob', 'Date of birth is required.'); ok = false; }
    else if (!deriveCategory(dob)) { showError('signupDob', 'Swimmer age must fall within U-10 to U-16.'); ok = false; }
  }
  if (!pass)  { showError('signupPassword', 'Password is required.'); ok = false; }
  else if (pass.length < 6) { showError('signupPassword', 'Password must be at least 6 characters.'); ok = false; }
  if (!terms) { $('signupTermsErr').textContent = 'You must agree to the terms to continue.'; ok = false; }
  if (!ok) return;

  const cat = deriveCategory(dob);

  const btn = e.target.querySelector('.login-submit-btn');
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Creating account…';
  btn.disabled = true;

  if (!window.SwimAuth) { showError('signupEmail', 'Auth not loaded — refresh the page.'); btn.innerHTML=orig; btn.disabled=false; return; }

  // Role depends on the chosen account type
  const newRole = isOrg ? 'organizer' : 'swimmer';
  let res = await window.SwimAuth.signUp({ email, password: pass, fullName: name, phone, role: newRole });
  console.log('[SwimFest] signUp result:', res);

  // Same email already exists?
  const alreadyExists = res && res.error && /already\s*(registered|exists)|user already/i.test(res.error);

  if (!res.ok && alreadyExists && isOrg) {
    // Existing account (e.g. a swimmer) wants to ALSO become an organizer.
    // Verify with their password and upgrade the account to organizer.
    const up = await window.SwimAuth.becomeOrganizer({ email, password: pass, fullName: name, phone });
    if (up.ok) {
      res = up; // continue the organizer flow below with this session
      showToast('Existing account found — adding organizer access.', 'info');
    } else if (up.error === 'wrong_password') {
      btn.innerHTML = orig; btn.disabled = false;
      showError('signupPassword', 'This email is already registered. Enter its password to add organizer access, or use a different email.');
      return;
    } else {
      btn.innerHTML = orig; btn.disabled = false;
      showError('signupEmail', 'Could not upgrade this account. Try logging in instead.');
      return;
    }
  } else if (!res.ok) {
    btn.innerHTML = orig; btn.disabled = false;
    if (alreadyExists) {
      showError('signupEmail', 'This email is already registered. Please log in instead.');
    } else {
      showError('signupEmail', res.error || 'Could not create account.');
    }
    return;
  }

  if (isOrg) {
    // Organizer: create/update their record in the dedicated organizers
    // table (upsert on owner_id so a swimmer-turned-organizer isn't dupled)
    if (window.sb && res.session && res.session.userId) {
      try {
        await window.sb.from('organizers').upsert({
          owner_id      : res.session.userId,
          org_name      : $('signupOrgName').value.trim(),
          contact_person: name,
          email_id      : email,
          phone_number  : phone,
          status        : 'PENDING_VERIFICATION',
        }, { onConflict: 'owner_id' });
      } catch (err) { console.warn('[SwimFest] organizer upsert:', err.message); }
    }
  } else if (window.sb && res.session && res.session.userId) {
    // Swimmer: create the swimmer record with gender + DOB + derived category
    try {
      await window.sb.from('swimmers').insert({
        owner_id     : res.session.userId,
        full_name    : name,
        gender       : selectedGender,
        date_of_birth: dob,
        category     : cat ? cat.label : null,
        parent_name  : name,
        parent_phone : phone,
        parent_email : email,
      });
      console.log('[SwimFest] swimmer record created for new account.');
    } catch (err) { console.warn('[SwimFest] swimmer insert:', err.message); }
  }

  btn.innerHTML = orig; btn.disabled = false;

  if (res.needsConfirm) {
    showToast('Account created! Check your email to confirm, then log in.', 'success');
    setTimeout(() => switchTab('login'), 1500);
    return;
  }

  const returnTo = getReturnTo();
  const dest = returnTo || (isOrg ? 'orgdashboard.html' : 'profile.html');
  showToast('Account created! Redirecting…', 'success');
  setTimeout(() => { window.location.href = dest; }, 1000);
};

// ── If already logged in, offer to continue ───────────────────
function checkExistingSession() {
  const raw = localStorage.getItem('swimfest_session') || sessionStorage.getItem('swimfest_session');
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    const cfg = ROLE_CONFIG[s.role];
    if (!cfg) return;

    // Pre-select their role
    document.querySelectorAll('.role-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.role === s.role);
    });
    selectedRole = s.role;

    // If they were sent here from a protected page, send them straight there
    const returnTo = getReturnTo();
    if (returnTo) {
      showToast(`Already signed in as ${s.roleLabel}. Continuing…`, 'info');
      setTimeout(() => { window.location.href = returnTo; }, 700);
    }
  } catch (_) {}
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const e = document.querySelector('.login-toast'); if (e) e.remove();
  const t = document.createElement('div');
  t.className = `login-toast login-toast-${type}`;
  const icon = type==='success'?'check-circle':type==='warn'?'exclamation-triangle':'info-circle';
  t.innerHTML = `<i class="fas fa-${icon}"></i> ${msg}`;
  document.body.appendChild(t);
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),400);},3000);
}
window.showToast = showToast;

(function(){
  const s = document.createElement('style');
  s.textContent = `
    .login-toast{position:fixed;bottom:28px;right:28px;z-index:99999;padding:12px 20px;
      background:var(--dark);color:var(--white);border-radius:var(--radius-sm);
      font-size:0.85rem;font-weight:500;display:flex;align-items:center;gap:10px;
      box-shadow:0 8px 24px rgba(0,0,0,0.25);transform:translateY(20px);opacity:0;
      transition:all 0.3s ease;max-width:400px;font-family:'Inter',sans-serif;}
    .login-toast.show{transform:translateY(0);opacity:1;}
    .login-toast i{color:var(--accent);}
    .login-toast.login-toast-success i{color:var(--success);}
    .login-toast.login-toast-warn i{color:var(--warning);}`;
  document.head.appendChild(s);
})();

// ── Bootstrap ─────────────────────────────────────────────────
function showReasonBanner() {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get('reason');
  if (!reason) return;
  const msgs = {
    login_required: 'Please sign in to register for a tournament.',
    wrong_role:     'Your account role does not have access to that page.',
  };
  const msg = msgs[reason];
  if (!msg) return;

  const banner = document.createElement('div');
  banner.style.cssText = `background:#fff3cd;border:1px solid #ffc107;color:#856404;
    padding:11px 16px;border-radius:var(--radius-sm);font-size:0.85rem;font-weight:600;
    margin-bottom:20px;display:flex;align-items:center;gap:8px;`;
  banner.innerHTML = `<i class="fas fa-lock"></i> ${msg}`;
  const wrap = document.querySelector('.login-form-wrap');
  const tabs = document.querySelector('.login-tabs');
  if (wrap && tabs) wrap.insertBefore(banner, tabs);

  // Default to swimmer role since that's who registers
  document.querySelectorAll('.role-btn').forEach(b => b.classList.toggle('active', b.dataset.role === 'swimmer'));
  selectedRole = 'swimmer';
}

document.addEventListener('DOMContentLoaded', () => {
  initRoleButtons();
  initSignupExtras();
  showReasonBanner();
  checkExistingSession();
});
