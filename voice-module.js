/* =====================================================================
   VOICE MODULE — native TTS + Speech Recognition via Capacitor plugins,
   with an automatic fallback to browser speech APIs.

   This one file serves two deployments from the same source:
     - Inside the Android/iOS app (Capacitor WebView): uses the native
       @capacitor-community/text-to-speech and speech-recognition plugins,
       which sound better and actually work in a WebView (unlike the
       browser APIs, which don't exist there at all).
     - On the plain web (e.g. the Firebase/GitHub Pages deployment): the
       `Capacitor` global isn't injected at all, so this falls back to
       window.speechSynthesis and webkitSpeechRecognition automatically.

   Every function name, signature, and call site is identical either way,
   so nothing else in the app needs to know which path is active.
===================================================================== */

const hasNativeVoice = typeof Capacitor !== 'undefined'
  && typeof Capacitor.isNativePlatform === 'function'
  && Capacitor.isNativePlatform()
  && Capacitor.Plugins && Capacitor.Plugins.TextToSpeech && Capacitor.Plugins.SpeechRecognition;

const { SpeechRecognition, TextToSpeech } = hasNativeVoice ? Capacitor.Plugins : {};

// ---------- Text-to-Speech ----------

async function speakArabicText(text, statusElId) {
  const statusEl = statusElId ? document.getElementById(statusElId) : null;
  if (hasNativeVoice) {
    if (statusEl) statusEl.textContent = '🔊 Playing...';
    try {
      await TextToSpeech.speak({
        text: text,
        lang: 'ar-SA',       // most devices ship Saudi/MSA Arabic as the default installed voice
        rate: 0.85,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient', // audio ducks politely instead of interrupting other sound
      });
      if (statusEl) statusEl.textContent = '';
    } catch (err) {
      console.error('TTS failed:', err);
      if (statusEl) statusEl.textContent = '⚠️ Playback failed — check that Arabic voice data is installed on this device.';
    }
    return;
  }

  // Browser fallback
  if (!('speechSynthesis' in window)) {
    if (statusEl) statusEl.textContent = "⚠️ This browser doesn't support text-to-speech.";
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ar-SA';
  utter.rate = 0.85;
  const arVoice = window.speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('ar'));
  if (arVoice) utter.voice = arVoice;
  if (statusEl) {
    statusEl.textContent = '🔊 Playing...';
    utter.onend = () => { statusEl.textContent = ''; };
    utter.onerror = () => { statusEl.textContent = '⚠️ Playback failed.'; };
  }
  window.speechSynthesis.speak(utter);
}

function listenToTarget() {
  const p = currentChapter.speakingPhrases[speakIndex];
  speakArabicText(p.plain, 'voiceStatus');
}

// Stops event bubbling so a 🔊 button inside a clickable flip-card doesn't
// also trigger the card's own flip/click handler — same behavior as before.
function speakWord(text, evt) {
  if (evt) evt.stopPropagation();
  speakArabicText(text);
}

// ---------- Speech Recognition ----------

let micPermissionGranted = false;

async function ensureMicPermission() {
  if (!hasNativeVoice) return true; // browser prompts for mic access itself on start()
  if (micPermissionGranted) return true;
  try {
    const status = await SpeechRecognition.checkPermissions();
    if (status.speechRecognition === 'granted') {
      micPermissionGranted = true;
      return true;
    }
    const req = await SpeechRecognition.requestPermissions();
    micPermissionGranted = req.speechRecognition === 'granted';
    return micPermissionGranted;
  } catch (err) {
    console.error('Permission check failed:', err);
    return false;
  }
}

function scoreAndShowResult(transcript) {
  const resultBox = document.getElementById('speakResult');
  const target = normalizeAr(currentChapter.speakingPhrases[speakIndex].plain);
  const heard = normalizeAr(transcript);
  const dist = levenshtein(target, heard);
  const maxLen = Math.max(target.length, heard.length) || 1;
  const similarity = Math.max(0, 1 - dist / maxLen);
  const pct = Math.round(similarity * 100);

  resultBox.classList.add('show');
  document.getElementById('heardText').textContent = transcript || '(nothing recognized)';
  const fill = document.getElementById('similarityFill');
  fill.style.width = pct + '%';
  const verdictEl = document.getElementById('speakVerdict');
  if (similarity > 0.85) {
    fill.style.background = '#27ae60'; verdictEl.style.color = '#27ae60';
    verdictEl.textContent = `Excellent! 🌟 (${pct}% match)`;
  } else if (similarity > 0.55) {
    fill.style.background = '#e67e22'; verdictEl.style.color = '#e67e22';
    verdictEl.textContent = `Close — keep practicing. (${pct}% match)`;
  } else {
    fill.style.background = '#e74c3c'; verdictEl.style.color = '#e74c3c';
    verdictEl.textContent = `Try again. (${pct}% match)`;
  }

  markSpeakingAttempt(speakIndex);
  renderSpeakTracker();
}

function showRecordingError(message) {
  const resultBox = document.getElementById('speakResult');
  resultBox.classList.add('show');
  document.getElementById('heardText').textContent = '—';
  const verdictEl = document.getElementById('speakVerdict');
  verdictEl.textContent = message;
  verdictEl.style.color = '#e74c3c';
}

async function startRecording() {
  const micBtn = document.getElementById('micBtn');

  const allowed = await ensureMicPermission();
  if (!allowed) {
    showRecordingError('Microphone/speech permission was denied — enable it in your device settings to use this feature.');
    return;
  }

  if (hasNativeVoice) {
    micBtn.classList.add('listening');
    micBtn.textContent = '🎙️ Listening...';
    try {
      const { matches } = await SpeechRecognition.start({
        language: 'ar-SA',
        maxResults: 1,
        prompt: 'Say the phrase now',
        partialResults: false,
        popup: false,
      });
      scoreAndShowResult((matches && matches[0]) || '');
    } catch (err) {
      console.error('Speech recognition failed:', err);
      showRecordingError(`Couldn't capture audio (${err.message || err}). Try again.`);
    } finally {
      micBtn.classList.remove('listening');
      micBtn.textContent = '🎙️ Record & Check';
    }
    return;
  }

  // Browser fallback
  const BrowserSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!BrowserSpeechRecognition) {
    showRecordingError("⚠️ This browser doesn't support speech recognition — try the app instead.");
    return;
  }
  const recognizer = new BrowserSpeechRecognition();
  recognizer.lang = 'ar-SA';
  recognizer.maxAlternatives = 1;
  recognizer.interimResults = false;

  micBtn.classList.add('listening');
  micBtn.textContent = '🎙️ Listening...';

  recognizer.onresult = (event) => {
    const transcript = event.results[0][0].transcript || '';
    scoreAndShowResult(transcript);
  };
  recognizer.onerror = (event) => {
    console.error('Speech recognition failed:', event.error);
    showRecordingError(`Couldn't capture audio (${event.error}). Try again.`);
  };
  recognizer.onend = () => {
    micBtn.classList.remove('listening');
    micBtn.textContent = '🎙️ Record & Check';
  };

  try {
    recognizer.start();
  } catch (err) {
    console.error('Speech recognition failed:', err);
    showRecordingError(`Couldn't capture audio (${err.message || err}). Try again.`);
    micBtn.classList.remove('listening');
    micBtn.textContent = '🎙️ Record & Check';
  }
}
