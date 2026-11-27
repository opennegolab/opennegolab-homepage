import { bankContexts, bankProblems, banks, places, shopProblems, shops, tripContexts, tripProblems, trips } from './content.js?v=2';
import { speak } from './speech.js?v=1';

const app = document.querySelector('#app');
const back = document.querySelector('#back');
const home = document.querySelector('#home');
const voiceStatus = document.querySelector('#voice-status');
const area = {
  '/haru/kiosk': { id: 'kiosk', title: '키오스크', prompt: '가게를 골라 구매나 주문 문제를 풀어 보세요.' },
  '/haru/bank': { id: 'bank', title: '은행 이용', prompt: '창구 또는 ATM을 골라 은행 문제를 풀어 보세요.' },
  '/haru/transport': { id: 'transport', title: '교통수단', prompt: '탈것을 골라 순서 문제를 풀어 보세요.' }
}[window.location.pathname.replace(/\/$/, '')];

if (area) {
  document.documentElement.setAttribute('data-haru', '');
  document.querySelector('.haru-return').hidden = false;
}

const welcome = '어디에 가 볼까요? 가 보고 싶은 곳의 사진을 눌러요.';
let state = { view: 'home' };
let trail = [];
let narration;

function say(text) {
  narration = text;
  voiceStatus.hidden = true;
  speak(text, () => {
    voiceStatus.textContent = '소리가 들리지 않으면 기기의 음량과 한국어 음성 설정을 확인해 주세요.';
    voiceStatus.hidden = false;
  });
}

function show(next, remember = true, confirmation = "") {
  if (remember) trail.push(state);
  state = next;
  const text = render();
  app.querySelector('h1').focus({ preventScroll: true });
  window.scrollTo(0, 0);
  say(confirmation + text);
}

function previous() {
  const last = trail.pop();
  if (last) show(last, false);
}

function reset() {
  trail = [];
  show({ view: 'home' }, false);
}

