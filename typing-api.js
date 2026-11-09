/* ============================================================
   타자 연습 (/typing) — 문제 저장소

   문제를 서버에 두어, 누가 어느 기기로 접속하든 같은 문제가 나오게 한다.
   server.js 는 /api/typing/ 으로 시작하는 요청만 이쪽으로 넘긴다.
   채점과 출제(섞기)는 브라우저(typing/store.js)가 한다 — 여기서는 문제만 지키고 내준다.

   문제집
     문제는 '오선빈 1', '김계란 1' 같은 문제집에 담는다. 연습할 때 문제집을 고른다.

   저장
     DATABASE_URL 이 있으면 PostgreSQL 의 typing_sets·typing_items 표에 둔다
     (통계·시뮬레이터가 쓰는 그 DB). 표는 처음 붙을 때 만들고 예시 문제를 넣는다.
     없으면 서버 메모리에만 담는다 — 재배포하면 사라지므로 문제 설정 화면에 경고를 띄운다.
     DATABASE_URL 이 있는데 연결이 안 되면 메모리로 떨어지지 않고 오류를 낸다.
     넣은 문제가 조용히 메모리에만 들어갔다가 사라지면 안 되기 때문이다.

   문제 설정
     로그인 없이 누구나 /typing/admin 에서 문제를 넣고 뺄 수 있다 (운영자 요청).
     다른 사이트에서 보낸 요청과 너무 잦은 변경만 막는다.
   ============================================================ */
const MODES = new Set(["dictation", "qa"]);
const MAX_TEXT = 200;        /* 문장 한 개 최대 글자 수 */
const MAX_ANSWERS = 10;      /* 질문 하나에 허용 정답 최대 개수 */
const MAX_BULK = 2000;
const MAX_SET_NAME = 30;     /* 문제집 이름 최대 글자 수 */       /* 한 번에 등록할 수 있는 문제 수 */
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

/* ---------- 저장소 ---------- */
let pool = null, connecting = null, lastTry = 0, note = "";
const memory = { seq: 0, setSeq: 0, sets: [], items: [] };

const SAMPLE_SET = "예시 문제집";
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

/* 한 번만 넣는 문제집 — 배포 후 처음 켜질 때 넣고, typing_meta 에 넣었다고 적어 둔다.
   그래서 나중에 지워도 다시 생기지 않는다. 같은 이름의 문제집이 이미 있으면 거기에 더하고,
   이미 있는 문제는 건너뛴다 */
const ONCE = [
  {
    key: "set:arith-1digit-v1",
    name: "한자리 산수",
    qa: [
      ["1 더하기 8은?", ["9"]],
      ["7 빼기 3은?", ["4"]],
      ["3 빼기 1은?", ["2"]],
      ["4 빼기 2는?", ["2"]],
      ["6 빼기 4는?", ["2"]],
      ["6 더하기 5는?", ["11"]],
      ["6 더하기 7은?", ["13"]],
      ["7 빼기 4는?", ["3"]],
      ["4 더하기 3은?", ["7"]],
      ["8 빼기 3은?", ["5"]],
      ["5 더하기 6은?", ["11"]],
      ["9 빼기 3은?", ["6"]],
      ["6 더하기 2는?", ["8"]],
      ["3 더하기 4는?", ["7"]],
      ["7 더하기 5는?", ["12"]],
      ["5 더하기 9는?", ["14"]],
      ["9 더하기 8은?", ["17"]],
      ["8 빼기 1은?", ["7"]],
      ["4 더하기 1은?", ["5"]],
      ["4 더하기 2는?", ["6"]],
      ["1 더하기 7은?", ["8"]],
      ["2 더하기 7은?", ["9"]],
      ["8 빼기 7은?", ["1"]],
      ["9 빼기 5는?", ["4"]],
      ["5 더하기 8은?", ["13"]],
      ["6 더하기 1은?", ["7"]],
      ["9 더하기 6은?", ["15"]],
      ["6 빼기 5는?", ["1"]],
      ["6 더하기 8은?", ["14"]],
      ["7 빼기 7은?", ["0"]],
    ],
  },
];

