/* 하루랑 보상 — 별 스티커, 장소 도장, 하루 꾸미기
   ------------------------------------------------------------
   - 학습을 한 판 끝까지 하면 별 1개. 점수와 상관없이 '끝까지 한 것'에 준다
   - 장소(한글 공부·돈 공부·마트·카페·음식점·ATM·패스트푸드)에서 처음 성공하면 그 장소 도장
   - 별이 모이면 하루 꾸미기(모자·안경·목도리·옷·신발·배경)가 하나씩 열린다. 별을 쓰지는 않는다
   어디에 저장하나
   - 보호자가 로그인하고 아이를 골랐으면: 서버(그 아이 프로필). 어느 기기에서든 같은 별
   - 둘러보기(로그인 없음): 이 기기(브라우저)에만
   이 파일은 서버(typing-api.js)도 불러 쓴다 — 별·도장·꾸미기 규칙을 한곳에만 둔다.
   그래서 화면(document·window)에 닿는 코드는 브라우저에서만 돈다.
   쓰는 곳: 각 학습 화면이 끝날 때 HaruRewards.award('장소'), 내 별(/haru/stars), 처음 화면(/haru), 아이 고르기(/haru/start) */
(function (root) {
  "use strict";

  const BOARD = 10;                     /* 스티커판 한 장의 칸 수 */

  const PLACES = [
    ["typing", "한글 공부"], ["money", "돈 공부"], ["mart", "마트"], ["cafe", "카페"],
    ["food", "음식점"], ["atm", "ATM"], ["burger", "패스트푸드"],
  ];
  const PLACE_NAME = Object.fromEntries(PLACES);
  /* 키오스크 가게 번호 → 도장 장소 (과일가게·채소가게는 마트) */
  const PLACE_OF = { fruit: "mart", vegetable: "mart", mart: "mart", cafe: "cafe", food: "food", atm: "atm", burger: "burger" };

  /* 꾸미기 자리 — 그리는 순서(뒤 → 앞)와 같다. 자리마다 하나씩만 입는다 */
  const SLOTS = [
    ["bg", "배경"], ["body", "옷"], ["neck", "목도리"], ["feet", "신발"], ["face", "안경"], ["head", "모자"],
  ];
  /* 꾸미기 아이템 — need: 열리는 데 필요한 별 수 */
  const ITEMS = [
    { id: "ribbon",     name: "리본",          need: 1,  slot: "head" },
    { id: "sneakers",   name: "빨간 운동화",   need: 2,  slot: "feet" },
    { id: "flower",     name: "꽃",            need: 3,  slot: "head" },
    { id: "scarf_red",  name: "빨간 목도리",   need: 4,  slot: "neck" },
    { id: "glasses",    name: "안경",          need: 5,  slot: "face" },
    { id: "overalls",   name: "멜빵바지",      need: 6,  slot: "body" },
    { id: "cap",        name: "야구 모자",     need: 8,  slot: "head" },
    { id: "crown",      name: "왕관",          need: 10, slot: "head" },
    { id: "boots",      name: "초록 장화",     need: 12, slot: "feet" },
    { id: "sunglasses", name: "선글라스",      need: 13, slot: "face" },
    { id: "sparkle",    name: "반짝이 배경",   need: 15, slot: "bg" },
    { id: "skirt",      name: "꽃무늬 치마",   need: 16, slot: "body" },
    { id: "scarf_sky",  name: "하늘색 목도리", need: 18, slot: "neck" },
    { id: "rainbow",    name: "무지개 배경",   need: 20, slot: "bg" },
    { id: "beanie",     name: "털모자",        need: 22, slot: "head" },
  ];
  const ITEM = Object.fromEntries(ITEMS.map(x => [x.id, x]));

  /* ---------- 규칙 (서버와 브라우저가 같이 쓴다) ---------- */
  const unlocked = (d, item) => d.stars >= item.need;

  /* 저장된 값 다듬기 — 모르는 장소·아이템, 아직 안 열린 꾸미기는 버린다 */
  function normalize(raw) {
    const d = raw && typeof raw === "object" ? raw : {};
    const stars = Math.min(1000000, Math.max(0, Math.floor(Number(d.stars) || 0)));
    const stamps = {};
    for (const [key] of PLACES) {
      const at = d.stamps && d.stamps[key] && d.stamps[key].at;
      if (typeof at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(at)) stamps[key] = { at };
    }
    const wear = {};
    for (const [slot] of SLOTS) {
      const item = ITEM[d.wear && d.wear[slot]];
      if (item && item.slot === slot && stars >= item.need) wear[slot] = item.id;
    }
    return { stars, stamps, wear };
  }

  /* 별 하나 주기. place: 'typing', 'money', 키오스크 가게 번호(fruit·cafe·atm …), today: 'YYYY-MM-DD' */
  function applyAward(raw, place, today) {
    const d = normalize(raw);
    const before = d.stars;
    d.stars += 1;
    const key = PLACE_OF[place] || place;
    let newStamp = null;
    if (PLACE_NAME[key] && !d.stamps[key]) {
      d.stamps[key] = { at: today };
      newStamp = PLACE_NAME[key];
    }
    const newItems = ITEMS.filter(item => before < item.need && d.stars >= item.need);
    /* 처음 열린 꾸미기는 바로 입혀 준다 (같은 자리에 이미 입은 것이 없을 때) */
    for (const item of newItems) if (!d.wear[item.slot]) d.wear[item.slot] = item.id;
    return { rewards: d, newStamp, newItems: newItems.map(x => x.id) };
  }

  /* 입기·벗기 — 입은 것을 다시 누르면 벗는다 */
  function applyWear(raw, itemId) {
    const d = normalize(raw);
    const item = ITEM[itemId];
    if (!item || !unlocked(d, item)) return d;
    if (d.wear[item.slot] === itemId) delete d.wear[item.slot];
    else d.wear[item.slot] = itemId;
    return d;
  }

  /* 둘러보기에서 모은 별을 아이 프로필에 더할 때 */
  function merge(a, b) {
    const x = normalize(a), y = normalize(b);
    const stamps = { ...y.stamps };
    for (const [k, v] of Object.entries(x.stamps)) if (!stamps[k] || v.at < stamps[k].at) stamps[k] = v;
    return normalize({ stars: x.stars + y.stars, stamps, wear: { ...y.wear, ...x.wear } });
  }

  const today = () => {
    const t = new Date();
    return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
  };

  const rules = { BOARD, PLACES, PLACE_OF, SLOTS, ITEMS, normalize, applyAward, applyWear, merge, unlocked };
  if (typeof module === "object" && module.exports) { module.exports = rules; return; }

  /* ---------- 그림 — 하루 그림(haru-base.webp, 420×508) 위에 얹는다. 같은 좌표계 ---------- */
  const LINE = ' stroke-width="5" stroke-linejoin="round" stroke-linecap="round"';
  const shoe = (cx, fill, stroke) =>
    '<path d="M' + (cx - 31) + ' 452 L' + (cx - 31) + ' 433 Q' + (cx - 29) + ' 414 ' + (cx - 9) + ' 414 L' + (cx + 9) + ' 414 Q' + (cx + 31) + ' 416 ' + (cx + 33) + ' 438 L' + (cx + 33) + ' 452 Z" fill="' + fill + '" stroke="' + stroke + '"' + LINE + '/>' +
    '<rect x="' + (cx - 33) + '" y="443" width="68" height="11" rx="5.5" fill="#fffaf0" stroke="' + stroke + '" stroke-width="4"/>' +
    '<path d="M' + (cx - 12) + ' 424 L' + (cx + 6) + ' 424 M' + (cx - 12) + ' 432 L' + (cx + 6) + ' 432" stroke="#fffaf0" stroke-width="3.5" stroke-linecap="round"/>';
  const boot = (cx, fill, stroke) =>
    '<path d="M' + (cx - 29) + ' 453 L' + (cx - 29) + ' 404 L' + (cx + 23) + ' 404 L' + (cx + 23) + ' 428 Q' + (cx + 35) + ' 431 ' + (cx + 35) + ' 445 L' + (cx + 35) + ' 453 Z" fill="' + fill + '" stroke="' + stroke + '"' + LINE + '/>' +
    '<rect x="' + (cx - 32) + '" y="398" width="58" height="14" rx="7" fill="#9fd18b" stroke="' + stroke + '" stroke-width="4"/>';
  const scarf = (fill, light, stroke) =>
    '<g stroke="' + stroke + '"' + LINE + '>' +
    '<path d="M101 262 Q210 292 319 260 L318 290 Q304 320 210 328 Q118 322 104 294 Z" fill="' + fill + '"/>' +
    '<path d="M236 318 L298 300 L316 360 L258 389 Z" fill="' + fill + '"/>' +
    '<path d="M120 286 Q210 306 300 284 M262 318 L280 372" fill="none" stroke="' + light + '" stroke-width="4"/></g>';
  const lens = (fill) => '<circle cx="165" cy="196" r="30" fill="' + fill + '"/><circle cx="262" cy="196" r="30" fill="' + fill + '"/>';

  const ART = {
    ribbon: '<g transform="translate(262 72) rotate(18)"><path d="M0 0 L-34 -22 Q-42 0 -34 22 Z" fill="#f28fb0" stroke="#b9476e" stroke-width="4" stroke-linejoin="round"/><path d="M0 0 L34 -22 Q42 0 34 22 Z" fill="#f28fb0" stroke="#b9476e" stroke-width="4" stroke-linejoin="round"/><circle r="10" fill="#f6a9c2" stroke="#b9476e" stroke-width="4"/></g>',
    flower: '<g transform="translate(140 108)">' +
      [0, 72, 144, 216, 288].map(a => '<ellipse cx="0" cy="-17" rx="11" ry="16" transform="rotate(' + a + ')" fill="#ffffff" stroke="#d98a2b" stroke-width="3.5"/>').join("") +
      '<circle r="10" fill="#f5c13a" stroke="#d98a2b" stroke-width="3.5"/></g>',
    crown: '<g transform="translate(214 44)"><path d="M-46 14 L-50 -26 L-24 -6 L0 -36 L24 -6 L50 -26 L46 14 Z" fill="#f7c948" stroke="#b07d12" stroke-width="5" stroke-linejoin="round"/><circle cx="0" cy="-2" r="7" fill="#e0567b"/><circle cx="-28" cy="4" r="5" fill="#4f8de0"/><circle cx="28" cy="4" r="5" fill="#4f8de0"/></g>',
    /* 야구 모자 — 머리 꼭대기를 덮는 둥근 모자 + 앞챙 */
    cap: '<g stroke="#2d4a6b"' + LINE + '><path d="M136 122 Q138 48 218 42 Q298 48 300 122 Z" fill="#6fa8dc"/>' +
      '<path d="M218 44 L218 120 M176 54 Q164 86 166 120 M260 54 Q272 86 270 120" fill="none" stroke-width="3"/>' +
      '<path d="M124 124 Q218 104 312 124 Q304 150 218 143 Q132 150 124 124 Z" fill="#4f86c0"/><circle cx="218" cy="43" r="8" fill="#4f86c0"/></g>',
    /* 털모자 — 방울 + 접은 단 */
    beanie: '<g stroke="#8c3b3b"' + LINE + '><path d="M134 120 Q136 48 218 40 Q300 48 302 120 Z" fill="#e0726b"/>' +
      '<rect x="124" y="106" width="188" height="32" rx="15" fill="#f2a29b"/>' +
      '<path d="M150 110 L150 134 M178 108 L178 136 M206 108 L206 136 M234 108 L234 136 M262 108 L262 136 M290 110 L290 134" stroke-width="3"/>' +
      '<circle cx="218" cy="34" r="18" fill="#fff4ea"/></g>',
    glasses: '<g fill="rgba(255,255,255,.25)" stroke="#3b3b4a" stroke-width="6" stroke-linejoin="round">' + lens("rgba(255,255,255,.25)") + '<path d="M195 192 Q213 182 232 192" fill="none"/></g>',
    sunglasses: '<g stroke="#26262f" stroke-width="6" stroke-linejoin="round">' + lens("#3a3a48") +
      '<path d="M195 192 Q213 182 232 192" fill="none"/></g>' +
      '<path d="M148 184 Q156 176 166 178 M245 184 Q253 176 263 178" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="4" stroke-linecap="round"/>',
    scarf_red: scarf("#e46b63", "#f4a6a0", "#8c2f2a"),
    scarf_sky: scarf("#7fb6e8", "#c3defa", "#2f5f8f"),
    /* 멜빵바지 — 배 아래쪽을 덮는 바지 + 어깨끈 두 줄 + 단추 */
    overalls: '<path d="M165 326 L165 390 M233 326 L233 390" stroke="#2d4f80" stroke-width="18"/><path d="M165 328 L165 390 M233 328 L233 390" stroke="#5b8ed6" stroke-width="10"/>' +
      '<g stroke="#2d4f80"' + LINE + '>' +
      '<path d="M116 384 L304 384 Q302 420 272 432 Q210 444 148 432 Q118 420 116 384 Z" fill="#5b8ed6"/>' +
      '<rect x="190" y="396" width="42" height="24" rx="6" fill="#80aae4" stroke-width="3.5"/>' +
      '<circle cx="165" cy="388" r="6" fill="#f7c948" stroke-width="3"/><circle cx="233" cy="388" r="6" fill="#f7c948" stroke-width="3"/></g>',
    /* 꽃무늬 치마 — 아래로 퍼지는 치마 + 점 무늬 */
    skirt: '<g stroke="#a8466e"' + LINE + '><path d="M120 380 L300 380 L316 430 Q210 448 104 430 Z" fill="#f5a3c3"/>' +
      [[142, 404], [180, 420], [214, 398], [250, 420], [284, 404]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="6" fill="#fff6fa" stroke-width="2.5"/>').join("") +
      '<path d="M120 380 L300 380" stroke-width="7"/></g>',
    sneakers: '<g>' + shoe(162, "#e46b63", "#8c2f2a") + shoe(259, "#e46b63", "#8c2f2a") + '</g>',
    boots: '<g>' + boot(162, "#5aa469", "#2c6338") + boot(259, "#5aa469", "#2c6338") + '</g>',
    sparkle: [[60, 90, 1], [360, 70, 1.3], [380, 260, .9], [40, 300, 1.1], [330, 420, .8], [90, 450, .9]]
      .map(([x, y, k]) => '<path transform="translate(' + x + ' ' + y + ') scale(' + k + ')" d="M0 -22 L6 -6 L22 0 L6 6 L0 22 L-6 6 L-22 0 L-6 -6 Z" fill="#f7c948" stroke="#d39b12" stroke-width="2"/>').join(""),
    /* 하루 몸(가운데)을 비워 두고 양옆만 그린다 — 무지개가 하루 뒤로 지나가는 것처럼 보인다 */
    rainbow: '<defs><clipPath id="haru-rainbow-sides"><rect x="0" y="0" width="86" height="508"/><rect x="334" y="0" width="86" height="508"/></clipPath></defs>' +
      '<g fill="none" stroke-width="11" clip-path="url(#haru-rainbow-sides)">' +
      ["#f28b82", "#f7c948", "#9fd18b", "#7fb2e5", "#b39ddb"].map((c, i) => {
        const r = 200 - i * 11;
        return '<path d="M' + (210 - r) + ' 440 A' + r + ' ' + r + ' 0 0 1 ' + (210 + r) + ' 440" stroke="' + c + '"/>';
      }).join("") + '</g>',
  };
  /* 아이템 미리보기에서 보여 줄 부분 (viewBox) */
  const VIEW = { head: "96 0 240 170", face: "116 150 196 96", neck: "88 240 246 160", body: "90 300 240 160", feet: "108 380 210 86", bg: "0 0 420 508" };

  const ordered = wear => SLOTS.map(([slot]) => wear[slot]).filter(Boolean);
  /* 꾸민 하루 그림 — 하루 그림은 바탕이 칠해져 있어서 모든 꾸미기를 그림 앞에 얹는다.
     배경(반짝이·무지개)은 몸과 겹치지 않는 자리에만 그리고, 다른 꾸미기보다 먼저 깐다 */
  function figure(d, alt) {
    return '<div class="haru-dressed">' +
      '<img src="/haru/assets/haru-base.webp" width="420" height="508" alt="' + (alt || "꾸민 하루") + '">' +
      '<svg class="haru-dress-front" viewBox="0 0 420 508" aria-hidden="true">' +
      ordered(d.wear || {}).map(id => ART[id] || "").join("") + "</svg></div>";
  }
  /* 아이템 하나를 하루 위에 입힌 작은 그림 */
  function preview(itemId) {
    const item = ITEM[itemId];
    if (!item) return "";
    return '<svg class="haru-item-preview" viewBox="' + VIEW[item.slot] + '" aria-hidden="true">' +
      '<image href="/haru/assets/haru-base.webp" width="420" height="508"/>' + ART[itemId] + "</svg>";
  }

  /* ---------- 저장 — 둘러보기는 이 기기, 아이를 골랐으면 서버 ---------- */
  const LOCAL = "haru.rewards.v1";          /* 둘러보기 별 (예전부터 쓰던 이름) */
  const PROFILE = "haru.profile.v1";        /* 누가 쓰는지 (서버 답을 기억해 둔 것) */
  const CHILD = "haru.child-rewards.v1";    /* 고른 아이의 별 (서버 값을 기억해 둔 것 — 화면을 바로 그리려고) */
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; } };
  const write = (key, v) => { try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} };

  let profile = read(PROFILE) || {};
  const childMode = () => !!(profile.guardian && profile.child);
  function load() {
    if (childMode()) {
      const c = read(CHILD);
      return normalize(c && c.id === profile.child.id ? c.rewards : null);
    }
    return normalize(read(LOCAL));
  }
  const setChildRewards = rewards => write(CHILD, { id: profile.child.id, rewards: normalize(rewards) });
  const changed = () => { try { window.dispatchEvent(new CustomEvent("haru-rewards")); } catch (e) {} };

  function setProfile(me) {
    profile = me && me.guardian ? { guardian: me.guardian, child: me.child ? { id: me.child.id, name: me.child.name } : null } : {};
    write(PROFILE, profile);
    if (me && me.child) setChildRewards(me.child.rewards);
    else write(CHILD, null);
    changed();
  }
  /* 서버에 물어 누가 쓰는지 확인한다. 로그인이 끝났거나 다른 기기에서 별을 받았으면 여기서 바로잡는다 */
  function refresh() {
    return fetch("/api/typing/me", { credentials: "same-origin", cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error("me " + r.status)))
      .then(me => { setProfile(me); return profile; })
      .catch(() => profile);                 /* 인터넷이 끊겼으면 기억해 둔 것을 쓴다 */
  }
  const ready = refresh();

  async function post(action, body) {
    const r = await fetch("/api/typing/rewards", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw Object.assign(new Error(data.message || "저장하지 못했어요."), { status: r.status });
    return data;
  }

  async function award(place) {
    await ready;
    if (!childMode()) {
      const r = applyAward(read(LOCAL), place, today());
      write(LOCAL, r.rewards);
      changed();
      toast(r.rewards, r.newStamp, r.newItems);
      return r.rewards;
    }
    try {
      const r = await post("award", { place: PLACE_OF[place] || place });
      setChildRewards(r.rewards);
      changed();
      toast(r.rewards, r.newStamp, r.newItems);
      return r.rewards;
    } catch (e) {
      if (e.status === 401 || e.status === 409) await refresh();   /* 로그인이 끝났거나 아이 선택이 풀렸다 */
      toastError();
      return load();
    }
  }

  /* 화면은 바로 바꾸고, 서버 저장은 뒤에서 한다. 실패하면 서버 값으로 되돌린다 */
  function wear(itemId) {
    const d = applyWear(load(), itemId);
    if (!childMode()) { write(LOCAL, d); changed(); return d; }
    setChildRewards(d);
    changed();
    post("wear", { item: itemId }).then(r => { setChildRewards(r.rewards); changed(); }, () => refresh());
    return d;
  }

  /* ---------- 별을 받았다는 알림 ---------- */
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.6 2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z" fill="#f7c948" stroke="#b07d12" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  function style() {
    if (document.getElementById("haru-reward-style")) return;
    const s = document.createElement("style");
    s.id = "haru-reward-style";
    s.textContent = `
.haru-reward-toast{position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:50;
  width:min(440px,calc(100% - 24px));display:grid;grid-template-columns:auto 1fr;gap:.15rem .8rem;align-items:center;
  padding:.8rem 1rem;border:2px solid #f0d27a;border-radius:1.1rem;background:#fffdf4;color:#26362c;
  box-shadow:0 12px 30px -10px rgba(60,48,20,.45);font-family:Pretendard,"Noto Sans KR","Malgun Gothic",system-ui,sans-serif;
  animation:haru-reward-in .35s ease-out}
.haru-reward-toast>svg{grid-column:1;grid-row:1 / span 4;align-self:start;width:46px;height:46px;animation:haru-reward-pop .6s ease-out}
.haru-reward-toast strong{grid-column:2;font-size:1.1rem;padding-right:1.6rem;word-break:keep-all}
.haru-reward-toast span{grid-column:2;font-size:.92rem;color:#526456;word-break:keep-all}
.haru-reward-toast a{grid-column:2;justify-self:start;margin-top:.4rem;padding:.5rem .9rem;border-radius:.8rem;background:#24543c;color:#fff;font-weight:800;text-decoration:none;white-space:nowrap;min-height:44px;display:inline-flex;align-items:center}
.haru-reward-toast button{position:absolute;top:2px;right:4px;border:0;background:none;font-size:1.1rem;color:#526456;cursor:pointer;padding:.25rem .45rem}
.haru-reward-toast.is-error{border-color:#e7b6b6}
@keyframes haru-reward-in{from{opacity:0;transform:translate(-50%,16px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes haru-reward-pop{0%{transform:scale(.3) rotate(-30deg)}60%{transform:scale(1.2)}100%{transform:none}}
@media (prefers-reduced-motion:reduce){.haru-reward-toast,.haru-reward-toast>svg{animation:none}}`;
    document.head.appendChild(s);
  }
  let hideTimer = 0;
  function show(html, cls) {
    if (!document.body) return;
    style();
    document.querySelectorAll(".haru-reward-toast").forEach(x => x.remove());
    const box = document.createElement("div");
    box.className = "haru-reward-toast" + (cls ? " " + cls : "");
    box.setAttribute("role", "status");
    box.innerHTML = html + '<button type="button" aria-label="알림 닫기">×</button>';
    box.querySelector("button").addEventListener("click", () => box.remove());
    document.body.appendChild(box);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => box.remove(), 7000);
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function toast(d, newStamp, newItems) {
    const who = childMode() ? esc(profile.child.name) + "의 별 " : "모은 별 ";
    const lines = [who + d.stars + "개"];
    if (newStamp) lines.push("'" + newStamp + "' 도장을 받았어요");
    if (newItems.length) lines.push("새 꾸미기: " + newItems.map(id => ITEM[id].name).join(", "));
    show(STAR + "<strong>별 1개를 받았어요!</strong>" + lines.map(t => "<span>" + t + "</span>").join("") +
      '<a href="/haru/stars">내 별 보기</a>');
  }
  function toastError() {
    show(STAR + "<strong>별을 저장하지 못했어요</strong><span>인터넷 연결을 확인해 주세요. 다음에 끝내면 다시 받을 수 있어요.</span>", "is-error");
  }

  root.HaruRewards = {
    ...rules, ART, load, award, wear, figure, preview, ready, refresh,
    profile: () => profile, setProfile, readLocal: () => normalize(read(LOCAL)), clearLocal: () => { write(LOCAL, null); changed(); },
  };
})(typeof window !== "undefined" ? window : globalThis);
