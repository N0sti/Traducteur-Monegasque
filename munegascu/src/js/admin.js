/**
 * admin.js — Münegascu v3
 */

const Admin = (() => {
  let _activeTab = 'suggestions';

  function open() {
    document.getElementById('admin-overlay').classList.add('show');
    if (State.adminLoggedIn) _showPanel();
  }
  function close() { document.getElementById('admin-overlay').classList.remove('show'); }

  function _showPanel() {
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    _switchTab(_activeTab);
  }

  function _switchTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('.adm-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.adm-tab-btn').forEach(b => b.classList.remove('active'));
    const el  = document.getElementById('adm-' + tab);
    const btn = document.querySelector('.adm-tab-btn[data-tab="' + tab + '"]');
    if (el)  el.style.display = 'block';
    if (btn) btn.classList.add('active');
    if (tab === 'suggestions') _renderSuggestions();
    if (tab === 'bdd')         _renderBDD();
    if (tab === 'verbes')      _renderVerbList();
  }

  function tryLogin() {
    const pwd = document.getElementById('admin-pwd').value;
    if (pwd === 'admin') { State.adminLoggedIn = true; _showPanel(); }
    else _status('login-status', 'Mot de passe incorrect.', true);
  }

  // ── SUGGESTIONS ──────────────────────────────────────────
  function _renderSuggestions() {
    const c = document.getElementById('sugg-list');
    const pending = State.suggestions.filter(s => s.status === 'pending');
    const cnt = document.getElementById('sugg-cnt');
    if (cnt) cnt.textContent = pending.length;
    if (!pending.length) { c.innerHTML = '<p style="color:#bbb;font-size:.85rem">Aucune suggestion en attente.</p>'; return; }
    c.innerHTML = pending.map(s => {
      const dir = s.direction === 'fr-mc' ? '🇫🇷→🇲🇨' : '🇲🇨→🇫🇷';
      return '<div class="suggestion-card" id="sugg-' + s.id + '">' +
        '<div class="sugg-meta">📅 ' + _esc(s.date) + ' · ' + dir + '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">' +
          '<div><div class="label">Texte original</div><div class="val">' + _esc(s.original) + '</div></div>' +
          '<div><div class="label">Traduction actuelle</div><div class="val mc">' + _esc(s.currentTr) + '</div></div>' +
        '</div>' +
        (s.wordToFix ? '<div style="margin-bottom:8px;padding:6px 10px;background:#fdecea;border-radius:6px;font-size:.8rem">🎯 Mot ciblé par l\'utilisateur : <strong style="color:var(--rouge)">' + _esc(s.wordToFix) + '</strong></div>' : '') +
        '<div style="margin-bottom:10px"><div class="label">Correction proposée</div><div class="val mc">' + _esc(s.proposed) + '</div></div>' +
        '<input type="text" class="admin-edit-input" id="edit-mc-' + s.id + '" value="' + _esc(s.proposed) + '" placeholder="Traduction MC…" style="margin-bottom:6px">' +
        '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">' +
          '<input type="text" class="admin-edit-input" id="edit-ph-' + s.id + '" value="' + _esc(s.phonetic||'') + '" placeholder="Phonétique IPA — ex: bun dʒurnu" style="flex:1">' +
          '<button class="btn-ipa" onclick="IPA.open(\'sugg-' + s.id + '\')" title="Clavier IPA">🔣</button>' +
        '</div>' +
        '<div style="font-size:.63rem;color:#bbb;margin-bottom:8px">Symboles IPA : ʃ ʒ tʃ dʒ ɲ ʎ ɔ ø œ ɛ ɑ̃ ɛ̃ œ̃ ɔ̃ y ɥ ʁ</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn-vert" onclick="Admin.validateSugg(' + s.id + ')">✅ Valider</button>' +
          '<button class="btn-ghost" onclick="Admin.rejectSugg(' + s.id + ')" style="color:var(--rouge)">❌ Rejeter</button>' +
        '</div>' +
        '<div class="modal-status" id="sugg-status-' + s.id + '"></div>' +
      '</div>';
    }).join('');
  }

  function validateSugg(id) {
    const s = State.suggestions.find(x => x.id === id);
    if (!s) return;
    const mc = document.getElementById('edit-mc-' + id)?.value.trim();
    const ph = document.getElementById('edit-ph-' + id)?.value.trim();
    if (!mc) { _status('sugg-status-' + id, 'MC vide.', true); return; }
    const ex = DB_WORDS.find(e => e.fr.toLowerCase() === s.original.toLowerCase() || e.mc.toLowerCase() === s.original.toLowerCase());
    if (ex) { ex.mc = mc; if (ph) ex.ph = ph; }
    else DB_WORDS.push({ fr: s.original, mc, ph: ph||'', cat: 'personnalisé', custom: true });
    s.status = 'validated';
    renderDict(); _renderSuggestions();
    _status('sugg-status', '✅ Validée.');
  }

  function rejectSugg(id) {
    const s = State.suggestions.find(x => x.id === id);
    if (s) s.status = 'rejected';
    _renderSuggestions();
  }

  // ── BDD VIEWER ───────────────────────────────────────────
  const BDD_PAGE = 35;
  let _bdd = { cat: 'all', q: '', page: 0 };

  function _renderBDD() {
    const catSel = document.getElementById('bdd-cat-filter');
    if (catSel) {
      const cats = [...new Set(DB_WORDS.map(e => e.cat))].sort();
      catSel.innerHTML = '<option value="all">Toutes</option>' +
        cats.map(c => '<option value="' + c + '"' + (c === _bdd.cat ? ' selected' : '') + '>' + c + '</option>').join('');
    }
    _renderBDDTable();
  }

  function _renderBDDTable() {
    const q = (_bdd.q || '').toLowerCase();
    const cat = _bdd.cat;
    const rows = DB_WORDS.filter(e =>
      (cat === 'all' || e.cat === cat) &&
      (!q || e.fr.toLowerCase().includes(q) || e.mc.toLowerCase().includes(q) || (e.ph||'').toLowerCase().includes(q))
    );
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / BDD_PAGE));
    _bdd.page   = Math.min(_bdd.page, pages - 1);
    const page  = _bdd.page;
    const slice = rows.slice(page * BDD_PAGE, (page + 1) * BDD_PAGE);

    const cntEl = document.getElementById('bdd-cnt');
    if (cntEl) cntEl.textContent = total + ' mots';

    const tbody = document.getElementById('bdd-tbody');
    if (!tbody) return;

    const ALL_CATS = ['salutation','nature','famille','chiffre','quotidien','cuisine','corps',
      'couleur','adjectif','verbe','monaco','animal','saison','pronom','particule','santé',
      'logement','vêtement','transport','commerce','métier','école','religion','émotion','personnalisé','import'];

    tbody.innerHTML = slice.length ? slice.map(e => {
      const idx = DB_WORDS.indexOf(e);
      const catOpts = ALL_CATS.map(c => '<option value="' + c + '"' + (c === e.cat ? ' selected' : '') + '>' + c + '</option>').join('');
      return '<tr id="brow-' + idx + '"' + (e.custom ? ' class="brow-custom"' : '') + '>' +
        '<td><span class="bv">' + _esc(e.fr) + '</span><input class="bdd-inp" style="display:none" value="' + _esc(e.fr) + '" onchange="Admin.saveCell(' + idx + ',\'fr\',this.value)"></td>' +
        '<td><span class="bv mc">' + _esc(e.mc) + '</span><input class="bdd-inp" style="display:none" value="' + _esc(e.mc) + '" onchange="Admin.saveCell(' + idx + ',\'mc\',this.value)"></td>' +
        '<td><span class="bv" style="font-family:monospace;font-size:.75rem">' + _esc(e.ph||'') + '</span>' +
          '<div class="bdd-ph-wrap" style="display:none">' +
            '<input class="bdd-inp bdd-ph-inp" value="' + _esc(e.ph||'') + '" placeholder="IPA…" onchange="Admin.saveCell(' + idx + ',\'ph\',this.value)" style="width:calc(100% - 36px)">' +
            '<button class="btn-ipa" onclick="IPA.open(\'bdd-' + idx + '\')" style="padding:3px 7px;vertical-align:middle">🔣</button>' +
          '</div></td>' +
        '<td><select class="bdd-cat-sel" onchange="Admin.saveCell(' + idx + ',\'cat\',this.value)">' + catOpts + '</select></td>' +
        '<td style="white-space:nowrap">' +
          '<button class="bdd-btn-edit" onclick="Admin.toggleEdit(' + idx + ')" title="Modifier">✏️</button> ' +
          '<button class="bdd-btn-del" onclick="Admin.delWord(' + idx + ')" title="Supprimer">🗑️</button>' +
        '</td></tr>';
    }).join('') : '<tr><td colspan="5" style="text-align:center;color:#bbb;padding:20px">Aucun résultat</td></tr>';

    const pag = document.getElementById('bdd-pag');
    if (pag) pag.innerHTML =
      '<span style="font-size:.75rem;color:#999">' + (page*BDD_PAGE+1) + '–' + Math.min((page+1)*BDD_PAGE, total) + ' / ' + total + '</span>' +
      '<button class="pag-btn"' + (page===0?' disabled':'') + ' onclick="Admin.bddPage(' + (page-1) + ')">◀</button>' +
      '<span style="font-size:.75rem">pg ' + (page+1) + '/' + pages + '</span>' +
      '<button class="pag-btn"' + (page>=pages-1?' disabled':'') + ' onclick="Admin.bddPage(' + (page+1) + ')">▶</button>';
  }

  function bddFilter(key, val) { _bdd[key] = val; _bdd.page = 0; _renderBDDTable(); }
  function bddPage(p) { _bdd.page = p; _renderBDDTable(); }

  function toggleEdit(idx) {
    const row = document.getElementById('brow-' + idx);
    if (!row) return;
    const on = row.classList.toggle('editing');
    row.querySelectorAll('.bv').forEach(el => el.style.display = on ? 'none' : '');
    row.querySelectorAll('.bdd-inp:not(.bdd-ph-inp), .bdd-cat-sel').forEach(el => el.style.display = on ? '' : 'none');
    row.querySelectorAll('.bdd-ph-wrap').forEach(el => el.style.display = on ? 'block' : 'none');
    if (on) row.querySelector('.bdd-inp')?.focus();
  }

  function saveCell(idx, field, val) {
    if (!DB_WORDS[idx]) return;
    DB_WORDS[idx][field] = (val || '').trim();
    const row = document.getElementById('brow-' + idx);
    if (!row) return;
    const spans = row.querySelectorAll('.bv');
    const map = { fr: 0, mc: 1, ph: 2 };
    if (map[field] !== undefined && spans[map[field]]) spans[map[field]].textContent = (val||'').trim();
  }

  function delWord(idx) {
    const e = DB_WORDS[idx];
    if (!e || !confirm('Supprimer "' + e.fr + '" → "' + e.mc + '" ?')) return;
    DB_WORDS.splice(idx, 1);
    _renderBDDTable(); buildCatBar(); renderDict();
    _status('bdd-status', '"' + e.fr + '" supprimé.');
  }

  // ── VERBES ───────────────────────────────────────────────
  function _renderVerbList() {
    const c = document.getElementById('verb-import-list');
    const cnt = document.getElementById('verb-import-cnt');
    const verbs = Object.keys(DB_VERBS);
    if (cnt) cnt.textContent = verbs.length;
    if (!c) return;
    const custom = State.customVerbs || [];
    c.innerHTML = verbs.map(fr => {
      const v = DB_VERBS[fr];
      const isN = custom.includes(fr);
      const tOk = ['présent','imparfait','futur','conditionnel','subjonctif','impératif']
        .filter(t => (v.conj[t]||[]).some(f => f && f !== '—')).length;
      return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--sable2);font-size:.83rem">' +
        '<span style="flex:1;font-weight:600">' + fr + '</span>' +
        '<span style="color:var(--bleu);font-style:italic">' + v.mc + '</span>' +
        '<span style="font-size:.7rem;color:#999">' + tOk + '/6 temps</span>' +
        (isN ? '<span class="badge badge-vert" style="font-size:.6rem">nouveau</span>' : '') +
        '<button class="btn-ghost" style="font-size:.7rem;padding:3px 8px;color:var(--rouge)" onclick="Admin.deleteVerb(\'' + fr + '\')">✕</button>' +
      '</div>';
    }).join('') || '<p style="color:#bbb;font-size:.82rem">Aucun verbe.</p>';
  }

  function deleteVerb(fr) {
    delete DB_VERBS[fr];
    State.customVerbs = (State.customVerbs||[]).filter(v => v !== fr);
    _renderVerbList(); _status('verb-status', '"' + fr + '" supprimé.');
  }



  function handleVerbJSON(file) {
    if (!file) return;
    if (!file.name.endsWith('.json')) { _status('verb-status', '❌ Fichier .json requis', true); return; }
    const r = new FileReader();
    r.onload = ev => _parseVerbJSON(ev.target.result);
    r.readAsText(file, 'UTF-8');
  }

  function _parseVerbJSON(text) {
    let data;
    try { data = JSON.parse(text); }
    catch(e) { _status('verb-status', '❌ JSON invalide : ' + e.message, true); return; }

    // Format 1 : tableau [{fr, mc, conj:{…}}]
    // Format 2 : objet {verbeFR: {mc, conj:{…}}}
    const verbsObj = {};
    if (Array.isArray(data)) {
      data.forEach(v => { if (v.fr && v.mc && v.conj) verbsObj[v.fr] = { mc: v.mc, conj: v.conj }; });
    } else if (typeof data === 'object') {
      Object.assign(verbsObj, data);
    }
    if (!Object.keys(verbsObj).length) { _status('verb-status', '❌ Aucun verbe valide.', true); return; }

    const TEMPS = ['présent','imparfait','futur','conditionnel','subjonctif','impératif'];
    let added = 0, updated = 0, errors = 0;
    for (const [fr, verb] of Object.entries(verbsObj)) {
      if (!verb.mc || !verb.conj) { errors++; continue; }
      TEMPS.forEach(t => { if (!verb.conj[t] || verb.conj[t].length < 6) verb.conj[t] = Array(6).fill('—'); });
      DB_VERBS[fr] ? updated++ : added++;
      DB_VERBS[fr] = verb;
      if (typeof _registerVerbForms === 'function') _registerVerbForms({[fr]: verb});
    }
    State.customVerbs = State.customVerbs || [];
    Object.keys(verbsObj).forEach(fr => { if (!State.customVerbs.includes(fr)) State.customVerbs.push(fr); });
    _renderVerbList();
    _status('verb-status', '✅ ' + added + ' ajouté(s), ' + updated + ' mis à jour' + (errors ? ', ' + errors + ' erreur(s)' : '') + '.');
  }

  function openVerbTab(tab) {
    ['verb-tab-import','verb-tab-list'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const active = document.getElementById('verb-tab-' + tab);
    if (active) active.style.display = 'block';
    document.querySelectorAll('.verb-tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector('.verb-tab-btn[data-tab="' + tab + '"]');
    if (btn) btn.classList.add('active');
    if (tab === 'list') _renderVerbList();
  }

  // ── CSV ──────────────────────────────────────────────────
  function csvDrag(e) { e.preventDefault(); document.getElementById('csvbox')?.classList.add('drag'); }
  function csvDrop(e) {
    e.preventDefault(); document.getElementById('csvbox')?.classList.remove('drag');
    const f = e.dataTransfer.files[0]; if (f) handleCSV(f);
  }

  function handleCSV(file) {
    if (!file) return;
    const r = new FileReader(); r.onload = ev => _parseCSV(ev.target.result); r.readAsText(file, 'UTF-8');
  }

  function _parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) { _status('csv-status', 'Fichier vide.', true); return; }
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^\uFEFF/,''));
    const iF=headers.indexOf('fr'), iM=headers.indexOf('mc');
    const iPh=headers.indexOf('phonetic'), iC=headers.indexOf('cat');
    if (iF<0||iM<0) { _status('csv-status', 'Colonnes "fr" et "mc" requises.', true); return; }
    const toImport=[], conflicts=[];
    lines.slice(1).forEach(line => {
      if (!line.trim()) return;
      const cols = line.match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g,'').trim()) || [];
      const fr=cols[iF]||'', mc=cols[iM]||'';
      if (!fr||!mc) return;
      const entry = { fr, mc, ph: iPh>=0?cols[iPh]||'':'', cat: iC>=0?cols[iC]||'import':'import', custom:true };
      const existing = DB_WORDS.find(e => e.fr.toLowerCase()===fr.toLowerCase());
      existing ? conflicts.push({entry,existing,choice:'csv'}) : toImport.push(entry);
    });
    toImport.forEach(e => { DB_WORDS.push(e); State.customWords.push(e); });
    if (conflicts.length) {
      State.conflictQueue = [...conflicts]; Conflict.open();
      _status('csv-status', '✅ ' + toImport.length + ' importé(s). ⚠️ ' + conflicts.length + ' conflit(s).');
    } else {
      buildCatBar(); renderDict();
      _status('csv-status', '✅ ' + toImport.length + ' mot(s) importé(s).');
    }
  }

  // ── AJOUT MANUEL ─────────────────────────────────────────
  function addManual() {
    const fr  = document.getElementById('add-fr').value.trim();
    const mc  = document.getElementById('add-mc').value.trim();
    const ph  = document.getElementById('add-ph').value.trim();
    const cat = document.getElementById('add-cat').value.trim() || 'personnalisé';
    if (!fr||!mc) { _status('add-status', 'FR et MC requis.', true); return; }
    if (DB_WORDS.find(e => e.fr.toLowerCase()===fr.toLowerCase())) { _status('add-status', '"' + fr + '" existe déjà.', true); return; }
    const entry = {fr, mc, ph, cat, custom:true};
    DB_WORDS.push(entry); State.customWords.push(entry);
    ['add-fr','add-mc','add-ph','add-cat'].forEach(id => document.getElementById(id).value='');
    buildCatBar(); renderDict(); _status('add-status', '✅ "' + fr + '" → "' + mc + '" ajouté !');
  }

  function exportCSV() {
    const rows = DB_WORDS.map(e => _csvCell(e.fr)+','+_csvCell(e.mc)+','+_csvCell(e.ph||'')+','+_csvCell(e.cat)).join('\n');
    const blob = new Blob(['\uFEFFfr,mc,phonetic,cat\n' + rows], {type:'text/csv;charset=utf-8'});
    const a = Object.assign(document.createElement('a'), {href:URL.createObjectURL(blob), download:'dictionnaire-monegasque.csv'});
    a.click();
  }

  function clearCustom() {
    if (!State.customWords.length) { _status('add-status','Aucun mot personnalisé.', true); return; }
    State.customWords.forEach(w => { const i = DB_WORDS.indexOf(w); if (i>=0) DB_WORDS.splice(i,1); });
    State.customWords = []; buildCatBar(); renderDict(); _status('add-status', 'Supprimés.');
  }

  function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function _csvCell(s) { return /[,"\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }
  function _status(id, msg, isErr=false) { showStatus(id, msg, isErr); }

  return {
    open, close, tryLogin, switchTab: _switchTab,
    validateSugg, rejectSugg,
    bddFilter, bddPage, toggleEdit, saveCell, delWord,
    openVerbTab, deleteVerb, handleVerbJSON,
    csvDrag, csvDrop, handleCSV,
    addManual, exportCSV, clearCustom,
  };
})();

