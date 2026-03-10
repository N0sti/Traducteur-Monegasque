/**
 * admin.js — Münegascu v3
 * Sécurité : toutes les sorties HTML passent par Security.esc()
 *            Authentification PBKDF2 (salt aléatoire, 600k itérations)
 *            Rate limiting + session expirante (30 min d'inactivité)
 *            Validation taille/type sur tous les uploads
 *            URL.createObjectURL révoqué via Security.safeDownload()
 */

const Admin = (() => {
  'use strict';

  let _activeTab = 'suggestions';
  let _sessionBadgeTimer = null;

  // ── Ouverture / Fermeture ────────────────────────────────
  function open() {
    if (State.adminLoggedIn && !Security.isSessionValid()) {
      _forceLogout('Session expirée. Reconnectez-vous.');
      return;
    }
    document.getElementById('admin-overlay').classList.add('show');
    if (State.adminLoggedIn) _showPanel();
    else document.getElementById('admin-pwd').value = '';
  }

  function close() {
    document.getElementById('admin-overlay').classList.remove('show');
  }

  function logout() {
    State.adminLoggedIn = false;
    Security.endSession();
    if (_sessionBadgeTimer) { clearInterval(_sessionBadgeTimer); _sessionBadgeTimer = null; }
    document.getElementById('admin-login').style.display  = '';
    document.getElementById('admin-panel').style.display  = 'none';
    document.getElementById('admin-pwd').value = '';
    close();
  }

  function _forceLogout(msg) {
    State.adminLoggedIn = false;
    Security.endSession();
    if (_sessionBadgeTimer) { clearInterval(_sessionBadgeTimer); _sessionBadgeTimer = null; }
    document.getElementById('admin-login').style.display  = '';
    document.getElementById('admin-panel').style.display  = 'none';
    document.getElementById('admin-pwd').value = '';
    document.getElementById('admin-overlay').classList.add('show');
    if (msg) _status('login-status', msg, true);
  }

  function _showPanel() {
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    _startSessionBadge();
    _switchTab(_activeTab);
  }

  function _startSessionBadge() {
    if (_sessionBadgeTimer) clearInterval(_sessionBadgeTimer);
    _updateSessionBadge();
    _sessionBadgeTimer = setInterval(_updateSessionBadge, 60_000);
  }

  function _updateSessionBadge() {
    const badge = document.getElementById('admin-session-badge');
    if (!badge) return;
    const min = Security.sessionMinutesLeft();
    badge.textContent = min > 0 ? `🕐 ${min} min restante(s)` : '⏰ Session expirée';
    badge.style.color = min <= 5 ? 'var(--rouge)' : 'var(--bleu)';
  }

  function _switchTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('.adm-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.adm-tab-btn').forEach(b => b.classList.remove('active'));
    const el  = document.getElementById('adm-' + tab);
    const btn = document.querySelector(`.adm-tab-btn[data-tab="${tab}"]`);
    if (el)  el.style.display = 'block';
    if (btn) btn.classList.add('active');
    if (tab === 'suggestions') _renderSuggestions();
    if (tab === 'bdd')         _renderBDD();
    if (tab === 'verbes')      _renderVerbList();
  }

  // ── Authentification (PBKDF2 + rate limiting) ────────────
  async function tryLogin() {
    const rateCheck = Security.checkRateLimit();
    if (!rateCheck.allowed) {
      _status('login-status', rateCheck.message, true);
      return;
    }

    const pwd = document.getElementById('admin-pwd').value;
    if (!pwd) { _status('login-status', 'Mot de passe requis.', true); return; }

    const btn = document.querySelector('#admin-login .btn-red');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }

    try {
      const ok = await Security.verifyPassword(pwd);
      if (ok) {
        Security.resetAttempts();
        State.adminLoggedIn = true;
        document.getElementById('admin-pwd').value = '';
        // Démarrer la session — callback appelé à l'expiration
        Security.startSession(() => _forceLogout('Session expirée après 30 min d\'inactivité.'));
        _showPanel();
      } else {
        Security.recordFailedAttempt();
        const left = Security.getRemainingAttempts();
        const msg = left > 0
          ? `Mot de passe incorrect. ${left} tentative(s) restante(s).`
          : 'Compte verrouillé. Réessayez dans 30 secondes.';
        _status('login-status', msg, true);
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Connexion'; }
    }
  }

  // ── SUGGESTIONS ──────────────────────────────────────────
  function _renderSuggestions() {
    const c = document.getElementById('sugg-list');
    const pending = State.suggestions.filter(s => s.status === 'pending');
    const cnt = document.getElementById('sugg-cnt');
    if (cnt) cnt.textContent = pending.length;

    if (!pending.length) {
      c.innerHTML = '<p style="color:#bbb;font-size:.85rem">Aucune suggestion en attente.</p>';
      return;
    }

    // Toutes les données utilisateur passent par Security.esc()
    c.innerHTML = pending.map(s => {
      const dir = s.direction === 'fr→mc' ? '🇫🇷→🇲🇨' : '🇲🇨→🇫🇷';
      const id  = Number(s.id); // forcer numérique — pas d'injection possible
      return `<div class="suggestion-card" id="sugg-${id}">
        <div class="sugg-meta">📅 ${Security.esc(s.date)} · ${dir}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div><div class="label">Texte original</div><div class="val">${Security.esc(s.original)}</div></div>
          <div><div class="label">Traduction actuelle</div><div class="val mc">${Security.esc(s.currentTr)}</div></div>
        </div>
        ${s.wordToFix ? `<div style="margin-bottom:8px;padding:6px 10px;background:#fdecea;border-radius:6px;font-size:.8rem">
          🎯 Mot ciblé : <strong style="color:var(--rouge)">${Security.esc(s.wordToFix)}</strong>
        </div>` : ''}
        <div style="margin-bottom:10px">
          <div class="label">Correction proposée</div>
          <div class="val mc">${Security.esc(s.proposed)}</div>
        </div>
        <input type="text" class="admin-edit-input" id="edit-mc-${id}"
               value="${Security.esc(s.proposed)}" placeholder="Traduction MC…"
               maxlength="200" style="margin-bottom:6px">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
          <input type="text" class="admin-edit-input" id="edit-ph-${id}"
                 value="${Security.esc(s.phonetic||'')}" placeholder="Phonétique IPA"
                 maxlength="200" style="flex:1">
          <button class="btn-ipa" data-sugg-id="${id}" onclick="IPA.open('sugg-${id}')" title="Clavier IPA">🔣</button>
        </div>
        <div style="font-size:.63rem;color:#bbb;margin-bottom:8px">IPA : ʃ ʒ tʃ dʒ ɲ ʎ ɔ ø œ ɛ ɑ̃ ɛ̃ œ̃ ɔ̃ y ɥ ʁ</div>
        <div style="display:flex;gap:8px">
          <button class="btn-vert" data-id="${id}" onclick="Admin.validateSugg(${id})">✅ Valider</button>
          <button class="btn-ghost" data-id="${id}" onclick="Admin.rejectSugg(${id})"
                  style="color:var(--rouge)">❌ Rejeter</button>
        </div>
        <div class="modal-status" id="sugg-status-${id}"></div>
      </div>`;
    }).join('');
  }

  function validateSugg(id) {
    const s = State.suggestions.find(x => x.id === id);
    if (!s) return;

    const rawMc = document.getElementById('edit-mc-' + id)?.value || '';
    const rawPh = document.getElementById('edit-ph-' + id)?.value || '';

    const mcVal = Security.validateText(rawMc, 'Traduction MC', { required: true });
    if (!mcVal.ok) { _status('sugg-status-' + id, mcVal.error, true); return; }
    const phVal = Security.validateText(rawPh, 'Phonétique');
    if (!phVal.ok) { _status('sugg-status-' + id, phVal.error, true); return; }

    const ex = DB_WORDS.find(e =>
      e.fr.toLowerCase() === s.original.toLowerCase() ||
      e.mc.toLowerCase() === s.original.toLowerCase()
    );
    if (ex) {
      ex.mc = mcVal.value;
      if (phVal.value) ex.ph = phVal.value;
    } else {
      DB_WORDS.push({ fr: s.original, mc: mcVal.value, ph: phVal.value, cat: 'personnalisé', custom: true });
    }
    s.status = 'validated';
    renderDict();
    _renderSuggestions();
    _status('sugg-status', '✅ Validée et appliquée.');
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
        cats.map(c => `<option value="${Security.esc(c)}"${c === _bdd.cat ? ' selected' : ''}>${Security.esc(c)}</option>`).join('');
    }
    _renderBDDTable();
  }

  function _renderBDDTable() {
    const q   = (_bdd.q || '').toLowerCase();
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
    if (cntEl) cntEl.textContent = `${total} mots`;

    const tbody = document.getElementById('bdd-tbody');
    if (!tbody) return;

    const ALL_CATS = ['salutation','nature','famille','chiffre','quotidien','cuisine','corps',
      'couleur','adjectif','verbe','monaco','animal','saison','pronom','particule','santé',
      'logement','vêtement','transport','commerce','métier','école','religion','émotion','personnalisé','import'];

    tbody.innerHTML = slice.length ? slice.map(e => {
      const idx     = DB_WORDS.indexOf(e);
      const catOpts = ALL_CATS.map(c =>
        `<option value="${Security.esc(c)}"${c === e.cat ? ' selected' : ''}>${Security.esc(c)}</option>`
      ).join('');

      // Les callbacks onclick utilisent des index numériques, pas de données utilisateur
      return `<tr id="brow-${idx}"${e.custom ? ' class="brow-custom"' : ''}>
        <td>
          <span class="bv">${Security.esc(e.fr)}</span>
          <input class="bdd-inp" style="display:none" value="${Security.esc(e.fr)}"
                 maxlength="200" data-idx="${idx}" data-field="fr"
                 onchange="Admin.saveCell(${idx},'fr',this.value)">
        </td>
        <td>
          <span class="bv mc">${Security.esc(e.mc)}</span>
          <input class="bdd-inp" style="display:none" value="${Security.esc(e.mc)}"
                 maxlength="200" data-idx="${idx}" data-field="mc"
                 onchange="Admin.saveCell(${idx},'mc',this.value)">
        </td>
        <td>
          <span class="bv" style="font-family:monospace;font-size:.75rem">${Security.esc(e.ph||'')}</span>
          <div class="bdd-ph-wrap" style="display:none">
            <input class="bdd-inp bdd-ph-inp" value="${Security.esc(e.ph||'')}"
                   placeholder="IPA…" maxlength="200"
                   onchange="Admin.saveCell(${idx},'ph',this.value)"
                   style="width:calc(100% - 36px)">
            <button class="btn-ipa" onclick="IPA.open('bdd-${idx}')"
                    style="padding:3px 7px;vertical-align:middle">🔣</button>
          </div>
        </td>
        <td><select class="bdd-cat-sel" onchange="Admin.saveCell(${idx},'cat',this.value)">${catOpts}</select></td>
        <td style="white-space:nowrap">
          <button class="bdd-btn-edit" onclick="Admin.toggleEdit(${idx})" title="Modifier">✏️</button>
          <button class="bdd-btn-del"  onclick="Admin.delWord(${idx})" title="Supprimer">🗑️</button>
        </td>
      </tr>`;
    }).join('') : '<tr><td colspan="5" style="text-align:center;color:#bbb;padding:20px">Aucun résultat</td></tr>';

    const pag = document.getElementById('bdd-pag');
    if (pag) {
      // Données numériques uniquement — pas d'injection possible
      pag.innerHTML =
        `<span style="font-size:.75rem;color:#999">${page*BDD_PAGE+1}–${Math.min((page+1)*BDD_PAGE,total)} / ${total}</span>` +
        `<button class="pag-btn"${page===0?' disabled':''} onclick="Admin.bddPage(${page-1})">◀</button>` +
        `<span style="font-size:.75rem">pg ${page+1}/${pages}</span>` +
        `<button class="pag-btn"${page>=pages-1?' disabled':''} onclick="Admin.bddPage(${page+1})">▶</button>`;
    }
  }

  function bddFilter(key, val) {
    // Valider la clé de filtre (whitelist)
    if (!['q','cat'].includes(key)) return;
    _bdd[key] = String(val || '').slice(0, 100);
    _bdd.page = 0;
    _renderBDDTable();
  }

  function bddPage(p) {
    _bdd.page = Math.max(0, parseInt(p) || 0);
    _renderBDDTable();
  }

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
    // Whitelist des champs modifiables
    if (!['fr','mc','ph','cat'].includes(field)) return;
    if (!DB_WORDS[idx]) return;

    const v = Security.validateText(val, field);
    if (!v.ok) return;

    DB_WORDS[idx][field] = v.value;
    const row = document.getElementById('brow-' + idx);
    if (!row) return;
    const spans = row.querySelectorAll('.bv');
    const map = { fr: 0, mc: 1, ph: 2 };
    if (map[field] !== undefined && spans[map[field]]) {
      spans[map[field]].textContent = v.value;  // textContent, pas innerHTML
    }
  }

  function delWord(idx) {
    const e = DB_WORDS[idx];
    if (!e) return;
    // Utiliser textContent dans le confirm — pas d'injection HTML possible
    if (!confirm(`Supprimer "${e.fr}" → "${e.mc}" ?`)) return;
    DB_WORDS.splice(idx, 1);
    _renderBDDTable();
    buildCatBar();
    renderDict();
    _status('bdd-status', `"${e.fr}" supprimé.`);
  }

  // ── VERBES ───────────────────────────────────────────────
  function _renderVerbList() {
    const c   = document.getElementById('verb-import-list');
    const cnt = document.getElementById('verb-import-cnt');
    const verbs = Object.keys(DB_VERBS);
    if (cnt) cnt.textContent = verbs.length;
    if (!c)  return;

    const custom = State.customVerbs || [];
    // Les clés des verbes (noms français) passent par Security.esc()
    // Les index numériques dans onclick sont sûrs
    c.innerHTML = verbs.map(fr => {
      const v    = DB_VERBS[fr];
      const isN  = custom.includes(fr);
      const tOk  = ['présent','imparfait','futur','conditionnel','subjonctif','impératif']
        .filter(t => (v.conj[t]||[]).some(f => f && f !== '—')).length;
      const idx  = verbs.indexOf(fr);  // index numérique pour onclick
      return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--sable2);font-size:.83rem">
        <span style="flex:1;font-weight:600">${Security.esc(fr)}</span>
        <span style="color:var(--bleu);font-style:italic">${Security.esc(v.mc)}</span>
        <span style="font-size:.7rem;color:#999">${tOk}/6 temps</span>
        ${isN ? '<span class="badge badge-vert" style="font-size:.6rem">nouveau</span>' : ''}
        <button class="btn-ghost" style="font-size:.7rem;padding:3px 8px;color:var(--rouge)"
                data-verb-idx="${idx}" onclick="Admin.deleteVerb(${idx})">✕</button>
      </div>`;
    }).join('') || '<p style="color:#bbb;font-size:.82rem">Aucun verbe.</p>';
  }

  function deleteVerb(idx) {
    // Utiliser un index numérique au lieu de la clé string (évite l'injection)
    const fr = Object.keys(DB_VERBS)[idx];
    if (!fr) return;
    delete DB_VERBS[fr];
    State.customVerbs = (State.customVerbs||[]).filter(v => v !== fr);
    _renderVerbList();
    _status('verb-status', `"${fr}" supprimé.`);
  }

  function handleVerbJSON(file) {
    const check = Security.validateFile(file, ['json'], { maxSize: 512 * 1024 }); // 512KB max
    if (!check.ok) { _status('verb-status', '❌ ' + check.error, true); return; }

    const r = new FileReader();
    r.onload = ev => _parseVerbJSON(ev.target.result);
    r.readAsText(file, 'UTF-8');
  }

  function _parseVerbJSON(text) {
    // Limiter la taille du texte brut
    if (text.length > 512 * 1024) { _status('verb-status', '❌ Fichier trop volumineux.', true); return; }

    let data;
    try { data = JSON.parse(text); }
    catch(e) { _status('verb-status', '❌ JSON invalide : ' + e.message, true); return; }

    const countCheck = Security.validateJSONVerbCount(data);
    if (!countCheck.ok) { _status('verb-status', '❌ ' + countCheck.error, true); return; }

    const verbsObj = {};
    if (Array.isArray(data)) {
      data.forEach(v => { if (v.fr && v.mc && v.conj) verbsObj[v.fr] = { mc: v.mc, conj: v.conj }; });
    } else if (typeof data === 'object' && data !== null) {
      Object.assign(verbsObj, data);
    }
    if (!Object.keys(verbsObj).length) { _status('verb-status', '❌ Aucun verbe valide.', true); return; }

    const TEMPS = ['présent','imparfait','futur','conditionnel','subjonctif','impératif'];
    let added = 0, updated = 0, errors = 0;

    for (const [fr, verb] of Object.entries(verbsObj)) {
      // Valider chaque entrée
      const frCheck = Security.validateText(fr, 'Verbe FR', { required: true });
      const mcCheck = Security.validateText(verb?.mc, 'Verbe MC', { required: true });
      if (!frCheck.ok || !mcCheck.ok || !verb?.conj) { errors++; continue; }

      TEMPS.forEach(t => {
        if (!verb.conj[t] || verb.conj[t].length < 6) {
          verb.conj[t] = Array(6).fill('—');
        }
      });

      DB_VERBS[fr] ? updated++ : added++;
      DB_VERBS[fr] = { mc: mcCheck.value, conj: verb.conj };
      if (typeof _registerVerbForms === 'function') _registerVerbForms({ [fr]: verb });
    }

    State.customVerbs = State.customVerbs || [];
    Object.keys(verbsObj).forEach(fr => {
      if (!State.customVerbs.includes(fr)) State.customVerbs.push(fr);
    });

    _renderVerbList();
    _status('verb-status', `✅ ${added} ajouté(s), ${updated} mis à jour${errors ? `, ${errors} erreur(s)` : ''}.`);
  }

  function openVerbTab(tab) {
    if (!['import','list'].includes(tab)) return; // whitelist
    ['verb-tab-import','verb-tab-list'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const active = document.getElementById('verb-tab-' + tab);
    if (active) active.style.display = 'block';
    document.querySelectorAll('.verb-tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.verb-tab-btn[data-tab="${tab}"]`);
    if (btn) btn.classList.add('active');
    if (tab === 'list') _renderVerbList();
  }

  // ── CSV ──────────────────────────────────────────────────
  function csvDrag(e) { e.preventDefault(); document.getElementById('csvbox')?.classList.add('drag'); }
  function csvDrop(e) {
    e.preventDefault();
    document.getElementById('csvbox')?.classList.remove('drag');
    const f = e.dataTransfer.files[0];
    if (f) handleCSV(f);
  }

  function handleCSV(file) {
    const check = Security.validateFile(file, ['csv'], { maxSize: 1024 * 1024 }); // 1MB max
    if (!check.ok) { _status('csv-status', '❌ ' + check.error, true); return; }
    const r = new FileReader();
    r.onload = ev => _parseCSV(ev.target.result);
    r.readAsText(file, 'UTF-8');
  }

  function _parseCSV(text) {
    if (text.length > 1024 * 1024) { _status('csv-status', '❌ Fichier trop volumineux.', true); return; }

    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) { _status('csv-status', 'Fichier vide.', true); return; }

    const rowCheck = Security.validateCSVRows(lines);
    if (!rowCheck.ok) { _status('csv-status', '❌ ' + rowCheck.error, true); return; }

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^\uFEFF/,''));
    const iF = headers.indexOf('fr'), iM = headers.indexOf('mc');
    const iPh = headers.indexOf('phonetic'), iC = headers.indexOf('cat');

    if (iF < 0 || iM < 0) { _status('csv-status', 'Colonnes "fr" et "mc" requises.', true); return; }

    const toImport = [], conflicts = [];
    let parseErrors = 0;

    lines.slice(1).forEach(line => {
      if (!line.trim()) return;
      const cols = line.match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g,'').trim()) || [];
      const fr = cols[iF] || '', mc = cols[iM] || '';
      if (!fr || !mc) return;

      // Valider chaque champ
      const frCheck  = Security.validateText(fr, 'FR');
      const mcCheck  = Security.validateText(mc, 'MC');
      const phCheck  = Security.validateText(iPh >= 0 ? cols[iPh] || '' : '', 'Phonétique');
      const catCheck = Security.validateText(iC  >= 0 ? cols[iC]  || '' : 'import', 'Catégorie');

      if (!frCheck.ok || !mcCheck.ok) { parseErrors++; return; }

      const entry = {
        fr:  frCheck.value,
        mc:  mcCheck.value,
        ph:  phCheck.ok  ? phCheck.value  : '',
        cat: catCheck.ok ? catCheck.value : 'import',
        custom: true,
      };

      const existing = DB_WORDS.find(e => e.fr.toLowerCase() === fr.toLowerCase());
      existing ? conflicts.push({ entry, existing, choice: 'csv' }) : toImport.push(entry);
    });

    toImport.forEach(e => { DB_WORDS.push(e); State.customWords.push(e); });

    let msg = `✅ ${toImport.length} importé(s)`;
    if (parseErrors)     msg += `, ${parseErrors} ligne(s) invalide(s) ignorée(s)`;
    if (conflicts.length) {
      State.conflictQueue = [...conflicts];
      Conflict.open();
      msg += `. ⚠️ ${conflicts.length} conflit(s) à résoudre`;
    } else {
      buildCatBar();
      renderDict();
    }
    _status('csv-status', msg + '.');
  }

  // ── AJOUT MANUEL ─────────────────────────────────────────
  function addManual() {
    const rawFr  = document.getElementById('add-fr').value;
    const rawMc  = document.getElementById('add-mc').value;
    const rawPh  = document.getElementById('add-ph').value;
    const rawCat = document.getElementById('add-cat').value;

    const frCheck  = Security.validateText(rawFr, 'Français', { required: true });
    const mcCheck  = Security.validateText(rawMc, 'Monégasque', { required: true });
    const phCheck  = Security.validateText(rawPh, 'Phonétique');
    const catCheck = Security.validateText(rawCat || 'personnalisé', 'Catégorie');

    if (!frCheck.ok)  { _status('add-status', frCheck.error, true); return; }
    if (!mcCheck.ok)  { _status('add-status', mcCheck.error, true); return; }

    if (DB_WORDS.find(e => e.fr.toLowerCase() === frCheck.value.toLowerCase())) {
      _status('add-status', `"${frCheck.value}" existe déjà.`, true);
      return;
    }

    const entry = {
      fr:  frCheck.value,
      mc:  mcCheck.value,
      ph:  phCheck.ok  ? phCheck.value  : '',
      cat: catCheck.ok ? catCheck.value : 'personnalisé',
      custom: true,
    };

    DB_WORDS.push(entry);
    State.customWords.push(entry);
    ['add-fr','add-mc','add-ph','add-cat'].forEach(id => document.getElementById(id).value = '');
    buildCatBar();
    renderDict();
    _status('add-status', `✅ "${frCheck.value}" → "${mcCheck.value}" ajouté !`);
  }

  function exportCSV() {
    const rows = DB_WORDS.map(e =>
      _csvCell(e.fr) + ',' + _csvCell(e.mc) + ',' + _csvCell(e.ph||'') + ',' + _csvCell(e.cat)
    ).join('\n');
    const blob = new Blob(['\uFEFFfr,mc,phonetic,cat\n' + rows], { type: 'text/csv;charset=utf-8' });
    Security.safeDownload(blob, 'dictionnaire-monegasque.csv');
  }

  function clearCustom() {
    if (!State.customWords.length) { _status('add-status', 'Aucun mot personnalisé.', true); return; }
    State.customWords.forEach(w => { const i = DB_WORDS.indexOf(w); if (i >= 0) DB_WORDS.splice(i, 1); });
    State.customWords = [];
    buildCatBar();
    renderDict();
    _status('add-status', 'Mots personnalisés supprimés.');
  }

  // ── Utilitaires ──────────────────────────────────────────
  function _csvCell(s) {
    return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function _status(id, msg, isErr = false) {
    showStatus(id, msg, isErr);
  }

  return {
    open, close, logout, tryLogin, switchTab: _switchTab,
    validateSugg, rejectSugg,
    bddFilter, bddPage, toggleEdit, saveCell, delWord,
    openVerbTab, deleteVerb, handleVerbJSON,
    csvDrag, csvDrop, handleCSV,
    addManual, exportCSV, clearCustom,
  };
})();

