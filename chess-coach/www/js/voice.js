/* Coach voice: reads comments aloud with the device's text-to-speech.
   Uses the native plugin inside the Android app and the browser's speech engine elsewhere. */
(function (g) {
  const RW = (g.RW = g.RW || {});
  const Plugins = (g.Capacitor && g.Capacitor.Plugins) || {};
  const PIECE = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight' };
  let enabled = false, voice = null;

  /* "Nxf3+" -> "knight takes F 3, check". Letters are upper-cased so they are read as letters. */
  function speakable(text) {
    return String(text)
      .replace(/O-O-O[+#]?/g, 'castles queenside')
      .replace(/O-O[+#]?/g, 'castles kingside')
      .replace(/\b([KQRBN]?)([a-h]?[1-8]?)(x?)([a-h])([1-8])(=[QRBN])?([+#]?)/g, (all, p, dis, x, f, r, promo, suf) => {
        let s = '';
        if (p) s += PIECE[p] + ' ';
        if (dis) s += dis.toUpperCase().split('').join(' ') + ' ';
        if (x) s += 'takes ';
        s += f.toUpperCase() + ' ' + r;
        if (promo) s += ' promotes to ' + PIECE[promo[1]];
        if (suf === '+') s += ', check';
        if (suf === '#') s += ', checkmate';
        return s;
      })
      .replace(/\s+/g, ' ')
      .trim();
  }

  function pickVoice() {
    if (!g.speechSynthesis) return;
    const all = g.speechSynthesis.getVoices() || [];
    const en = all.filter((v) => /^en[-_]/i.test(v.lang));
    const prefer = [/natural/i, /google us english/i, /samantha/i, /aria|jenny/i, /en[-_]us/i];
    voice = null;
    for (const re of prefer) {
      voice = en.find((v) => re.test(v.name) || re.test(v.lang));
      if (voice) break;
    }
    voice = voice || en[0] || null;
  }
  if (g.speechSynthesis) {
    pickVoice();
    try { g.speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) {}
  }

  function stop() {
    try {
      if (Plugins.TextToSpeech) Plugins.TextToSpeech.stop().catch(() => {});
      else if (g.speechSynthesis) g.speechSynthesis.cancel();
    } catch (e) {}
  }

  /* queue: say it after whatever is being said now, instead of cutting that off. */
  function speak(text, queue) {
    if (!enabled || !text) return;
    const t = speakable(text);
    if (!queue) stop();
    try {
      if (Plugins.TextToSpeech) {
        Plugins.TextToSpeech.speak({ text: t, lang: 'en-US', rate: 1.05, pitch: 1.05, volume: 1, category: 'ambient', queueStrategy: queue ? 1 : 0 }).catch(() => {});
      } else if (g.speechSynthesis && g.SpeechSynthesisUtterance) {
        const u = new g.SpeechSynthesisUtterance(t);
        u.lang = (voice && voice.lang) || 'en-US';
        if (voice) u.voice = voice;
        u.rate = 1.05;
        u.pitch = 1.05;
        g.speechSynthesis.speak(u);
      }
    } catch (e) {}
  }

  RW.Voice = {
    speak, stop, speakable,
    get available() { return !!(Plugins.TextToSpeech || (g.speechSynthesis && g.SpeechSynthesisUtterance)); },
    setEnabled(v) { enabled = !!v; if (!enabled) stop(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
