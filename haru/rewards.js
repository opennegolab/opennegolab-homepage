/* 하루랑 보상 — 별 스티커, 장소 도장, 하루 꾸미기
   ------------------------------------------------------------
   - 학습을 한 판 끝까지 하면 별 1개. 점수와 상관없이 '끝까지 한 것'에 준다
   - 장소(한글 공부·돈 공부·마트·카페·음식점·ATM·패스트푸드)에서 처음 성공하면 그 장소 도장
   - 별이 모이면 하루 꾸미기 아이템이 열린다
   - 이 기기(브라우저)에만 저장한다. 로그인은 필요 없다
   쓰는 곳: 각 학습 화면이 끝날 때 HaruRewards.award('장소'), 내 별 화면(/haru/stars) */
(function () {
  "use strict";

  const KEY = "haru.rewards.v1";
  const BOARD = 10;                     /* 스티커판 한 장의 칸 수 */

  const PLACES = [
    ["typing", "한글 공부"], ["money", "돈 공부"], ["mart", "마트"], ["cafe", "카페"],
    ["food", "음식점"], ["atm", "ATM"], ["burger", "패스트푸드"],
  ];
  const PLACE_NAME = Object.fromEntries(PLACES);
  /* 키오스크 가게 번호 → 도장 장소 (과일가게·채소가게는 마트) */
  const PLACE_OF = { fruit: "mart", vegetable: "mart", mart: "mart", cafe: "cafe", food: "food", atm: "atm", burger: "burger" };

  /* 꾸미기 아이템 — need: 열리는 데 필요한 별 수, slot: 한 자리에 하나만 */
  const ITEMS = [
    { id: "ribbon",  name: "리본",        need: 1,  slot: "head" },
    { id: "flower",  name: "꽃",          need: 3,  slot: "head" },
    { id: "glasses", name: "안경",        need: 5,  slot: "face" },
    { id: "crown",   name: "왕관",        need: 10, slot: "head" },
    { id: "sparkle", name: "반짝이 배경", need: 15, slot: "bg" },
    { id: "rainbow", name: "무지개 배경", need: 20, slot: "bg" },
  ];

  /* 하루 그림(haru-base.webp, 420×508) 위에 얹는 그림. 같은 좌표계를 쓴다 */
  const ART = {
    ribbon: '<g transform="translate(262 72) rotate(18)"><path d="M0 0 L-34 -22 Q-42 0 -34 22 Z" fill="#f28fb0" stroke="#b9476e" stroke-width="4" stroke-linejoin="round"/><path d="M0 0 L34 -22 Q42 0 34 22 Z" fill="#f28fb0" stroke="#b9476e" stroke-width="4" stroke-linejoin="round"/><circle r="10" fill="#f6a9c2" stroke="#b9476e" stroke-width="4"/></g>',
    flower: '<g transform="translate(140 108)">' +
      [0, 72, 144, 216, 288].map(a => '<ellipse cx="0" cy="-17" rx="11" ry="16" transform="rotate(' + a + ')" fill="#ffffff" stroke="#d98a2b" stroke-width="3.5"/>').join("") +
      '<circle r="10" fill="#f5c13a" stroke="#d98a2b" stroke-width="3.5"/></g>',
    glasses: '<g fill="rgba(255,255,255,.25)" stroke="#3b3b4a" stroke-width="6" stroke-linejoin="round"><circle cx="165" cy="196" r="30"/><circle cx="262" cy="196" r="30"/><path d="M195 192 Q213 182 232 192" fill="none"/></g>',
    crown: '<g transform="translate(214 44)"><path d="M-46 14 L-50 -26 L-24 -6 L0 -36 L24 -6 L50 -26 L46 14 Z" fill="#f7c948" stroke="#b07d12" stroke-width="5" stroke-linejoin="round"/><circle cx="0" cy="-2" r="7" fill="#e0567b"/><circle cx="-28" cy="4" r="5" fill="#4f8de0"/><circle cx="28" cy="4" r="5" fill="#4f8de0"/></g>',
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

  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
    if (!d || typeof d !== "object") d = {};
    return {
      stars: Math.max(0, Number(d.stars) || 0),
      stamps: d.stamps && typeof d.stamps === "object" ? d.stamps : {},
      wear: d.wear && typeof d.wear === "object" ? d.wear : {},
    };
  }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

  const unlocked = (d, item) => d.stars >= item.need;

  /* 별 하나 주기. place: 'typing', 'money', 키오스크 가게 번호(fruit·cafe·atm …) */
  function award(place) {
    const d = load();
    const before = d.stars;
    d.stars += 1;
    const key = PLACE_OF[place] || place;
    let newStamp = null;
    if (PLACE_NAME[key] && !d.stamps[key]) {
      d.stamps[key] = { at: new Date().toISOString().slice(0, 10) };
      newStamp = PLACE_NAME[key];
    }
    const newItems = ITEMS.filter(item => before < item.need && d.stars >= item.need);
    /* 처음 열린 꾸미기는 바로 입혀 준다 (같은 자리에 이미 입은 것이 없을 때) */
    for (const item of newItems) if (!d.wear[item.slot]) d.wear[item.slot] = item.id;
    save(d);
    toast(d, newStamp, newItems);
    return d;
  }

  function wear(itemId) {
    const d = load();
    const item = ITEMS.find(x => x.id === itemId);
    if (!item || !unlocked(d, item)) return d;
    d.wear[item.slot] = d.wear[item.slot] === itemId ? null : itemId;   /* 다시 누르면 벗는다 */
    save(d);
    return d;
  }

  /* 꾸민 하루 그림 — 배경은 하루 뒤에, 나머지는 앞에 */
  function figure(d, alt) {
    const ids = Object.values(d.wear).filter(Boolean);
    const layer = (filter, cls) => '<svg class="' + cls + '" viewBox="0 0 420 508" aria-hidden="true">' +
      ids.filter(filter).map(id => ART[id] || "").join("") + "</svg>";
    /* 하루 그림은 바탕이 칠해져 있어서 모든 꾸미기를 그림 앞에 얹는다.
       배경(반짝이·무지개)은 몸과 겹치지 않는 자리에만 그리고, 머리·얼굴 꾸미기보다 먼저 깐다 */
    const isBg = id => (ITEMS.find(x => x.id === id) || {}).slot === "bg";
    return '<div class="haru-dressed">' +
      '<img src="/haru/assets/haru-base.webp" width="420" height="508" alt="' + (alt || "꾸민 하루") + '">' +
      layer(isBg, "haru-dress-back") + layer(id => !isBg(id), "haru-dress-front") + "</div>";
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
@keyframes haru-reward-in{from{opacity:0;transform:translate(-50%,16px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes haru-reward-pop{0%{transform:scale(.3) rotate(-30deg)}60%{transform:scale(1.2)}100%{transform:none}}
@media (prefers-reduced-motion:reduce){.haru-reward-toast,.haru-reward-toast>svg{animation:none}}`;
    document.head.appendChild(s);
  }
  let hideTimer = 0;
  function toast(d, newStamp, newItems) {
    if (!document.body) return;
    style();
    document.querySelectorAll(".haru-reward-toast").forEach(x => x.remove());
    const box = document.createElement("div");
    box.className = "haru-reward-toast";
    box.setAttribute("role", "status");
    const lines = ["모은 별 " + d.stars + "개"];
    if (newStamp) lines.push("'" + newStamp + "' 도장을 받았어요");
    if (newItems.length) lines.push("새 꾸미기: " + newItems.map(x => x.name).join(", "));
    box.innerHTML = STAR + "<strong>별 1개를 받았어요!</strong>" +
      lines.map(t => "<span>" + t + "</span>").join("") +
      '<a href="/haru/stars">내 별 보기</a><button type="button" aria-label="알림 닫기">×</button>';
    box.querySelector("button").addEventListener("click", () => box.remove());
    document.body.appendChild(box);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => box.remove(), 7000);
  }

  window.HaruRewards = { BOARD, PLACES, ITEMS, load, award, wear, figure, unlocked };
})();
