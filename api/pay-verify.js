/* ============================================================
   SwimFest — confirm an entry once Razorpay says it's paid
   POST /api/pay-verify   { booking_id, razorpay_payment_id?, razorpay_signature? }
   Asks Razorpay directly whether the booking's order is paid (so it
   also works if the parent closed the page mid-payment), checks the
   checkout signature when one is given, then marks the entry PAID
   and emails a confirmation.
   ============================================================ */
'use strict';

const crypto = require('crypto');
const S = require('./_shared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return S.send(res, 405, { error: 'Use POST.' });
  const who = await S.caller(req);
  if (!who) return S.send(res, 401, { error: 'Sign in again.' });
  const b = S.body(req);
  const bookingId = String(b.booking_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return S.send(res, 400, { error: 'Missing registration.' });
  const sa = S.admin();
  if (!S.razorpayReady() || !sa) return S.send(res, 503, { error: 'Online payment is not set up yet.' });

  try {
    const booking = await S.loadBooking(sa, bookingId);
    if (!booking || booking.booked_by !== who.user.id) return S.send(res, 404, { error: 'Registration not found.' });
    if (booking.payment_status === 'PAID') return S.send(res, 200, { paid: true, already: true });
    if (!booking.razorpay_order_id) return S.send(res, 200, { paid: false });

    // A signature from the checkout must match this booking's order
    if (b.razorpay_payment_id && b.razorpay_signature) {
      const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${booking.razorpay_order_id}|${b.razorpay_payment_id}`).digest('hex');
      const given = String(b.razorpay_signature);
      if (expected.length !== given.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given))) {
        return S.send(res, 400, { error: 'Payment could not be verified.' });
      }
    }

    // Razorpay is the source of truth: the order must be fully paid
    const order = await S.razorpay(`/orders/${encodeURIComponent(booking.razorpay_order_id)}`);
    if (order.status !== 'paid' || order.amount_paid < order.amount) return S.send(res, 200, { paid: false });
    if (order.notes && order.notes.booking_id && order.notes.booking_id !== bookingId) {
      return S.send(res, 400, { error: 'Payment belongs to a different registration.' });
    }
    const payments = await S.razorpay(`/orders/${encodeURIComponent(order.id)}/payments`);
    const captured = (payments.items || []).find(p => p.status === 'captured');
    const paymentId = (captured && captured.id) || b.razorpay_payment_id || order.id;
    const amount = order.amount_paid / 100;

    const { data: updated, error } = await sa.from('bookings')
      .update({ payment_status: 'PAID', payment_ref: paymentId, paid_at: new Date().toISOString(), paid_amount: amount, total_amount: amount })
      .eq('booking_id', bookingId).neq('payment_status', 'PAID')
      .select('booking_id');
    if (error) throw new Error(error.message);

    // Email only once (the first call that actually marked it paid)
    if (updated && updated.length && S.mailReady()) {
      try {
        const to = await S.parentEmail(booking, sa);
        if (to) await S.sendMail({ to, ...S.paidEmail(booking, amount, paymentId, S.siteUrl(req)) });
      } catch (e) { console.warn('[pay-verify] email:', e.message); }
    }
    return S.send(res, 200, { paid: true, amount, payment_id: paymentId });
  } catch (e) {
    console.error('[pay-verify]', e.message);
    return S.send(res, 500, { error: 'Could not check the payment: ' + e.message });
  }
};
