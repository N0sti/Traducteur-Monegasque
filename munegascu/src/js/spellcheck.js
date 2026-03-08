/**
 * spellcheck.js — Münegascu v3
 *
 * Correcteur orthographe INLINE dans le textarea :
 *   - Div miroir transparente superposée sur le textarea
 *   - Mots erronés soulignés en rouge ondulé
 *   - Clic sur un mot souligné → popup flottant avec :
 *       ✅ Accepter la correction (applique + relance traduction)
 *       ✕  Ignorer (retire le soulignement)
 *
 * FR → LanguageTool API  |  MC → Levenshtein sur la BDD
 */

const SpellCheck = (() => {

  const LT_URL = 'https://api.languagetool.org/v2/check';
  let _corrections = [];
  let _timer = null;
  let _mirror = null;
  let _popup  = null;   // popup flottant actif

  // ── Levenshtein ──────────────────────────────────────────
  function _lev(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const dp = Array.from({length: b.length + 1}, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = i;
      for (let j = 1; j <= b.length; j++) {
        const val = a[i-1]===b[j-1] ? dp[j-1] : 1 + Math.min(dp[j-1], dp[j], prev);
        dp[j-1] = prev; prev = val;
      }
      dp[b.length] = prev;
    }
    return dp[b.length];
  }

  // ── Correcteur FR — LanguageTool ─────────────────────────
  let _ltCache = {};
  async function _checkFR(text) {
    const key = text.trim().slice(0, 200);
    if (_ltCache[key]) return _ltCache[key];
    const result = { corrections: [] };
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const resp  = await fetch(LT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ text, language: 'fr', disabledRules: 'WHITESPACE_RULE' }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      result.corrections = (data.matches || [])
        .filter(m => m.replacements.length > 0)
        .map(m => ({
          offset:  m.offset,
          length:  m.length,
          word:    text.slice(m.offset, m.offset + m.length),
          suggestions: m.replacements.slice(0, 3).map(r => r.value),
        }));
      if (result.corrections.length && Object.keys(_ltCache).length < 80) _ltCache[key] = result;
    } catch(e) { /* API indisponible */ }
    return result;
  }

  // ── Correcteur MC — BDD interne ──────────────────────────
  let _mcIndex = null;
  function _buildIndex() {
    const idx = new Set();
    DB_WORDS.forEach(e => e.mc.toLowerCase().split(/\s+/).forEach(w => idx.add(w.replace(/[.,;:!?'"]/g,''))));
    Object.values(DB_VERBS).forEach(v => Object.values(v.conj).forEach(forms => forms.forEach(f => { if (f && f !== '—') idx.add(f.toLowerCase()); })));
    ['u','a','i','e','de','pe','in','cun','ma','nu','miga','se','che','già','mai','sempre',
     'assai','mütu','là','ùnde','cümu','quandu','perché','quantu','ci','un','una','di'].forEach(t => idx.add(t));
    return idx;
  }

  function _checkMC(text) {
    if (!_mcIndex) _mcIndex = _buildIndex();
    const result = { corrections: [] };
    if (!text || text.trim().length < 2) return result;
    const tokens = text.match(/[\wÀ-ÿüïöàèùìòâêîôûæœ']+|[?!.,;:\s]/g) || [];
    let offset = 0;
    tokens.forEach(tok => {
      if (!/^[?!.,;:\s]$/.test(tok) && tok.length > 1) {
        const clean = tok.replace(/[.,;:!?'"]/g,'').toLowerCase();
        if (clean.length > 1 && !_mcIndex.has(clean)) {
          const maxDist = clean.length <= 4 ? 1 : 2;
          let best = null, bestD = maxDist + 1;
          for (const t2 of _mcIndex) {
            if (Math.abs(t2.length - clean.length) > 3) continue;
            const d = _lev(clean, t2);
            if (d < bestD) { bestD = d; best = t2; }
          }
          if (best) result.corrections.push({ offset, length: tok.length, word: tok, suggestions: [best] });
        }
      }
      offset += tok.length;
    });
    return result;
  }

  // ── Div miroir ───────────────────────────────────────────
  function _createMirror() {
    const tin = document.getElementById('tin');
    if (!tin) return;
    if (_mirror) return;   // déjà créé

    // Le parent .ta-col doit être position:relative (CSS le fait)
    const wrap = tin.parentElement;

    _mirror = document.createElement('div');
    _mirror.id = 'spell-mirror';
    _mirror.setAttribute('aria-hidden', 'true');

    // Copier exactement les styles typographiques du textarea
    const cs = window.getComputedStyle(tin);
    const copyProps = ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing',
      'paddingTop','paddingRight','paddingBottom','paddingLeft',
      'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
      'borderRadius','boxSizing'];
    copyProps.forEach(p => _mirror.style[p] = cs[p]);

    _mirror.style.position      = 'absolute';
    _mirror.style.top           = tin.offsetTop + 'px';
    _mirror.style.left          = tin.offsetLeft + 'px';
    _mirror.style.width         = tin.offsetWidth + 'px';
    _mirror.style.height        = tin.offsetHeight + 'px';
    _mirror.style.background    = 'white';
    _mirror.style.color         = 'transparent';
    _mirror.style.pointerEvents = 'none';
    _mirror.style.overflow      = 'hidden';
    _mirror.style.zIndex        = '1';
    _mirror.style.whiteSpace    = 'pre-wrap';
    _mirror.style.wordBreak     = 'break-word';
    _mirror.style.margin        = '0';

    // Le textarea doit être au-dessus et transparent pour que le miroir soit visible
    tin.style.position   = 'relative';
    tin.style.zIndex     = '2';
    tin.style.background = 'transparent';

    wrap.style.position = 'relative';
    wrap.appendChild(_mirror);   // après le textarea dans le DOM = en-dessous visuellement

    // Sync scroll
    tin.addEventListener('scroll', () => { if (_mirror) _mirror.scrollTop = tin.scrollTop; });
  }

  // ── Popup flottant (replace tooltip) ────────────────────
  function _createPopup() {
    if (document.getElementById('spell-popup')) return;
    const pop = document.createElement('div');
    pop.id = 'spell-popup';
    pop.style.cssText = `
      display:none; position:fixed; z-index:9999;
      background:#1a2a3c; border-radius:10px; padding:10px 12px;
      box-shadow:0 6px 24px rgba(0,0,0,.35); min-width:160px;
      flex-direction:column; gap:6px;
    `;
    pop.innerHTML = `
      <div style="font-size:.72rem;color:#aaa;margin-bottom:2px">Correction suggérée :</div>
      <button id="spell-pop-accept" style="
        background:#27ae60;color:white;border:none;border-radius:6px;
        padding:7px 12px;font-size:.82rem;font-weight:700;cursor:pointer;
        text-align:left;transition:filter .15s;
      "></button>
      <button id="spell-pop-reject" style="
        background:rgba(255,255,255,.1);color:#ccc;border:none;border-radius:6px;
        padding:6px 12px;font-size:.78rem;cursor:pointer;
        text-align:left;transition:background .15s;
      ">✕ Ignorer ce mot</button>
    `;
    document.body.appendChild(pop);
    _popup = pop;

    // Fermer si on clique ailleurs
    document.addEventListener('click', e => {
      if (_popup && _popup.style.display !== 'none') {
        if (!_popup.contains(e.target) && !e.target.classList.contains('spell-underline')) {
          _closePopup();
        }
      }
    });
  }

  function _openPopup(el, word, suggestions) {
    if (!_popup) _createPopup();
    const sug = suggestions[0] || '';
    const acceptBtn = document.getElementById('spell-pop-accept');
    const rejectBtn = document.getElementById('spell-pop-reject');

    acceptBtn.textContent = '✅ ' + sug;
    acceptBtn.onclick = () => { accept(word, sug); _closePopup(); };
    rejectBtn.onclick = () => { reject(word);  _closePopup(); };

    // Positionner au-dessus de l'élément souligné
    // On ne peut pas utiliser le miroir pour le positionnement (overlay transparent)
    // On se base sur le textarea + offset approximatif
    const tin = document.getElementById('tin');
    const rect = tin ? tin.getBoundingClientRect() : null;

    // Fallback : sous le textarea
    const popRect = _popup.getBoundingClientRect ? _popup.getBoundingClientRect() : null;
    _popup.style.display = 'flex';

    // Positionner centré par rapport au viewport, légèrement sous le textarea
    if (rect) {
      let left = rect.left + rect.width / 2 - 80;
      let top  = rect.bottom + 8;
      // Éviter débordement droit
      const vw = window.innerWidth;
      if (left + 180 > vw) left = vw - 190;
      if (left < 8) left = 8;
      _popup.style.left = left + 'px';
      _popup.style.top  = top  + 'px';
    }

    // Surligner le span cliqué
    document.querySelectorAll('.spell-underline.active').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
  }

  function _closePopup() {
    if (_popup) _popup.style.display = 'none';
    document.querySelectorAll('.spell-underline.active').forEach(s => s.classList.remove('active'));
  }

  // ── Rendu du miroir ──────────────────────────────────────
  function _renderMirror(text, corrections) {
    if (!_mirror) return;
    if (!corrections.length) { _mirror.innerHTML = _escHtml(text); return; }

    let html = '';
    let pos  = 0;
    const sorted = [...corrections].sort((a, b) => a.offset - b.offset);

    sorted.forEach(c => {
      if (c.offset > pos) html += _escHtml(text.slice(pos, c.offset));
      const sug  = (c.suggestions[0] || '').replace(/'/g,"&#39;").replace(/"/g,'&quot;');
      const word = _escHtml(c.word);
      const sugsJson = JSON.stringify(c.suggestions).replace(/"/g,'&quot;');
      html += `<span class="spell-underline" data-word="${_escAttr(c.word)}" data-sug="${sug}" data-sugs="${sugsJson}">${word}</span>`;
      pos = c.offset + c.length;
    });
    if (pos < text.length) html += _escHtml(text.slice(pos));

    _mirror.innerHTML = html;

    // Activer le pointer-events sur les spans soulignés
    _mirror.style.pointerEvents = 'none';
    _mirror.querySelectorAll('.spell-underline').forEach(span => {
      span.style.pointerEvents = 'auto';
      span.style.cursor = 'pointer';
      span.addEventListener('click', e => {
        e.stopPropagation();
        const w    = span.dataset.word;
        const sugs = JSON.parse(span.dataset.sugs || '[]');
        _openPopup(span, w, sugs);
      });
    });
  }

  // ── Actions ──────────────────────────────────────────────
  function accept(word, suggestion) {
    const tin = document.getElementById('tin');
    if (!tin || !suggestion) return;
    // Remplacer la 1ère occurrence (sensible à la casse)
    const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    tin.value = tin.value.replace(re, suggestion);
    _corrections = _corrections.filter(c => c.word !== word);
    _renderMirror(tin.value, _corrections);
    doTranslate();
  }

  function reject(word) {
    _corrections = _corrections.filter(c => c.word !== word);
    const tin = document.getElementById('tin');
    _renderMirror(tin ? tin.value : '', _corrections);
  }

  function clear() {
    _corrections = [];
    if (_mirror) _mirror.innerHTML = '';
    _closePopup();
  }

  // ── Init & hook ──────────────────────────────────────────
  function init() {
    setTimeout(() => { if (!_mcIndex) _mcIndex = _buildIndex(); }, 500);
    setTimeout(() => {
      _createMirror();
      _createPopup();
    }, 200);   // laisser le DOM se stabiliser

    const tin = document.getElementById('tin');
    if (!tin) return;

    tin.addEventListener('input', () => {
      clearTimeout(_timer);
      if (_mirror) _mirror.innerHTML = '';
      _closePopup();
      _timer = setTimeout(() => _run(tin.value), 900);
    });

    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        if (!_mirror || !tin) return;
        _mirror.style.width  = tin.offsetWidth + 'px';
        _mirror.style.height = tin.offsetHeight + 'px';
        _mirror.style.top    = tin.offsetTop + 'px';
        _mirror.style.left   = tin.offsetLeft + 'px';
      }).observe(tin);
    }
  }

  async function _run(text) {
    if (!text || text.trim().length < 3) { clear(); return; }
    const result = State.dirFR ? await _checkFR(text) : _checkMC(text);
    _corrections = result.corrections || [];
    _renderMirror(text, _corrections);
  }

  function _escHtml(s)  { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _escAttr(s)  { return (s||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  return { init, accept, reject, clear };
})();
