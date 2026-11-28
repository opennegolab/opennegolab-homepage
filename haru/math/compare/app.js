/* 수학 › 비교하기 — 길이·높이·크기·무게·개수·수를 그림으로 비교한다
   - 한 판 5문제. 두 그림 중 맞는 것을 누른다. 틀리면 힌트를 주고 다시 고르게 한다
   - 한 판을 끝까지 하면 하루랑 별 1개 (HaruRewards.award('math'))
   - 그림은 모두 SVG 도형 — 문제마다 크기·색을 새로 정한다 */
import { screenHistory } from '/haru/navigation.js?v=1';
import { showSpeechHelp, speak, stopSpeech, prepareSpeech } from '/typing/learn/speech.js?v=2';

const ROUND = 5;
const app = document.querySelector('#compare-app');
const back = document.querySelector('#compare-back');
const voiceStatus = document.querySelector('#voice-status');

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = list => list[Math.floor(Math.random() * list.length)];
/* 받침이 있으면 '이', 없으면 '가' (숫자는 읽는 소리로) */
function subject(word) {
  const last = String(word).trim().slice(-1);
  if (/\d/.test(last)) return word + ('013678'.includes(last) ? '이' : '가');
  const code = last.charCodeAt(0) - 0xac00;
  return word + (code >= 0 && code <= 11171 && code % 28 ? '이' : '가');
}
const object = word => {                         /* 을/를 */
  const code = String(word).slice(-1).charCodeAt(0) - 0xac00;
  return word + (code >= 0 && code <= 11171 && code % 28 ? '을' : '를');
};

const COLORS = [
  ['빨간', '#e46b63', '#8c2f2a'], ['파란', '#5b8ed6', '#2d4f80'], ['초록', '#5aa469', '#2c6338'],
  ['노란', '#f0c23a', '#94700e'], ['보라', '#a58be6', '#5e43a8'], ['주황', '#f0965e', '#a3532a'],
];
const twoColors = () => { const a = pick(COLORS); return [a, pick(COLORS.filter(c => c !== a))]; };
/* 서로 넉넉히 다른 두 값 */
function twoValues(min, max, gap) {
  for (;;) { const a = rand(min, max), b = rand(min, max); if (Math.abs(a - b) >= gap) return [a, b]; }
}
const svg = (box, body, label) => `<svg viewBox="${box}" role="img" aria-label="${label}">${body}</svg>`;

