/* ============================================================
   SwimFest — swimmer documents (age proof + signed undertaking)
   Files live in the PRIVATE 'swimmer-docs' bucket under
   <owner user id>/<swimmer id>/... and are opened through
   short-lived signed links (see backend/db/swimmer_documents.sql).
   ============================================================ */
(function () {
  const BUCKET   = 'swimmer-docs';
  const MAX_SIZE = 5 * 1024 * 1024;
  const TYPES    = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
  const KINDS    = {
    age_proof  : { col: 'age_proof_path',   label: 'Age proof' },
    undertaking: { col: 'undertaking_path', label: 'Undertaking' },
  };

  // Returns an error message, or '' when the file is fine
  function check(file) {
    if (!file) return 'Choose a file.';
    const okType = TYPES.includes(file.type) || /\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(file.name || '');
    if (!okType) return 'Use a photo (JPG, PNG) or a PDF.';
    if (file.size > MAX_SIZE) return 'File is over 5 MB. Use a smaller photo or PDF.';
    return '';
  }

  // Upload one file; returns its storage path
  async function upload(file, userId, swimmerId, kind) {
    if (!window.sb) throw new Error('Not connected to the database.');
    const err = check(file);
    if (err) throw new Error(err);
    const ext  = ((file.name || '').match(/\.([a-z0-9]+)$/i) || [, 'jpg'])[1].toLowerCase();
    const path = `${userId}/${swimmerId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await window.sb.storage.from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) {
      if (/bucket not found/i.test(error.message)) {
        throw new Error('Document storage is not set up yet. Please contact the organisers.');
      }
      throw new Error(error.message);
    }
    return path;
  }

  // Open a stored file in a new tab through a 10-minute signed link
  async function open(path) {
    if (!path || !window.sb) return;
    const tab = window.open('', '_blank');   // open now so pop-up blockers allow it
    const { data, error } = await window.sb.storage.from(BUCKET).createSignedUrl(path, 600);
    if (error || !data || !data.signedUrl) {
      if (tab) tab.close();
      const msg = 'Could not open the document: ' + (error ? error.message : 'no link returned');
      if (window.SF && SF.toast) SF.toast(msg, 'error'); else alert(msg);
      return;
    }
    if (tab) tab.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  }

  // Links for a swimmer row (for the approval tables)
  function linksHtml(swimmer, linkClass) {
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    const parts = Object.values(KINDS).map(k => {
      const p = swimmer && swimmer[k.col];
      return p
        ? `<a href="#" class="${linkClass || ''}" onclick="SwimDocs.open('${esc(p)}');return false;"><i class="fas fa-file-alt"></i> ${k.label}</a>`
        : `<span style="font-size:0.72rem;color:#b45309;"><i class="fas fa-triangle-exclamation"></i> No ${k.label.toLowerCase()}</span>`;
    });
    return `<div style="display:flex;flex-direction:column;gap:3px;margin-top:4px;">${parts.join('')}</div>`;
  }

  window.SwimDocs = { BUCKET, KINDS, check, upload, open, linksHtml };
})();
