/**
 * ui.js — Münegascu v3
 * Interface : traducteur, dictionnaire, corrections, conjugaison
 *
 * Sécurité :
 *   - Toutes les données dynamiques dans innerHTML → Security.esc()
 *   - esc() locale (pour onclick attributs) remplacée par Security.escAttr()
 *   - searchVerb() : la saisie utilisateur q échappée avant injection
 *   - renderWordsList / renderPhrasesList : Security.esc() sur toutes les données BDD
 *   - State protégé : adminLoggedIn non exposé via l'API publique de ui.js
 */

const State = {
  dirFR:            true,
  currentCat:       'all',
  viewMode:         'words',
  customWords:      [],
  suggestions:      [],
  conflictQueue:    [],
  lastTranslation:  { input: '', output: '', tokens: [] },
  selectedCorrWord: null,
  adminLoggedIn:    false,
  customVerbs:      [],
};

// ── Onglets ──────────────────────────────────────────────────
function switchTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  btn.classList.add('active');
}

// ── Traducteur ───────────────────────────────────────────────
function doTranslate() {
  const input = document.getElementById('tin').value.trim();
  const tout  = document.getElementById('tout');
  const awrap = document.getElementById('analysis-wrap');
  const bcorr = document.getElementById('btn-correct');

  if (!input) {
    tout.className = 'out-area empty';
    tout.innerHTML = 'La traduction apparaît ici…';
    awrap.style.display = 'none';
    bcorr.style.display = 'none';
    return;
  }

  const { result, tokens, confidence } = Translator.translate(input, State.dirFR);

  tout.className = 'out-area';
  tout.innerHTML = _buildClickableOutput(result, tokens);
  State.lastTranslation = { input, output: tout.innerText, tokens };

  _renderAnalysis(tokens, confidence);
  awrap.style.display = 'block';
  bcorr.style.display = 'block';
  document.getElementById('correction-panel').classList.remove('show');
  _resetCorrectionPanel();
}

/**
 * Construit la zone de traduction avec tokens cliquables.
 * Toutes les données BDD passent par Security.esc() / Security.escAttr().
 */
function _buildClickableOutput(result, tokens) {
  if (tokens.length === 1 && tokens[0].type === 'phrase') {
    return `<span class="out-token" onclick="selectTokenForCorrection(this)"
      data-token="${Security.escAttr(result)}">${Security.esc(result)}</span>`;
  }

  const parts = [];
  let remaining = result;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type === 'punct') {
      const pIdx = remaining.indexOf(tok.w);
      if (pIdx > 0) parts.push(Security.esc(remaining.slice(0, pIdx)));
      parts.push(Security.esc(tok.w));
      remaining = remaining.slice(pIdx + tok.w.length).replace(/^\s+/, '');
      continue;
    }

    const translated = tok.tr || tok.w;
    const idx    = remaining.toLowerCase().indexOf(translated.toLowerCase());
    const actual = idx >= 0 ? remaining.slice(idx, idx + translated.length) : translated;

    if (idx > 0) parts.push(Security.esc(remaining.slice(0, idx)));

    parts.push(
      `<span class="out-token" onclick="selectTokenForCorrection(this)"` +
      ` data-token="${Security.escAttr(tok.w)}"` +
      ` data-tr="${Security.escAttr(actual)}"` +
      ` title="Source\u00a0: ${Security.escAttr(tok.w)}">${Security.esc(actual)}</span>`
    );

    remaining = idx >= 0 ? remaining.slice(idx + actual.length).replace(/^\s+/, '') : remaining;
  }

  if (remaining) parts.push(Security.esc(remaining));
  return parts.join(' ');
}

