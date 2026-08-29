/* ============================================================
   방문 기록 — 모으고, 세고, 보여준다.

   GA4 는 데이터는 정확한데 화면이 복잡하다. 여기서는 홈페이지 운영에
   실제로 필요한 숫자만 뽑아서 한 화면에 보여준다. GA 를 대신하는 게
   아니라, 매일 열어 보는 용도다.

   저장
     DATABASE_URL 이 있으면 PostgreSQL 에 남긴다 (시뮬레이터가 쓰는 그 DB).
     없으면 메모리에만 담는다 — 서버가 다시 뜨면 사라지므로, 화면에도
     그렇게 적어 준다. 설정을 깜빡했을 때 숫자를 믿어 버리면 안 된다.

   개인정보
     IP 주소는 저장하지 않는다. 날짜·IP·브라우저를 한 덩어리로 해시해서
     16자만 남긴다. 같은 사람이 하루에 몇 번 왔는지는 셀 수 있지만,
     그 값으로 사람을 되짚을 수는 없고 날짜가 바뀌면 값도 달라진다.

   환경변수
     DATABASE_URL    (선택) 없으면 메모리 모드. 못 붙으면 그 이유를 화면에 띄운다
     STATS_PASSWORD  (필수) 이게 없으면 통계 화면 자체를 열지 않는다
     STATS_SALT      (선택) 방문자 구분값에 섞는 소금. 없으면 기동할 때 새로 만든다
   ============================================================ */
const crypto = require("crypto");

const KINDS = new Set(["view", "inquiry_open", "generate_lead", "simulator_click"]);
const KEEP_DAYS = 400;

/* ---------- 저장소 ---------- */
let pool = null;
let connecting = null;
let lastTry = 0;
let note = "";                 /* 메모리 모드로 떨어졌을 때 그 이유. 화면에 그대로 보여 준다 */
const memory = [];
const MEM_MAX = 20000;

const TABLE = `
  CREATE TABLE IF NOT EXISTS hp_hits (
    id      BIGSERIAL PRIMARY KEY,
    at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    kind    TEXT NOT NULL,
    path    TEXT,
    ref     TEXT,
    device  TEXT,
    visitor TEXT
  )`;

function makePool(useSsl) {
  const { Pool } = require("pg");
  const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 8000,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  p.on("error", e => console.error("통계 DB 풀 오류:", e && e.message));
  return p;
}

async function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) { note = "DATABASE_URL 환경변수가 없습니다."; return null; }
  try { require.resolve("pg"); }
  catch { note = "pg 모듈이 없습니다. 설치 명령(npm install)이 실행됐는지 확인해 주세요."; return null; }

  /* 클라우드타입 내부 DB 는 SSL 을 받지 않고, 외부 관리형 DB 는 대개 요구한다.
     주소만 보고 맞히려다 틀리면 조용히 메모리 모드로 떨어져 원인을 찾기 어렵다.
     그래서 한 번 해보고 안 되면 반대로 한 번 더 해본다 */
  const guess = !/localhost|127\.0\.0\.1|@postgresql:|\.svc|sslmode=disable/i.test(url);
  let last = "";
  for (const useSsl of [guess, !guess]) {
    let p;
    try {
      p = makePool(useSsl);
      await p.query(TABLE);
      await p.query(`CREATE INDEX IF NOT EXISTS hp_hits_at_idx ON hp_hits (at)`);
      note = "";
      console.log("통계: DB 연결 완료 (SSL " + (useSsl ? "사용" : "미사용") + ")");
      return p;
    } catch (e) {
      last = (e && e.message) || String(e);
      if (p) { try { await p.end(); } catch {} }
    }
  }
  note = "DB에 연결하지 못했습니다 — " + last;
  console.error("통계:", note);
  return null;
}

/* 연결은 한 번만 시도하되, 실패했으면 1분 뒤에 다시 해본다.
   서버가 뜰 때 DB 가 잠깐 늦게 준비되는 경우가 있는데, 그때 한 번 실패했다고
   끝까지 메모리 모드로 남아 있으면 안 된다 */
