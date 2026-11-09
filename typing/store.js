/* ============================================================
   타자 연습 — 채점과 문제 불러오기 (브라우저 쪽)

   문제는 서버에 문제집별로 있다 (typing-api.js). 누가 어느 기기로 접속하든 같은 문제가 나온다.
   채점(Levenshtein 편집거리)과 섞기는 여기, 브라우저 안에서 한다.
   ============================================================ */
(function (root) {
  "use strict";


  /* ---------- 글자 다듬기 ----------
     유니코드 정규화(NFC) — 같은 '가'라도 자모를 따로 담아 보내는 기기가 있다.
     앞뒤 공백은 지우고, 연달아 친 공백은 하나로 본다 (띄어쓰기 자체는 그대로 평가) */
  function clean(s) {
    return String(s == null ? "" : s).normalize("NFC")
      .replace(/[​-‍﻿]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  const chars = s => Array.from(s);   /* 한글 음절 하나 = 한 글자 */

  /* ---------- 채점 ----------
     Levenshtein 편집거리로 점수를 내고, 같은 표를 거꾸로 따라가며
     어느 글자가 틀렸고(sub) 빠졌고(del) 더 들어갔는지(ins) 표시한다 */
  function compare(answer, input) {
    const a = chars(answer), b = chars(input);
    const n = a.length, m = b.length;
    const d = [];
    for (let i = 0; i <= n; i++) { d.push(new Array(m + 1).fill(0)); d[i][0] = i; }
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
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && d[i][j] === d[i - 1][j - 1]) { ops.push({ t: "eq", a: a[i - 1], u: b[j - 1] }); i--; j--; }
      else if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + 1) { ops.push({ t: "sub", a: a[i - 1], u: b[j - 1] }); i--; j--; }
      else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { ops.push({ t: "del", a: a[i - 1] }); i--; }
      else { ops.push({ t: "ins", u: b[j - 1] }); j--; }
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
      if (!best || r.score > best.score || (r.score === best.score && r.dist < best.dist)) best = { ...r, answer: clean(ans) };
    }
    if (!best) best = { score: 0, dist: 0, ops: [], answer: "" };
    return { score: best.score, perfect: best.score === 100, answer: best.answer, input, ops: best.ops, feedback: feedback(best.score) };
  }

  /* 공평하게 섞기 (Fisher–Yates) */
  function randInt(n) {
    const c = root.crypto;
    if (c && c.getRandomValues) {
      const lim = Math.floor(0x100000000 / n) * n, buf = new Uint32Array(1);
      do { c.getRandomValues(buf); } while (buf[0] >= lim);
      return buf[0] % n;
    }
    return Math.floor(Math.random() * n);
  }
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ---------- 저장 (서버) ----------
     문제는 서버(/api/typing/…)에 있다. 누가 어느 기기로 접속하든 같은 문제를 쓴다 */
  async function call(path, body, method) {
    const opt = body === undefined ? {} : { method: method || "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    let r;
    try { r = await fetch("/api/typing" + path, opt); }
    catch (e) { throw new Error("인터넷 연결을 확인해 주세요."); }
    let data = {};
    try { data = await r.json(); } catch (e) {}
    if (!r.ok || data.ok === false) throw new Error(data.message || "잠시 후 다시 해 주세요.");
    return data;
  }

  const store = {
    async status() { return call("/status"); },
    /* 문제집 — [{ id, name, counts: { dictation, qa } }] */
    async sets() { return (await call("/sets")).sets; },
    async createSet(name) { return (await call("/sets", { name })).set; },
    async renameSet(id, name) { return (await call("/sets/" + id, { name }, "PUT")).set; },
    async removeSet(id) { return (await call("/sets/" + id, {}, "DELETE")).removed; },
    /* 문제 */
    async list(setId, mode) { return (await call("/items?set=" + encodeURIComponent(setId) + "&mode=" + encodeURIComponent(mode))).items; },
    /* 여러 개 등록. 하나라도 잘못되면 아무것도 넣지 않는다 */
    async add(setId, mode, list, skipDuplicates) { return call("/items", { set: setId, mode, items: list, skipDuplicates: skipDuplicates !== false }); },
    async update(id, raw) { return (await call("/items/" + id, { prompt: raw.prompt, answers: raw.answers || [] }, "PUT")).item; },
    async remove(ids) { return (await call("/delete", { ids })).removed; },
    /* 출제 — 섞어서 고른다. ids 를 주면(오답 복습·다시 풀기) 그 문제들만 다시 섞는다 */
    async pick(setId, mode, count, ids) {
      let pool = await this.list(setId, mode);
      if (Array.isArray(ids)) { const want = new Set(ids); pool = pool.filter(x => want.has(x.id)); }
      let picked = shuffle(pool);
      const n = count === "all" ? Infinity : Number(count);
      if (Number.isFinite(n) && n > 0) picked = picked.slice(0, Math.floor(n));
      return picked;
    },
  };

  const api = { clean, compare, grade, feedback, shuffle, store };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TypingStore = api;
})(typeof window !== "undefined" ? window : globalThis);
