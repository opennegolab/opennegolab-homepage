/* 열린협상연구소 홈페이지 — 정적 파일 서버 + 문의 접수

   파일을 저장소 루트에 두는 이유: 기존 Vercel 배포도 루트를 그대로 서비스하고
   있어서, 이 구조를 유지하면 Vercel과 Cloudtype 어느 쪽에서도 똑같이 동작한다.
   (도메인을 옮기는 동안 사이트가 끊기지 않는다)

   문의 폼은 POST /api/inquiry 로 받아 SMTP로 바로 메일을 보낸다 (inquiry.js). */
const http = require("http");
const fs = require("fs");
const path = require("path");
const inquiry = require("./inquiry");
const stats = require("./stats");
const typing = require("./typing-api");
const typingAuth = require("./typing-auth");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

/* 사이트 콘텐츠가 아닌 파일 — 외부에 내보내지 않는다.
   hit.js 는 방문자 브라우저가 받아 가야 하므로 여기 넣지 않는다 */
const HIDDEN = new Set(["server.js", "inquiry.js", "stats.js", "stats.html", "typing-api.js", "typing-auth.js",
                        "package.json", "package-lock.json", "readme.md", "agents.md", ".gitignore",
                        /* 내부 메모·도구 — DNS 기록, 이미지 변환 스크립트, 캡처 폴더 안내 */
                        "dns-snapshot.txt", "_pngtool.js", "img/shots/readme.txt"]);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

const home = () => path.join(ROOT, "index.html");

/* 공유 서비스가 스크립트 실행 없이 읽을 수 있도록 최초 HTML에 넣습니다. */
function haruShareMeta(urlPath, title, description) {
  const url = "https://www.opennegolab.com" + urlPath;
  return `<meta name="description" content="${description}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="하루랑">
<meta property="og:title" content="${title} | 하루랑">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://www.opennegolab.com/haru/assets/share.png?v=2">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="하루랑. 하루와 함께 세상 배우기. 손을 흔드는 하루 캐릭터.">`;
}

const HARU_TYPING_META = `<title>한글 공부 | 하루랑</title>
${haruShareMeta("/haru/typing", "한글 공부", "하루랑에서 받아쓰기와 질문에 답하기로 한글을 공부해요.")}
<meta name="theme-color" content="#fff8e9">
<link rel="icon" href="/haru/assets/favicon.png">
<link rel="manifest" href="/haru/manifest.webmanifest">
<link rel="stylesheet" href="/haru/brand.css?v=3">
<link rel="stylesheet" href="/haru/typing.css?v=1">`;

function haruTypingHeader(shared) {
  return `<header class="haru-top">
  <nav class="haru-top-inner" aria-label="하루랑">
    <a class="haru-return" href="/haru" aria-label="하루랑 처음으로">
      <img src="/haru/assets/logo.png" width="123" height="44" alt="하루랑">
    </a>
    ${shared ? "" : '<a class="haru-return haru-top-action haru-typing-settings" href="/typing/admin">보호자 문제 설정</a>'}
  </nav>
</header>`;
}

const HARU_TYPING_HEADING = `<header class="haru-heading">
  <div><h1>한글 공부</h1><p>잘 듣고, 또박또박 써 봐요.</p></div>
  <img class="haru-pose" src="/haru/assets/haru-guide.webp" alt="">
</header>`;

/* 요청 하나를 처리하다 예외가 나면 Node 는 프로세스를 끝낸다 — 방문자 한 명의
   이상한 요청 때문에 사이트 전체가 내려가면 안 된다. 그래서 전체를 감싼다 */
http.createServer((req, res) => {
  try { handle(req, res); }
  catch (e) {
    console.error("요청 처리 중 오류:", req.method, req.url, "—", e && e.message);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("잠시 후 다시 시도해 주세요.");
  }
}).listen(PORT, () => console.log(`homepage on :${PORT}`));

