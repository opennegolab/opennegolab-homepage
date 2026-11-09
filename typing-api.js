/* ============================================================
   타자 연습 (/typing) — 문제 저장, 출제, 채점, 관리자 기능

   홈페이지의 다른 기능과 섞이지 않게 이 파일 하나에 모았다.
   server.js 는 /api/typing/ 으로 시작하는 요청만 이쪽으로 넘긴다.

   저장
     DATABASE_URL 이 있으면 PostgreSQL 의 typing_items 표에 둔다
     (통계·시뮬레이터가 쓰는 그 DB). 표는 처음 붙을 때 만든다.
     없으면 메모리에만 담는다 — 재배포하면 사라지므로 관리자 화면에 경고를 띄운다.
     DATABASE_URL 이 있는데 연결이 안 되면 메모리로 떨어지지 않고 오류를 낸다.
     관리자가 등록한 문제가 조용히 메모리에만 들어갔다가 사라지면 안 되기 때문이다.

   정답 보호
     질문에 답하기의 정답은 채점 결과와 함께, 그 문제 하나에 대해서만 내보낸다.
     문제 목록·질문에는 정답이 들어 있지 않다.
     받아쓰기는 브라우저가 소리 내어 읽어야 하므로 문장을 브라우저에 보내야 한다.
     그래서 출제 목록에는 넣지 않고, 그 문제를 읽을 차례에 한 문제씩만 내준다(/speak).

   관리자 인증
     /stats 와 같은 방식 — 비밀번호를 맞히면 서명한 쿠키를 준다.
     TYPING_ADMIN_PASSWORD 를 쓰고, 없으면 STATS_PASSWORD 를 그대로 쓴다.
     모든 변경 요청은 서버에서 쿠키를 확인한다.
   ============================================================ */
const crypto = require("crypto");

const MODES = new Set(["dictation", "qa"]);
const MAX_TEXT = 200;        /* 문장 한 개 최대 글자 수 */
const MAX_ANSWERS = 10;      /* 질문 하나에 허용 정답 최대 개수 */
const MAX_BULK = 2000;       /* 한 번에 일괄 등록할 수 있는 문제 수 */
const MAX_BODY = 1024 * 1024;

/* ---------- 글자 다듬기 ----------
   유니코드 정규화(NFC) — 같은 '가'라도 자모를 따로 담아 보내는 기기가 있다.
   앞뒤 공백은 지우고, 연달아 친 공백은 하나로 본다 (띄어쓰기 자체는 그대로 평가) */
function clean(s) {
  return String(s == null ? "" : s).normalize("NFC")
    .replace(/[​-‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function chars(s) { return Array.from(s); }   /* 한글 음절 하나 = 한 글자 */

/* ---------- 채점 ----------
   Levenshtein 편집거리로 점수를 내고, 같은 표를 거꾸로 따라가며
   어느 글자가 틀렸고(sub) 빠졌고(del) 더 들어갔는지(ins) 표시한다 */
function compare(answer, input) {
  const a = chars(answer), b = chars(input);
  const n = a.length, m = b.length;
  const d = [];
  for (let i = 0; i <= n; i++) {
    d.push(new Array(m + 1).fill(0));
    d[i][0] = i;
  }
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  const ops = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && d[i][j] === d[i - 1][j - 1]) {
      ops.push({ t: "eq", a: a[i - 1], u: b[j - 1] }); i--; j--;
    } else if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + 1) {
      ops.push({ t: "sub", a: a[i - 1], u: b[j - 1] }); i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ t: "del", a: a[i - 1] }); i--;           /* 정답에 있는데 안 친 글자 */
    } else {
      ops.push({ t: "ins", u: b[j - 1] }); j--;           /* 정답에 없는데 더 친 글자 */
    }
  }
  ops.reverse();
  const dist = d[n][m];
  const len = Math.max(n, m);
  const score = len === 0 ? 100 : Math.round(Math.max(0, 1 - dist / len) * 100);
  return { score, dist, ops };
}

function feedback(score) {
  if (score === 100) return "정답이에요! 잘했어요.";
  if (score >= 80) return "거의 맞았어요!";
  if (score >= 50) return "조금 더 연습해 봐요.";
  if (score > 0) return "천천히 다시 해 봐요.";
  return "괜찮아요. 다음 문제에 도전해요.";
}

