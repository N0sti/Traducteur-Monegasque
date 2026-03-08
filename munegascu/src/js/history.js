/**
 * history.js — Münegascu
 * - Historique des traductions de la session
 * - Détection automatique de la langue source (FR ou MC)
 */

// ─────────────────────────────────────────────────────────────
// HISTORIQUE
// ─────────────────────────────────────────────────────────────
const History = (() => {

  const MAX = 50;
  const entries = [];  // { input, output, dirFR, timestamp }

  function push(input, output, dirFR) {
    if (!input || !output) return;
    // Éviter les doublons consécutifs
    if (entries.length && entries[0].input === input) return;
    entries.unshift({ input, output, dirFR, timestamp: Date.now() });
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

    c.innerHTML = entries.map((e, i) => {
      const time = new Date(e.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const from = e.dirFR ? '🇫🇷' : '🇲🇨';
      const to   = e.dirFR ? '🇲🇨' : '🇫🇷';
      return `<div class="history-card" onclick="History.reuse(${i})">
        <div class="history-meta">${time} · ${from} → ${to}</div>
        <div class="history-pair">
          <span class="history-src">${esc(e.input)}</span>
          <span class="history-arr">→</span>
          <span class="history-out">${esc(e.output)}</span>
        </div>
      </div>`;
    }).join('');
  }

  function reuse(i) {
    const e = entries[i];
    if (!e) return;
    document.getElementById('tin').value = e.input;
    // Restaurer la direction
    if (e.dirFR !== State.dirFR) swapDir();
    doTranslate();
    // Fermer le panneau historique si ouvert
    const panel = document.getElementById('history-panel');
    if (panel) panel.classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function togglePanel() {
    const p = document.getElementById('history-panel');
    if (p) p.classList.toggle('show');
  }

  function esc(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { push, clear, reuse, togglePanel };
})();


// ─────────────────────────────────────────────────────────────
// DÉTECTION AUTOMATIQUE DE LANGUE
// ─────────────────────────────────────────────────────────────
const LangDetect = (() => {

  // Mots très fréquents en FR qui n'existent pas en MC
  const FR_MARKERS = new Set([
    'je','tu','il','elle','nous','vous','ils','elles',
    'le','la','les','un','une','des',
    'et','ou','mais','donc','car','ni','or',
    'que','qui','quoi','dont','où',
    'est','sont','avoir','être',
    'très','bien','aussi','encore','déjà',
  ]);

  // Caractères typiquement monégasques
  const MC_CHARS = /[üïöàèùìòâêîôûæœ]/i;
  // Suffixes fréquents en monégasque
  const MC_SUFFIXES = /[ui](nu|na|mu|gu|la|ru|tu|su|nnu|amu|ai|du|pu)\b/i;
  // Mots monégasques caractéristiques
  const MC_WORDS = new Set([
    'bun','buna','giurnu','seira','neite','adiu','mersi','sci','nu','scüzè',
    'pardun','forse','certamente','mare','sùre','muntagna','aegua','celu',
    'famiggia','figgiù','figgia','fradè','surèla','nonu','nona',
    'andà','esse','avèi','pudè','vurrè','savèi','mangià','bèi','durmì',
    'mùnegu','münegascu','principatu','palatsu',
    'aïgu','stagu','sùn','vagu','parlu','cantu','ami',
    'ancheu','duman','ieri','lünis','marti','venres','sàbatu','dumenighe',
  ]);

  /**
   * Détecte si le texte est probablement FR (true) ou MC (false).
   * Retourne null si la détection est incertaine (texte trop court, noms propres).
   */
  function detect(text) {
    if (!text || text.trim().length < 2) return null;

    const tokens = text.toLowerCase().match(/[\wàáâãäåçèéêëìíîïñòóôõöùúûü']+/g) || [];
    if (!tokens.length) return null;

    let scoreFR = 0, scoreMC = 0;

    for (const tok of tokens) {
      if (FR_MARKERS.has(tok)) scoreFR += 3;
      if (MC_WORDS.has(tok))   scoreMC += 3;
      // Vérification dans DB_WORDS
      const inFR = DB_WORDS.some(e => e.fr.toLowerCase() === tok);
      const inMC = DB_WORDS.some(e => e.mc.toLowerCase() === tok);
      if (inFR && !inMC) scoreFR++;
      if (inMC && !inFR) scoreMC++;
      if (inFR && inMC) { /* ambigu */ }
    }

    // Analyse caractères spéciaux
    if (MC_CHARS.test(text)) scoreMC += 2;
    if (MC_SUFFIXES.test(text)) scoreMC += 2;

    const diff = scoreFR - scoreMC;
    if (Math.abs(diff) < 2) return null;  // trop incertain
    return diff > 0;  // true = FR
  }

  /**
   * Détecte et ajuste automatiquement la direction du traducteur.
   * À appeler sur l'événement `input` de la textarea.
   */
  function autoDetect(text) {
    const badge = document.getElementById('lang-detect-badge');
    if (!badge) return;

    if (!text || text.trim().length < 4) {
      badge.style.display = 'none';
      return;
    }

    const isFR = detect(text);
    if (isFR === null) {
      badge.style.display = 'none';
      return;
    }

    const label   = isFR ? '🇫🇷 Français détecté' : '🇲🇨 Monégasque détecté';
    const matches = isFR === State.dirFR;

    badge.textContent    = label;
    badge.style.display  = 'inline-block';
    badge.style.background = matches ? 'rgba(39,174,96,.15)' : 'rgba(200,16,46,.12)';
    badge.style.color      = matches ? 'var(--vert)' : 'var(--rouge)';
    badge.style.border     = `1px solid ${matches ? 'var(--vert)' : 'var(--rouge)'}`;

    if (!matches) {
      // Proposer de corriger la direction
      badge.title   = 'Cliquez pour inverser la direction';
      badge.style.cursor = 'pointer';
      badge.onclick = () => { swapDir(); autoDetect(text); };
    } else {
      badge.title  = '';
      badge.style.cursor = 'default';
      badge.onclick = null;
    }
  }

  return { detect, autoDetect };
})();