// ── CLAVIER IPA ──────────────────────────────────────────────
const IPA = (() => {
  let _target = null;

  const SYMBOLS = [
    { label:'Voyelles orales',   syms:['a','e','i','o','u','ə','ɑ','ɒ','ɔ','ø','œ','æ','y','ɯ','ɪ','ʊ','ɛ','ɜ'] },
    { label:'Voyelles nasales',  syms:['ɑ̃','ɛ̃','œ̃','ɔ̃','ã','ẽ','ĩ','õ','ũ'] },
    { label:'Plosives',          syms:['p','b','t','d','k','g','ʔ','ʈ','ɖ','c','ɟ'] },
    { label:'Fricatives',        syms:['f','v','s','z','ʃ','ʒ','x','χ','ɣ','ħ','ʁ','θ','ð','ɸ','β'] },
    { label:'Affriquées',        syms:['tʃ','dʒ','ts','dz'] },
    { label:'Nasales/Latérales', syms:['m','n','ŋ','ɲ','ɱ','l','ʎ','ɭ','r','ɾ','ʀ'] },
    { label:'Semi-voyelles',     syms:['w','j','ɥ','ʋ'] },
    { label:'Diacritiques/Ton',  syms:['ː','ˈ','ˌ','̃','͡','ʰ','ʷ'] },
    { label:'Monaco / ligures',  syms:['ü','ö','ï','ä','ë','à','è','ù','ì','ò','â','ê','î','ô','û','æ','œ','ç'] },
  ];

  function _getInput() {
    if (!_target) return null;
    if (_target === 'add-ph') return document.getElementById('add-ph');
    if (_target.startsWith('sugg-')) return document.getElementById('edit-ph-' + _target.replace('sugg-',''));
    if (_target.startsWith('bdd-'))  return document.querySelector('#brow-' + _target.replace('bdd-','') + ' .bdd-ph-inp');
    return null;
  }

  function open(target) {
    _target = target || 'add-ph';
    _buildKeyboard();
    document.getElementById('ipa-overlay').classList.add('show');
    setTimeout(() => _getInput()?.focus(), 80);
  }

  function close() { document.getElementById('ipa-overlay').classList.remove('show'); }

  function insert(sym) {
    const input = _getInput();
    if (!input) return;
    input.focus();
    const pos = input.selectionStart != null ? input.selectionStart : input.value.length;
    input.value = input.value.slice(0, pos) + sym + input.value.slice(pos);
    const np = pos + [...sym].length;
    try { input.setSelectionRange(np, np); } catch(e) {}
    input.dispatchEvent(new Event('change'));
  }

  function backspace() {
    const input = _getInput();
    if (!input) return;
    const pos = input.selectionStart != null ? input.selectionStart : input.value.length;
    if (!pos) return;
    const seg = [...input.value.slice(0, pos)];
    seg.pop();
    const before = seg.join('');
    input.value = before + input.value.slice(pos);
    try { input.setSelectionRange(before.length, before.length); } catch(e) {}
    input.dispatchEvent(new Event('change'));
  }

  function clearField() { const i = _getInput(); if (i) { i.value=''; i.dispatchEvent(new Event('change')); } }

  function _buildKeyboard() {
    const wrap = document.getElementById('ipa-keyboard');
    if (!wrap || wrap.dataset.built) return;
    wrap.dataset.built = '1';
    wrap.innerHTML = SYMBOLS.map(group =>
      '<div style="margin-bottom:12px">' +
        '<div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.45);margin-bottom:5px">' + group.label + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px">' +
          group.syms.map(s => '<button class="ipa-key" onclick="IPA.insert(\'' + s.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')">' + s + '</button>').join('') +
        '</div>' +
      '</div>'
    ).join('');
  }

  return { open, close, insert, backspace, clear: clearField };
})();