/* 허용 정답 여러 개 중 가장 점수가 높은 것으로 채점한다 */
function grade(item, rawInput) {
  const input = clean(rawInput);
  const answers = item.mode === "dictation" ? [item.prompt] : item.answers;
  let best = null;
  for (const ans of answers) {
    const r = compare(clean(ans), input);
    if (!best || r.score > best.score || (r.score === best.score && r.dist < best.dist)) {
      best = { ...r, answer: clean(ans) };
    }
  }
  if (!best) best = { score: 0, dist: 0, ops: [], answer: "" };
  return {
    score: best.score,
    perfect: best.score === 100,
    answer: best.answer,
    input,
    ops: best.ops,
    feedback: feedback(best.score),
  };
}

/* ---------- 저장소 ---------- */
let pool = null, connecting = null, lastTry = 0, note = "";
const memory = { seq: 0, items: [] };

const SAMPLES = {
  dictation: [
    "오늘은 날씨가 좋아요.", "나무", "학교에 가요.", "친구와 함께 놀아요.", "사과가 빨개요.",
    "엄마, 사랑해요.", "고양이가 잠을 자요.", "하늘이 파래요.", "책을 읽어요.", "손을 깨끗이 씻어요.",
  ],
  qa: [
    ["우리나라의 수도는?", ["서울", "서울특별시"]],
    ["일주일은 며칠일까요?", ["7일", "칠일", "7", "일주일은 7일"]],
    ["하늘은 무슨 색일까요?", ["파란색", "하늘색", "파랑"]],
    ["사과는 무슨 색일까요?", ["빨간색", "빨강"]],
    ["1 더하기 1은?", ["2", "이"]],
    ["봄 다음에 오는 계절은?", ["여름"]],
  ],
};

function seedMemory() {
  const now = new Date().toISOString();
  for (const t of SAMPLES.dictation) memory.items.push({ id: ++memory.seq, mode: "dictation", prompt: t, answers: [], created_at: now, updated_at: now });
  for (const [q, a] of SAMPLES.qa) memory.items.push({ id: ++memory.seq, mode: "qa", prompt: q, answers: a, created_at: now, updated_at: now });
}

function makePool(useSsl) {
  const { Pool } = require("pg");
  const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 8000,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  p.on("error", e => console.error("타자 연습 DB 풀 오류:", e && e.message));
  return p;
}

