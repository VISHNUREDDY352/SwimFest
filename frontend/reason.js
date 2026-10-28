/* ============================================================
   SwimFest – "Why are you rejecting this?" box
   A reason is required whenever staff reject or send back a
   submission, so the person who sent it knows what to fix.

   const reason = await SwimReason.ask({ title, subject });
   → the trimmed reason, or null if they cancelled.
   ============================================================ */
(function () {
  const MIN = 10;   // characters: enough for a real reason, not "no"

  const css = `
  .srn-back{position:fixed;inset:0;z-index:100001;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px}
  .srn-box{width:100%;max-width:480px;background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(15,23,42,.3);font-family:Inter,system-ui,sans-serif;color:#1e293b;overflow:hidden}
  .srn-head{padding:18px 20px 6px;font-weight:700;font-size:1.05rem}
  .srn-sub{padding:0 20px;font-size:.85rem;color:#64748b;line-height:1.45}
  .srn-body{padding:14px 20px 4px}
  .srn-body textarea{width:100%;min-height:110px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;font:inherit;font-size:.9rem;resize:vertical}
  .srn-body textarea:focus{outline:2px solid #0077b6;outline-offset:1px;border-color:#0077b6}
  .srn-err{min-height:1.2em;font-size:.78rem;color:#b91c1c;padding:4px 20px 0}
  .srn-foot{display:flex;justify-content:flex-end;gap:10px;padding:12px 20px 18px}
  .srn-foot button{font:inherit;font-weight:600;font-size:.88rem;border-radius:10px;padding:9px 16px;cursor:pointer}
  .srn-cancel{background:#fff;border:1px solid #cbd5e1;color:#1e293b}
  .srn-ok{background:#b91c1c;border:1px solid #b91c1c;color:#fff}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function ask({ title = 'Reason for rejecting', subject = '', action = 'Reject', placeholder } = {}) {
    return new Promise(resolve => {
      const back = document.createElement('div');
      back.className = 'srn-back';
      back.innerHTML = `
        <div class="srn-box" role="dialog" aria-modal="true" aria-labelledby="srnTitle">
          <div class="srn-head" id="srnTitle">${esc(title)}</div>
          <div class="srn-sub">${subject ? `<b>${esc(subject)}</b><br>` : ''}This reason is shown to whoever submitted it, so they know what to fix.</div>
          <div class="srn-body"><textarea id="srnText" maxlength="1000" placeholder="${esc(placeholder || 'e.g. The pool address is missing and the entry fee looks wrong. Please add the venue and check the fee.')}"></textarea></div>
          <div class="srn-err" id="srnErr"></div>
          <div class="srn-foot">
            <button type="button" class="srn-cancel">Cancel</button>
            <button type="button" class="srn-ok">${esc(action)}</button>
          </div>
        </div>`;
      document.body.appendChild(back);
      const text = back.querySelector('#srnText');
      text.focus();

      const done = value => { back.remove(); document.removeEventListener('keydown', onKey); resolve(value); };
      const submit = () => {
        const v = text.value.trim();
        if (v.length < MIN) {
          back.querySelector('#srnErr').textContent = `Please write a reason (at least ${MIN} characters).`;
          text.focus();
          return;
        }
        done(v);
      };
      const onKey = e => { if (e.key === 'Escape') done(null); };
      document.addEventListener('keydown', onKey);
      back.querySelector('.srn-cancel').addEventListener('click', () => done(null));
      back.querySelector('.srn-ok').addEventListener('click', submit);
      back.addEventListener('click', e => { if (e.target === back) done(null); });
    });
  }

  // Save a decision with its reason; databases without the
  // rejection_notes column (SQL not run yet) still save the status.
  async function update(table, idCol, id, patch) {
    let res = await window.sb.from(table).update(patch).eq(idCol, id).select(idCol);
    if (res.error && /rejection_notes/i.test(res.error.message)) {
      const { rejection_notes, ...rest } = patch;
      res = await window.sb.from(table).update(rest).eq(idCol, id).select(idCol);
    }
    // RLS can silently match no rows; treat that as a failure too
    if (!res.error && (!res.data || !res.data.length)) res.error = { message: 'Your account is not allowed to change this.' };
    return res;
  }

  window.SwimReason = { ask, update };
})();
