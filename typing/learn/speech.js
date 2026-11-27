// 타자연습과 같은 한국어 속도와 안드로이드 음성 선택 방식을 사용합니다.
const android = /Android/i.test(navigator.userAgent);
const synth = window.speechSynthesis;
let current;
let request = 0;
let delay;
let timeout;

export function stopSpeech() {
  request++;
  clearTimeout(delay);
  clearTimeout(timeout);
  if (synth?.speaking || synth?.pending) synth.cancel();
  current = null;
}

export function speak(text, onFailure) {
  const busy = synth?.speaking || synth?.pending;
  stopSpeech();
  if (!synth || !window.SpeechSynthesisUtterance) {
    onFailure();
    return;
  }
  const token = request;
  const start = () => {
    if (token !== request) return;
    const utterance = new SpeechSynthesisUtterance(text.replace(/ATM/g, '에이티엠'));
    utterance.lang = 'ko-KR';
    utterance.rate = 0.9;
    if (!android) {
      const voices = synth.getVoices().filter(voice => /^ko([-_]|$)/i.test(voice.lang));
      const natural = voices.find(voice => /natural|neural|premium|enhanced/i.test(voice.name)
        && (navigator.onLine || voice.localService));
      const voice = natural || voices.find(voice => voice.localService) || voices[0];
      if (voice) utterance.voice = voice;
    }
    utterance.onstart = () => { if (token === request) clearTimeout(timeout); };
    utterance.onerror = event => {
      if (token === request && !['canceled', 'interrupted'].includes(event.error)) {
        clearTimeout(timeout);
        onFailure();
      }
    };
    current = utterance;
    timeout = setTimeout(() => { if (token === request) onFailure(); }, 4000);
    try {
      synth.resume();
      synth.speak(current);
    } catch {
      clearTimeout(timeout);
      onFailure();
    }
  };
  if (busy) delay = setTimeout(start, android ? 300 : 120);
  else start();
}

window.addEventListener('pagehide', stopSpeech);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopSpeech();
});
