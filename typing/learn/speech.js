// 브라우저 음성의 첫 시도와 한국어 음성 재시도를 공통으로 관리합니다.
const android = /Android/i.test(navigator.userAgent);
const inApp = /KAKAOTALK|NAVER\(|NAVER\/|Instagram|FBAN|FBAV|Line\/|DaumApps|; wv\)/i.test(navigator.userAgent);
const synth = window.speechSynthesis;
export const speechAvailable = Boolean(synth && window.SpeechSynthesisUtterance);
let current;
let sequence = 0;
let timer;
let preferred;
let primed = false;
let reflect = () => {};

function voices() {
  try { return synth?.getVoices() || []; }
  catch { return []; }
}

// 처음 안내를 누르기 전에도 기기가 음성 목록을 준비할 수 있게 합니다.
voices();

function koreanVoice() {
  const korean = voices().filter(voice => /^ko([-_]|$)/i.test(voice.lang || ''));
  return korean.find(voice => voice.default) || korean.find(voice => voice.localService) || korean[0];
}

// 일부 iOS 브라우저는 첫 터치 안에서 재생을 시작해야 이후 자동 안내를 허용합니다.
export function prepareSpeech() {
  if (!speechAvailable || primed || !/iPhone|iPad|iPod/i.test(navigator.userAgent)) return;
  try {
    const silent = new window.SpeechSynthesisUtterance('시작');
    silent.lang = 'ko-KR';
    silent.volume = 0;
    synth.speak(silent);
    primed = true;
  } catch {
    // 자동 읽기가 시작되지 않으면 다시 듣기로 재시도할 수 있습니다.
  }
}

export function stopSpeech() {
  sequence++;
  clearTimeout(timer);
  const hadRequest = Boolean(current);
  current = null;
  if (hadRequest || synth?.speaking || synth?.pending) synth?.cancel();
  reflect(false);
  reflect = () => {};
}

export function speak(text, onFailure = () => {}, onSpeaking = () => {}) {
  const busy = Boolean(current || synth?.speaking || synth?.pending);
  stopSpeech();
  if (!speechAvailable) {
    onFailure();
    return false;
  }

  const token = sequence;
  const message = String(text).replace(/ATM/g, '에이티엠').trim();
  if (!message) return false;
  const first = preferred || (android ? 'default' : 'korean');
  reflect = onSpeaking;

  function play(mode, retried) {
    if (token !== sequence) return;
    const utterance = new window.SpeechSynthesisUtterance(message);
    const voice = mode === 'korean' ? koreanVoice() : undefined;
    utterance.lang = voice?.lang.replace('_', '-') || 'ko-KR';
    utterance.rate = 0.9;
    if (voice) utterance.voice = voice;
    current = utterance;
    let started = false;

    function failed() {
      if (token !== sequence || current !== utterance) return;
      clearTimeout(timer);
      current = null;
      synth.cancel();
      onSpeaking(false);
      if (!retried) {
        timer = setTimeout(() => play(mode === 'default' ? 'korean' : 'default', true), android ? 280 : 120);
      } else {
        preferred = undefined;
        onFailure();
      }
    }

    utterance.onstart = () => {
      if (token !== sequence || current !== utterance) return;
      started = true;
      clearTimeout(timer);
      preferred = mode;
      onSpeaking(true);
    };
    utterance.onend = () => {
      if (token !== sequence || current !== utterance) return;
      if (!started) return failed();
      clearTimeout(timer);
      current = null;
      onSpeaking(false);
    };
    utterance.onerror = failed;
    timer = setTimeout(failed, 2500);
    try {
      if (synth.paused) synth.resume();
      synth.speak(utterance);
    } catch {
      failed();
    }
  }

  // 첫 버튼 입력에서 바로 재생합니다. 기존 안내를 끊은 경우에만 잠시 기다립니다.
  if (busy) timer = setTimeout(() => play(first, false), android ? 280 : 120);
  else play(first, false);
  return true;
}

export function showSpeechHelp(target) {
  target.textContent = android
    ? '소리가 안 들리면 미디어 음량을 높이고, 설정의 텍스트 음성 변환에서 한국어 음성을 확인해 주세요.'
    : '소리가 안 들리면 음량과 기기의 한국어 음성 설정을 확인해 주세요.';
  if (inApp) {
    const address = new URL(location.href);
    address.searchParams.delete('inapp');
    const kakao = /KAKAOTALK/i.test(navigator.userAgent);
    const link = document.createElement('a');
    link.className = 'voice-external';
    link.textContent = kakao ? '기본 브라우저로 열기' : 'Chrome으로 열기';
    if (kakao) link.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(address.href);
    else if (android && address.protocol === 'https:') {
      link.href = 'intent://' + address.href.slice('https://'.length) +
        '#Intent;scheme=https;package=com.android.chrome;end';
    } else {
      target.append(' 브라우저 메뉴에서 외부 브라우저로 열어 주세요.');
    }
    if (link.hasAttribute('href')) target.append(' ', link);
  }
  target.hidden = false;
}

window.addEventListener('pagehide', stopSpeech);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopSpeech();
});
