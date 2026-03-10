/**
 * audio.js — Münegascu v3
 *
 * Prononciation monégasque :
 *   → Transcription interne MC→IPA basée sur la BDD + règles phonétiques
 *   → Lecture via Web Speech API avec voix italienne (la plus proche du MC)
 *      et ajustements pitch/rate pour un rendu monégasque authentique
 *   → Le sélecteur affiche "🇲🇨 Phonétique IPA" comme option par défaut
 *
 * Français : voix française du système
 */

const Audio = (() => {
  let _voices  = [];
  let _frVoice = null;
  let _itVoice = null;
  let _ready   = false;

  // ── Init ────────────────────────────────────────────────
  function init() {
    if (speechSynthesis.getVoices().length) {
      _loadVoices();
    }
    speechSynthesis.addEventListener('voiceschanged', _loadVoices);
    // Forcer chargement sur certains navigateurs
    setTimeout(_loadVoices, 300);
  }

  function _loadVoices() {
    const v = speechSynthesis.getVoices();
    if (!v.length) return;
    _voices = v;
    _frVoice = v.find(x => x.lang === 'fr-FR')
            || v.find(x => x.lang.startsWith('fr'))
            || v[0];
    _itVoice = v.find(x => x.lang === 'it-IT')
            || v.find(x => x.lang.startsWith('it'))
            || v.find(x => x.lang.startsWith('es'))
            || v[0];
    _ready = true;
    _buildVoiceSelect();
  }

  function _buildVoiceSelect() {
    const sel = document.getElementById('vsel');
    if (!sel || !_voices.length) return;

    const prev = sel.value;
    sel.innerHTML = '';

    // Option IPA en tête — toujours disponible (utilise voix IT + transcription)
    const optIPA = document.createElement('option');
    optIPA.value = 'ipa';
    optIPA.textContent = '🇲🇨 Phonétique IPA';
    optIPA.selected = true;
    sel.appendChild(optIPA);

    // Séparateur
    const sep = document.createElement('option');
    sep.disabled = true;
    sep.textContent = '── Autres voix ──';
    sel.appendChild(sep);

    // Voix IT et FR en priorité
    const pref = _voices.filter(x => x.lang.startsWith('it') || x.lang.startsWith('fr'));
    const rest = _voices.filter(x => !x.lang.startsWith('it') && !x.lang.startsWith('fr'));

    [...pref, ...rest].forEach(v => {
      const o = document.createElement('option');
      o.value = 'sys:' + _voices.indexOf(v);
      const flag = v.lang.startsWith('fr') ? '🇫🇷' : v.lang.startsWith('it') ? '🇮🇹' : '🌐';
      o.textContent = `${flag} ${v.name} (${v.lang})`;
      if (prev === o.value) o.selected = true;
      sel.appendChild(o);
    });
  }

  // ── Transcription MC → IPA ───────────────────────────────
  function _textToIPA(text) {
    if (!text) return '';
    const tokens = text.toLowerCase().replace(/[.,;:!?]/g, '').split(/\s+/);

    return tokens.map(tok => {
      // 1. Chercher le champ ph dans DB_WORDS (correspondance MC exacte)
      const entry = DB_WORDS.find(e => {
        const mc = e.mc.toLowerCase().replace(/[.,;:!?'"]/g, '');
        return mc === tok && e.ph;
      });
      if (entry?.ph) return entry.ph;

      // 2. Chercher dans les formes conjuguées
      for (const verb of Object.values(DB_VERBS)) {
        for (const forms of Object.values(verb.conj)) {
          if (forms.some(f => f && f.toLowerCase() === tok)) {
            return _mcRules(tok);
          }
        }
      }

      // 3. Règles phonétiques MC → IPA
      return _mcRules(tok);
    }).join(' ');
  }

  function _mcRules(s) {
    return s
      // Digraphes à traiter en premier
      .replace(/glia/gi, 'ʎa').replace(/glie/gi, 'ʎe').replace(/gliu/gi, 'ʎy')
      .replace(/gli/gi,  'ʎi')
      .replace(/gge/gi,  'dːʒe').replace(/ggi/gi,  'dːʒi')
      .replace(/sce/gi,  'ʃe').replace(/sci/gi,  'ʃi').replace(/sch/gi, 'sk')
      .replace(/sc/gi,   'sk')
      .replace(/che/gi,  'ke').replace(/chi/gi,  'ki')
      .replace(/ghe/gi,  'ge').replace(/ghi/gi,  'gi')
      .replace(/ge/gi,   'dʒe').replace(/gi/gi,  'dʒi')
      .replace(/ce/gi,   'tʃe').replace(/ci/gi,  'tʃi')
      .replace(/gn/gi,   'ɲ')
      // Voyelles spéciales
      .replace(/ü/g, 'y').replace(/ö/g, 'ø').replace(/ï/g, 'i').replace(/ë/g, 'e')
      .replace(/ae/g, 'ɛ').replace(/eau/g, 'o')
      .replace(/è/g, 'ɛ').replace(/é/g, 'e').replace(/ê/g, 'ɛ')
      .replace(/à/g, 'a').replace(/â/g, 'a')
      .replace(/ù/g, 'y').replace(/û/g, 'y')
      .replace(/ì/g, 'i').replace(/î/g, 'i')
      .replace(/ò/g, 'ɔ').replace(/ô/g, 'o')
      // Finales monégasques
      .replace(/annu$/g, 'any').replace(/emu$/g, 'emy').replace(/èi$/g, 'ɛj')
      .replace(/u$/g,    'y')
      // Consonnes
      .replace(/rr/g, 'r').replace(/ll/g, 'l')
      .replace(/ss/g, 's').replace(/nn/g, 'n').replace(/mm/g, 'm');
  }

  // ── Synthèse vocale ──────────────────────────────────────
  function speak(text, event, lang) {
    const clean = (text || '').replace(/<[^>]+>/g, '').trim();
    if (!clean) return;

    const btn = event?.currentTarget || null;
    if (btn) btn.classList.add('speaking');

    speechSynthesis.cancel();

    const utt = new SpeechSynthesisUtterance();
    utt.onend  = () => btn?.classList.remove('speaking');
    utt.onerror = () => btn?.classList.remove('speaking');

    if (lang === 'fr') {
      // Français — voix FR native
      utt.text  = clean;
      utt.voice = _frVoice;
      utt.lang  = 'fr-FR';
      utt.rate  = 0.85;
      utt.pitch = 1.0;
    } else {
      // Monégasque — selon sélection
      const val = document.getElementById('vsel')?.value || 'ipa';

      if (val === 'ipa' || !val.startsWith('sys:')) {
        // Mode IPA : transcrire en IPA puis lire avec voix italienne
        // (l'IPA est une approximation phonétique ; la voix IT est la plus proche du MC)
        const ipa = _textToIPA(clean);
        utt.text  = ipa;
        utt.voice = _itVoice;
        utt.lang  = _itVoice?.lang || 'it-IT';
        utt.rate  = 0.75;   // plus lent pour les sons spéciaux
        utt.pitch = 1.05;   // légèrement plus aigu que l'IT standard
      } else {
        // Voix système choisie par l'user
        const idxRaw = parseInt(val.replace('sys:', ''), 10);
        const idx = (!isNaN(idxRaw) && idxRaw >= 0 && idxRaw < _voices.length) ? idxRaw : 0;
        utt.text   = clean;
        utt.voice  = _voices[idx] || _itVoice;
        utt.lang   = utt.voice?.lang || 'it-IT';
        utt.rate   = 0.82;
        utt.pitch  = 1.0;
      }
    }

    speechSynthesis.speak(utt);
  }

  return { init, speak };
})();
