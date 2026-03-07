/**
 * translator.js — Münegascu
 * Moteur de traduction intelligent FR ↔ MC
 *
 * Expose : Translator.translate(text, dirFR) → { result, tokens, confidence }
 */

const Translator = (() => {

  // ── Helpers ─────────────────────────────────────────────
  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

  function translateRaw(text, toMC) {
    return text.trim().split(/\s+/).map(w => {
      const e = DB_WORDS.find(x => x.fr.toLowerCase() === w.toLowerCase());
      return e ? (toMC ? e.mc : e.fr) : w;
    }).join(' ');
  }

  // ── Traduction principale ────────────────────────────────
  function translate(input, dirFR = true) {
    const text = input.trim();
    if (!text) return { result: '', tokens: [], confidence: 'none' };

    // 1. Correspondance phrase exacte
    const exactPhrase = DB_PHRASES.find(p =>
      dirFR
        ? p.fr.toLowerCase() === text.toLowerCase()
        : p.mc.toLowerCase() === text.toLowerCase()
    );
    if (exactPhrase) {
      const result = dirFR ? exactPhrase.mc : exactPhrase.fr;
      return {
        result,
        tokens: [{ w: text, type: 'phrase', tr: result }],
        confidence: 'high',
      };
    }

    // 2. Patterns grammaticaux (FR→MC seulement)
    if (dirFR) {
      for (const pat of DB_PATTERNS) {
        const m = text.match(pat.re);
        if (m) {
          const res = pat.fn(m);
          if (res) return { result: res.mc, tokens: res.tokens, confidence: 'medium' };
        }
      }
    }

    // 3. Traduction token par token
    return _tokenTranslate(text, dirFR);
  }

  function _tokenTranslate(text, dirFR) {
    const rawTokens = text.match(/[\wÀ-ÿ''`-]+|[?!.,;:…]/g) || [];
    const resultParts = [];
    const tokens = [];
    let i = 0;

    while (i < rawTokens.length) {
      const tok = rawTokens[i];

      // Ponctuation
      if (/^[?!.,;:…]$/.test(tok)) {
        resultParts.push(tok);
        tokens.push({ w: tok, type: 'punct' });
        i++; continue;
      }

      const clean    = tok.replace(/[?!.,;:]/g, '');
      const cleanLow = clean.toLowerCase();

      // a. Multi-mots (2 puis 3 tokens)
      let multiFound = false;
      for (let len = 3; len >= 2; len--) {
        const multi    = rawTokens.slice(i, i + len).join(' ');
        const multiLow = multi.toLowerCase();
        const entry    = dirFR
          ? DB_WORDS.find(e => e.fr.toLowerCase() === multiLow)
          : DB_WORDS.find(e => e.mc.toLowerCase() === multiLow);
        if (entry) {
          const tr = dirFR ? entry.mc : entry.fr;
          resultParts.push(tr);
          tokens.push({ w: multi, type: 'found', tr });
          i += len; multiFound = true; break;
        }
      }
      if (multiFound) continue;

      // b. Mot seul dans le dictionnaire
      const entry = dirFR
        ? DB_WORDS.find(e => e.fr.toLowerCase() === cleanLow)
        : DB_WORDS.find(e => e.mc.toLowerCase() === cleanLow);
      if (entry) {
        const tr = dirFR ? entry.mc : entry.fr;
        const isSentStart = resultParts.length === 0 || /^[.!?]$/.test(resultParts[resultParts.length - 1]);
        resultParts.push(isSentStart ? capitalize(tr) : tr);
        tokens.push({ w: clean, type: 'found', tr });
        i++; continue;
      }

      // c. Forme verbale fléchie (FR→MC)
      if (dirFR && DB_VERB_FORMS_FR[cleanLow]) {
        const vf   = DB_VERB_FORMS_FR[cleanLow];
        const form = DB_VERBS[vf.v].conj[vf.t][vf.i];
        const isSentStart = resultParts.length === 0;
        resultParts.push(isSentStart ? capitalize(form) : form);
        tokens.push({ w: clean, type: 'smart', tr: form, note: `${vf.v} — ${vf.t} (${DB_PRONS_MC[vf.i]})` });
        i++; continue;
      }

      // d. Nom propre (majuscule hors début de phrase)
      const isSentStart = resultParts.length === 0 || /^[.!?]$/.test(resultParts[resultParts.length - 1]);
      if (!isSentStart && /^[A-ZÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜ]/.test(clean)) {
        resultParts.push(clean);
        tokens.push({ w: clean, type: 'proper' });
        i++; continue;
      }

      // e. Inconnu
      resultParts.push(clean);
      tokens.push({ w: clean, type: 'unknown' });
      i++;
    }

    const result = resultParts.join(' ').replace(/\s+([?!.,;:])/g, '$1');
    const unknownCount = tokens.filter(t => t.type === 'unknown').length;
    const confidence = unknownCount === 0 ? 'high'
      : unknownCount < tokens.length / 2 ? 'medium'
      : 'low';

    return { result, tokens, confidence };
  }

  return { translate };
})();