function handle(req, res) {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname); }
  catch { urlPath = "/"; }

  if (urlPath === "/api/inquiry") {
    inquiry.handle(req, res).catch(e => {
      console.error("문의 처리 오류:", e && e.message);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, message: "잠시 후 다시 시도해 주세요." }));
    });
    return;
  }

  /* 방문 기록 받기. 답은 바로 204 로 끊고 저장은 뒤에서 한다 —
     기록하느라 방문자 브라우저를 기다리게 할 이유가 없다 */
  if (urlPath === "/api/hit") {
    if (req.method !== "POST") { res.writeHead(405).end(); return; }
    let raw = "", size = 0;
    req.on("data", c => {
      size += c.length;
      if (size > 4096) { req.destroy(); return; }      /* 방문 기록은 이보다 클 이유가 없다 */
      raw += c;
    });
    req.on("end", () => {
      res.writeHead(204).end();
      let body; try { body = JSON.parse(raw || "{}"); } catch { return; }
      stats.record(req, body).catch(e => console.error("통계 기록 오류:", e && e.message));
    });
    req.on("error", () => {});
    return;
  }

  /* 통계 로그인 — 비밀번호를 받아 쪽지(쿠키)를 준다 */
  if (urlPath === "/api/stats-login") {
    if (req.method !== "POST") { res.writeHead(405).end(); return; }
    let raw = "", size = 0;
    req.on("data", c => { size += c.length; if (size > 2048) { req.destroy(); return; } raw += c; });
    req.on("end", () => {
      let body; try { body = JSON.parse(raw || "{}"); } catch { body = {}; }
      const r = stats.login(req, body.password);
      const head = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
      if (r.ok) head["Set-Cookie"] = r.cookie;
      res.writeHead(r.ok ? 200 : 401, head);
      res.end(JSON.stringify({ ok: r.ok, message: r.message || "" }));
    });
    req.on("error", () => {});
    return;
  }

  if (urlPath === "/api/stats-logout") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Set-Cookie": stats.logout(req) });
    return res.end(JSON.stringify({ ok: true }));
  }

  /* 통계 숫자 — 로그인한 사람에게만 */
  if (urlPath === "/api/stats") {
    if (!stats.configured()) {
      res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "STATS_PASSWORD 환경변수가 없습니다." }));
    }
    if (!stats.authorized(req)) {
      res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "로그인이 필요합니다." }));
    }
    stats.summary()
      .then(d => {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify(d));
      })
      .catch(e => {
        console.error("통계 집계 오류:", e && e.message);
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "집계에 실패했습니다." }));
      });
    return;
  }

  /* 통계 화면의 껍데기. 숫자는 위 /api/stats 로만 나가므로 이 파일 자체는
     누가 열어도 볼 게 없다. 로그인 창은 이 안에서 그린다 */
  if (urlPath === "/stats") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    return fs.createReadStream(path.join(ROOT, "stats.html")).pipe(res);
  }

  if (urlPath === "/haru/practice-data" || urlPath.startsWith("/haru/practice-data/")) {
    return typing.handlePublic(req, res, urlPath);
  }
  const haruPath = urlPath.replace(/\/$/, "");
  if (haruPath === "/haru/typing" || haruPath === "/haru/typing/shared") {
    const shared = haruPath.endsWith("/shared");
    const template = fs.readFileSync(path.join(ROOT, "typing", "index.html"), "utf8");
    const html = template
      .replace('<html lang="ko">', shared ? '<html lang="ko" data-haru data-shared>' : '<html lang="ko" data-haru>')
      .replace(/<!-- 기존 학습 메타 시작 -->[\s\S]*?<!-- 기존 학습 메타 끝 -->/, HARU_TYPING_META + (shared ? '<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">' : ""))
      .replace(/<!-- 기존 문제 설정 시작 -->[\s\S]*?<!-- 기존 문제 설정 끝 -->/, "")
      .replace("<!-- 하루랑 타자 상단 -->", haruTypingHeader(shared))
      .replace(/<!-- 타자 제목 시작 -->[\s\S]*?<!-- 타자 제목 끝 -->/, HARU_TYPING_HEADING)
      .replace(/@import url\('https:\/\/cdn\.jsdelivr\.net[^']*'\);/, "");
    res.writeHead(200, { "Content-Type": TYPES[".html"], "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff" });
    return res.end(html);
  }
  if (["/haru/kiosk", "/haru/bank", "/haru/transport"].includes(haruPath)) {
    const template = fs.readFileSync(path.join(ROOT, "typing", "learn", "index.html"), "utf8");
    const title = { "/haru/kiosk": "키오스크", "/haru/bank": "은행 이용", "/haru/transport": "교통수단" }[haruPath];
    const html = template.replace('<meta name="robots" content="noindex,nofollow">',
      haruShareMeta(haruPath, title, `하루와 함께 ${title} 학습을 해요.`))
      .replace("<title>생활학습 | 하루랑</title>", `<title>${title} | 하루랑</title>`);
    res.writeHead(200, { "Content-Type": TYPES[".html"], "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff" });
    return res.end(html);
  }

  /* 타자 연습 — 문제 저장은 typing-api.js 가 맡는다 (누가 접속하든 같은 문제) */
  if (urlPath.startsWith("/api/typing/")) { typing.handle(req, res, urlPath); return; }

  const normalizedPath = path.posix.normalize(urlPath).replace(/\/$/, "").toLowerCase();
  if (normalizedPath === "/grade1-learning" || normalizedPath === "/grade1-learning.html") {
    res.writeHead(410, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" });
    return res.end("이 페이지는 종료되었습니다.");
  }
  if (normalizedPath === "/typing" || normalizedPath === "/typing/index.html") {
    res.writeHead(302, { Location: "/haru/typing", "Cache-Control": "no-cache" });
    return res.end();
  }
  if (normalizedPath === "/typing/admin" || normalizedPath === "/typing/admin.html") {
    res.writeHead(200, {
      "Content-Type": TYPES[".html"],
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
    });
    return fs.createReadStream(path.join(ROOT, "typing", typingAuth.authorized(req) ? "admin.html" : "login.html")).pipe(res);
  }

  let file = path.join(ROOT, urlPath);

  /* ROOT 밖(../)이나 숨김 파일·.git 요청은 홈으로 돌린다 */
  const rel = path.relative(ROOT, file).split(path.sep).join("/").toLowerCase();
  if (rel.startsWith("..") || rel.startsWith(".git") || HIDDEN.has(rel)) file = home();

  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");

  /* 없는 주소 처리
     - 확장자가 있는 요청(이미지·PDF 등)은 진짜 404. 홈페이지 HTML을 대신 내보내면
       <img>가 그걸 받아 파일 크기만 낭비하고, 브라우저는 어차피 깨진 이미지로 처리한다.
     - 확장자가 없으면 같은 이름의 .html 을 먼저 찾는다. /privacy 로 들어와도
       privacy.html 이 나가므로 주소에 .html 을 붙이지 않아도 된다.
     - 그래도 없으면 홈페이지로 — 링크가 어긋나도 방문자는 홈을 본다. */
  if (!fs.existsSync(file)) {
    if (path.extname(file)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 Not Found");
    }
    const asHtml = file.replace(/[\\/]+$/, "") + ".html";
    file = fs.existsSync(asHtml) && !HIDDEN.has(path.basename(asHtml).toLowerCase()) ? asHtml : home();
  }

  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    "Content-Type": TYPES[ext] || "application/octet-stream",
    /* HTML은 매번 새로 받고(수정이 바로 보이게), 이미지 등은 하루 캐시 */
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  });
  fs.createReadStream(file).pipe(res);
}

/* 오래된 방문 기록은 치운다. 뜨자마자 한 번, 그 뒤로 하루에 한 번 */
stats.prune();
typing.warmUp();
setInterval(() => stats.prune(), 24 * 3600 * 1000).unref();
