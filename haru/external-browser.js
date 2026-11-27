(() => {
  const agent = navigator.userAgent;
  if (!/KAKAOTALK/i.test(agent) || /kakaotalk-scrap|kakaobot/i.test(agent)) return;

  const address = new URL(window.location.href);
  // 문제집 번호와 맞춤 연습 링크의 토큰을 그대로 전달합니다.
  address.searchParams.delete('inapp');
  const external = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(address.href);
  const root = document.documentElement;
  const style = document.createElement('style');
  style.textContent = 'html.haru-handoff { background: white !important; } html.haru-handoff body { visibility: hidden !important; }';
  document.head.append(style);

  let revealTimer;
  function reveal() {
    clearTimeout(revealTimer);
    root.classList.remove('haru-handoff');
  }

  function waitForBrowser() {
    root.classList.add('haru-handoff');
    clearTimeout(revealTimer);
    revealTimer = setTimeout(reveal, 1000);
  }

  function addFallback() {
    const banner = document.createElement('aside');
    banner.className = 'haru-browser-notice';
    banner.setAttribute('aria-label', '카카오톡 브라우저 안내');
    const message = document.createElement('p');
    message.textContent = '음성 안내를 들으려면 기본 브라우저에서 열어 주세요.';
    const link = document.createElement('a');
    link.className = 'haru-return';
    link.href = external;
    link.textContent = '기본 브라우저로 열기';
    link.addEventListener('click', waitForBrowser);
    banner.append(message, link);
    document.body.prepend(banner);
  }

  if (document.body) addFallback();
  else document.addEventListener('DOMContentLoaded', addFallback, { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) reveal(); });

  // 이 스크립트는 본문보다 먼저 실행되어 전환 중에는 빈 화면을 유지합니다.
  if (new URLSearchParams(window.location.search).get('inapp') === '1') return;
  try {
    const key = 'haru.external.attempted';
    if (sessionStorage.getItem(key) === address.href) return;
    sessionStorage.setItem(key, address.href);
  } catch {
    // 중복 전환을 막을 수 없는 환경에서는 버튼만 표시합니다.
    return;
  }

  waitForBrowser();
  try {
    window.location.assign(external);
  } catch {
    reveal();
  }
})();
