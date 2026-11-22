/* ============================================================
   SwimFest — email the parent about an entry decision
   POST /api/notify-decision   { booking_id }
   Called by the Admin / Super Admin console right after they
   approve or decline. Only someone allowed to decide that meet's
   entries (can_decide_entries) can trigger it, and the email always
   goes to the parent on record, never to an address from the browser.
   ============================================================ */
'use strict';

const S = require('./_shared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return S.send(res, 405, { error: 'Use POST.' });
  const who = await S.caller(req);
  if (!who) return S.send(res, 401, { error: 'Sign in again.' });
  const bookingId = String(S.body(req).booking_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return S.send(res, 400, { error: 'Missing registration.' });
  if (!S.mailReady()) return S.send(res, 503, { error: 'Email is not set up on the server yet.' });

  try {
    // Read as the staff member: RLS + can_decide_entries decide whether they may
    const booking = await S.loadBooking(who.db, bookingId);
    if (!booking) return S.send(res, 404, { error: 'Registration not found.' });
    const { data: allowed } = await who.db.rpc('can_decide_entries', { p_tournament: booking.tournament_id });
    if (allowed !== true) return S.send(res, 403, { error: 'You can only email parents for meets you run.' });
    if (!['APPROVED', 'REJECTED'].includes(booking.approval_status)) {
      return S.send(res, 409, { error: 'This registration hasn\'t been decided yet.' });
    }

    const to = await S.parentEmail(booking, S.admin());
    if (!to) return S.send(res, 422, { error: 'No email address on file for this parent.' });
    const mail = S.decisionEmail(booking, S.siteUrl(req));
    await S.sendMail({ to, ...mail });
    return S.send(res, 200, { sent: true, to: to.replace(/^(.{2}).*(@.*)$/, '$1…$2') });
  } catch (e) {
    console.error('[notify-decision]', e.message);
    return S.send(res, 500, { error: 'Could not send the email: ' + e.message });
  }
};
