/**
 * audio.js — Münegascu
 * Prononciation via Web Speech API (aucune clé requise)
 *
 * Expose : Audio.speak(text, event?, lang?)
 *          Audio.init()
 */

const Audio = (() => {
  let voices   = [];
  let itVoice  = null;
  let frVoice  = null;

  function init() {
    _loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = _loadVoices;
    }
  }

  function _loadVoices() {
    voices  = speechSynthesis.getVoices();
    itVoice = voices.find(v => v.lang.startsWith('it'))
           || voices.find(v => v.lang.startsWith('es'))
           || voices[0];
    frVoice = voices.find(v => v.lang.startsWith('fr')) || voices[0];

    const sel = document.getElementById('vsel');
    if (!sel || !voices.length) return;

    sel.innerHTML = '';
    const pref = voices.filter(v => v.lang.startsWith('it') || v.lang.startsWith('fr'));
    const rest = voices.filter(v => !v.lang.startsWith('it') && !v.lang.startsWith('fr'));

    [...pref, ...rest].forEach(v => {
      const o = document.createElement('option');
      o.value       = voices.indexOf(v);
      o.textContent = `${v.name} (${v.lang})`;
      if (v === itVoice) o.selected = true;
      sel.appendChild(o);
    });
  }

  function _getSelectedVoice() {
    const sel = document.getElementById('vsel');
    return (sel && voices.length) ? (voices[parseInt(sel.value)] || itVoice) : itVoice;
  }

  function speak(text, event, lang = 'mc') {
    const clean = (text || '').replace(/<[^>]+>/g, '').trim();
    if (!clean) return;

    speechSynthesis.cancel();

    const btn = event?.currentTarget;
    if (btn) {
      btn.classList.add('speaking');
      setTimeout(() => btn.classList.remove('speaking'), 2500);
    }

    const utt = new SpeechSynthesisUtterance(clean);
    if (lang === 'fr') {
      utt.voice = frVoice;
      utt.lang  = 'fr-FR';
    } else {
      utt.voice = _getSelectedVoice();
      utt.lang  = utt.voice?.lang || 'it-IT';
    }
    utt.rate  = 0.82;
    utt.pitch = 1;
    utt.onend = () => btn?.classList.remove('speaking');

    speechSynthesis.speak(utt);
  }

  return { init, speak };
})();