function selectTokenForCorrection(el) {
  document.querySelectorAll('.out-token.selected').forEach(w => w.classList.remove('selected'));
  el.classList.add('selected');

  const sourceWord    = el.dataset.token || el.textContent;
  const translatedWord = el.dataset.tr   || el.textContent;
  State.selectedCorrWord = sourceWord;

  const panel   = document.getElementById('correction-panel');
  const wordSel = document.getElementById('correction-word-select');
  const hint    = document.getElementById('correction-click-hint');
  const selSpan = document.getElementById('correction-selected-word');
  const selTr   = document.getElementById('correction-selected-tr');
  const corrInp = document.getElementById('correction-input');

  // textContent — pas innerHTML — pour afficher les données utilisateur
  if (selSpan) selSpan.textContent = sourceWord;
  if (selTr)   selTr.textContent   = translatedWord;
  if (wordSel) wordSel.style.display = 'block';
  if (hint)    hint.style.display    = 'none';
  corrInp.value = '';
  corrInp.focus();
  if (!panel.classList.contains('show')) panel.classList.add('show');
}

function _resetCorrectionPanel() {
  State.selectedCorrWord = null;
  document.querySelectorAll('.out-token.selected').forEach(w => w.classList.remove('selected'));
  const wordSel = document.getElementById('correction-word-select');
  const hint    = document.getElementById('correction-click-hint');
  if (wordSel) wordSel.style.display = 'none';
  if (hint)    hint.style.display    = 'block';
}

function _renderAnalysis(tokens, confidence) {
  const badge = {
    high:   '<span class="badge badge-vert" style="font-size:.65rem">✅ Confiance élevée</span>',
    medium: '<span class="badge badge-or"   style="font-size:.65rem">⚡ Confiance moyenne</span>',
    low:    '<span class="badge"            style="font-size:.65rem">⚠️ Confiance faible</span>',
  }[confidence] || '';

  // Données BDD dans les tokens → Security.esc()
  const tokHtml = tokens.map(t => {
    if (t.type === 'punct') return `<span class="tok tok-punct">${Security.esc(t.w)}</span>`;
    const cls = { found:'tok-found', smart:'tok-smart', proper:'tok-proper',
                  unknown:'tok-unk', phrase:'tok-phrase' }[t.type] || 'tok-unk';
    const tip = t.note ? ` title="${Security.escAttr(t.note)}"` : t.tr ? ` title="→ ${Security.escAttr(t.tr)}"` : '';
    return `<span class="tok ${cls}"${tip}>${Security.esc(t.w)}</span>`;
  }).join(' ');

  document.getElementById('analysis-box').innerHTML =
    badge + ' <span style="font-size:.72rem;color:#888;margin-left:8px">Analyse :</span><br>' + tokHtml;
}

function clearAll() {
  document.getElementById('tin').value = '';
  const t = document.getElementById('tout');
  t.className = 'out-area empty';
  t.innerHTML = 'La traduction apparaît ici…';
  document.getElementById('analysis-wrap').style.display = 'none';
  document.getElementById('correction-panel').classList.remove('show');
  document.getElementById('btn-correct').style.display = 'none';
  _resetCorrectionPanel();
  SpellCheck.clear();
}

function swapDir() {
  State.dirFR = !State.dirFR;
  const d = State.dirFR;
  document.getElementById('lbl-from').innerHTML = d ? '🇫🇷 Français<small>Source</small>'      : '🇲🇨 Monégasque<small>Source</small>';
  document.getElementById('lbl-to').innerHTML   = d ? '🇲🇨 Monégasque<small>Traduction</small>' : '🇫🇷 Français<small>Traduction</small>';
  document.getElementById('tin').placeholder    = d ? "Ex: Bonjour, je m'appelle Emma." : "Ex: Bun giurnu, me ciamu Emma.";
  clearAll();
}

function speakOut(event) {
  const t = document.getElementById('tout');
  const text = t.innerText.trim();
  if (!text || t.classList.contains('empty')) return;
  Audio.speak(text, event, State.dirFR ? 'mc' : 'fr');
}

function copyOut() {
  const t = document.getElementById('tout');
  navigator.clipboard.writeText(t.innerText || '').then(() => {
    const b = event.target;
    const orig = b.textContent;
    b.textContent = '✅ Copié !';
    setTimeout(() => b.textContent = orig, 1500);
  });
}

