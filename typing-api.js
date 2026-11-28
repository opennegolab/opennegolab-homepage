/* ============================================================
   타자 연습 (/typing) — 문제 저장소

   문제를 서버에 두어, 누가 어느 기기로 접속하든 같은 문제가 나오게 한다.
   server.js 는 /api/typing/ 으로 시작하는 요청만 이쪽으로 넘긴다.
   채점과 출제(섞기)는 브라우저(typing/store.js)가 한다 — 여기서는 문제만 지키고 내준다.

   문제집
     문제는 '오선빈 1', '김계란 1' 같은 문제집에 담는다. 연습할 때 문제집을 고른다.

   저장
     DATABASE_URL 이 있으면 PostgreSQL 의 typing_sets·typing_items 표에 둔다
     (통계·시뮬레이터가 쓰는 그 DB). 표는 처음 붙을 때 만든다.
     없으면 서버 메모리에만 담는다 — 재배포하면 사라지므로 문제 설정 화면에 경고를 띄운다.
     DATABASE_URL 이 있는데 연결이 안 되면 메모리로 떨어지지 않고 오류를 낸다.
     넣은 문제가 조용히 메모리에만 들어갔다가 사라지면 안 되기 때문이다.

   문제 설정
     보호자 세션은 문제집 변경과 맞춤 링크 관리에 필요하다.
   ============================================================ */
const auth = require("./typing-auth");
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

/* 공개 연습에 제공하는 기본 문제집입니다. */
const DEFAULT_EXERCISES = [
  {
    name: "한자리 산수",
    qa: [
      ["1 + 8 = ?", ["9"]],
      ["7 - 3 = ?", ["4"]],
      ["3 - 1 = ?", ["2"]],
      ["4 - 2 = ?", ["2"]],
      ["6 - 4 = ?", ["2"]],
      ["6 + 5 = ?", ["11"]],
      ["6 + 7 = ?", ["13"]],
      ["7 - 4 = ?", ["3"]],
      ["4 + 3 = ?", ["7"]],
      ["8 - 3 = ?", ["5"]],
      ["5 + 6 = ?", ["11"]],
      ["9 - 3 = ?", ["6"]],
      ["6 + 2 = ?", ["8"]],
      ["3 + 4 = ?", ["7"]],
      ["7 + 5 = ?", ["12"]],
      ["5 + 9 = ?", ["14"]],
      ["9 + 8 = ?", ["17"]],
      ["8 - 1 = ?", ["7"]],
      ["4 + 1 = ?", ["5"]],
      ["4 + 2 = ?", ["6"]],
      ["1 + 7 = ?", ["8"]],
      ["2 + 7 = ?", ["9"]],
      ["8 - 7 = ?", ["1"]],
      ["9 - 5 = ?", ["4"]],
      ["5 + 8 = ?", ["13"]],
      ["6 + 1 = ?", ["7"]],
      ["9 + 6 = ?", ["15"]],
      ["6 - 5 = ?", ["1"]],
      ["6 + 8 = ?", ["14"]],
      ["7 - 7 = ?", ["0"]],
    ],
  },
  {
    name: "낱말 받아쓰기",
    /* 과일·채소·탈것 이름 50개 (무작위 순서) */
    dictation: [
      "체리", "수박", "옥수수", "당근", "택시", "감", "가지", "배추", "유모차", "사과",
      "브로콜리", "바나나", "망고", "견인차", "기차", "지하철", "레몬", "감자", "오이", "경찰차",
      "구급차", "헬리콥터", "자두", "비행기", "청소차", "상추", "버스", "양파", "무", "딸기",
      "자전거", "복숭아", "굴착기", "고구마", "토마토", "파인애플", "참외", "키위", "트랙터", "오렌지",
      "파프리카", "귤", "고추", "오토바이", "버섯", "배달차", "소방차", "호박", "트럭", "멜론",
    ],
  },
];

/* 문제집 하나에 들어갈 문제 — 질문(qa)과 받아쓰기(dictation)를 한 목록으로 */
function seedItems(seed) {
  return [
    ...(seed.qa || []).map(([q, a]) => ({ mode: "qa", prompt: q, answers: a })),
    ...(seed.dictation || []).map(t => ({ mode: "dictation", prompt: t, answers: [] })),
  ];
}

/* DB 주소에 sslmode=require·ssl=true 같은 값이 붙어 있으면 pg 는 그 값을 아래 ssl 설정보다
   우선한다. 그러면 "SSL 없이 다시 해보기"가 실제로는 또 SSL 로 붙어, SSL 을 받지 않는 DB 에서
   두 번 다 실패한다. 그래서 주소에서 SSL 관련 값은 떼고, 쓸지 말지는 여기서만 정한다 */
