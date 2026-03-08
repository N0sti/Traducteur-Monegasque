/**
 * ui.js — Münegascu v3
 * Interface : traducteur, dictionnaire, corrections participatives, conjugaison
 */

const State = {
  dirFR:          true,
  currentCat:     'all',
  viewMode:       'words',
  customWords:    [],
  suggestions:    [],
  adminLoggedIn:  false,
  conflictQueue:  [],
  lastTranslation: { input: '', output: '', tokens: [] },
  selectedCorrWord: null,
};

// ── Onglets ─────────────────────────────────────────────────
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

  // Construire la sortie avec tokens cliquables (respecte les multi-mots)
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
 * Construit la zone de traduction avec chaque token cliquable.
 * Utilise les tokens du moteur pour respecter les multi-mots (ex: "Bun giurnu").
 * data-token stocke le texte affiché pour la correction.
 */
function _buildClickableOutput(result, tokens) {
  // Cas : phrase entière (token unique de type 'phrase')
  if (tokens.length === 1 && tokens[0].type === 'phrase') {
    const w = _escHtml(result);
    return `<span class="out-token" onclick="selectTokenForCorrection(this)" data-token="${_escAttr(result)}">${w}</span>`;
  }

  // Reconstruire depuis le résultat en le découpant par tokens traduits
  // On itère sur les tokens et on place chaque traduction dans un span cliquable
  const parts = [];
  // Le result est "tok1 tok2 tok3 punc" — on va le re-splitter en suivant les tokens
  // pour coller exactement ce qui a été produit par le moteur
  let remaining = result;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    if (tok.type === 'punct') {
      // Ponctuation : pas cliquable, juste du texte
      const pIdx = remaining.indexOf(tok.w);
      if (pIdx > 0) parts.push(_escHtml(remaining.slice(0, pIdx)));
      parts.push(_escHtml(tok.w));
      remaining = remaining.slice(pIdx + tok.w.length).replace(/^\s+/, '');
      continue;
    }

    // Le texte traduit correspondant à ce token
    const translated = tok.tr || tok.w;
    const idx = remaining.toLowerCase().indexOf(translated.toLowerCase());
    const actual = idx >= 0 ? remaining.slice(idx, idx + translated.length) : translated;

    if (idx > 0) {
      // Espace ou autre texte avant
      parts.push(_escHtml(remaining.slice(0, idx)));
    }

    parts.push(
      `<span class="out-token" onclick="selectTokenForCorrection(this)" ` +
      `data-token="${_escAttr(tok.w)}" data-tr="${_escAttr(actual)}" ` +
      `title="Source : ${_escAttr(tok.w)}">${_escHtml(actual)}</span>`
    );

    remaining = idx >= 0
      ? remaining.slice(idx + actual.length).replace(/^\s+/, '')
      : remaining;
  }

  if (remaining) parts.push(_escHtml(remaining));
  return parts.join(' ');
}