/* ---------- 그림 ---------- */
function pencil(len, [, fill, line]) {
  const x2 = 12 + len;
  return `<rect x="12" y="14" width="${len - 28}" height="34" rx="5" fill="${fill}" stroke="${line}" stroke-width="3"/>` +
    `<path d="M${x2 - 28} 14 L${x2} 31 L${x2 - 28} 48 Z" fill="#f5deb3" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M${x2 - 9} 26 L${x2} 31 L${x2 - 9} 36 Z" fill="#3b3b4a"/>` +
    `<rect x="5" y="14" width="12" height="34" rx="4" fill="#f2a7b8" stroke="${line}" stroke-width="3"/>`;
}
function building(h, [, fill, line]) {
  const top = 166 - h;
  let windows = '';
  for (let y = top + 14; y < 150; y += 24) windows += `<rect x="38" y="${y}" width="14" height="12" rx="2" fill="#fffaf0"/><rect x="68" y="${y}" width="14" height="12" rx="2" fill="#fffaf0"/>`;
  return `<path d="M8 166 H112" stroke="#a58f6b" stroke-width="4" stroke-linecap="round"/>` +
    `<rect x="26" y="${top}" width="68" height="${h}" rx="5" fill="${fill}" stroke="${line}" stroke-width="3"/>${windows}`;
}
function ball(r, [, fill, line]) {
  return `<circle cx="80" cy="80" r="${r}" fill="${fill}" stroke="${line}" stroke-width="3"/>` +
    `<path d="M${80 - r * .6} ${80 - r * .35} Q80 ${80 - r * .9} ${80 + r * .6} ${80 - r * .35}" fill="none" stroke="#fffaf0" stroke-opacity=".7" stroke-width="${Math.max(2, r / 9)}" stroke-linecap="round"/>`;
}
function box(size, [, fill, line], cx = 70, bottom = 120) {
  return `<rect x="${cx - size / 2}" y="${bottom - size}" width="${size}" height="${size}" rx="6" fill="${fill}" stroke="${line}" stroke-width="3"/>` +
    `<path d="M${cx - size / 2} ${bottom - size * .62} H${cx + size / 2}" stroke="${line}" stroke-width="2" stroke-opacity=".45"/>`;
}
const FRUITS = [['사과', '#e46b63', '#8c2f2a'], ['귤', '#f0965e', '#a3532a'], ['포도', '#a58be6', '#5e43a8'], ['키위', '#9fc56b', '#4e6b2a']];
function fruits(n, [, fill, line]) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = 26 + (i % 4) * 36, y = 26 + Math.floor(i / 4) * 36;
    out += `<circle cx="${x}" cy="${y}" r="14" fill="${fill}" stroke="${line}" stroke-width="2.5"/><path d="M${x} ${y - 14} q4 -7 10 -6" fill="none" stroke="#4e6b2a" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  return out;
}
function scale(heavyLeft, a, b) {
  const tilt = heavyLeft ? 10 : -10;                  /* 무거운 쪽이 내려간다 */
  const ly = 70 + tilt, ry = 70 - tilt;
  const pan = (x, y) => `<path d="M${x} ${y} v26" stroke="#7d6a4a" stroke-width="3"/><path d="M${x - 34} ${y + 26} h68 l-10 12 h-48 z" fill="#e8dcc6" stroke="#7d6a4a" stroke-width="3" stroke-linejoin="round"/>`;
  return `<path d="M160 70 V172 M118 172 H202" stroke="#7d6a4a" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M70 ${ly} L250 ${ry}" stroke="#7d6a4a" stroke-width="6" stroke-linecap="round"/><circle cx="160" cy="70" r="8" fill="#7d6a4a"/>` +
    pan(70, ly) + pan(250, ry) +
    box(a.size * .7, a.color, 70, ly + 26) + box(b.size * .7, b.color, 250, ry + 26);
}

/* ---------- 문제 만들기 ---------- */
const KINDS = {
  length: { title: '길이', text: '더 긴 것, 더 짧은 것', more: '긴', less: '짧은', moreSay: '더 길어요', lessSay: '더 짧아요',
    hint: '왼쪽 끝을 맞춰 놓았어요. 오른쪽 끝이 어디까지 가는지 봐요.',
    make() {
      const [a, b] = twoValues(70, 200, 34), colors = twoColors();
      return [a, b].map((v, i) => ({ value: v, name: colors[i][0] + ' 연필', art: svg('0 0 220 62', pencil(v, colors[i]), colors[i][0] + ' 연필') }));
    } },
  height: { title: '높이', text: '더 높은 것, 더 낮은 것', more: '높은', less: '낮은', moreSay: '더 높아요', lessSay: '더 낮아요',
    hint: '건물 꼭대기가 어디까지 올라가는지 봐요.',
    make() {
      const [a, b] = twoValues(46, 156, 30), colors = twoColors();
      return [a, b].map((v, i) => ({ value: v, name: colors[i][0] + ' 건물', art: svg('0 0 120 172', building(v, colors[i]), colors[i][0] + ' 건물') }));
    } },
  size: { title: '크기', text: '더 큰 것, 더 작은 것', more: '큰', less: '작은', moreSay: '더 커요', lessSay: '더 작아요',
    hint: '두 공을 잘 비교해 봐요.',
    make() {
      const [a, b] = twoValues(20, 66, 14), colors = twoColors();
      return [a, b].map((v, i) => ({ value: v, name: colors[i][0] + ' 공', art: svg('0 0 160 160', ball(v, colors[i]), colors[i][0] + ' 공') }));
    } },
  weight: { title: '무게', text: '저울로 무겁고 가벼운 것', more: '무거운', less: '가벼운', moreSay: '더 무거워요', lessSay: '더 가벼워요',
    hint: '저울에서 아래로 내려간 쪽이 더 무거워요.',
    make() {
      /* 크기와 무게는 따로 정한다 — 큰 상자가 더 가벼울 때도 있다 */
      const colors = twoColors(), sizes = [rand(44, 86), rand(44, 86)], heavy = rand(0, 1);
      const items = [0, 1].map(i => ({ value: i === heavy ? 2 : 1, size: sizes[i], color: colors[i], name: colors[i][0] + ' 상자' }));
      for (const item of items) item.art = svg('0 0 140 130', box(item.size, item.color), item.name);
      items.scene = svg('0 0 320 180', scale(heavy === 0, items[0], items[1]), '저울. ' + items[heavy].name + ' 쪽이 아래로 내려가 있어요.');
      return items;
    } },
  count: { title: '개수', text: '더 많은 것, 더 적은 것', more: '많은', less: '적은', moreSay: '더 많아요', lessSay: '더 적어요',
    hint: '하나씩 손가락으로 세어 봐요.',
    make() {
      const [a, b] = twoValues(1, 12, 2);
      const f1 = pick(FRUITS), f2 = pick(FRUITS.filter(f => f !== f1));
      return [[a, f1], [b, f2]].map(([n, f]) => ({ value: n, name: f[0], art: svg('0 0 160 124', fruits(n, f), f[0] + ' ' + n + '개') }));
    } },
  number: { title: '수', text: '더 큰 수, 더 작은 수', more: '큰', less: '작은', moreSay: '더 커요', lessSay: '더 작아요',
    hint: '1부터 세어 볼 때 뒤에 나오는 수가 더 커요.',
    make() {
      const [a, b] = twoValues(1, 20, 1);
      return [a, b].map(v => ({ value: v, name: String(v), art: svg('0 0 160 120', `<text x="80" y="88" text-anchor="middle" font-size="76" font-weight="900" fill="#26362c" font-family="Pretendard, 'Noto Sans KR', sans-serif">${v}</text>`, String(v)) }));
    } },
};
const NOUN = { length: '연필', height: '건물', size: '공', weight: '상자', count: '과일', number: '수' };

