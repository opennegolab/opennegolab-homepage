/* ============================================================
   문의 접수 — 폼 내용을 SMTP로 바로 메일 발송한다.
   시뮬레이터(backup-mail.js)와 같은 SMTP_* 환경변수를 쓰므로,
   Cloudtype에 이미 넣어 둔 값을 그대로 재사용하면 된다.

   환경변수
     SMTP_HOST, SMTP_USER, SMTP_PASS   (필수)
     SMTP_PORT                          (선택, 기본 465)
     SMTP_FROM                          (선택, 기본 SMTP_USER)
     INQUIRY_MAIL_TO                    (선택, 기본 negomaster@opennegolab.com)
   미설정이면 접수를 받지 않고, 방문자에게 이메일로 보내달라고 안내한다.
   ============================================================ */
const nodemailer = require("nodemailer");

const TO = process.env.INQUIRY_MAIL_TO || "negomaster@opennegolab.com";

function configured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transporter() {
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

/* 같은 곳에서 쏟아지는 요청을 막는다. 서버 재시작하면 비워지지만
   문의 폼 규모에서는 이 정도로 충분하다 */
const hits = new Map();
const WINDOW = 60 * 60 * 1000;
const LIMIT = 5;

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < WINDOW);
  if (list.length >= LIMIT) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();           // 메모리가 계속 불어나지 않도록
  return false;
}

const clean = (v, max) => String(v == null ? "" : v).replace(/[\r\n]+/g, " ").trim().slice(0, max);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > limit) { reject(new Error("too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handle(req, res) {
  const done = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(obj));
  };

  if (req.method !== "POST") return done(405, { ok: false, message: "허용되지 않은 요청입니다." });

  let body;
  try { body = JSON.parse(await readBody(req) || "{}"); }
  catch { return done(400, { ok: false, message: "요청을 읽지 못했습니다." }); }

  /* 사람 눈에 안 보이는 칸 — 자동 프로그램만 여기를 채운다.
     채워져 있으면 조용히 성공으로 응답하고 메일은 보내지 않는다 */
  if (clean(body.website, 80)) return done(200, { ok: true });

  const kind = clean(body.kind, 40) || "기타";
  const name = clean(body.name, 60);
  const company = clean(body.company, 80);
  const phone = clean(body.phone, 40);
  const email = clean(body.email, 120);
  const message = String(body.message == null ? "" : body.message).trim().slice(0, 4000);

  if (!name || !phone || !email || !message) {
    return done(400, { ok: false, message: "필수 항목을 모두 채워 주세요." });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return done(400, { ok: false, message: "이메일 주소를 확인해 주세요." });
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";
  if (rateLimited(ip)) {
    return done(429, { ok: false, message: "잠시 후 다시 시도해 주세요. 급하시면 negomaster@opennegolab.com 으로 보내주셔도 됩니다." });
  }

  if (!configured()) {
    console.warn("문의 접수: SMTP 미설정 — SMTP_HOST/USER/PASS 환경변수를 넣어 주세요.");
    return done(503, { ok: false, message: "지금은 접수가 어렵습니다. negomaster@opennegolab.com 으로 보내주시면 확인하겠습니다." });
  }

  const rows = [["문의 구분", kind], ["이름", name], ["회사명", company || "—"],
                ["연락처", phone], ["이메일", email]];
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\n문의 내용\n${message}`;
  const html =
    `<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">` +
    rows.map(([k, v]) =>
      `<tr><td style="padding:6px 14px 6px 0;color:#667085">${esc(k)}</td>` +
      `<td style="padding:6px 0"><b>${esc(v)}</b></td></tr>`).join("") +
    `</table><p style="font-family:sans-serif;font-size:14px;line-height:1.7;white-space:pre-wrap">` +
    `${esc(message)}</p>`;

  try {
    await transporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: TO,
      replyTo: `${name} <${email}>`,          /* 받은 메일에서 바로 답장하면 문의자에게 간다 */
      subject: `[홈페이지 문의] ${kind} · ${name}${company ? " (" + company + ")" : ""}`,
      text, html,
    });
    return done(200, { ok: true });
  } catch (e) {
    console.error("문의 메일 발송 실패:", e && e.message);
    return done(502, { ok: false, message: "전송에 실패했습니다. negomaster@opennegolab.com 으로 보내주시면 확인하겠습니다." });
  }
}

module.exports = { handle, configured };
