/**
 * quiz.js — Münegascu v3
 * Mode quiz / flashcards : mots, phrases, conjugaison
 *
 * Sécurité : toutes les données BDD injectées dans innerHTML
 *            passent par Security.esc() pour prévenir le XSS.
 *            Le bouton 🔊 utilise un data-attribute + event listener
 *            au lieu d'un onclick inline avec données interpolées.
 */

const Quiz = (() => {
  'use strict';

  const S = {
    mode:    'mots',
    dir:     'fr-mc',
    cat:     'all',
    cards:   [],
    idx:     0,
    flipped: false,
    score:   { ok: 0, ko: 0, skip: 0 },
    history: [],
    running: false,
  };

  // ── Init / Start ─────────────────────────────────────────
  function start() {
    S.mode    = document.getElementById('quiz-mode').value;
    S.dir     = document.getElementById('quiz-dir').value;
    S.cat     = document.getElementById('quiz-cat').value;
    S.score   = { ok: 0, ko: 0, skip: 0 };
    S.history = [];
    S.idx     = 0;
    S.running = true;

    S.cards = _buildDeck();
    if (!S.cards.length) { _msg('Aucune carte disponible pour cette sélection.', true); return; }

    _shuffle(S.cards);
    document.getElementById('quiz-setup').style.display   = 'none';
    document.getElementById('quiz-game').style.display    = 'block';
    document.getElementById('quiz-results').style.display = 'none';
    _renderCard();
  }

  function stop() {
    S.running = false;
    document.getElementById('quiz-setup').style.display   = 'block';
    document.getElementById('quiz-game').style.display    = 'none';
    document.getElementById('quiz-results').style.display = 'none';
    _buildCatSelect();
  }

  // ── Construction du deck ─────────────────────────────────
  function _buildDeck() {
    if (S.mode === 'mots') {
      const pool = S.cat === 'all' ? DB_WORDS : DB_WORDS.filter(e => e.cat === S.cat);
      return pool.map(e => ({
        q: S.dir === 'fr-mc' ? e.fr : e.mc,
        a: S.dir === 'fr-mc' ? e.mc : e.fr,
        ph:  e.ph  || '',
        cat: e.cat || '',
        type: 'mot',
      }));
    }
    if (S.mode === 'phrases') {
      return DB_PHRASES.map(p => ({
        q: S.dir === 'fr-mc' ? p.fr : p.mc,
        a: S.dir === 'fr-mc' ? p.mc : p.fr,
        ph: '', cat: 'phrase', type: 'phrase',
      }));
    }
    if (S.mode === 'conjugaison') {
      const cards = [];
      for (const [fr, verb] of Object.entries(DB_VERBS)) {
        for (const temps of ['présent', 'imparfait', 'futur']) {
          const forms = verb.conj[temps] || [];
          DB_PRONS_MC.forEach((pron, i) => {
            const form = forms[i];
            if (!form || form === '—') return;
            cards.push({
              q:    `${pron} — ${fr} (${temps})`,
              a:    form,
              ph:   '',
              cat:  'conjugaison',
              type: 'conj',
              hint: `Infinitif : ${verb.mc}`,
            });
          });
        }
      }
      return cards;
    }
    return [];
  }

  // ── Rendu d'une carte ────────────────────────────────────
  function _renderCard() {
    S.flipped = false;
    const total = S.cards.length;
    const card  = S.cards[S.idx];

    // Valeurs numériques — pas de XSS possible
    document.getElementById('quiz-progress-bar').style.width =
      Math.round((S.idx / total) * 100) + '%';
    // textContent pour les compteurs — jamais innerHTML
    document.getElementById('quiz-progress-txt').textContent = `${S.idx + 1} / ${total}`;
    document.getElementById('quiz-score-ok').textContent     = S.score.ok;
    document.getElementById('quiz-score-ko').textContent     = S.score.ko;
    document.getElementById('quiz-score-skip').textContent   = S.score.skip;

    document.getElementById('quiz-flashcard').className = 'quiz-flashcard';

    // ── Face avant : données BDD échappées via Security.esc() ──
    const front = document.getElementById('quiz-front');
    front.innerHTML = [
      `<div class="quiz-card-label">${_dirLabel()}</div>`,
      `<div class="quiz-card-word">${Security.esc(card.q)}</div>`,
      card.hint ? `<div class="quiz-card-hint">${Security.esc(card.hint)}</div>` : '',
      `<div class="quiz-card-cat">${Security.esc(card.cat)}</div>`,
    ].join('');

    // ── Face arrière : données BDD échappées, bouton 🔊 sans onclick inline ──
    const back = document.getElementById('quiz-back');
    back.innerHTML = [
      `<div class="quiz-card-label">Réponse</div>`,
      `<div class="quiz-card-word" style="color:var(--bleu)">${Security.esc(card.a)}</div>`,
      card.ph ? `<div class="quiz-card-ph">[${Security.esc(card.ph)}]</div>` : '',
      // data-speak stocke la valeur — event listener lit le data-attribute
      `<button class="speak-btn quiz-speak" data-speak="${Security.escAttr(card.a)}"
               style="margin-top:8px">🔊</button>`,
    ].join('');

    // Event listener propre sur le bouton speak (évite onclick inline interpolé)
    back.querySelector('.quiz-speak')?.addEventListener('click', e => {
      const text = e.currentTarget.dataset.speak;
      Audio.speak(text, e, 'mc');
    });

    document.getElementById('quiz-actions-flip').style.display   = 'flex';
    document.getElementById('quiz-actions-answer').style.display = 'none';
  }

  function flip() {
    if (S.flipped) return;
    S.flipped = true;
    document.getElementById('quiz-flashcard').classList.add('flipped');
    document.getElementById('quiz-actions-flip').style.display   = 'none';
    document.getElementById('quiz-actions-answer').style.display = 'flex';
    Audio.speak(S.cards[S.idx].a, null, 'mc');
  }

  function answer(result) {
    if (!['ok','ko','skip'].includes(result)) return; // whitelist
    const card = S.cards[S.idx];
    S.score[result]++;
    S.history.push({ q: card.q, a: card.a, userOk: result === 'ok' });

    const fc = document.getElementById('quiz-flashcard');
    fc.classList.add(result === 'ok' ? 'card-ok' : result === 'ko' ? 'card-ko' : 'card-skip');

    setTimeout(() => {
      S.idx++;
      if (S.idx >= S.cards.length) { _showResults(); return; }
      _renderCard();
    }, 320);
  }

  // ── Résultats ────────────────────────────────────────────
  function _showResults() {
    document.getElementById('quiz-game').style.display    = 'none';
    document.getElementById('quiz-results').style.display = 'block';

    const total = S.score.ok + S.score.ko + S.score.skip;
    const pct   = total ? Math.round((S.score.ok / total) * 100) : 0;
    // Emoji choisi programmatiquement — pas de données utilisateur
    const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '📚';

    // Résumé : toutes les valeurs sont numériques — pas de XSS
    document.getElementById('quiz-res-summary').innerHTML = `
      <div style="font-size:3rem;margin-bottom:8px">${emoji}</div>
      <div style="font-family:'Playfair Display',serif;font-size:1.4rem;color:var(--bleu);margin-bottom:14px">
        ${pct}% de réussite
      </div>
      <div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;margin-bottom:20px">
        <div style="text-align:center">
          <div style="font-size:1.8rem;font-weight:700;color:var(--vert)">${S.score.ok}</div>
          <div style="font-size:.75rem;color:#888">Correctes</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:1.8rem;font-weight:700;color:var(--rouge)">${S.score.ko}</div>
          <div style="font-size:.75rem;color:#888">Incorrectes</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:1.8rem;font-weight:700;color:#999">${S.score.skip}</div>
          <div style="font-size:.75rem;color:#888">Passées</div>
        </div>
      </div>`;

    // Erreurs : données BDD échappées
    const ko = S.history.filter(h => !h.userOk);
    const mistakesEl = document.getElementById('quiz-res-mistakes');
    if (ko.length) {
      mistakesEl.innerHTML =
        `<div style="font-size:.8rem;font-weight:700;color:var(--rouge);margin-bottom:8px">À revoir (${ko.length}) :</div>` +
        ko.map(h =>
          `<div style="font-size:.82rem;padding:5px 0;border-bottom:1px solid var(--sable2)">
            <span style="color:#555">${Security.esc(h.q)}</span>
            <span style="color:#bbb;margin:0 6px">→</span>
            <span style="color:var(--bleu);font-style:italic">${Security.esc(h.a)}</span>
          </div>`
        ).join('');
    } else {
      mistakesEl.innerHTML = '<div style="color:var(--vert);font-size:.85rem">🎉 Aucune erreur !</div>';
    }
  }

  function retry() {
    const ko = S.history.filter(h => !h.userOk);
    if (!ko.length) { start(); return; }
    S.cards   = ko.map(h => ({ q: h.q, a: h.a, ph: '', cat: '', type: 'retry' }));
    S.idx     = 0;
    S.score   = { ok: 0, ko: 0, skip: 0 };
    S.history = [];
    document.getElementById('quiz-results').style.display = 'none';
    document.getElementById('quiz-game').style.display    = 'block';
    _renderCard();
  }

  // ── Utilitaires ──────────────────────────────────────────
  function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function _dirLabel() {
    return S.dir === 'fr-mc' ? '🇫🇷 → 🇲🇨' : '🇲🇨 → 🇫🇷';
  }

  function _msg(txt, isErr) {
    const el = document.getElementById('quiz-msg');
    if (!el) return;
    el.textContent = txt; // textContent — pas innerHTML
    el.className   = 'modal-status ' + (isErr ? 'err' : 'ok');
    setTimeout(() => el.className = 'modal-status', 3000);
  }

  function _buildCatSelect() {
    const sel = document.getElementById('quiz-cat');
    if (!sel) return;
    const cats = [...new Set(DB_WORDS.map(e => e.cat))].sort();
    // Données BDD dans les options → Security.esc()
    sel.innerHTML = '<option value="all">Toutes catégories</option>' +
      cats.map(c => `<option value="${Security.escAttr(c)}">${Security.esc(c)}</option>`).join('');
  }

  function initQuiz() {
    _buildCatSelect();
    const modeEl = document.getElementById('quiz-mode');
    const catRow = document.getElementById('quiz-cat-row');
    if (modeEl && catRow) {
      modeEl.addEventListener('change', () => {
        catRow.style.display = modeEl.value === 'mots' ? '' : 'none';
      });
    }
  }

  return { start, stop, flip, answer, retry, initQuiz };
})();