function node(tag, className = '', text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function heading(title, prompt, detail, pose) {
  const header = node('div', 'heading');
  const copy = node('div');
  if (detail) copy.append(node('p', 'context', detail));
  const titleElement = node('h1', '', title);
  titleElement.tabIndex = -1;
  copy.append(titleElement);
  if (prompt) copy.append(node('p', 'prompt', prompt));
  header.append(copy);
  if (area && pose) {
    header.classList.add('with-haru');
    const mascot = node('img', 'haru-pose');
    mascot.src = '/haru/assets/haru-' + pose + '.webp';
    mascot.alt = '';
    header.append(mascot);
  }
  app.append(header);
}

function button(label, callback, primary = false) {
  const element = node('button', primary ? 'primary' : '', label);
  element.type = 'button';
  element.addEventListener('click', callback);
  return element;
}

function photo(id, className = '') {
  const image = node('img', className);
  image.src = '/typing/learn/images/' + id + '.webp';
  image.alt = '';
  image.draggable = false;
  image.loading = 'lazy';
  image.decoding = 'async';
  return image;
}

function card(label, image, callback, caption) {
  const element = button('', callback);
  element.className = 'photo-card';
  const copy = node('span', 'card-copy');
  copy.append(node('strong', '', label));
  if (caption) copy.append(node('small', '', caption));
  element.append(photo(image), copy);
  return element;
}

function group(className, ...children) {
  const element = node('div', className);
  element.append(...children);
  app.append(element);
  return element;
}

function startPlace(id) {
  if (shops[id]) openShop(id);
  else show({ view: 'places', id });
}

function placeChoices(id) {
  if (id === 'mart') return [['fruit', shops.fruit], ['vegetable', shops.vegetable]];
  return Object.entries(id === 'bank' ? banks : trips);
}

function resetActivity(parent) {
  const start = { view: 'home' };
  const hasParentMenu = parent && area?.id !== parent;
  trail = hasParentMenu ? [start] : [];
  state = hasParentMenu ? { view: 'places', id: parent } : start;
}

function restartShop(id, problemIndex) {
  resetActivity(['fruit', 'vegetable'].includes(id) ? 'mart' : null);
  openShop(id, problemIndex);
}

function openShop(id, problemIndex = 0) {
  const shop = shops[id];
  const items = shop.groups.flatMap(([, products]) => products);
  const problem = shopProblems[id][problemIndex];
  const target = problem.items.map(([name, count]) => ({ item: items.find(item => item.name === name), count }));
  const verb = shop.submit === '주문하기' ? '주문해 보세요.' : '사 보세요.';
  const goal = target.map(({ item, count }) => wording(item, count)).join(', ') + ' ' + verb;
  show({ view: 'problem', id, problemIndex, goal, target, category: 0, cart: [] });
}

function openActivity(id, place, activity, problemIndex = 0) {
  const target = bankProblems[id]?.[problemIndex];
  const goal = target
    ? activity.name + '에서 ' + target.amount.toLocaleString('ko-KR') + '원을 ' +
      (target.deposit ? '입금해 보세요.' : '출금해 보세요.')
    : tripProblems[id];
  show({ view: 'problem', id, place, activity, problemIndex, goal, target, step: activity.start ?? 0, values: {} });
}

function problemScreen() {
  const activity = state.activity || shops[state.id];
  heading(activity.name + ' 문제', state.goal, undefined, 'guide');
  if (shops[state.id]) {
    group('goal-items', ...state.target.map(({ item, count }) => {
      const figure = node('div', 'goal-item');
      figure.append(repeated(item, count), node('strong', '', wording(item, count)));
      return figure;
    }));
  }
  group('controls', button('문제 풀기', () => {
    show({ ...state, view: state.activity ? 'action' : 'entrance' });
  }, true));
  return state.goal + ' 준비되면 문제 풀기를 눌러요.';
}

function showProblemGoal() {
  const card = node('aside', 'problem-goal');
  card.setAttribute('aria-label', '지금 푸는 문제');
  card.append(node('p', '', state.goal), button('문제 다시 듣기', () => say(state.goal)));
  app.append(card);
}

function feedback(message) {
  const status = app.querySelector('.problem-feedback');
  status.textContent = message;
  say(message);
}

function feedbackLine() {
  const status = node('p', 'problem-feedback');
  status.setAttribute('role', 'status');
  app.append(status);
}

function submitCart() {
  const { cart, target } = state;
  const extra = cart.find(line => !target.some(goal => goal.item === line.item));
  const missing = target.find(goal => !cart.some(line => line.item === goal.item));
  const different = cart.find(line => target.some(goal => goal.item === line.item && goal.count !== line.count));
  if (extra) return feedback('문제에 없는 물건이 담겼어요. ' + extra.item.name + ' 옆의 빼기를 눌러 보세요.');
  if (missing) return feedback('아직 담지 않은 물건이 있어요. 문제와 고른 목록을 비교해 보세요.');
  if (different) return feedback(different.item.name + '의 수량을 문제와 비교해 보세요.');
  changeShop('receive');
}

function changeShop(view, patch = {}, remember = true) {
  show({ ...state, ...patch, view }, remember);
}

function wording(item, count) {
  if (item.unit === '인분' && count === 1) return item.name + ' 하나';
  const number = ['', '한', '두', '세', '네', '다섯'][count];
  return item.name + ' ' + number + ' ' + item.unit;
}

function repeated(item, count) {
  const strip = node('span', 'repeated');
  strip.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) strip.append(photo(item.image));
  return strip;
}

function updateCartHistory(cart) {
  for (let i = trail.length - 1; i >= 0 && trail[i].id === state.id; i--) {
    trail[i] = { ...trail[i], cart, notice: '' };
  }
}

function saveQuantity() {
  const { item, count, cart } = state;
  // 수량을 확정했으므로 확인 전의 수량 화면과 중복 장바구니를 건너뜁니다.
  trail.pop();
  if (trail.at(-1)?.view === 'cart') trail.pop();
  const updated = cart.filter(line => line.item !== item);
  const position = cart.findIndex(line => line.item === item);
  updated.splice(position < 0 ? updated.length : position, 0, { item, count });
  updateCartHistory(updated);
  changeShop('cart', { cart: updated, notice: wording(item, count) + ' 담았어요.' }, false);
}

function receipt(cart, editable) {
  const rows = cart.map(({ item, count }) => {
    const row = node('li', 'receipt-row');
    const label = wording(item, count);
    row.append(repeated(item, count), button(label + ' · 듣기', () => say(label)));
    if (editable) {
      const edit = button('수량 바꾸기', () => changeShop('quantity', { item, count }));
      edit.setAttribute('aria-label', item.name + ' 수량 바꾸기');
      const remove = button('빼기', () => {
        const updated = cart.filter(line => line.item !== item);
        updateCartHistory(updated);
        changeShop('cart', { cart: updated, notice: item.name + ' 빼기를 마쳤어요.' }, false);
      });
      remove.setAttribute('aria-label', item.name + ' 빼기');
      row.append(edit, remove);
    }
    return row;
  });
  const list = node('ul', 'receipt');
  list.append(...rows);
  app.append(list);
}