// ── CONFLITS CSV ─────────────────────────────────────────────
const Conflict = (() => {
  function open() {
    const c = document.getElementById('conflict-list');
    c.innerHTML = State.conflictQueue.map((cf,i) =>
      '<div class="conflict-item">' +
        '<h4>⚠️ Conflit #' + (i+1) + ' — « ' + cf.entry.fr + ' »</h4>' +
        '<div class="conflict-grid">' +
          '<div class="conflict-choice' + (cf.choice==='db'?' selected':'') + '" onclick="Conflict.setChoice(' + i + ',\'db\')" id="cc-db-' + i + '">' +
            '<span class="badge badge-blue badge-choice">Existant</span>' +
            '<div class="word">' + cf.existing.fr + '</div><div class="trans">' + cf.existing.mc + '</div>' +
            '<div style="font-size:.72rem;color:#999">[' + (cf.existing.ph||'') + '] · ' + cf.existing.cat + '</div>' +
          '</div>' +
          '<div class="conflict-choice' + (cf.choice==='csv'?' selected':'') + '" onclick="Conflict.setChoice(' + i + ',\'csv\')" id="cc-csv-' + i + '">' +
            '<span class="badge badge-vert badge-choice">CSV</span>' +
            '<div class="word">' + cf.entry.fr + '</div><div class="trans">' + cf.entry.mc + '</div>' +
            '<div style="font-size:.72rem;color:#999">[' + (cf.entry.ph||'') + '] · ' + cf.entry.cat + '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    ).join('');
    document.getElementById('conflict-overlay').classList.add('show');
  }
  function close() { document.getElementById('conflict-overlay').classList.remove('show'); buildCatBar(); renderDict(); }
  function setChoice(idx, choice) {
    State.conflictQueue[idx].choice = choice;
    ['db','csv'].forEach(k => {
      const el = document.getElementById('cc-'+k+'-'+idx);
      if (el) el.className = 'conflict-choice' + (choice===k?' selected':'');
    });
  }
  function resolveAll(choice) { State.conflictQueue.forEach((_,i) => setChoice(i, choice)); }
  function apply() {
    let replaced=0, kept=0;
    State.conflictQueue.forEach(cf => {
      if (cf.choice==='csv') {
        const idx = DB_WORDS.findIndex(e => e.fr.toLowerCase()===cf.entry.fr.toLowerCase());
        if (idx>=0) { DB_WORDS[idx]={...cf.entry}; replaced++; } else kept++;
      } else kept++;
    });
    State.conflictQueue=[];
    document.getElementById('conflict-overlay').classList.remove('show');
    buildCatBar(); renderDict();
    showStatus('csv-status', '✅ ' + replaced + ' remplacé(s), ' + kept + ' conservé(s).');
  }
  return { open, close, setChoice, resolveAll, apply };
})();