function store() {
  if (pool) return Promise.resolve(pool);
  if (connecting) return connecting;
  if (Date.now() - lastTry < 60000) return Promise.resolve(null);
  lastTry = Date.now();
  connecting = connect().then(async p => {
    pool = p;
    connecting = null;
    /* 연결되기 전에 메모리에 쌓인 게 있으면 옮겨 담는다 */
    if (p && memory.length) {
      const pending = memory.splice(0, memory.length);
      for (const r of pending) {
        try {
          await p.query(`INSERT INTO hp_hits (at, kind, path, ref, device, visitor) VALUES ($1,$2,$3,$4,$5,$6)`,
            [r.at, r.kind, r.path, r.ref, r.device, r.visitor]);
        } catch (e) { /* 한 줄 못 옮겼다고 나머지를 포기할 일은 아니다 */ }
      }
      console.log("통계: 메모리에 있던 " + pending.length + "건을 DB로 옮겼다");
    }
    return p;
  });
  return connecting;
}

/* ---------- 들어온 요청에서 필요한 것만 뽑기 ---------- */
const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|monitor|curl|wget|python-requests|axios|okhttp|phantom|lighthouse|pingdom|uptime/i;

/* 해시에 섞는 값. 따로 정해 두지 않으면 서버가 뜰 때 하나 만든다 —
   서버가 재시작되면 값이 달라져 순방문자가 다시 세어지지만, 그래도
   IP 를 그대로 두는 것보다 낫다 */
const SALT = process.env.STATS_SALT || crypto.randomBytes(16).toString("hex");

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
         (req.socket && req.socket.remoteAddress) || "";
}

