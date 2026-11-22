/* ============================================================
   SwimFest — helpers shared by the email + payment functions
   (files starting with "_" are not routes on Vercel)

   Environment variables (Vercel → Project → Settings → Environment Variables):
     SUPABASE_URL, SUPABASE_ANON_KEY   (fall back to the public project values)
     SUPABASE_SERVICE_ROLE_KEY         server-only; marks payments, reads parent emails
     GMAIL_USER, GMAIL_APP_PASSWORD    the Gmail account that sends the emails
     RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
     SITE_URL                          optional, e.g. https://swim-fest-orcin.vercel.app
   ============================================================ */
'use strict';

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nexnriixtrvjycjzqypq.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5leG5yaWl4dHJ2anljanpxeXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjE2ODIsImV4cCI6MjEwMzk5NzY4Mn0.5vu_Xeo2sKwOf5rjeFIFrjYba4mKosJrOnnsMRp_CEQ';
const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } };

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = null; } }
  return b || {};
}

// The caller's Supabase sign-in → { user, token, db } (db runs as them, under RLS)
async function caller(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { ...NO_SESSION, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return { user: data.user, token, db };
}

// Full-access client for trusted server work (never sent to the browser)
function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, NO_SESSION);
}

// Load a registration with its swimmer and meet
async function loadBooking(db, bookingId) {
  const { data, error } = await db.from('bookings')
    .select('*, swimmers(full_name, parent_name, parent_email, parent_phone), tournaments(tournament_id, title, start_date, end_date, venue_name, city, reg_fee_amount, relay_add_on_fee, platform_fee, gateway_option)')
    .eq('booking_id', bookingId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// What the parent owes, worked out from the meet's own fees (never trusts the browser).
// Same rule as the register page: entry fee + relay (if chosen) + platform fee for online meets.
function amountDue(booking) {
  const t = booking.tournaments || {};
  const num = (v, d) => (v == null || v === '' || isNaN(Number(v)) ? d : Number(v));
  const base = num(t.reg_fee_amount, 800);
  const relay = booking.relay_selected ? num(t.relay_add_on_fee, 300) : 0;
  const offline = t.gateway_option === 'OPTION_B_NO_GATEWAY';
  const platform = offline ? 0 : num(t.platform_fee, 50);
  return Math.round((base + relay + platform) * 100) / 100;
}

// Where to email the parent: the address on the swimmer, else their account email
async function parentEmail(booking, sa) {
  const s = booking.swimmers || {};
  if (s.parent_email) return s.parent_email;
  if (sa && booking.booked_by) {
    const { data } = await sa.auth.admin.getUserById(booking.booked_by);
    if (data && data.user && data.user.email) return data.user.email;
  }
  return null;
}

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `https://${host}` : '';
}

// ── Email (Gmail SMTP with an app password) ─────────────────
function mailReady() { return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD); }

