const { createHash, randomBytes, timingSafeEqual } = require("node:crypto");

const lifetime = 8 * 60 * 60;
const sessions = new Map();
const cookieName = "typing_guardian";
const password = process.env.TYPING_ADMIN_PASSWORD || "";
const digest = value => createHash("sha256").update(value).digest();

function token(req) {
  return (req.headers.cookie || "").match(/(?:^|;\s*)typing_guardian=([a-f0-9]{64})(?:;|$)/)?.[1];
}

function authorized(req) {
  return password.length >= 12 && sessions.get(token(req)) > Date.now();
}

function cookie(req, value, age) {
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || "");
  return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${local ? "" : "; Secure"}`;
}

function signIn(req, input) {
  if (password.length < 12 || typeof input !== "string" || !timingSafeEqual(digest(input), digest(password))) return null;
  const now = Date.now();
  for (const [key, expiry] of sessions) if (expiry <= now) sessions.delete(key);
  sessions.delete(token(req));
  const key = randomBytes(32).toString("hex");
  sessions.set(key, now + lifetime * 1000);
  return cookie(req, key, lifetime);
}

function signOut(req) {
  sessions.delete(token(req));
  return cookie(req, "", 0);
}

module.exports = { authorized, signIn, signOut, enabled: password.length >= 12 };
