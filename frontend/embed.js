/* ============================================================
   SwimFest – tool pages shown inside the super admin console
   superadmin.html opens tools (player list, heat generation…) in a
   frame. This hides the page's own sidebar, top bar and Ask SwimFest
   button there, and sends links to other tools back to the console
   so its address and sidebar stay in step. Load it in <head>.
   ============================================================ */
(function () {
  var parent;
  try {
    if (window.top === window) return;
    parent = window.parent;
    if (!parent.SA_TOOL_PAGES) return;   // only inside the super admin console
  } catch (e) { return; }   // framed by another site: leave the page alone

  document.documentElement.classList.add('sf-embed');
  var style = document.createElement('style');
  style.textContent =
    'html.sf-embed .ac-sidebar, html.sf-embed .ac-mobilebar, html.sf-embed #navbar,' +
    'html.sf-embed .sfa-fab, html.sf-embed .sfa-panel, html.sf-embed .global-back-btn { display:none !important; }';
  document.head.appendChild(style);

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var u = new URL(a.href, location.href);
    if (u.origin !== location.origin) return;
    var page = u.pathname.split('/').pop();
    var tools = parent.SA_TOOL_PAGES || {};
    if (page === (parent.SA_CONSOLE_PAGE || 'superadmin.html') || tools[page]) {
      e.preventDefault();
      parent.openToolFromFrame(u.href);
    } else if (page !== location.pathname.split('/').pop()) {
      // Anything else (public meet page, home…) leaves the console
      e.preventDefault();
      parent.location.href = u.href;
    }
  }, true);
})();
