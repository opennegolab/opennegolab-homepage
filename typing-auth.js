const { promisify } = require("node:util");
const { randomBytes, timingSafeEqual, scrypt } = require("node:crypto");

const lifetime = 8 * 60 * 60;
const sessions = new Map();
const cookieName = "typing_guardian";

function token(req) {
  return (req.headers.cookie || "").match(/(?:^|;\s*)typing_guardian=([a-f0-9]{64})(?:;|$)/)?.[1];
}

function user(req) {
  const session = sessions.get(token(req));
  return session && session.expiry > Date.now() ? session.username : undefined;
}

function authorized(req) {
  return user(req) !== undefined;
}

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

function signIn(req, username) {
  const now = Date.now();
  for (const [key, session] of sessions) if (session.expiry <= now) sessions.delete(key);
  sessions.delete(token(req));
  const key = randomBytes(32).toString("hex");
  sessions.set(key, { username, expiry: now + lifetime * 1000 });
  return cookie(req, key, lifetime);
}

function signOut(req) {
  sessions.delete(token(req));
  return cookie(req, "", 0);
}

module.exports = { authorized, user, signIn, signOut, hashPassword, checkPassword };
