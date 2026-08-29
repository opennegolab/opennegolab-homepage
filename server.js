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

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

/* 사이트 콘텐츠가 아닌 파일 — 외부에 내보내지 않는다.
   hit.js 는 방문자 브라우저가 받아 가야 하므로 여기 넣지 않는다 */
const HIDDEN = new Set(["server.js", "inquiry.js", "stats.js", "stats.html",
                        "package.json", "package-lock.json", "readme.md", ".gitignore"]);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
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
setInterval(() => stats.prune(), 24 * 3600 * 1000).unref();
