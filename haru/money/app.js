import { selectionCounter } from '/haru/selection-count.js?v=1';
import { screenHistory } from '/haru/navigation.js?v=1';
import { showSpeechHelp, speak, stopSpeech } from '/typing/learn/speech.js?v=2';

import { randomQuestion } from '/haru/questions.js?v=1';
import { notes, values, won, total } from './currency.js?v=1';

const comparisons = [
  { left: [1000], right: [5000], larger: true },
  { left: [10000], right: [5000], larger: false },
  { left: [10000], right: [1000, 1000, 1000], larger: true },
  { left: [1000, 1000], right: [5000], larger: false },
  { left: [5000], right: [5000, 1000, 1000], larger: true }
];
const targets = [2000, 5000, 6000, 10000, 15000];
const sections = {
  learn: ['지폐 알아보기', '지폐 금액 듣기', 1000],
  compare: ['금액 비교하기', '큰 금액과 작은 금액', 10000],
  build: ['금액 만들기', '지폐로 금액 맞추기', 5000],
  change: ['거스름돈 계산', '얼마를 돌려받을까요?', 10000]
};

/* 거스름돈 문제 — 물건값과 낸 돈을 그때그때 정한다 (천 원 단위, 거스름돈은 지폐로 보여 줄 수 있게) */
const goods = ['공책', '연필 세트', '우유', '빵', '과자', '주스', '아이스크림', '색연필', '김밥', '장난감 자동차'];
function changeQuestion(previous) {
  for (;;) {
    const paid = Math.random() < .4 ? 5000 : 10000;
    const price = 1000 * (1 + Math.floor(Math.random() * (paid / 1000 - 1)));
    const item = goods[Math.floor(Math.random() * goods.length)];
    if (!previous || previous.price !== price || previous.paid !== paid) return { item, price, paid };
  }
}
/* 거스름돈을 지폐로 — 큰 지폐부터 */
function breakdown(amount) {
  const out = [];
  for (const value of [...values].sort((a, b) => b - a)) while (amount >= value) { out.push(value); amount -= value; }
  return out;
}
/* 보기 3개 — 정답, 천 원 차이, 물건값(자주 하는 실수) 가운데서 */
function changeChoices({ price, paid }) {
  const answer = paid - price;
  const wrong = [answer - 1000, answer + 1000, price, answer + 2000]
    .filter((v, i, list) => v > 0 && v < paid && v !== answer && list.indexOf(v) === i);
  const picked = wrong.sort(() => Math.random() - .5).slice(0, 2);
  return [answer, ...picked].sort(() => Math.random() - .5);
}

const app = document.querySelector('#money-app');
const back = document.querySelector('#money-back');
const voiceStatus = document.querySelector('#voice-status');
let page = 'home';
let question;
let wallet = [];
const navigation = screenHistory(
  () => ({ page, question, wallet, contents: [...app.childNodes] }),
  screen => {
    stopAuto();
    ({ page, question, wallet } = screen);
    app.replaceChildren(...screen.contents);
    app.querySelectorAll('.auto-next').forEach(bar => bar.remove());   /* 돌아온 화면에서는 저절로 넘어가지 않는다 */
    stopSpeech();
    voiceStatus.hidden = true;
    app.querySelector('h1').focus();
  }
);

function element(tag, text = '', className = '') {
  const result = document.createElement(tag);
  result.textContent = text;
  if (className) result.className = className;
  return result;
}

function button(text, action, className = '') {
  const result = element('button', text, className);
  result.type = 'button';
  result.addEventListener('click', action);
  return result;
}

function picture(value) {
  const image = element('img');
  image.alt = '';
  image.src = '/typing/learn/images/' + notes[value].image + '.webp';
  return image;
}

function announce(message) {
  voiceStatus.hidden = true;
  speak(message, () => showSpeechHelp(voiceStatus));
}

function heading(title, prompt) {
  const header = element('header', '', 'heading haru-heading');
  const copy = element('div');
  const name = element('h1', title);
  name.tabIndex = -1;
  copy.append(name, element('p', prompt, 'prompt'));
  const mascot = element('img', '', 'haru-pose');
  mascot.alt = '';
  mascot.src = '/haru/assets/haru-guide.webp';
  header.append(copy, mascot);
  app.append(header);
}

