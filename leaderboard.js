/* ============================================================
   SwimFest — Academy Leaderboard page   leaderboard.js
   Reads the public `academy_leaderboard` view (see
   db/public_leaderboard.sql) which aggregates published
   results (heat_rows.points_awarded / official_rank) by academy.
   ============================================================ */
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function load() {
    const wrap   = $('lbTableWrap');
    const podium = $('lbPodium');
    const meta   = $('lbMeta');

    if (!window.sb) {
      wrap.innerHTML = `<div class="lb-empty"><i class="fas fa-plug"></i>
        <p>Leaderboard service unavailable. Please try again later.</p></div>`;
      return;
    }

    const { data, error } = await window.sb
      .from('academy_leaderboard')
      .select('*');

    if (error) {
      console.error('[SwimFest] leaderboard:', error.message);
      wrap.innerHTML = `<div class="lb-empty"><i class="fas fa-triangle-exclamation"></i>
        <p>Could not load leaderboard: ${esc(error.message)}</p></div>`;
      return;
    }

    const rows = data || [];

    if (!rows.length) {
      meta.innerHTML = '';
      podium.innerHTML = '';
      wrap.innerHTML = `<div class="lb-empty"><i class="fas fa-trophy"></i>
        <p>No championship points published yet.</p>
        <p style="font-size:0.82rem;margin-top:6px;">Standings appear once officials publish event results with points.</p></div>`;
      return;
    }

    const totalPoints = rows.reduce((sum, r) => sum + Number(r.total_points || 0), 0);
    const totalGold   = rows.reduce((sum, r) => sum + Number(r.gold || 0), 0);
    meta.innerHTML = `
      <span><i class="fas fa-building"></i> ${rows.length} academies scoring</span>
      <span><i class="fas fa-star"></i> ${totalPoints} total points</span>
      <span><i class="fas fa-medal"></i> ${totalGold} gold medals</span>`;

    renderPodium(rows.slice(0, 3), podium);
    renderTable(rows, wrap);
  }

  function renderPodium(top, podium) {
    // Display order: 2nd, 1st, 3rd for a classic podium look
    const order = [top[1], top[0], top[2]].filter(Boolean);
    podium.innerHTML = order.map((r) => {
      const rank = top.indexOf(r) + 1;
      const medals = `
        <div class="podium-medals">
          <span class="m-gold"><i class="fas fa-medal"></i> ${r.gold || 0}</span>
          <span class="m-silver"><i class="fas fa-medal"></i> ${r.silver || 0}</span>
          <span class="m-bronze"><i class="fas fa-medal"></i> ${r.bronze || 0}</span>
        </div>`;
      return `
        <div class="podium-card podium-${rank}">
          <div class="podium-rank">${rank}</div>
          <p class="podium-name">${esc(r.academy_name)}</p>
          <p class="podium-city">${esc(r.city || '')}</p>
          <div class="podium-points">${r.total_points}<span>Points</span></div>
          ${medals}
        </div>`;
    }).join('');
  }

  function renderTable(rows, wrap) {
    wrap.innerHTML = `
      <table class="lb-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Academy</th>
            <th><i class="fas fa-medal medal-gold"></i> Gold</th>
            <th><i class="fas fa-medal medal-silver"></i> Silver</th>
            <th><i class="fas fa-medal medal-bronze"></i> Bronze</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => {
            const rank = i + 1;
            const badgeCls = rank <= 3 ? `r${rank}` : '';
            return `
              <tr>
                <td><span class="lb-rank-badge ${badgeCls}">${rank}</span></td>
                <td>
                  <div class="lb-academy-name">${esc(r.academy_name)}</div>
                  <div class="lb-city">${esc(r.city || '')}</div>
                </td>
                <td class="lb-medal-cell"><i class="fas fa-medal medal-gold"></i> ${r.gold || 0}</td>
                <td class="lb-medal-cell"><i class="fas fa-medal medal-silver"></i> ${r.silver || 0}</td>
                <td class="lb-medal-cell"><i class="fas fa-medal medal-bronze"></i> ${r.bronze || 0}</td>
                <td><span class="lb-points">${r.total_points}</span></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  document.addEventListener('DOMContentLoaded', load);
})();