// ── Corrections participatives ───────────────────────────────
function toggleCorrection() {
  const p = document.getElementById('correction-panel');
  p.classList.toggle('show');
  if (!p.classList.contains('show')) _resetCorrectionPanel();
}

function submitCorrection() {
  const rawVal = document.getElementById('correction-input').value;
  const word   = State.selectedCorrWord;

  if (!word) { showStatus('correction-status', 'Cliquez d\'abord sur un mot traduit.', true); return; }

  // Valider la correction soumise par l'utilisateur
  const v = Security.validateText(rawVal, 'Correction', { required: true });
  if (!v.ok) { showStatus('correction-status', v.error, true); return; }

  State.suggestions.push({
    id:        Date.now(),
    original:  State.lastTranslation.input.slice(0, 500),  // limiter la taille
    wordToFix: word.slice(0, 200),
    currentTr: State.lastTranslation.output.slice(0, 500),
    proposed:  v.value,
    direction: State.dirFR ? 'fr→mc' : 'mc→fr',
    date:      new Date().toLocaleString('fr-FR'),
    status:    'pending',
    phonetic:  '',
  });

  showStatus('correction-status', '✅ Correction soumise, merci !');
  document.getElementById('correction-input').value = '';
  _resetCorrectionPanel();
  setTimeout(() => {
    document.getElementById('correction-panel').classList.remove('show');
    document.getElementById('correction-status').className = 'modal-status';
  }, 2500);
}

// ── Dictionnaire ─────────────────────────────────────────────
function toggleView(mode) {
  if (!['words','phrases'].includes(mode)) return; // whitelist
  State.viewMode = mode;
  document.getElementById('view-words').style.cssText   = mode==='words'   ? 'font-size:.75rem;background:var(--or);color:var(--blanc);border-color:var(--or)' : 'font-size:.75rem';
  document.getElementById('view-phrases').style.cssText = mode==='phrases' ? 'font-size:.75rem;background:var(--or);color:var(--blanc);border-color:var(--or)' : 'font-size:.75rem';
  renderDict();
}

function buildCatBar() {
  const cats = [...new Set(DB_WORDS.map(e => e.cat))].sort();
  document.getElementById('cat-bar').innerHTML =
    `<button class="cat-btn active" onclick="filterCat('all',this)">Tous</button>` +
    // Données BDD dans les boutons : Security.esc() + escAttr()
    cats.map(c => `<button class="cat-btn" onclick="filterCat('${Security.escAttr(c)}',this)">${Security.esc(c)}</button>`).join('');
}

function filterCat(cat, btn) {
  State.currentCat = String(cat).slice(0, 100); // limiter la taille
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('dsearch').value = '';
  renderDict();
}

function searchAll() {
  // Limiter la longueur de la recherche
  const q = document.getElementById('dsearch').value.slice(0, Security.LIMITS.SEARCH_MAX).toLowerCase();
  if (State.viewMode === 'phrases') {
    renderPhrasesList(DB_PHRASES.filter(p =>
      p.fr.toLowerCase().includes(q) || p.mc.toLowerCase().includes(q)
    ));
    return;
  }
  const data = DB_WORDS.filter(e =>
    e.fr.toLowerCase().includes(q) ||
    e.mc.toLowerCase().includes(q) ||
    (e.ph && e.ph.includes(q))
  );
  State.currentCat = 'all';
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.cat-btn')?.classList.add('active');
  renderWordsList(data);
}

function renderDict(data) {
  if (State.viewMode === 'phrases') { renderPhrasesList(); return; }
  renderWordsList(data);
}