function open(next) {
  navigation.push();
  page = next;
  question = next === 'compare' ? randomQuestion(comparisons) : next === 'build' ? randomQuestion(targets)
    : next === 'change' ? changeQuestion() : undefined;
  draw(true);
}

/* 맞힌 뒤 잠시 기다렸다가 저절로 다음 문제로 ('다음 문제' 버튼 없이).
   칭찬 말이 끝날 만큼 기다리고, 그동안 막대가 차오른다 */
const AUTO_MS = 1500;   /* 말 없이 ✓ 표시만 보여 주므로 짧게 */
let autoTimer = 0;
function stopAuto() { clearTimeout(autoTimer); }
function autoNext(go, place) {
  stopAuto();
  const bar = element('span', '', 'auto-next');
  bar.style.setProperty('--t', AUTO_MS + 'ms');
  bar.setAttribute('aria-hidden', 'true');
  bar.append(element('i'));
  place.after(bar);
  autoTimer = setTimeout(() => { if (place.isConnected) go(); }, AUTO_MS);   /* 그사이 화면을 나갔으면 넘기지 않는다 */
}

/* 정답 여부 표시 — 맞으면 초록 ✓, 틀리면 빨간 ✕와 흔들림 (문장·음성 없이) */
function markRight(target) {
  stopSpeech();
  target.classList.remove('wrong');
  target.classList.add('right');
}
function markWrong(target) {
  stopSpeech();
  target.classList.remove('wrong'); void target.offsetWidth; target.classList.add('wrong');
  if (target.blur) target.blur();
}

function draw(focus = false) {
  stopAuto();
  app.replaceChildren();
  back.hidden = false;
  if (page === 'home') {
    heading('돈 계산', '돈을 읽고, 비교하고, 계산해 볼까요?');
    const menu = element('div', '', 'grid money-menu money-home');
    for (const [key, [title, text, value]] of Object.entries(sections)) {
      const card = button('', () => open(key), 'photo-card');
      const copy = element('span', '', 'card-copy');
      copy.append(element('strong', title), element('small', text));
      card.append(picture(value), copy);
      menu.append(card);
    }
    app.append(menu);
  } else if (page === 'learn') showNotes();
  else if (page === 'compare') showComparison();
  else if (page === 'change') showChange();
  else showWallet();
  if (focus) {
    stopSpeech();
    voiceStatus.hidden = true;
    app.querySelector('h1').focus();
    if (question !== undefined) announce(app.querySelector('.prompt').textContent);
  }
}

function messageLine() {
  const line = element('p', '', 'problem-feedback');
  line.setAttribute('role', 'status');
  return line;
}

function noteCard(value, action, prefix = '') {
  const card = button('', action, 'photo-card money-note');
  const copy = element('span', prefix + won(value), 'card-copy');
  card.append(picture(value), copy);
  return card;
}

function showNotes() {
  heading(sections.learn[0], '사진을 눌러 얼마인지 들어 보세요.');
  const grid = element('div', '', 'grid money-menu');
  const status = messageLine();
  for (const value of values) {
    grid.append(noteCard(value, () => {
      status.textContent = won(value) + ' 지폐 한 장이에요.';
      announce(notes[value].spoken + '.');
    }));
  }
  app.append(grid, status);
}

function next(questions) {
  navigation.push();
  question = randomQuestion(questions, question);
  draw(true);
}

function showComparison() {
  const { left, right, larger } = question;
  const sums = [total(left), total(right)];
  const correct = Number(larger ? sums[1] > sums[0] : sums[1] < sums[0]);
  const prompt = larger ? '어느 쪽의 금액이 더 큰가요?' : '어느 쪽의 금액이 더 작은가요?';
  heading(sections.compare[0], prompt);
  const status = messageLine();
  const choices = element('div', '', 'grid money-compare');
  const advance = () => next(comparisons);
  /* 정답 여부만 표시 — 문장·음성 없이 ✓ / ✕ (운영자 요청) */
  function check(choice, option) {
    if (choice === correct) {
      markRight(option);
      window.HaruRewards?.award('money');
      for (const control of choices.querySelectorAll('button')) control.disabled = true;
      autoNext(advance, status);
    } else markWrong(option);
  }
  for (const [side, notesToShow] of [left, right].entries()) {
    const option = button('', () => check(side, option), 'photo-card money-option');
    const photos = element('span', '', 'money-pictures');
    for (const value of notesToShow) photos.append(picture(value));
    option.append(photos, element('span', won(sums[side]), 'card-copy'));
    choices.append(option);
  }
  app.append(choices, button('문제 다시 듣기', () => announce(prompt)), status);
}