function today(d) {
  /* 한국 시간 기준 날짜. 서버가 어느 시간대에 있든 소장님이 보는 날짜와 맞춘다 */
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function visitorId(req, when) {
  const raw = today(when) + "|" + clientIp(req) + "|" + (req.headers["user-agent"] || "") + "|" + SALT;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

/* 유입 경로 — 도메인만 남기고, 아는 곳은 알아보기 쉬운 이름으로 바꾼다 */
const SOURCES = [
  [/(^|\.)naver\.com$/, "네이버"],
  [/(^|\.)google\./, "구글"],
  [/(^|\.)daum\.net$|(^|\.)kakao\.com$/, "다음·카카오"],
  [/(^|\.)bing\.com$/, "빙"],
  [/(^|\.)instagram\.com$/, "인스타그램"],
  [/(^|\.)facebook\.com$|(^|\.)fb\./, "페이스북"],
  [/(^|\.)linkedin\.com$|lnkd\.in$/, "링크드인"],
  [/(^|\.)youtube\.com$|youtu\.be$/, "유튜브"],
  [/(^|\.)threads\.(net|com)$/, "스레드"],
  [/(^|\.)tistory\.com$/, "티스토리"],
  [/(^|\.)brunch\.co\.kr$/, "브런치"],
];

function refName(ref) {
  if (!ref) return "직접 방문";
  let host;
  try { host = new URL(ref).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return "직접 방문"; }
  if (/(^|\.)opennegolab\.com$/.test(host)) return "직접 방문";   /* 우리 사이트 안에서 옮겨 다닌 것 */
  for (const [re, name] of SOURCES) if (re.test(host)) return name;
  return host;
}

function deviceOf(ua) {
  if (!ua) return "기타";
  if (/iPad|Tablet/i.test(ua)) return "태블릿";
  if (/Mobi|Android|iPhone/i.test(ua)) return "모바일";
  return "데스크톱";
}

/* ---------- 기록 ---------- */
const seen = new Map();          /* 같은 곳에서 쏟아지는 요청 막기 */
function tooMany(ip) {
  const now = Date.now();
  const list = (seen.get(ip) || []).filter(t => now - t < 60000);
  if (list.length >= 60) { seen.set(ip, list); return true; }
  list.push(now);
  seen.set(ip, list);
  if (seen.size > 5000) seen.clear();
  return false;
}

async function record(req, body) {
  const ua = req.headers["user-agent"] || "";
  if (BOT.test(ua)) return;                       /* 검색엔진 수집기는 방문자가 아니다 */
  const kind = String(body.kind || "");
  if (!KINDS.has(kind)) return;
  if (tooMany(clientIp(req))) return;

  const when = new Date();
  const row = {
    at: when,
    kind,
    path: String(body.path || "/").slice(0, 200),
    ref: refName(String(body.ref || "")),
    device: deviceOf(ua),
    visitor: visitorId(req, when),
  };

  const p = await store();
  if (p) {
    try {
      await p.query(
        `INSERT INTO hp_hits (at, kind, path, ref, device, visitor) VALUES ($1,$2,$3,$4,$5,$6)`,
        [row.at, row.kind, row.path, row.ref, row.device, row.visitor]);
      return;
    } catch (e) {
      console.error("통계 기록 실패:", e && e.message);   /* 기록이 안 돼도 방문자에게는 영향 없다 */
    }
  }
  memory.push(row);
  if (memory.length > MEM_MAX) memory.splice(0, memory.length - MEM_MAX);
}

/* ---------- 집계 ----------
   DB 든 메모리든 원본 줄을 그대로 받아 와서 계산은 한 곳에서 한다.
   집계 SQL 을 따로 쓰면 두 모드의 숫자가 어긋날 수 있다. 규모가 작아서
   30일치를 가져와 세도 부담이 없다 */
async function rowsSince(since) {
  const p = await store();
  if (p) {
    try {
      const r = await p.query(
        `SELECT at, kind, ref, device, visitor FROM hp_hits WHERE at >= $1 ORDER BY at`, [since]);
      return { rows: r.rows, mode: "db" };
    } catch (e) {
      console.error("통계 조회 실패:", e && e.message);
      note = "DB에서 읽지 못했습니다 — " + (e && e.message);
    }
  }
  return { rows: memory.filter(r => r.at >= since), mode: "memory" };
}

function countTop(rows, key, limit) {
  const m = new Map();
  for (const r of rows) m.set(r[key], (m.get(r[key]) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([name, n]) => ({ name, n }));
}

function summarize(rows, days) {
  const from = today(new Date(Date.now() - (days - 1) * 86400000));
  const inRange = rows.filter(r => today(new Date(r.at)) >= from);
  const views = inRange.filter(r => r.kind === "view");
  return {
    방문자: new Set(views.map(r => r.visitor)).size,
    조회수: views.length,
    문의창: inRange.filter(r => r.kind === "inquiry_open").length,
    문의접수: inRange.filter(r => r.kind === "generate_lead").length,
    시뮬레이터: inRange.filter(r => r.kind === "simulator_click").length,
  };
}

async function summary() {
  const since = new Date(Date.now() - 30 * 86400000);
  const { rows, mode } = await rowsSince(since);
  const views = rows.filter(r => r.kind === "view");

  /* 최근 30일 일별 — 하루도 빠짐없이 채운다. 방문이 없던 날이 빠지면 그래프가 거짓말을 한다 */
  const byDay = new Map();
  for (const r of views) {
    const d = today(new Date(r.at));
    if (!byDay.has(d)) byDay.set(d, new Set());
    byDay.get(d).add(r.visitor);
  }
  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const d = today(new Date(Date.now() - i * 86400000));
    daily.push({ 날짜: d, 방문자: byDay.has(d) ? byDay.get(d).size : 0 });
  }

  const 어제 = today(new Date(Date.now() - 86400000));
  const 어제행 = rows.filter(r => today(new Date(r.at)) === 어제);

  return {
    저장방식: mode,
    저장이유: mode === "db" ? "" : note,
    기준시각: new Date().toISOString(),
    오늘: summarize(rows, 1),
    어제: {
      방문자: new Set(어제행.filter(r => r.kind === "view").map(r => r.visitor)).size,
      조회수: 어제행.filter(r => r.kind === "view").length,
      문의창: 어제행.filter(r => r.kind === "inquiry_open").length,
      문의접수: 어제행.filter(r => r.kind === "generate_lead").length,
      시뮬레이터: 어제행.filter(r => r.kind === "simulator_click").length,
    },
    최근7일: summarize(rows, 7),
    최근30일: summarize(rows, 30),
    일별: daily,
    유입경로: countTop(views, "ref", 10),
    기기: countTop(views, "device", 4),
  };
}

/* ---------- 오래된 기록 정리 ---------- */
async function prune() {
  const p = await store();
  if (!p) return;
  try { await p.query(`DELETE FROM hp_hits WHERE at < now() - interval '${KEEP_DAYS} days'`); }
  catch (e) { console.error("통계 정리 실패:", e && e.message); }
}

/* ---------- 통계 화면 접근 ----------
   브라우저 기본 비밀번호 창(Basic 인증) 대신 로그인 화면을 쓴다.
   팝업은 휴대폰에서 불편하고 로그아웃할 방법도 없다.

   로그인하면 서명한 쪽지(쿠키)를 하나 준다. 서버에 아무것도 저장하지 않아서
   재배포해도 로그인이 풀리지 않고, 비밀번호를 바꾸면 서명이 어긋나
   기존 쪽지가 한꺼번에 무효가 된다 */
const COOKIE = "onl_stats";
const DAYS = 30;

function configured() { return !!process.env.STATS_PASSWORD; }

/* 길이가 다르면 timingSafeEqual 이 예외를 던지므로 먼저 확인한다.
   비교 시간으로 값을 짐작하지 못하게 하는 게 목적이다 */
function same(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

function sign(exp) {
  return crypto.createHmac("sha256", String(process.env.STATS_PASSWORD))
    .update(String(exp)).digest("hex").slice(0, 32);
}

function newTicket() {
  const exp = Date.now() + DAYS * 86400 * 1000;
  return exp + "." + sign(exp);
}

function validTicket(t) {
  const m = /^(\d{10,16})\.([0-9a-f]{32})$/.exec(String(t || ""));
  if (!m) return false;
  if (Number(m[1]) < Date.now()) return false;          /* 기한이 지났다 */
  return same(m[2], sign(m[1]));
}

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function authorized(req) {
  return configured() && validTicket(readCookie(req, COOKIE));
}

/* 클라우드타입은 앞단에서 HTTPS 를 받아 뒤로는 평문으로 넘긴다.
   그래서 실제 접속이 https 였는지는 이 헤더로 판단한다 */
function cookieHeader(req, value, maxAge) {
  const https = (req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
  return COOKIE + "=" + encodeURIComponent(value) +
    "; Path=/; Max-Age=" + maxAge + "; HttpOnly; SameSite=Lax" + (https ? "; Secure" : "");
}

/* 비밀번호를 계속 넣어 보는 걸 막는다 */
const tries = new Map();
function tooManyTries(ip) {
  const now = Date.now();
  const list = (tries.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  if (list.length >= 10) { tries.set(ip, list); return true; }
  list.push(now);
  tries.set(ip, list);
  if (tries.size > 2000) tries.clear();
  return false;
}

function login(req, password) {
  if (!configured()) return { ok: false, message: "통계 화면이 아직 설정되지 않았습니다." };
  if (tooManyTries(clientIp(req))) {
    return { ok: false, message: "너무 여러 번 시도했습니다. 10분 뒤에 다시 해주세요." };
  }
  if (!same(String(password || ""), process.env.STATS_PASSWORD)) {
    return { ok: false, message: "비밀번호가 맞지 않습니다." };
  }
  return { ok: true, cookie: cookieHeader(req, newTicket(), DAYS * 86400) };
}

function logout(req) { return cookieHeader(req, "", 0); }

module.exports = { record, summary, prune, configured, authorized, login, logout };
