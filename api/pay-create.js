/* ============================================================
   SwimFest — start paying for an approved entry (Razorpay order)
   POST /api/pay-create   { booking_id }
   Only the parent who made the registration can pay, only once it is
   approved, and the amount is worked out here from the meet's fees.
   ============================================================ */
'use strict';

const S = require('./_shared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return S.send(res, 405, { error: 'Use POST.' });
  const who = await S.caller(req);
  if (!who) return S.send(res, 401, { error: 'Sign in again to pay.' });
  const bookingId = String(S.body(req).booking_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return S.send(res, 400, { error: 'Missing registration.' });
  const sa = S.admin();
  if (!S.razorpayReady() || !sa) return S.send(res, 503, { error: 'Online payment is not set up yet. Please try again later.' });

  try {
    const booking = await S.loadBooking(sa, bookingId);
    if (!booking || booking.booked_by !== who.user.id) return S.send(res, 404, { error: 'Registration not found.' });
    if (booking.approval_status !== 'APPROVED') return S.send(res, 409, { error: 'This entry isn\'t approved yet, so it can\'t be paid.' });
    if (booking.payment_status === 'PAID') return S.send(res, 409, { error: 'This entry is already paid.' });

    const amount = S.amountDue(booking);
    const paise = Math.round(amount * 100);
    if (paise < 100) return S.send(res, 400, { error: 'Nothing to pay for this entry.' });

    // Reuse an open order for the same amount, so a retry doesn't create a second one
    let order = null;
    if (booking.razorpay_order_id) {
      try {
        const old = await S.razorpay(`/orders/${encodeURIComponent(booking.razorpay_order_id)}`);
        if (old.status !== 'paid' && old.amount === paise) order = old;
      } catch (_) { /* make a new one */ }
    }
    if (!order) {
      order = await S.razorpay('/orders', { method: 'POST', json: {
        amount: paise, currency: 'INR',
        receipt: String(booking.booking_ref || booking.booking_id).slice(0, 40),
        notes: { booking_id: booking.booking_id, tournament_id: booking.tournament_id },
      } });
      const { error } = await sa.from('bookings').update({ razorpay_order_id: order.id }).eq('booking_id', bookingId);
      if (error) throw new Error(error.message);
    }

    const s = booking.swimmers || {};
    return S.send(res, 200, {
      key_id: process.env.RAZORPAY_KEY_ID,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency || 'INR',
      description: `${(booking.tournaments || {}).title || 'Meet'} entry: ${s.full_name || ''}`.trim(),
      prefill: { name: s.parent_name || '', email: s.parent_email || who.user.email || '', contact: s.parent_phone || '' },
    });
  } catch (e) {
    console.error('[pay-create]', e.message);
    return S.send(res, 500, { error: 'Could not start the payment: ' + e.message });
  }
};