// ── CLAVIER IPA ──────────────────────────────────────────────
const IPA = (() => {
  'use strict';
  let _target = null;

  const SYMBOLS = [
    { label:'Voyelles orales',   syms:['a','e','i','o','u','ə','ɑ','ɒ','ɔ','ø','œ','æ','y','ɯ','ɪ','ʊ','ɛ','ɜ'] },
    { label:'Voyelles nasales',  syms:['ɑ̃','ɛ̃','œ̃','ɔ̃','ã','ẽ','ĩ','õ','ũ'] },
    { label:'Plosives',          syms:['p','b','t','d','k','g','ʔ','ʈ','ɖ','c','ɟ'] },
    { label:'Fricatives',        syms:['f','v','s','z','ʃ','ʒ','x','χ','ɣ','ħ','ʁ','θ','ð','ɸ','β'] },
    { label:'Affriquées',        syms:['tʃ','dʒ','ts','dz'] },
    { label:'Nasales/Latérales', syms:['m','n','ŋ','ɲ','ɱ','l','ʎ','ɭ','r','ɾ','ʀ'] },
    { label:'Semi-voyelles',     syms:['w','j','ɥ','ʋ'] },
    { label:'Diacritiques',      syms:['ː','ˈ','ˌ','͡','ʰ','ʷ'] },
    { label:'Monaco / ligures',  syms:['ü','ö','ï','ä','ë','à','è','ù','ì','ò','â','ê','î','ô','û','æ','œ','ç'] },
  ];

  function _getInput() {
    if (!_target) return null;
    if (_target === 'add-ph')         return document.getElementById('add-ph');
    if (_target.startsWith('sugg-'))  return document.getElementById('edit-ph-' + _target.replace('sugg-',''));
    if (_target.startsWith('bdd-'))   return document.querySelector('#brow-' + _target.replace('bdd-','') + ' .bdd-ph-inp');
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

  function clearField() {
    const i = _getInput();
    if (i) { i.value = ''; i.dispatchEvent(new Event('change')); }
  }

  function _buildKeyboard() {
    const wrap = document.getElementById('ipa-keyboard');
    if (!wrap || wrap.dataset.built) return;
    wrap.dataset.built = '1';
    wrap.innerHTML = SYMBOLS.map(group => {
      const btns = group.syms.map(s => {
        // Créer les boutons sans onclick inline → event listener
        return `<button class="ipa-key" data-sym="${Security.esc(s)}">${Security.esc(s)}</button>`;
      }).join('');
      return `<div style="margin-bottom:12px">
        <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.45);margin-bottom:5px">
          ${Security.esc(group.label)}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${btns}</div>
      </div>`;
    }).join('');

    // Event listeners délégués au lieu de onclick inline par symbole
    wrap.addEventListener('click', e => {
      const btn = e.target.closest('.ipa-key');
      if (btn) IPA.insert(btn.dataset.sym);
    });
  }

  return { open, close, insert, backspace, clear: clearField };
})();

// ── CONFLITS CSV ─────────────────────────────────────────────
const Conflict = (() => {
  'use strict';

  function open() {
    const c = document.getElementById('conflict-list');
    // Toutes les données passent par Security.esc()
    c.innerHTML = State.conflictQueue.map((cf, i) =>
      `<div class="conflict-item">
        <h4>⚠️ Conflit #${i+1} — « ${Security.esc(cf.entry.fr)} »</h4>
        <div class="conflict-grid">
          <div class="conflict-choice${cf.choice==='db' ? ' selected' : ''}"
               onclick="Conflict.setChoice(${i},'db')" id="cc-db-${i}">
            <span class="badge badge-blue badge-choice">Existant</span>
            <div class="word">${Security.esc(cf.existing.fr)}</div>
            <div class="trans">${Security.esc(cf.existing.mc)}</div>
            <div style="font-size:.72rem;color:#999">[${Security.esc(cf.existing.ph||'')}] · ${Security.esc(cf.existing.cat)}</div>
          </div>
          <div class="conflict-choice${cf.choice==='csv' ? ' selected' : ''}"
               onclick="Conflict.setChoice(${i},'csv')" id="cc-csv-${i}">
            <span class="badge badge-vert badge-choice">CSV</span>
            <div class="word">${Security.esc(cf.entry.fr)}</div>
            <div class="trans">${Security.esc(cf.entry.mc)}</div>
            <div style="font-size:.72rem;color:#999">[${Security.esc(cf.entry.ph||'')}] · ${Security.esc(cf.entry.cat)}</div>
          </div>
        </div>
      </div>`
    ).join('');
    document.getElementById('conflict-overlay').classList.add('show');
  }

  function close() {
    document.getElementById('conflict-overlay').classList.remove('show');
    buildCatBar();
    renderDict();
  }

  function setChoice(idx, choice) {
    // Whitelist des choix valides
    if (!['db','csv','skip'].includes(choice)) return;
    if (!State.conflictQueue[idx]) return;
    State.conflictQueue[idx].choice = choice;
    ['db','csv'].forEach(k => {
      const el = document.getElementById('cc-'+k+'-'+idx);
      if (el) el.className = 'conflict-choice' + (choice === k ? ' selected' : '');
    });
  }

  function resolveAll(choice) {
    if (!['db','csv','skip'].includes(choice)) return;
    State.conflictQueue.forEach((_, i) => setChoice(i, choice));
  }

  function apply() {
    let replaced = 0, kept = 0;
    State.conflictQueue.forEach(cf => {
      if (cf.choice === 'csv') {
        const idx = DB_WORDS.findIndex(e => e.fr.toLowerCase() === cf.entry.fr.toLowerCase());
        if (idx >= 0) { DB_WORDS[idx] = { ...cf.entry }; replaced++; } else kept++;
      } else {
        kept++;
      }
    });
    State.conflictQueue = [];
    document.getElementById('conflict-overlay').classList.remove('show');
    buildCatBar();
    renderDict();
    showStatus('csv-status', `✅ ${replaced} remplacé(s), ${kept} conservé(s).`);
  }

  return { open, close, setChoice, resolveAll, apply };
})();