function withoutSslParams(url) {
  url = String(url || "");
  const q = url.indexOf("?", url.lastIndexOf("@") + 1);   /* 비밀번호 안의 ? 는 건드리지 않는다 */
  if (q < 0) return url;
  const keep = url.slice(q + 1).split("&")
    .filter(kv => kv && !/^(sslmode|ssl|uselibpqcompat)=/i.test(kv));
  return url.slice(0, q) + (keep.length ? "?" + keep.join("&") : "");
}

function makePool(useSsl) {
  const { Pool } = require("pg");
  const p = new Pool({
    connectionString: withoutSslParams(process.env.DATABASE_URL),
    max: 3,
    connectionTimeoutMillis: 8000,
    ssl: useSsl ? { rejectUnauthorized: false } : false,   /* false 도 꼭 적는다 — 없으면 PGSSLMODE 환경변수를 따른다 */
  });
  p.on("error", e => console.error("타자 연습 DB 풀 오류:", e && e.message));
  return p;
}

/* 표 만들기
   typing_sets  — 문제집 ('오선빈 1', '김계란 1' …)
   typing_items — 문제. 어느 문제집에 속하는지 set_id 로 안다. 문제집을 지우면 문제도 같이 지워진다 */
async function prepare(p) {
  await p.query(`
    CREATE TABLE IF NOT EXISTS typing_sets (
      id         BIGSERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await p.query(`CREATE TABLE IF NOT EXISTS typing_guardians (
    username TEXT PRIMARY KEY, password_hash TEXT NOT NULL
  )`);
  await p.query(`ALTER TABLE typing_sets ADD COLUMN IF NOT EXISTS owner TEXT REFERENCES typing_guardians(username)`);
  await p.query(`CREATE UNIQUE INDEX IF NOT EXISTS typing_sets_owner_name_idx ON typing_sets (coalesce(owner, ''), lower(name))`);
  await p.query(`DROP INDEX IF EXISTS typing_sets_name_idx`);
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

  await resetGuardianData(p);
}

/* 보호자 데이터 정리 — 운영자 요청으로 각각 한 번만 한다 (2026-11).
   typing_meta 에 했다고 적어 두므로, 다시 켜져도 그 뒤에 새로 만든 계정·문제집은 지워지지 않는다.
   - reset:guardian-data-2026-11     그동안의 문제집·문제와 연습 링크 공유를 지운다 (계정은 남김)
   - reset:guardian-accounts-2026-11 보호자 계정(아이디·비밀번호)을 모두 지운다.
                                      문제집은 계정에 묶여 있어 보호자 문제집도 함께 지운다 */
const RESETS = [
  ["reset:guardian-data-2026-11", async client => {
    await client.query(`DROP TABLE IF EXISTS typing_practice_links`);
    const r = await client.query(`DELETE FROM typing_sets`);   /* 문제는 ON DELETE CASCADE 로 함께 */
    return "보호자 문제집 " + r.rowCount + "개와 공유 링크를 지웠다";
  }],
  ["reset:guardian-accounts-2026-11", async client => {
    const sets = await client.query(`DELETE FROM typing_sets WHERE owner IS NOT NULL`);
    const accounts = await client.query(`DELETE FROM typing_guardians`);
    return "보호자 계정 " + accounts.rowCount + "개와 그 문제집 " + sets.rowCount + "개를 지웠다";
  }],
];
async function resetGuardianData(p) {
  await p.query(`CREATE TABLE IF NOT EXISTS typing_meta (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  for (const [key, run] of RESETS) {
    if ((await p.query(`SELECT 1 FROM typing_meta WHERE key = $1`, [key])).rows.length) continue;
    const client = await p.connect();
    try {
      await client.query("BEGIN");
      const what = await run(client);
      await client.query(`INSERT INTO typing_meta (key) VALUES ($1)`, [key]);
      await client.query("COMMIT");
      console.log("타자 연습: " + what);
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch {}
      throw e;
    } finally { client.release(); }
  }
}

async function connect() {
  try { require.resolve("pg"); }
  catch { note = "pg 모듈이 없습니다. 설치 명령(npm install)이 실행됐는지 확인해 주세요."; return null; }
  /* 클라우드타입 내부 DB 는 SSL 을 받지 않고 외부 관리형 DB 는 대개 요구한다 — 둘 다 해 본다 (stats.js 와 같은 방식) */
  const url = process.env.DATABASE_URL;
  const guess = !/localhost|127\.0\.0\.1|@postgresql:|\.svc|sslmode=disable/i.test(url);
  const fails = [];
  for (const useSsl of [guess, !guess]) {
    let p;
    try {
      p = makePool(useSsl);
      await prepare(p);
      note = "";
      console.log("타자 연습: DB 연결 완료 (SSL " + (useSsl ? "사용" : "미사용") + ")");
      return p;
    } catch (e) {
      /* 두 번 다 실패하면 둘 다 보여 준다 — 마지막 것만 보이면 진짜 원인이 가려진다 */
      fails.push("SSL " + (useSsl ? "사용" : "미사용") + ": " + ((e && e.message) || String(e)));
      if (p) { try { await p.end(); } catch {} }
    }
  }
  note = "DB에 연결하지 못했습니다 — " + fails.join(" / ");
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
  async sets(owner) {
    if (!usingDb()) {
      return memory.sets.filter(st => (st.owner ?? null) === owner).map(st => ({
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
       WHERE s.owner IS NOT DISTINCT FROM $1::text
       GROUP BY s.id ORDER BY s.id`, [owner]);
    return r.rows.map(x => ({ id: Number(x.id), name: x.name, counts: { dictation: x.d, qa: x.q } }));
  },
  async getSet(id) {
    if (!usingDb()) { const st = memory.sets.find(x => x.id === id); return st ? { ...st } : null; }
    const r = await (await db()).query(`SELECT id, name, owner FROM typing_sets WHERE id = $1`, [id]);
    return r.rows[0] ? { id: Number(r.rows[0].id), name: r.rows[0].name, owner: r.rows[0].owner } : null;
  },
  async createSet(name, owner) {
    if (!usingDb()) {
      if (memory.sets.some(x => (x.owner ?? null) === owner && x.name.toLowerCase() === name.toLowerCase())) throw new Conflict();
      const st = { id: ++memory.setSeq, name, owner, created_at: new Date().toISOString() };
      memory.sets.push(st);
      return { id: st.id, name };
    }
    try {
      const r = await (await db()).query(`INSERT INTO typing_sets (name, owner) VALUES ($1, $2) RETURNING id, name`, [name, owner]);
      return { id: Number(r.rows[0].id), name: r.rows[0].name };
    } catch (e) { if (e && e.code === "23505") throw new Conflict(); throw e; }
  },
  async renameSet(id, name, owner) {
    if (!usingDb()) {
      if (memory.sets.some(x => x.id !== id && (x.owner ?? null) === owner && x.name.toLowerCase() === name.toLowerCase())) throw new Conflict();
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
  async remove(ids, owner) {
    if (!usingDb()) {
      const set = new Set(ids);
      const before = memory.items.length;
      const owned = new Set(memory.sets.filter(st => (st.owner ?? null) === owner).map(st => st.id));
      memory.items = memory.items.filter(x => !set.has(x.id) || !owned.has(x.set_id));
      return before - memory.items.length;
    }
    const r = await (await db()).query(`DELETE FROM typing_items i USING typing_sets s
      WHERE i.id = ANY($1::bigint[]) AND i.set_id = s.id AND s.owner IS NOT DISTINCT FROM $2::text`, [ids, owner]);
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
const limitLogin = limiter(8, 60000);
const limitLoginProxy = limiter(40, 60000);
const limitGuardianLogin = limiter(5, 15 * 60000);
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

const guardianAccounts = new Map();

async function registerGuardian(username, password) {
  const hash = await auth.hashPassword(password);
  if (!usingDb()) {
    if (guardianAccounts.has(username)) return false;
    guardianAccounts.set(username, hash);
    return true;
  }
  const result = await (await db()).query(`INSERT INTO typing_guardians (username,password_hash)
    VALUES ($1,$2) ON CONFLICT DO NOTHING`, [username, hash]);
  return result.rowCount === 1;
}

async function guardianHash(username) {
  if (!usingDb()) return guardianAccounts.get(username);
  const result = await (await db()).query("SELECT password_hash FROM typing_guardians WHERE username=$1", [username]);
  return result.rows[0]?.password_hash;
}

async function replaceGuardianPassword(username, previousHash, pin) {
  const hash = await auth.hashPassword(pin);
  if (!usingDb()) {
    if (guardianAccounts.get(username) !== previousHash) return false;
    guardianAccounts.set(username, hash);
    return true;
  }
  const result = await (await db()).query(
    "UPDATE typing_guardians SET password_hash=$1 WHERE username=$2 AND password_hash=$3",
    [hash, username, previousHash]
  );
  return result.rowCount === 1;
}

const isPin = value => typeof value === "string" && /^[0-9]{4}$/.test(value);

async function route(req, res, urlPath) {
  const url = new URL(req.url, "http://x");
  const sub = urlPath.replace(/^\/api\/typing/, "").replace(/\/+$/, "") || "/";
  const method = req.method;
  const ip = clientIp(req);
  if ((sub === "/session" || sub === "/register") && method === "POST") {
    if (!sameOrigin(req)) return send(res, 403, { ok: false, message: "허용되지 않은 요청입니다." });
    if (limitLoginProxy(req.socket.remoteAddress || "") || limitLogin(ip)) return send(res, 429, { ok: false, message: "잠시 후 다시 시도해 주세요." });
    const body = await readJson(req);
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = body?.password;
    const newPin = body?.newPin;
    const legacy = sub === "/session" && typeof password === "string" &&
      password.length >= 12 && password.length <= 128 && isPin(newPin);
    if (!/^[a-z0-9_]{4,24}$/.test(username)) {
      throw new BadRequest("아이디는 영문, 숫자, 밑줄 4~24자로 입력해 주세요.");
    }
    if (!legacy && !isPin(password)) throw new BadRequest("비밀번호는 숫자 4자리로 입력해 주세요.");
    if (sub === "/register") {
      if (!await registerGuardian(username, password)) {
        return send(res, 409, { ok: false, message: "사용할 수 없는 아이디입니다." });
      }
    } else {
      if (limitGuardianLogin(username)) {
        return send(res, 429, { ok: false, message: "로그인 시도가 많아요. 15분 뒤에 다시 시도해 주세요." });
      }
      const hash = await guardianHash(username);
      if (!await auth.checkPassword(password, hash)) {
        return send(res, 401, { ok: false, message: "아이디와 비밀번호를 확인해 주세요." });
      }
      if (legacy && !await replaceGuardianPassword(username, hash, newPin)) {
        return send(res, 409, { ok: false, message: "비밀번호가 이미 바뀌었어요. 다시 로그인해 주세요." });
      }
    }
    return send(res, 200, { ok: true }, { "Set-Cookie": auth.signIn(req, username) });
  }
  if (sub === "/session" && method === "DELETE" && sameOrigin(req)) {
    return send(res, 200, { ok: true }, { "Set-Cookie": auth.signOut(req) });
  }
  const owner = auth.user(req);
  if (!owner) return send(res, 401, { ok: false, message: "보호자 로그인이 필요해요." });

  const mustSet = async v => {
    const st = await store.getSet(toId(v));
    if (!st || (st.owner ?? null) !== owner) throw new BadRequest("사용할 수 없는 문제집이에요.");
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
    if (sub === "/sets") return send(res, 200, { ok: true, sets: await store.sets(owner) });
    if (sub === "/items") {
      const st = await mustSet(url.searchParams.get("set"));
      const mode = checkMode(url.searchParams.get("mode"));
      /* 등록 시각(at)도 보낸다 — 문제 설정 목록이 한꺼번에 넣은 묶음을 적은 순서대로 보여 주는 데 쓴다 */
      const items = (await store.list(st.id, mode)).map(x => ({ id: x.id, mode: x.mode, prompt: x.prompt, answers: x.answers, at: x.created_at }));
      return send(res, 200, { ok: true, items });
    }
    return send(res, 404, { ok: false, message: "없는 주소입니다." });
  }

  /* ----- 바꾸기 (보호자) ----- */
  if (!sameOrigin(req)) return send(res, 403, { ok: false, message: "허용되지 않은 요청입니다." });
  if (limitWrite(ip)) return send(res, 429, { ok: false, message: "너무 빠르게 바꾸고 있어요. 1분 뒤에 다시 해 주세요." });

  if (sub === "/sets" && method === "POST") {
    const body = await readJson(req);
    return send(res, 200, { ok: true, set: await store.createSet(checkSetName(body.name), owner) });
  }
  const setOne = /^\/sets\/(\d+)$/.exec(sub);
  if (setOne && method === "PUT") {
    const body = await readJson(req);
    const original = await mustSet(setOne[1]);
    const st = await store.renameSet(original.id, checkSetName(body.name), owner);
    if (!st) return send(res, 404, { ok: false, message: "없는 문제집이에요." });
    return send(res, 200, { ok: true, set: st });
  }
  if (setOne && method === "DELETE") {
    const original = await mustSet(setOne[1]);
    const n = await store.removeSet(original.id);
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
    await mustSet(item.set_id);
    const x = checkItem(item.mode, body);
    return send(res, 200, { ok: true, item: await store.update(id, x.prompt, x.answers) });
  }

  if (sub === "/delete" && method === "POST") {
    const body = await readJson(req);
    const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, 10000).map(toId);
    if (!ids.length) throw new BadRequest("지울 문제를 고르세요.");
    return send(res, 200, { ok: true, removed: await store.remove(ids, owner) });
  }

  return send(res, 404, { ok: false, message: "없는 주소입니다." });
}

/* 서버가 뜰 때 DB 를 미리 붙여 둔다 (첫 사람이 기다리지 않게) */
function warmUp() {
  if (usingDb()) db().catch(() => {});
}

/* 공개 기본 문제집 — 코드에 들어 있는 읽기 전용 문제 */
const publicSeeds = [
  { name: SAMPLE_SET, ...SAMPLES },
  ...DEFAULT_EXERCISES,
];
const publicSets = publicSeeds.map((seed, index) => {
  const id = index + 1;
  const items = seedItems(seed).map((item, position) => ({ ...item, id: position + 1 }));
  const counts = { dictation: 0, qa: 0 };
  for (const item of items) counts[item.mode]++;
  return { id, name: seed.name, counts, items };
});

/* 한글 공부(/haru/typing)가 읽는 문제
   - 누구나: 코드에 들어 있는 공개 기본 문제집 (번호 1, 2, 3 …)
   - 보호자가 로그인한 브라우저: 그 보호자가 문제 설정에서 만든 문제집.
     보호자 문제집에 문제가 하나라도 있으면 기본 문제집은 빼고 보호자 문제집만 보여 준다.
     공개 문제집 번호와 겹치지 않게 '-DB 번호'(음수)로 내보낸다 */
async function handlePublic(req, res, pathname) {
  if (req.method !== "GET") {
    return send(res, 405, { ok: false, message: "읽기만 할 수 있어요." }, { Allow: "GET" });
  }
  if (limitRead(clientIp(req))) return send(res, 429, { ok: false, message: "잠시 후 다시 해 주세요." });
  const owner = auth.user(req);
  try {
    if (pathname === "/haru/practice-data/sets") {
      const mine = owner ? (await store.sets(owner)).map(({ id, name, counts }) => ({ id: -id, name, counts })) : [];
      /* 보호자가 문제를 하나라도 넣었으면 그 문제집만 보여 준다 (기본 문제집은 뺀다).
         문제집만 만들고 문제가 없으면 연습할 것이 없으니 기본 문제집을 보여 준다 */
      const hasOwn = mine.some(st => st.counts.dictation + st.counts.qa > 0);
      const sets = hasOwn ? mine : [...mine, ...publicSets.map(({ id, name, counts }) => ({ id, name, counts }))];
      return send(res, 200, { ok: true, sets });
    }
    if (pathname === "/haru/practice-data/items") {
      const query = new URL(req.url, "http://x").searchParams;
      const id = Number(query.get("set"));
      const mode = query.get("mode");
      if (mode !== "qa" && mode !== "dictation") return send(res, 404, { ok: false, message: "문제집을 찾을 수 없어요." });
      if (id < 0 && owner) {
        const st = await store.getSet(-id);
        if (!st || (st.owner ?? null) !== owner) return send(res, 404, { ok: false, message: "문제집을 찾을 수 없어요." });
        const items = (await store.list(st.id, mode)).map(({ id, mode, prompt, answers }) => ({ id, mode, prompt, answers }));
        return send(res, 200, { ok: true, items });
      }
      const set = publicSets.find(entry => entry.id === id);
      if (!set) return send(res, 404, { ok: false, message: "문제집을 찾을 수 없어요." });
      return send(res, 200, { ok: true, items: set.items.filter(item => item.mode === mode) });
    }
    return send(res, 404, { ok: false, message: "학습 자료를 찾을 수 없어요." });
  } catch (e) {
    if (e instanceof StoreError) return send(res, 503, { ok: false, message: "문제 저장소에 연결하지 못했어요. 잠시 후 다시 해 주세요." });
    console.error("타자 연습 오류:", pathname, "—", e && e.message);
    return send(res, 500, { ok: false, message: "잠시 후 다시 시도해 주세요." });
  }
}

module.exports = { handle, handlePublic, warmUp, clean };
