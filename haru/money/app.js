import { speak } from '/typing/learn/speech.js?v=1';

import { notes, values, won, total } from './currency.js?v=1';

const comparisons = [
  { left: [1000], right: [5000], larger: true },
  { left: [10000], right: [5000], larger: false },
  { left: [10000], right: [1000, 1000, 1000], larger: true },
  { left: [1000, 1000], right: [5000], larger: false },
  { left: [5000], right: [1000, 1000, 1000, 1000, 1000], larger: true }
];
const targets = [2000, 5000, 6000, 10000, 15000];
const sections = {
  learn: ['지폐 알아보기', '사진을 눌러 얼마인지 들어 보세요.', 1000],
  compare: ['금액 비교하기', '어느 쪽이 더 큰지, 더 작은지 골라 보세요.', 10000],
  build: ['금액 만들기', '지폐를 골라 문제와 같은 금액을 만들어 보세요.', 5000]
};

const app = document.querySelector('#money-app');
const back = document.querySelector('#money-back');
const voiceStatus = document.querySelector('#voice-status');
let page = 'home';
let index = 0;
let wallet = [];
let narration = '';

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
  speak(message, () => {
    voiceStatus.textContent = '소리가 들리지 않으면 음량과 한국어 음성 설정을 확인해 주세요.';
    voiceStatus.hidden = false;
  });
}

function heading(title, prompt) {
  narration = prompt;
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
  page = next;
  index = 0;
  draw(true);
}

function draw(focus = false) {
  app.replaceChildren();
  back.hidden = page === 'home';
  if (page === 'home') {
    heading('돈 공부', '돈의 금액을 읽고 비교해 볼까요?');
    const menu = element('div', '', 'grid money-menu');
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
  else showWallet();
  if (focus) {
    app.querySelector('h1').focus();
    announce(narration);
  }
}

function messageLine() {
  const line = element('p', '', 'problem-feedback');
  line.setAttribute('role', 'status');
  return line;
}

function respond(line, message) {
  line.textContent = message;
  announce(message);
}

function noteCard(value, action, prefix = '') {
  const card = button('', action, 'photo-card money-note');
  const copy = element('span', prefix + won(value), 'card-copy');
  card.append(picture(value), copy);
  return card;
}

function showNotes() {
  heading(sections.learn[0], sections.learn[1]);
  const grid = element('div', '', 'grid money-menu');
  const status = messageLine();
  for (const value of values) {
    grid.append(noteCard(value, () => respond(status, won(value) + ' 지폐 한 장이에요. ' + notes[value].spoken + '.')));
  }
  app.append(grid, status);
}

function next(limit) {
  index = (index + 1) % limit;
  draw(true);
}

function showComparison() {
  const { left, right, larger } = comparisons[index];
  const sums = [total(left), total(right)];
  const correct = sums[0] === sums[1] ? 2 : Number(larger ? sums[1] > sums[0] : sums[1] < sums[0]);
  const question = larger ? '어느 쪽의 금액이 더 큰가요?' : '어느 쪽의 금액이 더 작은가요?';
  heading(sections.compare[0], question);
  const status = messageLine();
  const choices = element('div', '', 'grid money-compare');
  const advance = button('다음 문제', () => next(comparisons.length), 'primary');
  advance.hidden = true;
  function check(choice) {
    if (choice === correct) {
      respond(status, correct === 2 ? '맞아요. 지폐 장수가 달라도 둘 다 ' + won(sums[0]) + '이에요.'
        : '맞아요. ' + won(sums[choice]) + '이 ' + won(sums[1 - choice]) + '보다 ' + (larger ? '커요.' : '작아요.'));
      for (const control of choices.querySelectorAll('button')) control.disabled = true;
      advance.hidden = false;
      advance.focus();
    } else {
      respond(status, '두 쪽에 적힌 금액을 다시 비교해 보세요. 지폐 장수만으로 금액을 알 수 없어요.');
    }
  }
  for (const [side, notesToShow] of [left, right].entries()) {
    const option = button('', () => check(side), 'photo-card money-option');
    const photos = element('span', '', 'money-pictures');
    for (const value of notesToShow) photos.append(picture(value));
    option.append(photos, element('span', won(sums[side]), 'card-copy'));
    choices.append(option);
  }
  choices.append(button('두 금액이 같아요', () => check(2)));
  app.append(choices, status, advance);
}

function showWallet() {
  wallet = [];
  const target = targets[index];
  heading(sections.build[0], won(target) + '을 만들어 보세요.');
  const choices = element('div', '', 'grid money-menu');
  const selected = element('div', '', 'money-wallet');
  const sumLabel = element('p', '', 'money-total');
  sumLabel.setAttribute('aria-live', 'polite');
  const status = messageLine();
  const advance = button('다음 문제', () => next(targets.length), 'primary');
  advance.hidden = true;
  const check = button('금액 확인', () => {
    const sum = total(wallet);
    if (sum === target) {
      respond(status, '맞아요. ' + won(target) + '을 만들었어요!');
      for (const control of [...choices.querySelectorAll('button'), ...selected.querySelectorAll('button'), check]) control.disabled = true;
      advance.hidden = false;
      advance.focus();
    } else {
      respond(status, '지금은 ' + won(sum) + '이에요. ' + (sum < target ? '지폐를 더 담아 볼까요?' : '지폐를 빼 볼까요?'));
    }
  }, 'primary');
  function update() {
    selected.replaceChildren();
    if (!wallet.length) selected.append(element('p', '담은 지폐가 없어요.'));
    for (const [position, value] of wallet.entries()) {
      selected.append(button(won(value) + ' 빼기', () => {
        wallet.splice(position, 1);
        status.textContent = '';
        update();
        (selected.querySelectorAll('button')[Math.min(position, wallet.length - 1)] || choices.querySelector('button')).focus();
      }));
    }
    sumLabel.textContent = '담은 금액 ' + won(total(wallet));
  }
  for (const value of values) {
    choices.append(noteCard(value, () => {
      if (wallet.length >= 15) {
        respond(status, '담긴 지폐를 빼고 다시 골라 보세요.');
        return;
      }
      wallet.push(value);
      status.textContent = '';
      update();
    }, '담기 · '));
  }
  const controls = element('div', '', 'controls');
  controls.append(check, advance);
  app.append(choices, sumLabel, selected, status, controls);
  update();
}

back.addEventListener('click', () => open('home'));
document.querySelector('#money-listen').addEventListener('click', () => announce(narration));
draw();