function makeQuestion(kind) {
  const k = KINDS[kind];
  const options = k.make();
  const more = Math.random() < .5;
  const answer = more ? (options[0].value > options[1].value ? 0 : 1) : (options[0].value < options[1].value ? 0 : 1);
  const word = more ? k.more : k.less;
  const prompt = kind === 'count' ? '더 ' + word + ' 과일을 골라 보세요.' : '더 ' + word + ' ' + object(NOUN[kind]) + ' 골라 보세요.';
  return { kind, options, scene: options.scene, answer, more, prompt, tries: 0 };
}

/* ---------- 화면 ---------- */
let page = 'home', kind = null, round = null;
const navigation = screenHistory(
  () => ({ page, kind, round: round && { ...round, list: [...round.list] }, contents: [...app.childNodes] }),
  screen => {
    ({ page, kind } = screen);
    round = screen.round;
    app.replaceChildren(...screen.contents);
    stopSpeech();
    voiceStatus.hidden = true;
    back.hidden = page === 'home';
    app.querySelector('h1')?.focus();
  }
);

function el(tag, text = '', cls = '') {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
function btn(text, action, cls = '') {
  const b = el('button', text, cls);
  b.type = 'button';
  b.addEventListener('click', action);
  return b;
}
function announce(text) { voiceStatus.hidden = true; speak(text, () => showSpeechHelp(voiceStatus)); }
function heading(title, prompt) {
  const header = el('header', '', 'heading haru-heading');
  const copy = el('div');
  const h1 = el('h1', title);
  h1.tabIndex = -1;
  copy.append(h1, el('p', prompt, 'prompt'));
  const mascot = el('img', '', 'haru-pose');
  mascot.alt = '';
  mascot.src = '/haru/assets/haru-guide.webp';
  header.append(copy, mascot);
  app.append(header);
}

function drawHome() {
  page = 'home';
  back.hidden = true;
  app.replaceChildren();
  heading('비교하기', '무엇을 비교해 볼까요?');
  const grid = el('div', '', 'grid compare-menu');
  for (const [key, k] of [...Object.entries(KINDS), ['mix', { title: '모두 섞어서', text: '여러 가지를 번갈아' }]]) {
    const card = btn('', () => start(key), 'photo-card compare-kind');
    card.dataset.kind = key;
    /* 고르기 카드는 실사 사진 (haru/math/assets/compare-종류.webp, 모두 섞어서는 compare.svg). 문제 화면은 도형 그림 */
    const pic = el('img');
    pic.alt = '';
    pic.width = 640;
    pic.height = 360;
    pic.src = key === 'mix' ? '/haru/math/assets/compare.svg' : '/haru/math/assets/compare-' + key + '.webp';
    const copy = el('span', '', 'card-copy');
    copy.append(el('strong', k.title), el('small', k.text));
    card.append(pic, copy);
    grid.append(card);
  }
  app.append(grid);
}

function start(key) {
  prepareSpeech();
  navigation.push();
  kind = key;
  const kinds = Object.keys(KINDS);
  /* 모두 섞어서: 여섯 가지 중 다섯 가지를 겹치지 않게 */
  const order = key === 'mix' ? kinds.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]) : [];
  round = { i: 0, firstTry: 0, list: Array.from({ length: ROUND }, (_, n) => makeQuestion(key === 'mix' ? order[n] : key)) };
  page = 'question';
  drawQuestion();
}