async function seedOnce(p) {
  await p.query(`CREATE TABLE IF NOT EXISTS typing_meta (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  for (const seed of ONCE) {
    const done = (await p.query(`SELECT 1 FROM typing_meta WHERE key = $1`, [seed.key])).rows.length;
    if (done) continue;
    const client = await p.connect();
    try {
      await client.query("BEGIN");
      const found = (await client.query(`SELECT id FROM typing_sets WHERE lower(name) = lower($1)`, [seed.name])).rows[0];
      const set = found ? found.id : (await client.query(`INSERT INTO typing_sets (name) VALUES ($1) RETURNING id`, [seed.name])).rows[0].id;
      const have = new Set((await client.query(`SELECT prompt FROM typing_items WHERE set_id = $1 AND mode = 'qa'`, [set])).rows.map(r => r.prompt));
      let n = 0;
      for (const [q, a] of seed.qa) {
        if (have.has(q)) continue;
        await client.query(`INSERT INTO typing_items (set_id, mode, prompt, answers) VALUES ($1, 'qa', $2, $3)`, [set, q, JSON.stringify(a)]);
        n++;
      }
      await client.query(`INSERT INTO typing_meta (key) VALUES ($1) ON CONFLICT DO NOTHING`, [seed.key]);
      await client.query("COMMIT");
      console.log(`타자 연습: '${seed.name}' 문제집에 ${n}문제를 넣었다`);
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch {}
      console.error("타자 연습: 문제집 넣기 실패 —", e && e.message);
    } finally { client.release(); }
  }
}

function seedMemory() {
  const now = new Date().toISOString();
  const set = { id: ++memory.setSeq, name: SAMPLE_SET, created_at: now };
  memory.sets.push(set);
  for (const t of SAMPLES.dictation) memory.items.push({ id: ++memory.seq, set_id: set.id, mode: "dictation", prompt: t, answers: [], created_at: now, updated_at: now });
  for (const [q, a] of SAMPLES.qa) memory.items.push({ id: ++memory.seq, set_id: set.id, mode: "qa", prompt: q, answers: a, created_at: now, updated_at: now });
  for (const seed of ONCE) {
    const st = { id: ++memory.setSeq, name: seed.name, created_at: now };
    memory.sets.push(st);
    for (const [q, a] of seed.qa) memory.items.push({ id: ++memory.seq, set_id: st.id, mode: "qa", prompt: q, answers: a, created_at: now, updated_at: now });
  }
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

/* 표 만들기
   typing_sets  — 문제집 ('오선빈 1', '김계란 1' …)
   typing_items — 문제. 어느 문제집에 속하는지 set_id 로 안다. 문제집을 지우면 문제도 같이 지워진다 */
async function prepare(p) {
  const fresh = !(await p.query(`SELECT to_regclass('typing_items') AS t`)).rows[0].t;
  await p.query(`
    CREATE TABLE IF NOT EXISTS typing_sets (
      id         BIGSERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await p.query(`CREATE UNIQUE INDEX IF NOT EXISTS typing_sets_name_idx ON typing_sets (lower(name))`);
  await p.query(`
    CREATE TABLE IF NOT EXISTS typing_items (
      id         BIGSERIAL PRIMARY KEY,
      mode       TEXT NOT NULL CHECK (mode IN ('dictation','qa')),
      prompt     TEXT NOT NULL,
      answers    JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  /* 문제집이 생기기 전에 만든 표에는 set_id 칸이 없다 — 붙인다 */
  await p.query(`ALTER TABLE typing_items ADD COLUMN IF NOT EXISTS set_id BIGINT REFERENCES typing_sets(id) ON DELETE CASCADE`);
  await p.query(`CREATE INDEX IF NOT EXISTS typing_items_set_idx ON typing_items (set_id, mode, id)`);

  if (fresh) {
    /* 표를 처음 만든 때만 예시 문제집을 넣는다. 지운 뒤 다시 생기면 안 된다 */
    const set = (await p.query(`INSERT INTO typing_sets (name) VALUES ($1) RETURNING id`, [SAMPLE_SET])).rows[0].id;
    for (const t of SAMPLES.dictation) {
      await p.query(`INSERT INTO typing_items (set_id, mode, prompt) VALUES ($1, 'dictation', $2)`, [set, t]);
    }
    for (const [q, a] of SAMPLES.qa) {
      await p.query(`INSERT INTO typing_items (set_id, mode, prompt, answers) VALUES ($1, 'qa', $2, $3)`, [set, q, JSON.stringify(a)]);
    }
    console.log("타자 연습: 문제 표를 만들고 예시 문제집을 넣었다");
  } else {
    /* 문제집이 없던 때 넣은 문제는 '기본 문제집'으로 옮긴다 */
    const orphan = (await p.query(`SELECT count(*)::int AS n FROM typing_items WHERE set_id IS NULL`)).rows[0].n;
    if (orphan) {
      const found = (await p.query(`SELECT id FROM typing_sets WHERE lower(name) = lower($1)`, ["기본 문제집"])).rows[0];
      const set = found ? found.id : (await p.query(`INSERT INTO typing_sets (name) VALUES ($1) RETURNING id`, ["기본 문제집"])).rows[0].id;
      await p.query(`UPDATE typing_items SET set_id = $1 WHERE set_id IS NULL`, [set]);
      console.log("타자 연습: 문제집 없이 있던 문제 " + orphan + "개를 '기본 문제집'으로 옮겼다");
    }
  }
  await seedOnce(p);
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
    id: Number(r.id), set_id: Number(r.set_id), mode: r.mode, prompt: r.prompt,
    answers: Array.isArray(r.answers) ? r.answers : [],
    created_at: r.created_at, updated_at: r.updated_at,
  };
}
const copy = x => ({ ...x, answers: [...x.answers] });

class Conflict extends Error {}

const store = {
  /* ----- 문제집 ----- */
  async sets() {
    if (!usingDb()) {
      return memory.sets.map(st => ({
        id: st.id, name: st.name,
        counts: {
          dictation: memory.items.filter(x => x.set_id === st.id && x.mode === "dictation").length,
          qa: memory.items.filter(x => x.set_id === st.id && x.mode === "qa").length,
        },
      }));
    }
    const r = await (await db()).query(`
      SELECT s.id, s.name,
             count(i.id) FILTER (WHERE i.mode = 'dictation')::int AS d,
             count(i.id) FILTER (WHERE i.mode = 'qa')::int AS q
        FROM typing_sets s LEFT JOIN typing_items i ON i.set_id = s.id
       GROUP BY s.id ORDER BY s.id`);
    return r.rows.map(x => ({ id: Number(x.id), name: x.name, counts: { dictation: x.d, qa: x.q } }));
  },
  async getSet(id) {
    if (!usingDb()) { const st = memory.sets.find(x => x.id === id); return st ? { ...st } : null; }
    const r = await (await db()).query(`SELECT id, name FROM typing_sets WHERE id = $1`, [id]);
    return r.rows[0] ? { id: Number(r.rows[0].id), name: r.rows[0].name } : null;
  },
  async createSet(name) {
    if (!usingDb()) {
      if (memory.sets.some(x => x.name.toLowerCase() === name.toLowerCase())) throw new Conflict();
      const st = { id: ++memory.setSeq, name, created_at: new Date().toISOString() };
      memory.sets.push(st);
      return { id: st.id, name };
    }
    try {
      const r = await (await db()).query(`INSERT INTO typing_sets (name) VALUES ($1) RETURNING id, name`, [name]);
      return { id: Number(r.rows[0].id), name: r.rows[0].name };
    } catch (e) { if (e && e.code === "23505") throw new Conflict(); throw e; }
  },
  async renameSet(id, name) {
    if (!usingDb()) {
      if (memory.sets.some(x => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) throw new Conflict();
      const st = memory.sets.find(x => x.id === id);
      if (!st) return null;
      st.name = name;
      return { id, name };
    }
    try {
      const r = await (await db()).query(`UPDATE typing_sets SET name = $2 WHERE id = $1 RETURNING id, name`, [id, name]);
      return r.rows[0] ? { id: Number(r.rows[0].id), name: r.rows[0].name } : null;
    } catch (e) { if (e && e.code === "23505") throw new Conflict(); throw e; }
  },
  async removeSet(id) {
    if (!usingDb()) {
      const before = memory.sets.length;
      memory.sets = memory.sets.filter(x => x.id !== id);
      memory.items = memory.items.filter(x => x.set_id !== id);
      return before - memory.sets.length;
    }
    const r = await (await db()).query(`DELETE FROM typing_sets WHERE id = $1`, [id]);   /* 문제는 ON DELETE CASCADE 로 함께 */
    return r.rowCount;
  },

  /* ----- 문제 ----- */
  async list(setId, mode) {
    if (!usingDb()) return memory.items.filter(x => x.set_id === setId && x.mode === mode).map(copy);
    const r = await (await db()).query(
      `SELECT id, set_id, mode, prompt, answers, created_at, updated_at FROM typing_items
        WHERE set_id = $1 AND mode = $2 ORDER BY id`, [setId, mode]);
    return r.rows.map(rowOut);
  },
  async get(id) {
    if (!usingDb()) { const x = memory.items.find(x => x.id === id); return x ? copy(x) : null; }
    const r = await (await db()).query(
      `SELECT id, set_id, mode, prompt, answers, created_at, updated_at FROM typing_items WHERE id = $1`, [id]);
    return r.rows[0] ? rowOut(r.rows[0]) : null;
  },
  async insertMany(setId, mode, list) {
    if (!usingDb()) {
      const now = new Date().toISOString();
      const added = list.map(x => ({ id: ++memory.seq, set_id: setId, mode, prompt: x.prompt, answers: x.answers, created_at: now, updated_at: now }));
      memory.items.push(...added);
      return added.map(copy);
    }
    const client = await (await db()).connect();
    try {
      await client.query("BEGIN");
      const out = [];
      for (const x of list) {
        const r = await client.query(
          `INSERT INTO typing_items (set_id, mode, prompt, answers) VALUES ($1, $2, $3, $4)
           RETURNING id, set_id, mode, prompt, answers, created_at, updated_at`,
          [setId, mode, x.prompt, JSON.stringify(x.answers)]);
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
      return copy(x);
    }
    const r = await (await db()).query(
      `UPDATE typing_items SET prompt = $2, answers = $3, updated_at = now() WHERE id = $1
       RETURNING id, set_id, mode, prompt, answers, created_at, updated_at`, [id, prompt, JSON.stringify(answers)]);
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

function checkSetName(raw) {
  const name = clean(raw);
  if (!name) throw new BadRequest("문제집 이름을 입력해 주세요.");
  if (chars(name).length > MAX_SET_NAME) throw new BadRequest(`문제집 이름은 ${MAX_SET_NAME}자까지 쓸 수 있어요.`);
  return name;
}
function toId(v) {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n <= 0) throw new BadRequest("잘못된 문제 번호입니다.");
  return n;
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
const limitRead = limiter(300, 60000);     /* 문제 읽기 */
const limitWrite = limiter(60, 60000);     /* 문제 등록·수정·삭제 */

/* 다른 사이트의 페이지가 방문자 브라우저를 빌려 문제를 바꾸지 못하게 한다.
   Origin 이 붙어 오면 우리 주소인지 본다 */
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
    if (e instanceof Conflict) return send(res, 409, { ok: false, message: "같은 이름의 문제집이 이미 있어요." });
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
  const mustSet = async v => {
    const st = await store.getSet(toId(v));
    if (!st) throw new BadRequest("없는 문제집이에요. 다른 사람이 지웠을 수 있어요.");
    return st;
  };

  if (method === "GET") {
    if (limitRead(ip)) return send(res, 429, { ok: false, message: "잠시 후 다시 해 주세요." });

    /* 저장 상태 — 문제 설정 화면이 경고를 띄울지 정한다 */
    if (sub === "/status") {
      let note = "";
      if (usingDb()) { try { await db(); } catch (e) { note = e.message; } }
      return send(res, 200, { ok: true, storage: usingDb() ? "db" : "memory", note });
    }
    /* 문제집 목록과 문제집마다의 문제 수 */
    if (sub === "/sets") return send(res, 200, { ok: true, sets: await store.sets() });
    if (sub === "/items") {
      const st = await mustSet(url.searchParams.get("set"));
      const mode = checkMode(url.searchParams.get("mode"));
      const items = (await store.list(st.id, mode)).map(x => ({ id: x.id, mode: x.mode, prompt: x.prompt, answers: x.answers }));
      return send(res, 200, { ok: true, items });
    }
    return send(res, 404, { ok: false, message: "없는 주소입니다." });
  }

  /* ----- 바꾸기 (누구나) ----- */
  if (!sameOrigin(req)) return send(res, 403, { ok: false, message: "허용되지 않은 요청입니다." });
  if (limitWrite(ip)) return send(res, 429, { ok: false, message: "너무 빠르게 바꾸고 있어요. 1분 뒤에 다시 해 주세요." });

  if (sub === "/sets" && method === "POST") {
    const body = await readJson(req);
    return send(res, 200, { ok: true, set: await store.createSet(checkSetName(body.name)) });
  }
  const setOne = /^\/sets\/(\d+)$/.exec(sub);
  if (setOne && method === "PUT") {
    const body = await readJson(req);
    const st = await store.renameSet(toId(setOne[1]), checkSetName(body.name));
    if (!st) return send(res, 404, { ok: false, message: "없는 문제집이에요." });
    return send(res, 200, { ok: true, set: st });
  }
  if (setOne && method === "DELETE") {
    const n = await store.removeSet(toId(setOne[1]));
    return send(res, n ? 200 : 404, { ok: !!n, removed: n });
  }

  /* 한 개 또는 여러 개 등록. 하나라도 잘못되면 아무것도 넣지 않는다.
     같은 문제집에 같은 문제가 이미 있으면 건너뛸 수 있다 */
  if (sub === "/items" && method === "POST") {
    const body = await readJson(req);
    const st = await mustSet(body.set);
    const mode = checkMode(body.mode);
    const raw = Array.isArray(body.items) ? body.items : [];
    if (!raw.length) throw new BadRequest("등록할 문제가 없어요.");
    if (raw.length > MAX_BULK) throw new BadRequest(`한 번에 ${MAX_BULK}개까지 등록할 수 있어요.`);
    let list = raw.map(x => checkItem(mode, x));
    let skipped = 0;
    if (body.skipDuplicates !== false) {
      const existing = new Set((await store.list(st.id, mode)).map(x => x.prompt));
      list = list.filter(x => {
        if (existing.has(x.prompt)) { skipped++; return false; }
        existing.add(x.prompt);
        return true;
      });
    }
    const added = list.length ? await store.insertMany(st.id, mode, list) : [];
    return send(res, 200, { ok: true, added: added.length, skipped, items: added });
  }

  const one = /^\/items\/(\d+)$/.exec(sub);
  if (one && method === "PUT") {
    const id = toId(one[1]);
    const item = await store.get(id);
    if (!item) return send(res, 404, { ok: false, message: "이미 지워진 문제예요." });
    const body = await readJson(req);
    const x = checkItem(item.mode, body);
    return send(res, 200, { ok: true, item: await store.update(id, x.prompt, x.answers) });
  }

  if (sub === "/delete" && method === "POST") {
    const body = await readJson(req);
    const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, 10000).map(toId);
    if (!ids.length) throw new BadRequest("지울 문제를 고르세요.");
    return send(res, 200, { ok: true, removed: await store.remove(ids) });
  }

  return send(res, 404, { ok: false, message: "없는 주소입니다." });
}

/* 서버가 뜰 때 DB 를 미리 붙여 둔다 (첫 사람이 기다리지 않게) */
function warmUp() {
  if (usingDb()) db().catch(() => {});
  else { seedMemory(); console.log("타자 연습: DATABASE_URL 이 없어 메모리에 예시 문제를 담았다"); }
}

module.exports = { handle, warmUp, clean };
