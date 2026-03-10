/**
 * history.js — Münegascu v3
 * Historique des traductions de la session (max 50 entrées).
 *
 * Sécurité :
 *   - Toutes les sorties innerHTML → Security.esc()
 *   - Pas de esc() locale dupliquée
 *   - LangDetect supprimé de ce fichier (défini dans ui.js, unique)
 */

const History = (() => {
  'use strict';

  const MAX     = 50;
  const entries = [];  // { input, output, dirFR, timestamp }

  function push(input, output, dirFR) {
    if (!input || !output) return;
    // Éviter les doublons consécutifs
    if (entries.length && entries[0].input === input) return;
    // Limiter la taille stockée par entrée
    entries.unshift({
      input:     String(input).slice(0, 500),
      output:    String(output).slice(0, 500),
      dirFR:     Boolean(dirFR),
      timestamp: Date.now(),
    });
    if (entries.length > MAX) entries.pop();
    _render();
  }

  function clear() {
    entries.length = 0;
    _render();
  }

  function _render() {
    const c   = document.getElementById('history-list');
    const cnt = document.getElementById('history-cnt');
    if (!c) return;
    if (cnt) cnt.textContent = entries.length;

    if (!entries.length) {
      c.innerHTML = '<p style="color:#bbb;font-size:.83rem;padding:10px 0">Aucune traduction dans cette session.</p>';
      return;
    }

    // Toutes les données utilisateur (input/output) passent par Security.esc()
    c.innerHTML = entries.map((e, i) => {
      const time = new Date(e.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const from = e.dirFR ? '🇫🇷' : '🇲🇨';
      const to   = e.dirFR ? '🇲🇨' : '🇫🇷';
      return `<div class="history-card" onclick="History.reuse(${i})">
        <div class="history-meta">${Security.esc(time)} · ${from} → ${to}</div>
        <div class="history-pair">
          <span class="history-src">${Security.esc(e.input)}</span>
          <span class="history-arr">→</span>
          <span class="history-out">${Security.esc(e.output)}</span>
        </div>
      </div>`;
    }).join('');
  }

  function reuse(i) {
    const idx = parseInt(i);
    if (isNaN(idx) || idx < 0 || idx >= entries.length) return;
    const e = entries[idx];
    if (!e) return;

    const v = Security.validateText(e.input, 'Historique');
    if (!v.ok) return;

    document.getElementById('tin').value = v.value;
    if (e.dirFR !== State.dirFR) swapDir();
    doTranslate();
    const panel = document.getElementById('history-panel');
    if (panel) panel.classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function togglePanel() {
    const p = document.getElementById('history-panel');
    if (p) p.classList.toggle('show');
  }

  return { push, clear, reuse, togglePanel };
})();