function selectTokenForCorrection(el) {
  // Désélectionner le précédent
  document.querySelectorAll('.out-token.selected').forEach(w => w.classList.remove('selected'));
  el.classList.add('selected');

  // Le mot source (avant traduction) est dans data-token
  const sourceWord = el.dataset.token || el.textContent;
  const translatedWord = el.dataset.tr || el.textContent;
  State.selectedCorrWord = sourceWord;

  const panel   = document.getElementById('correction-panel');
  const wordSel = document.getElementById('correction-word-select');
  const hint    = document.getElementById('correction-click-hint');
  const selSpan = document.getElementById('correction-selected-word');
  const selTr   = document.getElementById('correction-selected-tr');
  const corrInp = document.getElementById('correction-input');

  selSpan.textContent = sourceWord;
  if (selTr) selTr.textContent = translatedWord;
  wordSel.style.display = 'block';
  hint.style.display    = 'none';
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

  const tokHtml = tokens.map(t => {
    if (t.type === 'punct') return `<span class="tok tok-punct">${t.w}</span>`;
    const cls = { found:'tok-found', smart:'tok-smart', proper:'tok-proper', unknown:'tok-unk', phrase:'tok-phrase' }[t.type] || 'tok-unk';
    const tip = t.note ? ` title="${t.note}"` : t.tr ? ` title="→ ${t.tr}"` : '';
    return `<span class="tok ${cls}"${tip}>${t.w}</span>`;
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
  document.getElementById('lbl-from').innerHTML = d ? '🇫🇷 Français<small>Source</small>' : '🇲🇨 Monégasque<small>Source</small>';
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
  const val  = document.getElementById('correction-input').value.trim();
  const word = State.selectedCorrWord;
  if (!word) { showStatus('correction-status', 'Cliquez d\'abord sur un mot traduit.', true); return; }
  if (!val)  { showStatus('correction-status', 'Entrez votre correction.', true); return; }

  State.suggestions.push({
    id:        Date.now(),
    original:  State.lastTranslation.input,
    wordToFix: word,
    currentTr: State.lastTranslation.output,
    proposed:  val,
    direction: State.dirFR ? 'fr→mc' : 'mc→fr',
    date:      new Date().toLocaleString('fr-FR'),
    status:    'pending',
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
  State.viewMode = mode;
  document.getElementById('view-words').style.cssText   = mode==='words'   ? 'font-size:.75rem;background:var(--or);color:var(--blanc);border-color:var(--or)' : 'font-size:.75rem';
  document.getElementById('view-phrases').style.cssText = mode==='phrases' ? 'font-size:.75rem;background:var(--or);color:var(--blanc);border-color:var(--or)' : 'font-size:.75rem';
  renderDict();
}

function buildCatBar() {
  const cats = [...new Set(DB_WORDS.map(e => e.cat))].sort();
  document.getElementById('cat-bar').innerHTML =
    `<button class="cat-btn active" onclick="filterCat('all',this)">Tous</button>` +
    cats.map(c => `<button class="cat-btn" onclick="filterCat('${c}',this)">${c}</button>`).join('');
}

function filterCat(cat, btn) {
  State.currentCat = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('dsearch').value = '';
  renderDict();
}

function searchAll() {
  const q = document.getElementById('dsearch').value.toLowerCase();
  if (State.viewMode === 'phrases') {
    renderPhrasesList(DB_PHRASES.filter(p => p.fr.toLowerCase().includes(q) || p.mc.toLowerCase().includes(q)));
    return;
  }
  const data = DB_WORDS.filter(e => e.fr.toLowerCase().includes(q) || e.mc.toLowerCase().includes(q) || (e.ph && e.ph.includes(q)));
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
    const sf = esc(e.fr), sm = esc(e.mc);
    return `<div class="dict-card${e.custom?' custom':''}" onclick="useWord('${sf}')">
      <div>
        <div class="dw">${e.fr}${e.custom?'<span class="badge badge-vert" style="font-size:.6rem;margin-left:4px">custom</span>':''}
          <button class="speak-btn" style="width:22px;height:22px;font-size:.7rem" onclick="event.stopPropagation();Audio.speak('${sf}',event,'fr')">🔊</button>
        </div>
        <div class="dcat">${e.cat}</div>
      </div>
      <div class="darr">→</div>
      <div>
        <div class="dw" style="color:var(--bleu)">${e.mc}
          <button class="speak-btn" style="width:22px;height:22px;font-size:.7rem" onclick="event.stopPropagation();Audio.speak('${sm}',event,'mc')">🔊</button>
        </div>
        <div class="dph">[${e.ph||''}]</div>
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
    const sm = esc(p.mc);
    return `<div class="dict-card phrase-card" onclick="usePhrase('${esc(p.fr)}')">
      <div style="grid-column:1/4;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;width:100%">
        <div><div class="dw" style="font-weight:400">${p.fr}</div></div>
        <div class="darr">→</div>
        <div><div class="dw" style="color:var(--bleu);font-weight:400">${p.mc}
          <button class="speak-btn" style="width:22px;height:22px;font-size:.7rem" onclick="event.stopPropagation();Audio.speak('${sm}',event,'mc')">🔊</button>
        </div></div>
      </div>
    </div>`;
  }).join('');
}

function useWord(fr) {
  document.getElementById('tin').value = fr;
  State.dirFR = true;
  document.getElementById('lbl-from').innerHTML = '🇫🇷 Français<small>Source</small>';
  document.getElementById('lbl-to').innerHTML   = '🇲🇨 Monégasque<small>Traduction</small>';
  doTranslate();
  window.scrollTo({ top:0, behavior:'smooth' });
}
function usePhrase(fr) { useWord(fr); }

// ── Conjugaison ──────────────────────────────────────────────
function loadVerb(v) {
  document.getElementById('verb-search').value = v;
  searchVerb();
  document.getElementById('tab-conjugaison').scrollIntoView({ behavior:'smooth' });
}

function searchVerb() {
  const q   = document.getElementById('verb-search').value.trim().toLowerCase();
  const out = document.getElementById('conj-result');
  if (!q) { out.innerHTML = ''; return; }
  const verb = DB_VERBS[q];
  if (!verb) {
    out.innerHTML = `<div class="gram-section"><p style="color:var(--rouge)">Verbe "<strong>${q}</strong>" non trouvé.</p></div>`;
    return;
  }
  const tenses = Object.keys(verb.conj);
  out.innerHTML = `<div class="gram-section">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      <div style="font-family:'Playfair Display',serif;font-size:1.2rem;color:var(--bleu)">${_cap(q)}</div>
      <span style="color:var(--rouge);font-style:italic">→ ${verb.mc}</span>
      <button class="speak-btn" onclick="Audio.speak('${esc(verb.mc)}',event,'mc')" title="Infinitif">🔊</button>
    </div>
    <div class="conj-block">
      ${tenses.map(t => `<div class="conj-tense">
        <h4>${DB_TENSE_LABELS[t]||t}</h4>
        <ul>${DB_PRONS_MC.map((p,i) => `<li>
          <span class="pron">${p}</span>
          <span class="form">${verb.conj[t][i]||'—'}</span>
          <button class="speak-btn" style="width:18px;height:18px;font-size:.6rem"
            onclick="Audio.speak('${esc(verb.conj[t][i]||'')}',event,'mc')">🔊</button>
        </li>`).join('')}</ul>
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
    const isFR = lang === 'fr';
    const correct = isFR === State.dirFR;
    badge.textContent = isFR ? '🇫🇷 Français détecté' : '🇲🇨 Monégasque détecté';
    badge.className   = 'lang-detect-badge ' + (correct ? 'ok' : 'warn');
    badge.onclick = correct ? null : () => swapDir();
  }
  return { detect, autoDetect };
})();

// ── Utilitaires ──────────────────────────────────────────────
function esc(s)  { return (s||'').replace(/'/g,"\\'").replace(/"/g,'&quot;'); }
function _escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _escAttr(s) { return (s||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function _cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function _status(el, msg, isErr=false) {
  if (!el) return;
  el.className = 'modal-status ' + (isErr ? 'err' : 'ok');
  el.textContent = msg;
  setTimeout(() => el.className = 'modal-status', 4000);
}
function showStatus(id, msg, isErr=false) { _status(document.getElementById(id), msg, isErr); }

// ── Init ─────────────────────────────────────────────────────
function initUI() {
  buildCatBar();
  renderDict();
  const tin = document.getElementById('tin');
  if (tin) tin.addEventListener('input', () => LangDetect.autoDetect(tin.value));
}