function renderWordsList(data) {
  if (!data) data = State.currentCat === 'all' ? DB_WORDS : DB_WORDS.filter(e => e.cat === State.currentCat);
  const cust = data.filter(e => e.custom).length;

  document.getElementById('dcnt').textContent = data.length + ' mots';
  const cb = document.getElementById('custcnt');
  if (cust > 0) { cb.style.display = ''; cb.textContent = cust + ' importés'; } else cb.style.display = 'none';

  const c = document.getElementById('dres');
  if (!data.length) { c.innerHTML = '<div style="color:#999;text-align:center;padding:20px">Aucun résultat</div>'; return; }

  c.innerHTML = data.map(e => {
    // Toutes les données BDD échappées
    return `<div class="dict-card${e.custom?' custom':''}"
         onclick="useWord('${Security.escAttr(e.fr)}')">
      <div>
        <div class="dw">${Security.esc(e.fr)}${e.custom ? '<span class="badge badge-vert" style="font-size:.6rem;margin-left:4px">custom</span>' : ''}
          <button class="speak-btn" style="width:22px;height:22px;font-size:.7rem"
                  data-speak-fr="${Security.escAttr(e.fr)}"
                  onclick="event.stopPropagation();Audio.speak(this.dataset.speakFr,event,'fr')">🔊</button>
        </div>
        <div class="dcat">${Security.esc(e.cat)}</div>
      </div>
      <div class="darr">→</div>
      <div>
        <div class="dw" style="color:var(--bleu)">${Security.esc(e.mc)}
          <button class="speak-btn" style="width:22px;height:22px;font-size:.7rem"
                  data-speak-mc="${Security.escAttr(e.mc)}"
                  onclick="event.stopPropagation();Audio.speak(this.dataset.speakMc,event,'mc')">🔊</button>
        </div>
        <div class="dph">[${Security.esc(e.ph||'')}]</div>
      </div>
    </div>`;
  }).join('');
}

function renderPhrasesList(data) {
  if (!data) data = DB_PHRASES;
  document.getElementById('pcnt').textContent = data.length + ' phrases';
  const c = document.getElementById('dres');
  if (!data.length) { c.innerHTML = '<div style="color:#999;text-align:center;padding:20px">Aucun résultat</div>'; return; }

  c.innerHTML = data.map(p => {
    return `<div class="dict-card phrase-card" onclick="usePhrase('${Security.escAttr(p.fr)}')">
      <div style="grid-column:1/4;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;width:100%">
        <div><div class="dw" style="font-weight:400">${Security.esc(p.fr)}</div></div>
        <div class="darr">→</div>
        <div><div class="dw" style="color:var(--bleu);font-weight:400">${Security.esc(p.mc)}
          <button class="speak-btn" style="width:22px;height:22px;font-size:.7rem"
                  data-speak-mc="${Security.escAttr(p.mc)}"
                  onclick="event.stopPropagation();Audio.speak(this.dataset.speakMc,event,'mc')">🔊</button>
        </div></div>
      </div>
    </div>`;
  }).join('');
}