async function prepare(p) {
  const exists = (await p.query(`SELECT to_regclass('typing_items') AS t`)).rows[0].t;
  await p.query(`
    CREATE TABLE IF NOT EXISTS typing_items (
      id         BIGSERIAL PRIMARY KEY,
      mode       TEXT NOT NULL CHECK (mode IN ('dictation','qa')),
      prompt     TEXT NOT NULL,
      answers    JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await p.query(`CREATE INDEX IF NOT EXISTS typing_items_mode_idx ON typing_items (mode, id)`);
  /* 표를 처음 만든 때만 예시 문제를 넣는다. 관리자가 지운 뒤 다시 생기면 안 된다 */
  if (!exists) {
    for (const t of SAMPLES.dictation) {
      await p.query(`INSERT INTO typing_items (mode, prompt) VALUES ('dictation', $1)`, [t]);
    }
    for (const [q, a] of SAMPLES.qa) {
      await p.query(`INSERT INTO typing_items (mode, prompt, answers) VALUES ('qa', $1, $2)`, [q, JSON.stringify(a)]);
    }
    console.log("타자 연습: 문제 표를 만들고 예시 문제를 넣었다");
  }
}

async function connect() {
  try { require.resolve("pg"); }
  catch { note = "pg 모듈이 없습니다. 설치 명령(npm install)이 실행됐는지 확인해 주세요."; return null; }
  /* 클라우드타입 내부 DB 는 SSL 을 받지 않고 외부 관리형 DB 는 대개 요구한다 — 둘 다 해 본다 (stats.js 와 같은 방식) */
  const url = process.env.DATABASE_URL;
  const guess = !/localhost|127\.0\.0\.1|@postgresql:|\.svc|sslmode=disable/i.test(url);
  let last = "";
  for (const useSsl of [guess, !guess]) {
    let p;
    try {
      p = makePool(useSsl);
      await prepare(p);
      note = "";
      console.log("타자 연습: DB 연결 완료 (SSL " + (useSsl ? "사용" : "미사용") + ")");
      return p;
    } catch (e) {
      last = (e && e.message) || String(e);
      if (p) { try { await p.end(); } catch {} }
    }
  }
  note = "DB에 연결하지 못했습니다 — " + last;
  console.error("타자 연습:", note);
  return null;
}

function usingDb() { return !!process.env.DATABASE_URL; }

class StoreError extends Error {}

/* DB 를 쓰기로 했으면 DB 가 붙을 때까지 기다리고, 안 붙으면 오류를 낸다.
   실패한 뒤에는 15초마다 다시 시도한다 */
async function db() {
  if (pool) return pool;
  if (!connecting) {
    if (Date.now() - lastTry < 15000) throw new StoreError(note || "DB 준비 중입니다.");
    lastTry = Date.now();
    connecting = connect().then(p => { pool = p; connecting = null; return p; });
  }
  const p = await connecting;
  if (!p) throw new StoreError(note || "DB에 연결하지 못했습니다.");
  return p;
}

function rowOut(r) {
  return {
    id: Number(r.id), mode: r.mode, prompt: r.prompt,
    answers: Array.isArray(r.answers) ? r.answers : [],
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

const store = {
  async list(mode) {
    if (!usingDb()) return memory.items.filter(x => x.mode === mode).map(x => ({ ...x, answers: [...x.answers] }));
    const r = await (await db()).query(
      `SELECT id, mode, prompt, answers, created_at, updated_at FROM typing_items WHERE mode = $1 ORDER BY id`, [mode]);
    return r.rows.map(rowOut);
  },
  async get(id) {
    if (!usingDb()) { const x = memory.items.find(x => x.id === id); return x ? { ...x } : null; }
    const r = await (await db()).query(
      `SELECT id, mode, prompt, answers, created_at, updated_at FROM typing_items WHERE id = $1`, [id]);
    return r.rows[0] ? rowOut(r.rows[0]) : null;
  },
  async counts() {
    if (!usingDb()) {
      return { dictation: memory.items.filter(x => x.mode === "dictation").length, qa: memory.items.filter(x => x.mode === "qa").length };
    }
    const r = await (await db()).query(`SELECT mode, count(*)::int AS n FROM typing_items GROUP BY mode`);
    const out = { dictation: 0, qa: 0 };
    for (const row of r.rows) out[row.mode] = row.n;
    return out;
  },
  async insertMany(mode, list) {
    if (!usingDb()) {
      const now = new Date().toISOString();
      const added = list.map(x => ({ id: ++memory.seq, mode, prompt: x.prompt, answers: x.answers, created_at: now, updated_at: now }));
      memory.items.push(...added);
      return added.map(x => ({ ...x }));
    }
    const client = await (await db()).connect();
    try {
      await client.query("BEGIN");
      const out = [];
      for (const x of list) {
        const r = await client.query(
          `INSERT INTO typing_items (mode, prompt, answers) VALUES ($1, $2, $3)
           RETURNING id, mode, prompt, answers, created_at, updated_at`,
          [mode, x.prompt, JSON.stringify(x.answers)]);
        out.push(rowOut(r.rows[0]));
      }
      await client.query("COMMIT");
      return out;
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch {}
      throw e;
    } finally { client.release(); }
  },
  async update(id, prompt, answers) {
    if (!usingDb()) {
      const x = memory.items.find(x => x.id === id);
      if (!x) return null;
      x.prompt = prompt; x.answers = answers; x.updated_at = new Date().toISOString();
      return { ...x };
    }
    const r = await (await db()).query(
      `UPDATE typing_items SET prompt = $2, answers = $3, updated_at = now() WHERE id = $1
       RETURNING id, mode, prompt, answers, created_at, updated_at`, [id, prompt, JSON.stringify(answers)]);
    return r.rows[0] ? rowOut(r.rows[0]) : null;
  },
  async remove(ids) {
    if (!usingDb()) {
      const set = new Set(ids);
      const before = memory.items.length;
      memory.items = memory.items.filter(x => !set.has(x.id));
      return before - memory.items.length;
    }
    const r = await (await db()).query(`DELETE FROM typing_items WHERE id = ANY($1::bigint[])`, [ids]);
    return r.rowCount;
  },
};

/* ---------- 입력 검사 ---------- */
class BadRequest extends Error {}

function checkItem(mode, raw) {
  const prompt = clean(raw && raw.prompt);
  if (!prompt) throw new BadRequest(mode === "qa" ? "질문을 입력해 주세요." : "문장을 입력해 주세요.");
  if (chars(prompt).length > MAX_TEXT) throw new BadRequest(`${MAX_TEXT}자보다 길게 쓸 수 없습니다: ${prompt.slice(0, 20)}…`);
  let answers = [];
  if (mode === "qa") {
    const list = Array.isArray(raw.answers) ? raw.answers : [];
    const seen = new Set();
    for (const a of list) {
      const c = clean(a);
      if (!c || seen.has(c)) continue;
      if (chars(c).length > MAX_TEXT) throw new BadRequest(`정답은 ${MAX_TEXT}자보다 길게 쓸 수 없습니다.`);
      seen.add(c); answers.push(c);
    }
    if (!answers.length) throw new BadRequest(`정답이 없습니다: ${prompt}`);
    if (answers.length > MAX_ANSWERS) throw new BadRequest(`정답은 ${MAX_ANSWERS}개까지 넣을 수 있습니다: ${prompt}`);
  }
  return { prompt, answers };
}

function checkMode(m) {
  if (!MODES.has(m)) throw new BadRequest("mode 는 dictation 또는 qa 여야 합니다.");
  return m;
}

function toId(v) {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n <= 0) throw new BadRequest("잘못된 문제 번호입니다.");
  return n;
}

/* 공평하게 섞기 (Fisher–Yates, 암호학적 난수) */
function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- 남용 막기 ---------- */
function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
         (req.socket && req.socket.remoteAddress) || "";
}

function limiter(max, windowMs) {
  const seen = new Map();
  return ip => {
    const now = Date.now();
    const list = (seen.get(ip) || []).filter(t => now - t < windowMs);
    if (list.length >= max) { seen.set(ip, list); return true; }
    list.push(now);
    seen.set(ip, list);
    if (seen.size > 5000) seen.clear();
    return false;
  };
}
const limitStart = limiter(40, 60000);
const limitSpeak = limiter(240, 60000);
const limitGrade = limiter(240, 60000);
const limitLogin = limiter(10, 10 * 60000);

/* ---------- 관리자 인증 (stats.js 와 같은 방식) ---------- */
const COOKIE = "onl_typing";
const LOGIN_DAYS = 14;

function secret() { return process.env.TYPING_ADMIN_PASSWORD || process.env.STATS_PASSWORD || ""; }
function configured() { return !!secret(); }

function same(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}
/* 통계 쿠키와 섞이지 않도록 서명할 때 'typing' 을 붙인다 */
function sign(exp) {
  return crypto.createHmac("sha256", "typing|" + secret()).update(String(exp)).digest("hex").slice(0, 32);
}
function readCookie(req, name) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}
function authorized(req) {
  if (!configured()) return false;
  const m = /^(\d{10,16})\.([0-9a-f]{32})$/.exec(String(readCookie(req, COOKIE) || ""));
  if (!m || Number(m[1]) < Date.now()) return false;
  return same(m[2], sign(m[1]));
}
function cookieHeader(req, value, maxAge) {
  const https = (req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
  return COOKIE + "=" + encodeURIComponent(value) +
    "; Path=/; Max-Age=" + maxAge + "; HttpOnly; SameSite=Strict" + (https ? "; Secure" : "");
}

/* 다른 사이트에서 관리자 브라우저를 빌려 요청을 보내는 것(CSRF)을 막는다.
   쿠키를 SameSite=Strict 로 주고, Origin 이 붙어 오면 우리 주소인지 한 번 더 본다 */
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

/* ---------- HTTP ---------- */
function send(res, status, data, extra) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(extra || {}),
  });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    if (!/application\/json/i.test(req.headers["content-type"] || "")) {
      return reject(new BadRequest("JSON 으로 보내 주세요."));
    }
    let raw = "", size = 0, done = false;
    req.on("data", c => {
      if (done) return;
      size += c.length;
      if (size > MAX_BODY) { done = true; reject(new BadRequest("보낸 내용이 너무 큽니다.")); req.destroy(); return; }
      raw += c;
    });
    req.on("end", () => {
      if (done) return;
      done = true;
      try { resolve(JSON.parse(raw || "{}")); } catch { reject(new BadRequest("JSON 형식이 아닙니다.")); }
    });
    req.on("error", e => { if (!done) { done = true; reject(e); } });
  });
}

async function handle(req, res, urlPath) {
  try {
    await route(req, res, urlPath);
  } catch (e) {
    if (res.headersSent) { res.end(); return; }
    if (e instanceof BadRequest) return send(res, 400, { ok: false, message: e.message });
    if (e instanceof StoreError) return send(res, 503, { ok: false, message: "문제 저장소에 연결하지 못했어요. 잠시 후 다시 해 주세요." });
    console.error("타자 연습 오류:", req.method, urlPath, "—", e && e.message);
    send(res, 500, { ok: false, message: "잠시 후 다시 시도해 주세요." });
  }
}

async function route(req, res, urlPath) {
  const url = new URL(req.url, "http://x");
  const sub = urlPath.replace(/^\/api\/typing/, "").replace(/\/+$/, "") || "/";
  const method = req.method;
  const ip = clientIp(req);

  /* ----- 학습용 (누구나) ----- */
  if (sub === "/info" && method === "GET") {
    return send(res, 200, { ok: true, counts: await store.counts() });
  }

  /* 출제 — 섞어서 고른 문제 번호만 준다. 질문 모드는 질문 글자도 함께. 정답은 없다.
     ids 를 주면(오답 복습·다시 풀기) 그 문제들만 다시 섞어 낸다 */
  if (sub === "/start" && method === "POST") {
    if (limitStart(ip)) return send(res, 429, { ok: false, message: "잠시 후 다시 시작해 주세요." });
    const body = await readJson(req);
    const mode = checkMode(body.mode);
    let pool = await store.list(mode);
    if (Array.isArray(body.ids)) {
      const want = new Set(body.ids.slice(0, 5000).map(Number));
      pool = pool.filter(x => want.has(x.id));
    }
    let picked = shuffle(pool);
    const count = body.count === "all" ? Infinity : Number(body.count);
    if (Number.isFinite(count) && count > 0) picked = picked.slice(0, Math.floor(count));
    return send(res, 200, {
      ok: true, mode, total: pool.length,
      items: picked.map(x => mode === "qa" ? { id: x.id, question: x.prompt } : { id: x.id }),
    });
  }

  /* 받아쓰기 문장을 읽을 차례에 한 문제씩 내준다 */
  if (sub === "/speak" && method === "GET") {
    if (limitSpeak(ip)) return send(res, 429, { ok: false, message: "잠시 후 다시 해 주세요." });
    const item = await store.get(toId(url.searchParams.get("id")));
    if (!item) return send(res, 404, { ok: false, message: "문제가 지워졌어요." });
    return send(res, 200, { ok: true, text: item.prompt });
  }

  if (sub === "/grade" && method === "POST") {
    if (limitGrade(ip)) return send(res, 429, { ok: false, message: "잠시 후 다시 해 주세요." });
    const body = await readJson(req);
    const item = await store.get(toId(body.id));
    if (!item) return send(res, 404, { ok: false, message: "문제가 지워졌어요." });
    const input = clean(body.answer);
    if (!input) throw new BadRequest("답을 입력해 주세요.");
    if (chars(input).length > MAX_TEXT * 2) throw new BadRequest("답이 너무 길어요.");
    return send(res, 200, { ok: true, ...grade(item, input) });
  }

  /* ----- 관리자 ----- */
  if (!sub.startsWith("/admin")) return send(res, 404, { ok: false, message: "없는 주소입니다." });
  if (method !== "GET" && !sameOrigin(req)) return send(res, 403, { ok: false, message: "허용되지 않은 요청입니다." });

  if (sub === "/admin/login" && method === "POST") {
    const body = await readJson(req);
    if (!configured()) return send(res, 503, { ok: false, message: "관리자 비밀번호(TYPING_ADMIN_PASSWORD)가 설정되지 않았습니다." });
    if (limitLogin(ip)) return send(res, 429, { ok: false, message: "너무 여러 번 시도했습니다. 10분 뒤에 다시 해 주세요." });
    if (!same(String(body.password || ""), secret())) return send(res, 401, { ok: false, message: "비밀번호가 맞지 않습니다." });
    const exp = Date.now() + LOGIN_DAYS * 86400000;
    return send(res, 200, { ok: true }, { "Set-Cookie": cookieHeader(req, exp + "." + sign(exp), LOGIN_DAYS * 86400) });
  }
  if (sub === "/admin/logout" && method === "POST") {
    return send(res, 200, { ok: true }, { "Set-Cookie": cookieHeader(req, "", 0) });
  }

  if (!authorized(req)) {
    return send(res, 401, { ok: false, configured: configured(), message: "관리자 로그인이 필요합니다." });
  }

  if (sub === "/admin/me" && method === "GET") {
    let dbNote = "";
    if (usingDb()) { try { await db(); } catch (e) { dbNote = e.message; } }
    return send(res, 200, {
      ok: true,
      storage: usingDb() ? "db" : "memory",
      note: usingDb() ? dbNote : "DATABASE_URL 환경변수가 없어 문제가 서버 메모리에만 저장됩니다. 재배포하거나 서버가 다시 시작되면 사라집니다.",
    });
  }

  if (sub === "/admin/items" && method === "GET") {
    const mode = checkMode(url.searchParams.get("mode"));
    return send(res, 200, { ok: true, items: await store.list(mode) });
  }

  /* 한 개 또는 여러 개 등록. 같은 문제가 이미 있으면 건너뛸 수 있다 */
  if (sub === "/admin/items" && method === "POST") {
    const body = await readJson(req);
    const mode = checkMode(body.mode);
    const raw = Array.isArray(body.items) ? body.items : [body.item];
    if (!raw.length || !raw[0]) throw new BadRequest("등록할 문제가 없습니다.");
    if (raw.length > MAX_BULK) throw new BadRequest(`한 번에 ${MAX_BULK}개까지 등록할 수 있습니다.`);
    let list = raw.map(x => checkItem(mode, x));
    let skipped = 0;
    if (body.skipDuplicates !== false) {
      const existing = new Set((await store.list(mode)).map(x => x.prompt));
      list = list.filter(x => {
        if (existing.has(x.prompt)) { skipped++; return false; }
        existing.add(x.prompt);
        return true;
      });
    }
    const added = list.length ? await store.insertMany(mode, list) : [];
    return send(res, 200, { ok: true, added: added.length, skipped, items: added });
  }

  const one = /^\/admin\/items\/(\d+)$/.exec(sub);
  if (one && method === "PUT") {
    const id = toId(one[1]);
    const item = await store.get(id);
    if (!item) return send(res, 404, { ok: false, message: "이미 지워진 문제입니다." });
    const body = await readJson(req);
    const x = checkItem(item.mode, body);
    return send(res, 200, { ok: true, item: await store.update(id, x.prompt, x.answers) });
  }
  if (one && method === "DELETE") {
    const n = await store.remove([toId(one[1])]);
    return send(res, n ? 200 : 404, { ok: !!n, removed: n });
  }
  if (sub === "/admin/delete" && method === "POST") {
    const body = await readJson(req);
    const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, 10000).map(toId);
    if (!ids.length) throw new BadRequest("지울 문제를 고르세요.");
    return send(res, 200, { ok: true, removed: await store.remove(ids) });
  }

  return send(res, 404, { ok: false, message: "없는 주소입니다." });
}

/* 서버가 뜰 때 DB 를 미리 붙여 둔다 (첫 학생이 기다리지 않게) */
function warmUp() {
  if (usingDb()) db().catch(() => {});
  else { seedMemory(); console.log("타자 연습: DATABASE_URL 이 없어 메모리에 예시 문제를 담았다"); }
}

module.exports = { handle, warmUp, grade, compare, clean, feedback };
