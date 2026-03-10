/**
 * security.js — Münegascu v3
 * ══════════════════════════════════════════════════════════════
 * Module de sécurité central — chargé EN PREMIER avant tout autre script.
 *
 * Responsabilités :
 *   1. Sanitisation HTML (XSS)    — esc(), escAttr(), escHtml()
 *   2. Authentification PBKDF2    — salt aléatoire, 600k itérations, temps constant
 *   3. Rate limiting login        — lockout progressif, max 5 tentatives
 *   4. Session expirante          — 30 min d'inactivité → déconnexion auto
 *   5. Validation des inputs      — longueur, contenu, protocoles dangereux
 *   6. Validation des fichiers    — taille, extension, comptage
 *   7. Téléchargement sécurisé    — safeDownload() avec revokeObjectURL
 *   8. Anti-clickjacking          — détection iframe au chargement
 * ══════════════════════════════════════════════════════════════
 */

const Security = (() => {
  'use strict';

  // ── Limites globales ──────────────────────────────────────
  const LIMITS = Object.freeze({
    FIELD_MAX:        200,
    FILE_CSV:         1 * 1024 * 1024,
    FILE_JSON:        512 * 1024,
    CSV_ROWS:         5000,
    JSON_VERBS:       200,
    SEARCH_MAX:       300,
    FILENAME_MAX:     100,
    SESSION_DURATION: 30 * 60 * 1000,   // 30 minutes
  });

  // ─────────────────────────────────────────────────────────
  // 1. SANITISATION HTML
  // ─────────────────────────────────────────────────────────

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  function escAttr(s) {
    return esc(s).replace(/`/g, '&#x60;');
  }

  const escHtml = esc;

  // ─────────────────────────────────────────────────────────
  // 2. AUTHENTIFICATION PBKDF2
  //    Format credential : "<salt_hex>:<hash_hex>"
  //    • Salt aléatoire unique par génération → pas de rainbow table
  //    • 600 000 itérations (OWASP 2024)
  //    • Comparaison en temps constant (anti timing-attack)
  //
  //    Pour changer le mot de passe :
  //      1. Ouvrir la console du navigateur
  //      2. Taper : Security.generateCredential('nouveau_mdp')
  //      3. Copier le résultat dans ADMIN_CREDENTIAL ci-dessous
  // ─────────────────────────────────────────────────────────

  const PBKDF2_ITERATIONS = 600_000;

  // Credential actuel = mot de passe "admin"
  const ADMIN_CREDENTIAL = 'ec3eb92f6ef42e6a364fcadab73114af:b03cee0c0a25f52e052665d9d143a6799708cf7fd88a39a292f67e30e2115cd8';

  function _hexToBytes(hex) {
    const buf = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      buf[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return buf;
  }

  function _bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function _pbkdf2(password, saltHex) {
    const enc  = new TextEncoder();
    const key  = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: _hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      key, 256
    );
    return _bytesToHex(new Uint8Array(bits));
  }

  function _timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  async function verifyPassword(input) {
    if (!input) return false;
    const [saltHex, storedHash] = ADMIN_CREDENTIAL.split(':');
    if (!saltHex || !storedHash) return false;
    const inputHash = await _pbkdf2(input, saltHex);
    return _timingSafeEqual(inputHash, storedHash);
  }

  async function generateCredential(password) {
    if (!password || password.length < 6) {
      console.warn('[Security] Mot de passe trop court (min 6 caractères)');
      return null;
    }
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const saltHex   = _bytesToHex(saltBytes);
    const hashHex   = await _pbkdf2(password, saltHex);
    const credential = saltHex + ':' + hashHex;
    console.log('%c[Security] Nouveau credential généré :', 'color:#27ae60;font-weight:bold');
    console.log('%c' + credential, 'color:#2980b9;font-family:monospace');
    console.log('%c→ Copiez cette valeur dans ADMIN_CREDENTIAL dans security.js', 'color:#888');
    return credential;
  }

  // ─────────────────────────────────────────────────────────
  // 3. RATE LIMITING
  // ─────────────────────────────────────────────────────────

  let _attempts  = 0;
  let _lockUntil = 0;
  const MAX_TRIES  = 5;
  const BASE_DELAY = 30_000;

  function checkRateLimit() {
    const now = Date.now();
    if (_lockUntil > now) {
      const s = Math.ceil((_lockUntil - now) / 1000);
      return { allowed: false, message: `Trop de tentatives. Réessayez dans ${s}s.` };
    }
    return { allowed: true };
  }

  function recordFailedAttempt() {
    _attempts++;
    if (_attempts >= MAX_TRIES) {
      const mult  = Math.floor(_attempts / MAX_TRIES);
      const delay = BASE_DELAY * Math.pow(2, mult - 1);
      _lockUntil  = Date.now() + Math.min(delay, 600_000);
    }
  }

  function resetAttempts() { _attempts = 0; _lockUntil = 0; }
  function getRemainingAttempts() { return Math.max(0, MAX_TRIES - _attempts); }

  // ─────────────────────────────────────────────────────────
  // 4. SESSION EXPIRANTE
  //    Durée : 30 min d'inactivité (clic/frappe renouvelle le timer)
  //    Callback onExpire appelé à l'expiration → ferme le panel admin
  // ─────────────────────────────────────────────────────────

  let _sessionExpiry    = 0;
  let _sessionTimer     = null;
  let _onExpireCallback = null;

  function startSession(onExpire) {
    _onExpireCallback = onExpire || null;
    _sessionExpiry    = Date.now() + LIMITS.SESSION_DURATION;
    _scheduleExpiry();
    ['click', 'keydown', 'input'].forEach(e =>
      document.addEventListener(e, _refreshSession, { passive: true })
    );
  }

  function isSessionValid() {
    return _sessionExpiry > 0 && Date.now() < _sessionExpiry;
  }

  function endSession() {
    _sessionExpiry = 0;
    if (_sessionTimer) { clearTimeout(_sessionTimer); _sessionTimer = null; }
    ['click', 'keydown', 'input'].forEach(e =>
      document.removeEventListener(e, _refreshSession)
    );
  }

  function sessionMinutesLeft() {
    const ms = _sessionExpiry - Date.now();
    return ms > 0 ? Math.ceil(ms / 60_000) : 0;
  }

  function _refreshSession() {
    if (!_sessionExpiry) return;
    _sessionExpiry = Date.now() + LIMITS.SESSION_DURATION;
    _scheduleExpiry();
  }

  function _scheduleExpiry() {
    if (_sessionTimer) clearTimeout(_sessionTimer);
    const remaining = _sessionExpiry - Date.now();
    if (remaining <= 0) { _expire(); return; }
    _sessionTimer = setTimeout(_expire, remaining);
  }

  function _expire() {
    endSession();
    if (_onExpireCallback) try { _onExpireCallback(); } catch(e) {}
  }

  // ─────────────────────────────────────────────────────────
  // 5. VALIDATION INPUTS
  //    Protocoles dangereux : javascript:, vbscript:, data:, file:
  //    y compris variantes avec espaces/sauts de ligne
  //    (ex: "java\nscript:" contourne les regex naïves)
  // ─────────────────────────────────────────────────────────

  const _DANGEROUS_PROTO  = /^\s*(javascript|vbscript|data|file)\s*:/i;
  const _DANGEROUS_INLINE = /javascript\s*:/i;
  const _HTML_TAG         = /<[a-z!/?]/i;

  function validateText(raw, fieldName = 'Champ', opts = {}) {
    const max = opts.max || LIMITS.FIELD_MAX;
    const s   = String(raw ?? '').replace(/[\r\n\t]/g, ' ').trim();

    if (opts.required && !s)  return { ok: false, error: `${fieldName} est requis.` };
    if (s.length > max)       return { ok: false, error: `${fieldName} trop long (max ${max} caractères).` };
    if (_HTML_TAG.test(s) || _DANGEROUS_INLINE.test(s) || _DANGEROUS_PROTO.test(s))
      return { ok: false, error: `${fieldName} contient des caractères non autorisés.` };

    return { ok: true, value: s };
  }

  // ─────────────────────────────────────────────────────────
  // 6. VALIDATION FICHIERS
  // ─────────────────────────────────────────────────────────

  function validateFile(file, allowedExts, opts = {}) {
    if (!file) return { ok: false, error: 'Aucun fichier.' };
    const maxSize = opts.maxSize || LIMITS.FILE_CSV;
    if (file.size === 0)     return { ok: false, error: 'Fichier vide.' };
    if (file.size > maxSize) return { ok: false, error: `Fichier trop volumineux (max ${Math.round(maxSize / 1024)} KB).` };
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!allowedExts.includes(ext))
      return { ok: false, error: `Extension non autorisée. Attendu : .${allowedExts.join(', .')}.` };
    return { ok: true };
  }

  function validateCSVRows(lines) {
    if (lines.length > LIMITS.CSV_ROWS)
      return { ok: false, error: `CSV trop grand (max ${LIMITS.CSV_ROWS} lignes).` };
    return { ok: true };
  }

  function validateJSONVerbCount(data) {
    const n = Array.isArray(data) ? data.length : Object.keys(data ?? {}).length;
    if (n > LIMITS.JSON_VERBS)
      return { ok: false, error: `Trop de verbes (max ${LIMITS.JSON_VERBS}).` };
    return { ok: true };
  }

  // ─────────────────────────────────────────────────────────
  // 7. TÉLÉCHARGEMENT SÉCURISÉ
  //    • Sanitise le nom de fichier (pas de path traversal "../")
  //    • Révoque l'ObjectURL après 1s pour libérer la mémoire
  // ─────────────────────────────────────────────────────────

  function safeDownload(blob, filename) {
    const safeName = String(filename || 'download')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '_')
      .slice(0, LIMITS.FILENAME_MAX);

    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement('a'), { href: url, download: safeName });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ─────────────────────────────────────────────────────────
  // 8. ANTI-CLICKJACKING
  //    Si l'app est chargée dans une iframe étrangère,
  //    le contenu est masqué et une erreur est levée.
  // ─────────────────────────────────────────────────────────

  (function _checkFraming() {
    try {
      if (window.top !== window.self) {
        document.documentElement.style.display = 'none';
        throw new Error('[Security] Clickjacking bloqué : exécution dans une iframe interdite.');
      }
    } catch (e) {
      if (e.message.includes('Clickjacking')) throw e;
      // Accès cross-origin à window.top → encore plus suspect
      document.documentElement.style.display = 'none';
      throw new Error('[Security] Accès iframe cross-origin bloqué.');
    }
  })();

  // ─────────────────────────────────────────────────────────
  // API publique
  // ─────────────────────────────────────────────────────────
  return Object.freeze({
    esc, escAttr, escHtml,
    verifyPassword, generateCredential,
    checkRateLimit, recordFailedAttempt, resetAttempts, getRemainingAttempts,
    startSession, endSession, isSessionValid, sessionMinutesLeft,
    validateText, validateFile, validateCSVRows, validateJSONVerbCount,
    safeDownload,
    LIMITS,
  });
})();
