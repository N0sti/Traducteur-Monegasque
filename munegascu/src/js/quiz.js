/**
 * quiz.js — Münegascu
 * Mode quiz / flashcards : mots, phrases, conjugaison
 */

const Quiz = (() => {

  // ── État ──────────────────────────────────────────────────
  const S = {
    mode:     'mots',    // 'mots' | 'phrases' | 'conjugaison'
    dir:      'fr-mc',   // 'fr-mc' | 'mc-fr'
    cat:      'all',
    cards:    [],
    idx:      0,
    flipped:  false,
    score:    { ok: 0, ko: 0, skip: 0 },
    history:  [],        // { q, a, userOk }
    running:  false,
  };

  // ── Init / start ──────────────────────────────────────────
  function start() {
    S.mode    = document.getElementById('quiz-mode').value;
    S.dir     = document.getElementById('quiz-dir').value;
    S.cat     = document.getElementById('quiz-cat').value;
    S.score   = { ok: 0, ko: 0, skip: 0 };
    S.history = [];
    S.idx     = 0;
    S.running = true;

    S.cards = _buildDeck();
    if (!S.cards.length) {
      _msg('Aucune carte disponible pour cette sélection.', true);
      return;
    }

    _shuffle(S.cards);
    document.getElementById('quiz-setup').style.display    = 'none';
    document.getElementById('quiz-game').style.display     = 'block';
    document.getElementById('quiz-results').style.display  = 'none';
    _renderCard();
  }

  function stop() {
    S.running = false;
    document.getElementById('quiz-setup').style.display   = 'block';
    document.getElementById('quiz-game').style.display    = 'none';
    document.getElementById('quiz-results').style.display = 'none';
    _buildCatSelect();
  }

  // ── Construction du deck ──────────────────────────────────
  function _buildDeck() {
    if (S.mode === 'mots') {
      const pool = S.cat === 'all'
        ? DB_WORDS
        : DB_WORDS.filter(e => e.cat === S.cat);
      return pool.map(e => ({
        q:    S.dir === 'fr-mc' ? e.fr   : e.mc,
        a:    S.dir === 'fr-mc' ? e.mc   : e.fr,
        ph:   e.ph || '',
        cat:  e.cat,
        type: 'mot',
      }));
    }

    if (S.mode === 'phrases') {
      return DB_PHRASES.map(p => ({
        q:    S.dir === 'fr-mc' ? p.fr : p.mc,
        a:    S.dir === 'fr-mc' ? p.mc : p.fr,
        ph:   '',
        cat:  'phrase',
        type: 'phrase',
      }));
    }

    if (S.mode === 'conjugaison') {
      const cards = [];
      const tenses = ['présent', 'imparfait', 'futur'];
      for (const [fr, verb] of Object.entries(DB_VERBS)) {
        for (const temps of tenses) {
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

  // ── Rendu d'une carte ─────────────────────────────────────
  function _renderCard() {
    S.flipped = false;
    const total = S.cards.length;
    const card  = S.cards[S.idx];

    document.getElementById('quiz-progress-bar').style.width =
      Math.round((S.idx / total) * 100) + '%';
    document.getElementById('quiz-progress-txt').textContent =
      `${S.idx + 1} / ${total}`;
    document.getElementById('quiz-score-ok').textContent   = S.score.ok;
    document.getElementById('quiz-score-ko').textContent   = S.score.ko;
    document.getElementById('quiz-score-skip').textContent = S.score.skip;

    const fc = document.getElementById('quiz-flashcard');
    fc.className = 'quiz-flashcard';
    document.getElementById('quiz-front').innerHTML =
      `<div class="quiz-card-label">${_dirLabel()}</div>
       <div class="quiz-card-word">${card.q}</div>
       ${card.hint ? `<div class="quiz-card-hint">${card.hint}</div>` : ''}
       <div class="quiz-card-cat">${card.cat}</div>`;

    document.getElementById('quiz-back').innerHTML =
      `<div class="quiz-card-label">Réponse</div>
       <div class="quiz-card-word" style="color:var(--bleu)">${card.a}</div>
       ${card.ph ? `<div class="quiz-card-ph">[${card.ph}]</div>` : ''}
       <button class="speak-btn" style="margin-top:8px" onclick="Audio.speak('${esc(card.a)}',event,'mc')">🔊</button>`;

    document.getElementById('quiz-actions-flip').style.display    = 'flex';
    document.getElementById('quiz-actions-answer').style.display  = 'none';
  }

  function flip() {
    if (S.flipped) return;
    S.flipped = true;
    document.getElementById('quiz-flashcard').classList.add('flipped');
    document.getElementById('quiz-actions-flip').style.display   = 'none';
    document.getElementById('quiz-actions-answer').style.display = 'flex';
    // Prononciation automatique
    Audio.speak(S.cards[S.idx].a, null, 'mc');
  }

  function answer(result) {
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

  // ── Résultats ─────────────────────────────────────────────
  function _showResults() {
    document.getElementById('quiz-game').style.display    = 'none';
    document.getElementById('quiz-results').style.display = 'block';

    const total = S.score.ok + S.score.ko + S.score.skip;
    const pct   = total ? Math.round((S.score.ok / total) * 100) : 0;
    const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '📚';

    document.getElementById('quiz-res-summary').innerHTML = `
      <div style="font-size:3rem;margin-bottom:8px">${emoji}</div>
      <div style="font-family:'Playfair Display',serif;font-size:1.4rem;color:var(--bleu);margin-bottom:14px">
        ${pct}% de réussite
      </div>
      <div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;margin-bottom:20px">
        <div style="text-align:center"><div style="font-size:1.8rem;font-weight:700;color:var(--vert)">${S.score.ok}</div><div style="font-size:.75rem;color:#888">Correctes</div></div>
        <div style="text-align:center"><div style="font-size:1.8rem;font-weight:700;color:var(--rouge)">${S.score.ko}</div><div style="font-size:.75rem;color:#888">Incorrectes</div></div>
        <div style="text-align:center"><div style="font-size:1.8rem;font-weight:700;color:#999">${S.score.skip}</div><div style="font-size:.75rem;color:#888">Passées</div></div>
      </div>`;

    // Mots ratés → révision ciblée
    const ko = S.history.filter(h => !h.userOk);
    if (ko.length) {
      document.getElementById('quiz-res-mistakes').innerHTML =
        `<div style="font-size:.8rem;font-weight:700;color:var(--rouge);margin-bottom:8px">À revoir (${ko.length}) :</div>` +
        ko.map(h => `<div style="font-size:.82rem;padding:5px 0;border-bottom:1px solid var(--sable2)">
          <span style="color:#555">${h.q}</span>
          <span style="color:#bbb;margin:0 6px">→</span>
          <span style="color:var(--bleu);font-style:italic">${h.a}</span>
        </div>`).join('');
    } else {
      document.getElementById('quiz-res-mistakes').innerHTML =
        '<div style="color:var(--vert);font-size:.85rem">🎉 Aucune erreur !</div>';
    }
  }

  function retry() {
    // Rejouer uniquement les cartes ratées
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

  // ── Utilitaires ───────────────────────────────────────────
  function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function _dirLabel() {
    if (S.dir === 'fr-mc') return '🇫🇷 → 🇲🇨';
    return '🇲🇨 → 🇫🇷';
  }

  function esc(s) { return (s || '').replace(/'/g, "\\'"); }

  function _msg(txt, isErr) {
    const el = document.getElementById('quiz-msg');
    if (!el) return;
    el.textContent = txt;
    el.className   = 'modal-status ' + (isErr ? 'err' : 'ok');
    setTimeout(() => el.className = 'modal-status', 3000);
  }

  // ── Init select catégories ────────────────────────────────
  function _buildCatSelect() {
    const sel = document.getElementById('quiz-cat');
    if (!sel) return;
    const cats = [...new Set(DB_WORDS.map(e => e.cat))].sort();
    sel.innerHTML = '<option value="all">Toutes catégories</option>' +
      cats.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  function initQuiz() {
    _buildCatSelect();

    // Masquer/afficher catégorie selon le mode
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
