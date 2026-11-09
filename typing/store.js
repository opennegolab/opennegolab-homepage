/* ============================================================
   타자 연습 — 문제 저장과 채점 (브라우저 안에서만)

   문제는 이 기기·이 브라우저의 localStorage 에만 저장한다.
   서버로 보내지 않으므로 사람마다 자기가 만든 문제로 연습한다.
   다른 기기로 옮기려면 문제 관리 화면에서 내보내기 → 가져오기를 쓴다.

   브라우저 저장 공간을 쓸 수 없으면(사생활 보호 모드 등) 이 창에서만
   기억하고, 화면에 그렇게 알린다.
   ============================================================ */
(function (root) {
  "use strict";

  const KEY = "typing.bank.v1";
  const MAX_TEXT = 200;
  const MAX_ANSWERS = 10;

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

  /* ---------- 저장 ---------- */
  const SAMPLES = {
    dictation: ["오늘은 날씨가 좋아요.", "나무", "학교에 가요.", "친구와 함께 놀아요.", "사과가 빨개요.",
      "엄마, 사랑해요.", "고양이가 잠을 자요.", "하늘이 파래요.", "책을 읽어요.", "손을 깨끗이 씻어요."],
    qa: [
      ["우리나라의 수도는?", ["서울", "서울특별시"]],
      ["일주일은 며칠일까요?", ["7일", "칠일", "7", "일주일은 7일"]],
      ["하늘은 무슨 색일까요?", ["파란색", "하늘색", "파랑"]],
      ["사과는 무슨 색일까요?", ["빨간색", "빨강"]],
      ["1 더하기 1은?", ["2", "이"]],
      ["봄 다음에 오는 계절은?", ["여름"]],
    ],
  };

  let memory = null;          /* 브라우저 저장소를 못 쓸 때 대신 쓰는 곳 */
  let persistent = true;

  function samples() {
    const now = Date.now();
    let seq = 0;
    const items = [];
    for (const t of SAMPLES.dictation) items.push({ id: ++seq, mode: "dictation", prompt: t, answers: [], at: now });
    for (const [q, a] of SAMPLES.qa) items.push({ id: ++seq, mode: "qa", prompt: q, answers: a.slice(), at: now });
    return { v: 1, seq, items };
  }

  function load() {
    if (memory) return memory;
    let raw = null;
    try { raw = root.localStorage.getItem(KEY); }
    catch (e) { persistent = false; memory = samples(); return memory; }
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.items)) return { v: 1, seq: Number(d.seq) || 0, items: d.items };
      } catch (e) {}
    }
    /* 처음 열었을 때만 예시 문제를 넣는다. 다 지운 뒤에는 다시 생기지 않는다 */
    const fresh = samples();
    save(fresh);
    return fresh;
  }

  function save(data) {
    if (memory) { memory = data; return; }
    try { root.localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) {
      persistent = false;
      memory = data;
      if (e && /quota/i.test(String(e.name || e.message))) throw new Error("이 기기의 저장 공간이 가득 찼어요.");
    }
  }

  class InputError extends Error {}

  function checkItem(mode, raw) {
    const prompt = clean(raw && raw.prompt);
    if (!prompt) throw new InputError(mode === "qa" ? "질문을 입력해 주세요." : "문장을 입력해 주세요.");
    if (chars(prompt).length > MAX_TEXT) throw new InputError(MAX_TEXT + "자보다 길게 쓸 수 없어요: " + prompt.slice(0, 20) + "…");
    const answers = [];
    if (mode === "qa") {
      const seen = new Set();
      for (const a of Array.isArray(raw.answers) ? raw.answers : []) {
        const c = clean(a);
        if (!c || seen.has(c)) continue;
        if (chars(c).length > MAX_TEXT) throw new InputError("정답은 " + MAX_TEXT + "자보다 길게 쓸 수 없어요.");
        seen.add(c); answers.push(c);
      }
      if (!answers.length) throw new InputError("정답이 없어요: " + prompt);
      if (answers.length > MAX_ANSWERS) throw new InputError("정답은 " + MAX_ANSWERS + "개까지 넣을 수 있어요: " + prompt);
    }
    return { prompt, answers };
  }
  function checkMode(m) {
    if (m !== "dictation" && m !== "qa") throw new InputError("알 수 없는 연습 종류예요.");
    return m;
  }
  const copy = x => ({ id: x.id, mode: x.mode, prompt: x.prompt, answers: x.answers.slice(), at: x.at });

  const store = {
    persistent() { load(); return persistent; },
    list(mode) { return load().items.filter(x => x.mode === mode).map(copy); },
    get(id) { const x = load().items.find(x => x.id === id); return x ? copy(x) : null; },
    counts() {
      const out = { dictation: 0, qa: 0 };
      for (const x of load().items) if (x.mode in out) out[x.mode]++;
      return out;
    },
    /* 여러 개 등록. 같은 문제가 이미 있으면 건너뛸 수 있다 */
    add(mode, list, skipDuplicates) {
      checkMode(mode);
      const checked = list.map(x => checkItem(mode, x));
      const data = load();
      const existing = new Set(data.items.filter(x => x.mode === mode).map(x => x.prompt));
      let skipped = 0;
      const added = [];
      for (const x of checked) {
        if (skipDuplicates !== false && existing.has(x.prompt)) { skipped++; continue; }
        existing.add(x.prompt);
        const item = { id: ++data.seq, mode, prompt: x.prompt, answers: x.answers, at: Date.now() };
        data.items.push(item);
        added.push(copy(item));
      }
      if (added.length) save(data);
      return { added: added.length, skipped, items: added };
    },
    update(id, raw) {
      const data = load();
      const x = data.items.find(x => x.id === id);
      if (!x) throw new InputError("이미 지워진 문제예요.");
      const c = checkItem(x.mode, raw);
      x.prompt = c.prompt; x.answers = c.answers; x.at = Date.now();
      save(data);
      return copy(x);
    },
    remove(ids) {
      const set = new Set(ids);
      const data = load();
      const before = data.items.length;
      data.items = data.items.filter(x => !set.has(x.id));
      const n = before - data.items.length;
      if (n) save(data);
      return n;
    },
    /* 출제 — 섞어서 고른다. ids 를 주면(오답 복습·다시 풀기) 그 문제들만 다시 섞는다 */
    pick(mode, count, ids) {
      let pool = this.list(checkMode(mode));
      if (Array.isArray(ids)) { const want = new Set(ids); pool = pool.filter(x => want.has(x.id)); }
      let picked = shuffle(pool);
      const n = count === "all" ? Infinity : Number(count);
      if (Number.isFinite(n) && n > 0) picked = picked.slice(0, Math.floor(n));
      return picked;
    },
  };

  const api = { KEY, clean, compare, grade, feedback, shuffle, store, InputError };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TypingStore = api;
})(typeof window !== "undefined" ? window : globalThis);
