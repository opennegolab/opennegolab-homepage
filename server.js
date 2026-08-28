/* 열린협상연구소 홈페이지 — 정적 파일 서버
   저장소 폴더의 파일을 그대로 내보낸다. 외부 패키지를 쓰지 않으므로
   Cloudtype에서 설치 과정 없이 `npm start` 만으로 뜬다.

   파일을 저장소 루트에 두는 이유: 기존 Vercel 배포도 루트를 그대로 서비스하고
   있어서, 이 구조를 유지하면 Vercel과 Cloudtype 어느 쪽에서도 똑같이 동작한다.
   (도메인을 옮기는 동안 사이트가 끊기지 않는다) */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

/* 사이트 콘텐츠가 아닌 파일 — 외부에 내보내지 않는다 */
const HIDDEN = new Set(["server.js", "package.json", "package-lock.json", "readme.md", ".gitignore"]);

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

http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname); }
  catch { urlPath = "/"; }

  let file = path.join(ROOT, urlPath);

  /* ROOT 밖(../)이나 숨김 파일·.git 요청은 홈으로 돌린다 */
  const rel = path.relative(ROOT, file).split(path.sep).join("/").toLowerCase();
  if (rel.startsWith("..") || rel.startsWith(".git") || HIDDEN.has(rel)) file = home();

  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");

  /* 없는 주소는 404 대신 홈페이지 — 링크가 깨져도 방문자는 홈을 본다 */
  if (!fs.existsSync(file)) file = home();

  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    "Content-Type": TYPES[ext] || "application/octet-stream",
    /* HTML은 매번 새로 받고(수정이 바로 보이게), 이미지 등은 하루 캐시 */
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`homepage on :${PORT}`));
