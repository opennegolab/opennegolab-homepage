/* 방문 기록을 우리 서버로 보낸다.

   opennegolab.com 에서만 보낸다 — 로컬이나 미리보기 주소에서 시험한 것이
   실제 숫자에 섞이면 통계를 믿을 수 없게 된다. (Google Analytics 도 같은 조건)

   sendBeacon 을 먼저 쓴다. 링크를 눌러 페이지를 떠나는 순간에도 요청이
   끊기지 않고 나간다. 없는 브라우저에서는 fetch 로 대신한다.

   기록이 실패해도 방문자에게는 아무 일도 일어나지 않아야 한다. 그래서
   전부 try 로 감싸고, 실패해도 조용히 넘어간다. */
(function () {
  var live = /(^|\.)opennegolab\.com$/i.test(location.hostname);

  window.onlHit = function (kind) {
    if (!live) return;
    try {
      var body = JSON.stringify({
        kind: kind,
        path: location.pathname,
        ref: document.referrer || ""
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/hit", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/hit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          keepalive: true
        });
      }
    } catch (e) {}
  };

  window.onlHit("view");
})();
