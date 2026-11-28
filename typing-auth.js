/* 보호자 로그인 세션
   - 로그인하면 30일 동안 유지한다 (하루랑을 열 때마다 로그인하지 않게)
   - DB 가 있으면 세션을 DB(typing_sessions)에도 적어 둔다 — 서버가 다시 켜져도(배포) 로그인이 풀리지 않는다.
     쿠키 값 그대로가 아니라 SHA-256 으로 바꾼 값만 저장한다
   - 세션에는 지금 고른 아이(child)도 적는다. 하루랑 별·꾸미기는 그 아이 프로필에 쌓인다
   - DB 가 없으면(메모리 모드) 서버 메모리에만 둔다 */
const { promisify } = require("node:util");
const { randomBytes, timingSafeEqual, scrypt, createHash } = require("node:crypto");

const lifetime = 30 * 24 * 60 * 60;          /* 초 */
const sessions = new Map();                  /* 키(해시) → { username, child, expiry } — DB 값의 사본 */
const cookieName = "typing_guardian";
let store = null;                            /* typing-api.js 가 넣어 준다: load·save·remove·setChild */

function useStore(s) { store = s; }

function token(req) {
  return (req.headers.cookie || "").match(/(?:^|;\s*)typing_guardian=([a-f0-9]{64})(?:;|$)/)?.[1];
}
const digest = t => createHash("sha256").update(t).digest("hex");

/* 지금 요청의 세션 { key, username, child } — 없거나 끝났으면 null */
async function session(req) {
  const t = token(req);
  if (!t) return null;
  const key = digest(t);
  let s = sessions.get(key);
  if (!s && store) {
    try { s = await store.load(key); } catch { s = null; }
    if (s) sessions.set(key, s);
  }
  if (!s) return null;
  if (s.expiry <= Date.now()) { sessions.delete(key); return null; }
  return { key, username: s.username, child: s.child ?? null };
}

async function user(req) { return (await session(req))?.username; }
async function authorized(req) { return (await user(req)) !== undefined; }

const derive = promisify(scrypt);
async function hashPassword(input) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + (await derive(input, salt, 64)).toString("hex");
}

async function checkPassword(input, hash) {
  // 등록되지 않은 계정에도 같은 비용의 해시 연산을 수행합니다.
  const [salt, expected] = (hash || ("0".repeat(32) + ":" + "0".repeat(128))).split(":");
  const match = timingSafeEqual(await derive(input, salt, 64), Buffer.from(expected, "hex"));
  return Boolean(hash) && match;
}

function cookie(req, value, age) {
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || "");
  return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${local ? "" : "; Secure"}`;
}

async function signIn(req, username) {
  const now = Date.now();
  for (const [key, s] of sessions) if (s.expiry <= now) sessions.delete(key);
  await forget(req);
  const t = randomBytes(32).toString("hex");
  const s = { username, child: null, expiry: now + lifetime * 1000 };
  if (store) await store.save(digest(t), s);
  sessions.set(digest(t), s);
  return cookie(req, t, lifetime);
}

async function forget(req) {
  const t = token(req);
  if (!t) return;
  sessions.delete(digest(t));
  if (store) { try { await store.remove(digest(t)); } catch {} }
}

async function signOut(req) {
  await forget(req);
  return cookie(req, "", 0);
}

/* 이 세션에서 공부할 아이를 고른다 (null 이면 고르지 않은 상태) */
async function setChild(req, child) {
  const s = await session(req);
  if (!s) return false;
  if (store) await store.setChild(s.key, child);
  const cached = sessions.get(s.key);
  if (cached) cached.child = child;
  return true;
}

module.exports = { authorized, user, session, signIn, signOut, setChild, useStore, hashPassword, checkPassword };