function showChange() {
  const { item, price, paid } = question;
  const answer = paid - price;
  const prompt = item + ' ' + won(price) + '짜리를 사고 ' + won(paid) + '을 냈어요. 거스름돈은 얼마일까요?';
  heading(sections.change[0], prompt);
  const scene = element('div', '', 'change-scene');
  const tag = element('div', '', 'change-tag');
  tag.append(element('small', '산 물건'), element('strong', item), element('b', won(price)));
  const pay = element('div', '', 'change-paid');
  pay.append(element('small', '낸 돈'), picture(paid), element('b', won(paid)));
  scene.append(tag, element('span', '−', 'change-minus'), pay);
  const status = messageLine();
  const choices = element('div', '', 'grid money-change');
  const advance = () => {
    navigation.push();
    question = changeQuestion(question);
    draw(true);
  };
  for (const amount of changeChoices(question)) {
    const option = button('', () => {
      if (amount === answer) {
        markRight(option);
        window.HaruRewards?.award('money');
        for (const control of choices.querySelectorAll('button')) control.disabled = true;
        autoNext(advance, status);
      } else markWrong(option);
    }, 'photo-card money-option');
    option.dataset.amount = amount;
    const photos = element('span', '', 'money-pictures');
    for (const value of breakdown(amount)) photos.append(picture(value));
    option.append(photos, element('span', won(amount), 'card-copy'));
    choices.append(option);
  }
  app.append(scene, choices, button('문제 다시 듣기', () => announce(prompt)), status);
}

function showWallet() {
  wallet = [];
  const target = question;
  const prompt = won(target) + '을 만들어 보세요.';
  heading(sections.build[0], prompt);
  const choices = element('div', '', 'grid money-menu');
  const sumLabel = element('p', '', 'money-total');
  sumLabel.setAttribute('aria-live', 'polite');
  const status = messageLine();
  const advance = () => next(targets);
  const reset = button('다시 선택', () => {
    wallet = [];
    status.textContent = '';
    update();
    choices.querySelector('button').focus();
  });
  const check = button('금액 확인', () => {
    const sum = total(wallet);
    if (sum === target) {
      markRight(selection);
      window.HaruRewards?.award('money');
      for (const control of [...choices.querySelectorAll('button'), reset, check]) control.disabled = true;
      autoNext(advance, status);
    } else markWrong(selection);   /* 담은 금액은 상자에 늘 보인다 — 아이가 더 담거나 '다시 선택' */
  }, 'primary');
  const counters = new Map();
  function update() {
    for (const [value, updateCount] of counters) {
      updateCount(wallet.filter(note => note === value).length);
    }
    sumLabel.textContent = '담은 금액 ' + won(total(wallet));
    selection.classList.remove('wrong');   /* 다시 담기 시작하면 ✕ 를 지운다 */
    reset.disabled = wallet.length === 0;
  }
  for (const value of values) {
    const choice = noteCard(value, () => {
      if (wallet.length >= 15) {
        status.textContent = '‘다시 선택’을 눌러 다시 골라 보세요.';
        return;
      }
      wallet.push(value);
      status.textContent = '';
      update();
    }, '담기 · ');
    counters.set(value, selectionCounter(choice, '담기 · ' + won(value), '장'));
    choices.append(choice);
  }
  const controls = element('div', '', 'controls');
  controls.append(check, button('문제 다시 듣기', () => announce(prompt)));
  const selection = element('div', '', 'cash-selection');
  selection.append(sumLabel, reset);
  app.append(selection, choices, status, controls);
  update();
}

back.addEventListener('click', () => navigation.back());
draw();
