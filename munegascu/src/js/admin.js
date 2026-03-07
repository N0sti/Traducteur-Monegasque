/**
 * admin.js — Münegascu
 * Panneau d'administration : authentification, suggestions, import CSV, conflits
 */

const Admin = (() => {

  // ─────────────────────────────────────────────────────────
  // AUTHENTIFICATION
  // ─────────────────────────────────────────────────────────
  function open() {
    document.getElementById('admin-overlay').classList.add('show');
    if (State.adminLoggedIn) _showPanel();
  }

  function close() {
    document.getElementById('admin-overlay').classList.remove('show');
  }

  function tryLogin() {
    const pwd = document.getElementById('admin-pwd').value;
    const st  = document.getElementById('login-status');
    // ⚠️  En production : remplacer par une vérification serveur ou hash SHA-256
    if (pwd === 'admin') {
      State.adminLoggedIn = true;
      document.getElementById('admin-login').style.display = 'none';
      _showPanel();
    } else {
      _status('login-status', 'Mot de passe incorrect.', true);
    }
  }

  function _showPanel() {
    document.getElementById('admin-panel').style.display = 'block';
    document.getElementById('admin-login').style.display = 'none';
    _renderSuggestions();
  }

  // ─────────────────────────────────────────────────────────
  // SUGGESTIONS
  // ─────────────────────────────────────────────────────────
  function _renderSuggestions() {
    const c       = document.getElementById('sugg-list');
    const pending = State.suggestions.filter(s => s.status === 'pending');
    document.getElementById('sugg-cnt').textContent = pending.length;

    if (!pending.length) {
      c.innerHTML = '<p style="color:#bbb;font-size:.85rem">Aucune suggestion en attente.</p>';
      return;
    }

    c.innerHTML = pending.map(s => `
      <div class="suggestion-card" id="sugg-${s.id}">
        <div class="sugg-meta">📅 ${s.date} · ${s.direction}</div>
        <div class="sugg-row">
          <div><div class="label">Texte original</div><div class="val">${s.original}</div></div>
          <div><div class="label">Traduction actuelle</div><div class="val mc">${s.currentTr}</div></div>
        </div>
        <div class="sugg-row">
          <div style="grid-column:1/3">
            <div class="label">Correction proposée</div>
            <div class="val mc">${s.proposed}</div>
          </div>
        </div>
        <div class="sugg-actions">
          <input type="text" class="admin-edit-input" id="edit-${s.id}" value="${s.proposed}" placeholder="Modifier…">
          <button class="btn-vert"  onclick="Admin.validateSugg(${s.id})">✅ Valider</button>
          <button class="btn-ghost" onclick="Admin.rejectSugg(${s.id})" style="color:var(--rouge)">❌ Rejeter</button>
        </div>
      </div>`).join('');
  }

  function validateSugg(id) {
    const s   = State.suggestions.find(x => x.id === id);
    if (!s) return;
    const val = document.getElementById('edit-' + id)?.value.trim();
    if (!val) return;

    if (s.direction === 'fr→mc') {
      const entry = DB_WORDS.find(e => e.fr.toLowerCase() === s.original.toLowerCase());
      if (entry) {
        entry.mc = val;
      } else {
        DB_PHRASES.push({ fr: s.original, mc: val });
      }
    } else {
      const entry = DB_WORDS.find(e => e.mc.toLowerCase() === s.original.toLowerCase());
      if (entry) entry.fr = val;
    }

    s.status = 'validated';
    _renderSuggestions();
    renderDict();
    _status('add-status', '✅ Correction validée et intégrée à la base de données !');
  }

  function rejectSugg(id) {
    const s = State.suggestions.find(x => x.id === id);
    if (s) s.status = 'rejected';
    _renderSuggestions();
  }

  // ─────────────────────────────────────────────────────────
  // IMPORT CSV
  // ─────────────────────────────────────────────────────────
  function csvDrag(e) {
    e.preventDefault();
    document.getElementById('csvbox').classList.add('drag');
  }

  function csvDrop(e) {
    e.preventDefault();
    document.getElementById('csvbox').classList.remove('drag');
    const f = e.dataTransfer.files[0];
    if (f) handleCSV(f);
  }

  function handleCSV(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => _parseCSV(ev.target.result);
    reader.readAsText(file, 'UTF-8');
  }

  function _parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) { _status('csv-status', 'Fichier vide ou invalide.', true); return; }

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const iF = headers.indexOf('fr');
    const iM = headers.indexOf('mc');
    const iPh = headers.indexOf('phonetic');
    const iC  = headers.indexOf('cat');

    if (iF < 0 || iM < 0) { _status('csv-status', 'Colonnes "fr" et "mc" requises.', true); return; }

    const toImport  = [];
    const conflicts = [];

    lines.slice(1).forEach(line => {
      if (!line.trim()) return;
      const cols = line.match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
      const fr   = cols[iF]  || '';
      const mc   = cols[iM]  || '';
      if (!fr || !mc) return;

      const entry    = { fr, mc, ph: iPh >= 0 ? cols[iPh] || '' : '', cat: iC >= 0 ? cols[iC] || 'import' : 'import', custom: true };
      const existing = DB_WORDS.find(e => e.fr.toLowerCase() === fr.toLowerCase());
      existing ? conflicts.push({ entry, existing, choice: 'csv' }) : toImport.push(entry);
    });

    toImport.forEach(e => { DB_WORDS.push(e); State.customWords.push(e); });

    if (conflicts.length > 0) {
      State.conflictQueue = [...conflicts];
      Conflict.open();
      _status('csv-status', `✅ ${toImport.length} mot(s) importé(s). ⚠️ ${conflicts.length} conflit(s) à résoudre.`);
    } else {
      buildCatBar(); renderDict();
      _status('csv-status', `✅ ${toImport.length} mot(s) importé(s) avec succès.`);
    }
  }

  // ─────────────────────────────────────────────────────────
  // AJOUT MANUEL
  // ─────────────────────────────────────────────────────────
  function addManual() {
    const fr  = document.getElementById('add-fr').value.trim();
    const mc  = document.getElementById('add-mc').value.trim();
    const ph  = document.getElementById('add-ph').value.trim();
    const cat = document.getElementById('add-cat').value.trim() || 'personnalisé';

    if (!fr || !mc) { _status('add-status', 'FR et MC sont requis.', true); return; }

    const existing = DB_WORDS.find(e => e.fr.toLowerCase() === fr.toLowerCase());
    if (existing) { _status('add-status', `"${fr}" existe déjà (${existing.mc}).`, true); return; }

    const entry = { fr, mc, ph, cat, custom: true };
    DB_WORDS.push(entry);
    State.customWords.push(entry);
    ['add-fr', 'add-mc', 'add-ph', 'add-cat'].forEach(id => document.getElementById(id).value = '');
    buildCatBar(); renderDict();
    _status('add-status', `✅ "${fr}" → "${mc}" ajouté !`);
  }

  function exportCSV() {
    const rows = DB_WORDS.map(e => `${e.fr},${e.mc},${e.ph || ''},${e.cat}`).join('\n');
    const blob = new Blob(['fr,mc,phonetic,cat\n' + rows], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'dictionnaire-monegasque.csv'; a.click();
  }

  function clearCustom() {
    if (!State.customWords.length) { _status('add-status', 'Aucun mot personnalisé.', true); return; }
    State.customWords.forEach(w => {
      const idx = DB_WORDS.indexOf(w);
      if (idx >= 0) DB_WORDS.splice(idx, 1);
    });
    State.customWords = [];
    buildCatBar(); renderDict();
    _status('add-status', 'Mots importés supprimés.');
  }

  function _status(id, msg, isErr = false) {
    showStatus(id, msg, isErr);
  }

  // API publique
  return { open, close, tryLogin, validateSugg, rejectSugg, csvDrag, csvDrop, handleCSV, addManual, exportCSV, clearCustom };
})();