function finishActions(repeat, other = reset, nextProblem) {
  const actions = [button('같은 문제 다시 풀기', repeat), button('다른 활동 하기', other)];
  if (nextProblem) actions.unshift(button('새 문제 풀기', nextProblem, true));
  group('controls', ...actions);
}

function shopScreen(shop) {
  const { id, view, category, cart, item, count, notice } = state;
  const menu = shop.submit === '주문하기';
  if (view === 'entrance') {
    const prompt = shop.name + '에 왔어요.';
    const label = menu ? '메뉴판 보기' : '진열대 보기';
    heading(shop.name, prompt);
    group('single', card(label, shop.image, () => changeShop('items')));
    return prompt + ' 사진을 눌러 ' + (menu ? '메뉴판을 봐요.' : '진열대를 봐요.');
  }
  if (view === 'items') {
    heading(shop.name, shop.prompt);
    if (shop.groups.length > 1) {
      const categories = shop.groups.map(([name], index) => {
        const tab = button(name, () => changeShop('items', { category: index }, false));
        tab.setAttribute('aria-pressed', index === category);
        return tab;
      });
      group('categories', ...categories);
    }
    group('grid items', ...shop.groups[category][1].map(product => card(product.name, product.image, () => {
      const oldCount = cart.find(line => line.item === product)?.count;
      changeShop('quantity', { item: product, count: oldCount ?? 1 });
    })));
    if (cart.length) group('controls', button(shop.container + ' 보기', () => changeShop('cart', { notice: '' })));
    return shop.groups.length > 1 ? shop.groups[category][0] + '. ' + shop.prompt : shop.prompt;
  }
  if (view === 'quantity') {
    const prompt = '몇 ' + item.unit + (menu ? ' 주문할까요?' : ' 살까요?');
    heading(item.name, prompt, shop.name);
    const numbers = Array.from({ length: item.maxQuantity ?? shop.maxQuantity ?? 5 }, (_, index) => {
      const quantity = index + 1;
      const choice = button(String(quantity), () => changeShop('confirm', { count: quantity }));
      choice.setAttribute('aria-label', wording(item, quantity));
      choice.append(repeated(item, quantity));
      return choice;
    });
    group('quantities', ...numbers);
    const last = item.name.charCodeAt(item.name.length - 1) - 0xAC00;
    return item.name + (last % 28 ? '을' : '를') + ' 골랐어요. ' + prompt;
  }
  if (view === 'confirm') {
    const label = wording(item, count);
    heading(label, label + ' 주세요.', shop.name);
    group('quantity-photo', repeated(item, count));
    group('controls', card(shop.add, shop.containerImage, saveQuantity));
    return label + ' 골랐어요. ' + label + ' 주세요. ' + shop.add + ' 사진을 눌러요.';
  }
  if (view === 'cart') {
    const prompt = cart.length ? shop.confirm : '아직 고른 것이 없어요.';
    heading(shop.container, notice || prompt, shop.name);
    receipt(cart, true);
    feedbackLine();
    const actions = [button(shop.more, () => changeShop('items', { notice: '' })), button(shop.submit, submitCart, true)];
    group('controls', ...actions);
    return (notice ? notice + ' ' : '') + prompt + (cart.length
      ? ' 더 고르거나 ' + (menu ? '주문할 수 있어요.' : '구매할 수 있어요.')
      : ' 더 고르기를 눌러요.');
  }
  if (view === 'receive') {
    const text = cart.map(line => wording(line.item, line.count) + ' 주세요.').join(' ');
    heading(menu ? '주문했어요' : '구매했어요', text, shop.name);
    receipt(cart, false);
    group('controls', button(shop.receive, () => changeShop('shop-done'), true));
    return text + ' 이제 ' + (menu ? '주문한 메뉴를' : '산 물건을') + ' 받아요.';
  }
  heading('문제를 해결했어요', shop.done, shop.name, 'cheer');
  receipt(cart, false);
  const isMarket = id === 'fruit' || id === 'vegetable';
  const other = !area && isMarket ? () => {
    trail = [];
    show({ view: 'places', id: 'mart' });
  } : reset;
  const next = (state.problemIndex + 1) % shopProblems[id].length;
  finishActions(() => restartShop(id, state.problemIndex), other, () => restartShop(id, next));
  return '문제에 맞게 골랐어요. ' + shop.done + ' ' + cart.map(line => wording(line.item, line.count) + ' 받았어요.').join(' ');
}