function useWord(fr) {
  // Valider l'input avant utilisation
  const v = Security.validateText(fr, 'Mot');
  if (!v.ok) return;
  document.getElementById('tin').value = v.value;
  State.dirFR = true;
  document.getElementById('lbl-from').innerHTML = '🇫🇷 Français<small>Source</small>';
  document.getElementById('lbl-to').innerHTML   = '🇲🇨 Monégasque<small>Traduction</small>';
  doTranslate();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function usePhrase(fr) { useWord(fr); }

// ── Conjugaison ──────────────────────────────────────────────
function loadVerb(v) {
  // v est une valeur hardcodée dans le HTML statique — mais on valide quand même
  const safe = String(v).slice(0, 100).replace(/[<>"'&]/g, '');
  document.getElementById('verb-search').value = safe;
  searchVerb();
  document.getElementById('tab-conjugaison').scrollIntoView({ behavior: 'smooth' });
}

function searchVerb() {
  // Saisie utilisateur : valider + limiter avant injection dans innerHTML
  const raw = document.getElementById('verb-search').value;
  const q   = raw.trim().toLowerCase().slice(0, 100);
  const out = document.getElementById('conj-result');
  if (!q) { out.innerHTML = ''; return; }

  const verb = DB_VERBS[q];
  if (!verb) {
    // q est une saisie utilisateur → Security.esc() obligatoire
    out.innerHTML = `<div class="gram-section"><p style="color:var(--rouge)">
      Verbe « <strong>${Security.esc(q)}</strong> » non trouvé.
    </p></div>`;
    return;
  }

  const tenses = Object.keys(verb.conj);
  // verb.mc et les formes de conjugaison viennent de la BDD → Security.esc()
  out.innerHTML = `<div class="gram-section">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      <div style="font-family:'Playfair Display',serif;font-size:1.2rem;color:var(--bleu)">${Security.esc(_cap(q))}</div>
      <span style="color:var(--rouge);font-style:italic">→ ${Security.esc(verb.mc)}</span>
      <button class="speak-btn" data-speak-mc="${Security.escAttr(verb.mc)}"
              onclick="Audio.speak(this.dataset.speakMc,event,'mc')" title="Infinitif">🔊</button>
    </div>
    <div class="conj-block">
      ${tenses.map(t => `<div class="conj-tense">
        <h4>${Security.esc(DB_TENSE_LABELS[t] || t)}</h4>
        <ul>${DB_PRONS_MC.map((p, i) => {
          const form = verb.conj[t][i] || '—';
          return `<li>
            <span class="pron">${Security.esc(p)}</span>
            <span class="form">${Security.esc(form)}</span>
            <button class="speak-btn" style="width:18px;height:18px;font-size:.6rem"
                    data-speak-mc="${Security.escAttr(form)}"
                    onclick="Audio.speak(this.dataset.speakMc,event,'mc')">🔊</button>
          </li>`;
        }).join('')}</ul>
      </div>`).join('')}
    </div>
  </div>`;
}

// ── Détection automatique de langue ─────────────────────────
const LangDetect = (() => {
  const MC = ['bun','bona','giurnu','mùnegu','münegascu','sùn','ami','cümu','mare','famiggia','nui','vui','elu','ela','miga'];
  const FR = ['je','tu','il','elle','nous','vous','ils','les','le','la','une','des','est','sont','faire','aller'];

  function detect(text) {
    if (!text || text.length < 3) return null;
    const words = text.toLowerCase().split(/\s+/);
    let mc = 0, fr = 0;
    words.forEach(w => { if (MC.includes(w)) mc++; if (FR.includes(w)) fr++; });
    if (/[üöàèùìò]/.test(text)) mc += 2;
    return mc > fr ? 'mc' : fr > mc ? 'fr' : null;
  }

  function autoDetect(text) {
    const badge = document.getElementById('lang-detect-badge');
    if (!badge) return;
    if (!text || text.length < 4) { badge.textContent = ''; return; }
    const lang = detect(text);
    if (!lang) { badge.textContent = ''; return; }
    const isFR   = lang === 'fr';
    const correct = isFR === State.dirFR;
    // textContent — pas innerHTML — pour le badge
    badge.textContent = isFR ? '🇫🇷 Français détecté' : '🇲🇨 Monégasque détecté';
    badge.className   = 'lang-detect-badge ' + (correct ? 'ok' : 'warn');
    badge.onclick     = correct ? null : () => swapDir();
  }

  return { detect, autoDetect };
})();

// ── Utilitaires ──────────────────────────────────────────────
// esc() conservée pour rétrocompat avec admin.js (utilise Security.esc en interne)
function esc(s)      { return Security.escAttr(s); }
function _cap(s)     { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }

function _status(el, msg, isErr = false) {
  if (!el) return;
  el.className   = 'modal-status ' + (isErr ? 'err' : 'ok');
  el.textContent = msg; // textContent — pas innerHTML
  setTimeout(() => el.className = 'modal-status', 4000);
}
function showStatus(id, msg, isErr = false) {
  _status(document.getElementById(id), msg, isErr);
}

// ── Init ─────────────────────────────────────────────────────
function initUI() {
  buildCatBar();
  renderDict();
  const tin = document.getElementById('tin');
  if (tin) tin.addEventListener('input', () => LangDetect.autoDetect(tin.value));
}