async function sendMail({ to, subject, html, text }) {
  if (!mailReady()) throw new Error('Email is not set up (GMAIL_USER / GMAIL_APP_PASSWORD).');
  const nodemailer = require('nodemailer');
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, '') },
  });
  await transport.sendMail({ from: `"SwimFest" <${process.env.GMAIL_USER}>`, to, subject, html, text });
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const day = d => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
};
const rupees = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="font-weight:700;font-size:20px;color:#0b5cad;margin-bottom:16px;">SwimFest</div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
      <h1 style="font-size:20px;margin:0 0 12px;">${esc(title)}</h1>
      ${bodyHtml}
    </div>
    <p style="font-size:12px;color:#64748b;margin-top:16px;">You're getting this because you registered a swimmer on SwimFest.</p>
  </div></body></html>`;
}

function meetLines(b) {
  const t = b.tournaments || {};
  const s = b.swimmers || {};
  const when = [day(t.start_date), day(t.end_date)].filter(Boolean).join(' – ');
  const where = [t.venue_name, t.city].filter(Boolean).join(', ');
  return {
    html: `<table style="font-size:14px;line-height:1.6;margin:12px 0;">
      <tr><td style="color:#64748b;padding-right:12px;">Swimmer</td><td><b>${esc(s.full_name || '')}</b></td></tr>
      <tr><td style="color:#64748b;padding-right:12px;">Meet</td><td><b>${esc(t.title || '')}</b></td></tr>
      ${when ? `<tr><td style="color:#64748b;padding-right:12px;">Dates</td><td>${esc(when)}</td></tr>` : ''}
      ${where ? `<tr><td style="color:#64748b;padding-right:12px;">Venue</td><td>${esc(where)}</td></tr>` : ''}
      ${b.booking_ref ? `<tr><td style="color:#64748b;padding-right:12px;">Reference</td><td>${esc(b.booking_ref)}</td></tr>` : ''}
    </table>`,
    text: `Swimmer: ${s.full_name || ''}\nMeet: ${t.title || ''}\n${when ? 'Dates: ' + when + '\n' : ''}${where ? 'Venue: ' + where + '\n' : ''}${b.booking_ref ? 'Reference: ' + b.booking_ref + '\n' : ''}`,
  };
}

const button = (href, label) =>
  `<p style="margin:20px 0 8px;"><a href="${esc(href)}" style="background:#0b5cad;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700;display:inline-block;">${esc(label)}</a></p>`;

function decisionEmail(b, site) {
  const m = meetLines(b);
  const link = `${site}/profile.html#registrations`;
  const parent = (b.swimmers || {}).parent_name || 'there';
  if (b.approval_status === 'APPROVED') {
    const due = rupees(amountDue(b));
    return {
      subject: `Approved: ${(b.swimmers || {}).full_name || 'your swimmer'} for ${(b.tournaments || {}).title || 'the meet'}. Pay to confirm`,
      html: layout('Your entry is approved', `<p>Hi ${esc(parent)},</p>
        <p>Good news: the organisers approved this entry. <b>Pay ${esc(due)} to confirm it.</b> The place isn't confirmed until payment is done.</p>
        ${m.html}${button(link, `Pay ${due} and confirm`)}
        <p style="font-size:13px;color:#64748b;">Or open SwimFest, go to your profile and find it under My registrations.</p>`),
      text: `Hi ${parent},\n\nThe organisers approved this entry. Pay ${due} to confirm it:\n\n${m.text}\nPay here: ${link}\n`,
    };
  }
  const reason = b.decision_notes || '';
  return {
    subject: `Entry declined: ${(b.swimmers || {}).full_name || 'your swimmer'} for ${(b.tournaments || {}).title || 'the meet'}`,
    html: layout('Your entry was declined', `<p>Hi ${esc(parent)},</p>
      <p>The organisers couldn't approve this entry.</p>${m.html}
      ${reason ? `<p style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;"><b>Reason:</b> ${esc(reason)}</p>` : ''}
      <p>You can fix the details and register again.</p>${button(link, 'Open My registrations')}`),
    text: `Hi ${parent},\n\nThe organisers couldn't approve this entry.\n\n${m.text}${reason ? 'Reason: ' + reason + '\n' : ''}\nFix it and register again: ${link}\n`,
  };
}

function paidEmail(b, amount, paymentId, site) {
  const m = meetLines(b);
  const parent = (b.swimmers || {}).parent_name || 'there';
  return {
    subject: `Confirmed: ${(b.swimmers || {}).full_name || 'your swimmer'} for ${(b.tournaments || {}).title || 'the meet'}`,
    html: layout('Registration confirmed', `<p>Hi ${esc(parent)},</p>
      <p>We received your payment of <b>${esc(rupees(amount))}</b>. The entry is confirmed.</p>${m.html}
      <p style="font-size:13px;color:#64748b;">Payment ID: ${esc(paymentId)}</p>
      ${button(`${site}/profile.html#registrations`, 'View My registrations')}`),
    text: `Hi ${parent},\n\nWe received your payment of ${rupees(amount)}. The entry is confirmed.\n\n${m.text}Payment ID: ${paymentId}\n`,
  };
}

// ── Razorpay ────────────────────────────────────────────────
function razorpayReady() { return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET); }

async function razorpay(path, { method = 'GET', json } = {}) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: json ? JSON.stringify(json) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.error && data.error.description) || `Razorpay error ${res.status}`);
  return data;
}

module.exports = {
  send, body, caller, admin, loadBooking, amountDue, parentEmail, siteUrl,
  mailReady, sendMail, decisionEmail, paidEmail, razorpayReady, razorpay, rupees,
};