function activityScreen() {
  const { activity, step, place, id, values } = state;
  const steps = activity.steps;
  const nextStep = steps[step];
  if (!nextStep) {
    heading('문제를 해결했어요', activity.done, activity.name, 'cheer');
    group('scene', photo(activity.image));
    const replay = problemIndex => {
      resetActivity(place);
      openActivity(id, place, activity, problemIndex);
    };
    const other = () => {
      if (area?.id === place) reset();
      else {
        trail = [];
        show({ view: 'places', id: place });
      }
    };
    const nextProblem = bankProblems[id] ? () => replay((state.problemIndex + 1) % bankProblems[id].length) : undefined;
    finishActions(() => replay(state.problemIndex), other, nextProblem);
    return activity.done;
  }
  const scene = typeof nextStep === 'function' ? nextStep(values) : nextStep;
  const trip = typeof step === 'number';
  const [bankContext, distractor] = bankContexts[step] || [];
  const situation = trip ? tripContexts[id][step] : step === 'result' ? scene.prompt : bankContext;
  const prompt = situation + ' 다음에 무엇을 할까요?';
  heading(activity.name, prompt, trip ? (step + 1) + ' / ' + steps.length : '가상 은행 연습');
  if (scene.image) {
    const picture = photo(scene.image);
    picture.alt = scene.alt || '';
    group('scene', picture);
  }

  const options = [...scene.options];
  if (options.length === 1) {
    const alternativeStep = trip ? steps[step + 1] || steps[step - 1] : steps[distractor];
    if (alternativeStep) {
      const alternative = alternativeStep.options[0];
      options.push({ label: alternative.label, image: alternative.image });
    }
  }
  // 정답 카드의 위치가 매번 같지 않도록 합니다.
  const offset = (trip ? step : step.length + state.problemIndex) % options.length;
  const ordered = options.slice(offset).concat(options.slice(0, offset));
  const choices = ordered.map(option => card(option.label, option.image, () => {
    if (option.next === undefined) {
      feedback(option.hint || '아직 그 순서가 아니에요. ' + scene.prompt);
      return;
    }
    if (step === 'choice' && option.values.deposit !== state.target.deposit) {
      feedback('문제에서 돈을 넣으라고 했나요, 꺼내라고 했나요? 다시 골라 보세요.');
      return;
    }
    if (step === 'amount' && option.values.amount !== state.target.amount) {
      feedback('문제에 나온 금액을 다시 확인하고 골라 보세요.');
      return;
    }
    show({ ...state, step: option.next, values: { ...values, ...option.values } }, true, scene.prompt + ' ');
  }));
  group('grid actions', ...choices);
  feedbackLine();
  return prompt;
}

function render() {
  app.replaceChildren();
  const { id, view } = state;
  app.classList.toggle('kiosk-session', area?.id === 'kiosk' && Boolean(shops[id]));
  back.hidden = trail.length === 0;
  home.hidden = view === 'home';
  if (view === 'home') {
    if (area) {
      heading(area.title, area.prompt, undefined, 'guide');
      if (area.id === 'kiosk') {
        group('grid places kiosk-menu', ...places.slice(0, 4).map(([key, name, desc, image]) =>
          card(name, image, () => startPlace(key), desc)));
      } else {
        group('grid places', ...placeChoices(area.id).map(([key, activity]) =>
          card(activity.name, activity.image, () => openActivity(key, area.id, activity))));
      }
      return area.title + '. ' + area.prompt;
    }
    heading('생활학습', '어디에 가 볼까요?');
    group('grid places', ...places.map(([key, name, desc, image]) =>
      card(name, image, () => startPlace(key), desc)));
    return welcome;
  }
  if (view === 'places') {
    const [, name] = places.find(([key]) => key === id);
    const prompt = { mart: '어느 가게에 갈까요?', bank: '창구와 ATM 중에서 골라요.', transport: '무엇을 타 볼까요?' }[id];
    heading(name, prompt);
    group('grid places', ...placeChoices(id).map(([key, activity]) =>
      card(activity.name, activity.image, () => {
        if (id === 'mart') openShop(key);
        else openActivity(key, id, activity);
      })));
    return name + '. ' + prompt;
  }
  if (view === 'problem') return problemScreen();
  showProblemGoal();
  return view === 'action' ? activityScreen() : shopScreen(shops[id]);
}

back.addEventListener('click', previous);
home.addEventListener('click', reset);
document.querySelector('#listen').addEventListener('click', () => say(narration));
narration = render();