function drawQuestion() {
  back.hidden = false;
  app.replaceChildren();
  const q = round.list[round.i];
  const k = KINDS[q.kind];
  heading(k.title + ' 비교', q.prompt);
  const progress = el('p', (round.i + 1) + ' / ' + ROUND, 'compare-progress');
  progress.setAttribute('aria-label', ROUND + '문제 중 ' + (round.i + 1) + '번째');
  app.querySelector('.heading div').prepend(progress);
  if (q.scene) { const scene = el('div', '', 'compare-scene'); scene.innerHTML = q.scene; app.append(scene); }
  const choices = el('div', '', 'grid compare-options kind-' + q.kind);
  const status = el('p', '', 'problem-feedback');
  status.setAttribute('role', 'status');
  const last = round.i + 1 >= ROUND;
  const advance = btn(last ? '다 했어요' : '다음 문제', () => {
    navigation.push();
    if (last) finish(); else { round.i++; drawQuestion(); }
  }, 'primary compare-next');
  advance.hidden = true;
  q.options.forEach((option, i) => {
    const card = btn('', () => {
      if (i === q.answer) {
        if (!q.tries) round.firstTry++;
        card.classList.add('right');
        for (const b of choices.querySelectorAll('button')) b.disabled = true;
        const other = q.options[1 - i];
        const say = '맞아요! ' + (q.kind === 'number' ? subject(option.name) + ' ' + other.name + '보다 ' : subject(option.name) + ' ') + (q.more ? k.moreSay : k.lessSay) + '.';
        status.textContent = say;
        announce(say);
        advance.hidden = false;
        advance.focus();
      } else {
        q.tries++;
        card.classList.remove('wrong'); void card.offsetWidth; card.classList.add('wrong');
        status.textContent = '다시 골라 볼까요? ' + k.hint;
        announce(status.textContent);
      }
    }, 'photo-card compare-option');
    card.dataset.option = i;
    const pic = el('span', '', 'compare-pic');
    pic.innerHTML = option.art;
    card.append(pic, el('span', q.kind === 'number' ? '' : option.name, 'card-copy'));
    choices.append(card);
  });
  const controls = el('div', '', 'controls');
  controls.append(btn('문제 다시 듣기', () => announce(q.prompt)), advance);
  app.append(choices, status, controls);
  app.querySelector('h1').focus();
  announce(q.prompt);
}

function finish() {
  page = 'done';
  stopSpeech();
  app.replaceChildren();
  heading(kind === 'mix' ? '비교하기' : KINDS[kind].title + ' 비교', ROUND + '문제를 모두 풀었어요!');
  const box = el('div', '', 'compare-done');
  box.append(el('strong', '처음에 바로 맞힌 문제 ' + round.firstTry + '개'),
    el('span', round.firstTry === ROUND ? '모두 한 번에 맞혔어요. 정말 멋져요!' : '끝까지 잘했어요!'));
  const controls = el('div', '', 'controls');
  controls.append(btn('한 번 더 하기', () => start(kind), 'primary'), btn('다른 비교 고르기', () => { navigation.push(); drawHome(); }));
  app.append(box, controls);
  app.querySelector('h1').focus();
  announce('다 했어요! 처음에 바로 맞힌 문제는 ' + round.firstTry + '개예요.');
  /* 하루랑 별 — 한 판을 끝까지 하면 하나 */
  window.HaruRewards?.award('math');
}

back.addEventListener('click', () => navigation.back());
drawHome();
window.__compare = { KINDS, makeQuestion, get round() { return round; } };