// ─────────────────────────────────────────────────────────────
// GESTION DES CONFLITS CSV
// ─────────────────────────────────────────────────────────────
const Conflict = (() => {

  function open() {
    const c = document.getElementById('conflict-list');
    c.innerHTML = State.conflictQueue.map((cf, i) => `
      <div class="conflict-item">
        <h4>⚠️ Conflit #${i + 1} — « ${cf.entry.fr} »</h4>
        <div class="conflict-grid">
          <div class="conflict-choice${cf.choice === 'db' ? ' selected' : ''}"
               onclick="Conflict.setChoice(${i},'db')" id="cc-db-${i}">
            <span class="badge badge-blue badge-choice">Existant</span>
            <h5>Dans la base</h5>
            <div class="word">${cf.existing.fr}</div>
            <div class="trans">${cf.existing.mc}</div>
            <div style="font-size:.72rem;color:#999;margin-top:4px">[${cf.existing.ph || ''}] · ${cf.existing.cat}</div>
          </div>
          <div class="conflict-choice${cf.choice === 'csv' ? ' selected' : ''}"
               onclick="Conflict.setChoice(${i},'csv')" id="cc-csv-${i}">
            <span class="badge badge-vert badge-choice">CSV</span>
            <h5>Depuis CSV</h5>
            <div class="word">${cf.entry.fr}</div>
            <div class="trans">${cf.entry.mc}</div>
            <div style="font-size:.72rem;color:#999;margin-top:4px">[${cf.entry.ph || ''}] · ${cf.entry.cat}</div>
          </div>
        </div>
      </div>`).join('');

    document.getElementById('conflict-overlay').classList.add('show');
  }

  function close() {
    document.getElementById('conflict-overlay').classList.remove('show');
    buildCatBar(); renderDict();
  }

  function setChoice(idx, choice) {
    State.conflictQueue[idx].choice = choice;
    document.getElementById('cc-db-'  + idx).className = 'conflict-choice' + (choice === 'db'  ? ' selected' : '');
    document.getElementById('cc-csv-' + idx).className = 'conflict-choice' + (choice === 'csv' ? ' selected' : '');
  }

  function resolveAll(choice) {
    State.conflictQueue.forEach((_, i) => setChoice(i, choice));
  }

  function apply() {
    let replaced = 0, kept = 0, skipped = 0;
    State.conflictQueue.forEach(cf => {
      if (cf.choice === 'csv') {
        const idx = DB_WORDS.findIndex(e => e.fr.toLowerCase() === cf.entry.fr.toLowerCase());
        if (idx >= 0) { DB_WORDS[idx] = { ...cf.entry }; replaced++; }
      } else if (cf.choice === 'db') {
        kept++;
      } else {
        skipped++;
      }
    });
    State.conflictQueue = [];
    document.getElementById('conflict-overlay').classList.remove('show');
    buildCatBar(); renderDict();
    showStatus('csv-status', `✅ Conflits résolus : ${replaced} remplacé(s), ${kept} conservé(s), ${skipped} ignoré(s).`);
  }

  return { open, close, setChoice, resolveAll, apply };
})();
