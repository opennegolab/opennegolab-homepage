import { selectionCounter } from '/haru/selection-count.js?v=1';
import { screenHistory } from '/haru/navigation.js?v=1';
import { atm, atmProblems, places, shopProblems, shops } from './content.js?v=15';
import { showSpeechHelp, speak, stopSpeech } from './speech.js?v=2';
import { randomQuestion } from '/haru/questions.js?v=1';
import { notes, values as noteValues, total, won } from '/haru/money/currency.js?v=1';

const app = document.querySelector('#app');
const back = document.querySelector('#back');
const home = document.querySelector('#home');
const replay = document.querySelector('#problem-replay');
const voiceStatus = document.querySelector('#voice-status');
const area = {
  '/haru/kiosk': { id: 'kiosk', title: '키오스크', prompt: '가게에서 주문하거나 ATM을 이용해 보세요.' },
  '/haru/burger': { id: 'burger', title: '패스트푸드', prompt: '햄버거, 샌드위치, 피자, 치킨, 사이드, 음료를 주문해 보세요.' }
}[window.location.pathname.replace(/\/$/, '')];
const usesOrderScreen = area?.id === 'kiosk' || area?.id === 'burger';

if (area) {
  document.documentElement.setAttribute('data-haru', '');
  document.querySelector('.haru-return').hidden = false;
}

let state = { view: 'home' };
const navigation = screenHistory(() => state, screen => show(screen, false));
let lastOrderNumber = 100;

function show(next, remember = true) {
  if (remember) navigation.push();
  state = next;
  render();
  app.querySelector('h1').focus({ preventScroll: true });
  window.scrollTo(0, 0);
  if (state.view === 'problem') readProblem();
  else {
    stopSpeech();
    voiceStatus.hidden = true;
  }
}

function readProblem() {
  voiceStatus.hidden = true;
  const spokenGoal = (state.spokenGoal ?? state.goal).replace(/([1-5])인분/g, (_, count) => ' 일이삼사오'[count] + '인분');
  speak(spokenGoal, () => showSpeechHelp(voiceStatus));
}

function reset() {
  if (area?.id === 'burger') window.location.assign('/haru');
  else show({ view: 'home' });
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
    header.classList.add('haru-heading');
    const mascot = node('img', 'haru-pose');
    mascot.src = '/haru/assets/haru-' + pose + '.webp';
    mascot.alt = '';
    header.append(mascot);
  }
  app.append(header);
  return header;
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

function newShopTarget(id) {
  if (Math.random() < 0.2) return null;
  const products = shops[id].groups.flatMap(([, entries]) => entries);
  const namedTargets = shopProblems[id].map(problem => problem.items.map(([name, count]) => ({
    item: products.find(item => item.name === name), count
  })));
  const singleTargets = products.flatMap(item => [1, 2, 3].map(count => [{ item, count }]));
  const pairTargets = products.flatMap((item, index) => products.slice(index + 1).map(other =>
    [{ item, count: 1 }, { item: other, count: 2 }]));
  return randomQuestion([...namedTargets, ...singleTargets, ...pairTargets]);
}

function openShop(id, remember = true) {
  const target = newShopTarget(id);
  const menu = shops[id].submit === '주문하기';
  const freeChoice = menu ? '먹고 싶은 것을 선택해 주세요.' : '사고 싶은 것을 선택해 주세요.';
  const instruction = menu ? ' 주문해 보세요.' : ' 사 보세요.';
  const describe = format => target
    ? target.map(({ item, count }) => format(item, count)).join(', ') + instruction
    : freeChoice;
  const view = usesOrderScreen ? 'kiosk-order' : 'problem';
  show({ view, id, goal: describe(numericQuantity), spokenGoal: describe(wording),
    target, category: 0, cart: [] }, remember);
  if (usesOrderScreen) readProblem();
}

function openAtm() {
  const target = randomQuestion(atmProblems);
  const goal = 'ATM에서 ' + won(target.amount) + '을 ' + (target.deposit ? '입금해 보세요.' : '출금해 보세요.');
  show({ view: 'action', id: 'atm', goal, target, step: atm.start, values: {} });
  readProblem();
}

function problemScreen() {
  const activity = shops[state.id];
  heading(activity.name + ' 문제', state.goal, undefined, 'guide');
  if (state.target) {
    group('goal-items', ...state.target.map(({ item, count }) => {
      const figure = node('div', 'goal-item');
      figure.append(repeated(item, count), node('strong', '', numericQuantity(item, count)));
      return figure;
    }));
  }
  group('controls', button('문제 풀기', () => show({ ...state, view: 'entrance' }), true),
    button('문제 다시 듣기', readProblem));
}

function showProblemGoal() {
  const card = node('aside', 'problem-goal');
  card.setAttribute('aria-label', '지금 푸는 문제');
  card.append(node('p', '', state.goal));
  app.append(card);
}

function feedback(message) {
  const status = app.querySelector('.problem-feedback');
  status.textContent = message;
}

function feedbackLine(parent = app) {
  const status = node('p', 'problem-feedback');
  status.setAttribute('role', 'status');
  parent.append(status);
}

function submitCart() {
  const { cart, target } = state;
  if (!cart.length) return feedback('상품을 하나 이상 골라 주세요.');
  if (!target) {
    changeShop('cash', { cash: [] });
    return;
  }
  const extra = cart.find(line => !target.some(goal => goal.item === line.item));
  const missing = target.find(goal => !cart.some(line => line.item === goal.item));
  const different = cart.find(line => target.some(goal => goal.item === line.item && goal.count !== line.count));
  if (extra) {
    const action = usesOrderScreen ? '의 수량을 줄여 빼 보세요.' : ' 옆의 빼기를 눌러 보세요.';
    return feedback('문제에 없는 물건이 담겼어요. ' + extra.item.name + action);
  }
  if (missing) return feedback('아직 담지 않은 물건이 있어요. 문제와 고른 목록을 비교해 보세요.');
  if (different) return feedback(different.item.name + '의 수량을 문제와 비교해 보세요.');
  changeShop('cash', { cash: [] });
}

function changeShop(view, patch = {}, remember = true) {
  show({ ...state, ...patch, view }, remember);
}

function numericQuantity(item, count) {
  return item.name + ' ' + count + item.unit;
}

function wording(item, count) {
  if (item.unit === '인분') return numericQuantity(item, count);
  const number = ['', '한', '두', '세', '네', '다섯'][count];
  return item.name + ' ' + number + ' ' + item.unit;
}

function repeated(item, count) {
  const strip = node('span', 'repeated');
  strip.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) strip.append(photo(item.image));
  return strip;
}

function saveQuantity() {
  const { item, count, cart } = state;
  const updated = cart.filter(line => line.item !== item);
  const position = cart.findIndex(line => line.item === item);
  updated.splice(position < 0 ? updated.length : position, 0, { item, count });
  changeShop('cart', { cart: updated, notice: wording(item, count) + ' 담았어요.' });
}

function orderTotal(cart) {
  return cart.reduce((sum, { item, count }) => sum + item.price * count, 0);
}

function finishPayment(method, tendered, change = 0) {
  changeShop(change ? 'change' : 'receive', {
    payment: { method, tendered, change, orderNumber: ++lastOrderNumber }
  });
}

function kioskOrder(shop) {
  heading(shop.name, '상품을 누르면 주문 목록에 담겨요.');
  const menu = node('section', 'kiosk-products');
  menu.setAttribute('aria-label', '상품');
  const basket = node('aside', 'kiosk-basket');
  basket.setAttribute('aria-label', '담은 상품');
  basket.tabIndex = -1;
  const rows = node('ul', 'kiosk-lines');
  const resetOrder = button('다시 선택', () => {
    state = { ...state, cart: [] };
    feedback('');
    for (const updateCount of productCounters.values()) updateCount(0);
    drawBasket();
    jump.focus({ preventScroll: true });
  });
  resetOrder.classList.add('kiosk-basket-reset');
  basket.append(rows);
  feedbackLine(basket);
  const checkout = button('결제하기', submitCart, true);
  checkout.classList.add('kiosk-checkout');
  basket.append(checkout);

  const categories = node('div', 'categories kiosk-categories');
  const products = node('div', 'grid items');
  const productCounters = new Map();
  if (shop.groups.length > 1) {
    categories.classList.toggle('kiosk-categories-wide', shop.groups.length > 3);
    shop.groups.forEach(([label], category) => {
      const tab = button(label, () => {
        state = { ...state, category };
        drawProducts();
      });
      categories.append(tab);
    });
    menu.append(categories);
  }
  menu.append(products);
  const jump = button('', () => {
    basket.focus({ preventScroll: true });
    basket.scrollIntoView({ block: 'nearest' });
  });
  jump.classList.add('kiosk-order-jump');
  jump.setAttribute('aria-live', 'polite');
  const orderBar = node('div', 'kiosk-order-bar');
  orderBar.append(jump, resetOrder);
  group('kiosk-layout', orderBar, menu, basket);

  function adjust(item, delta, focusControl = false) {
    const cart = [...state.cart];
    const position = cart.findIndex(line => line.item === item);
    const count = (cart[position]?.count || 0) + delta;
    if (count > (item.maxQuantity ?? shop.maxQuantity ?? 5)) {
      feedback('한 번에 최대 ' + (item.maxQuantity ?? shop.maxQuantity ?? 5) + item.unit + ' 담을 수 있어요.');
      return;
    }
    if (position < 0) cart.push({ item, count });
    else if (count === 0) cart.splice(position, 1);
    else cart[position] = { item, count };
    state = { ...state, cart };
    feedback('');
    productCounters.get(item)?.(count);
    drawBasket(focusControl ? { item, delta } : undefined);
  }

  function drawProducts() {
    [...categories.children].forEach((tab, index) =>
      tab.setAttribute('aria-pressed', String(index === state.category)));
    productCounters.clear();
    products.replaceChildren(...shop.groups[state.category][1].map(item => {
      const product = card(item.name, item.image, () => adjust(item, 1), won(item.price));
      const update = selectionCounter(product, item.name + ' ' + won(item.price), item.unit);
      productCounters.set(item, update);
      update(state.cart.find(line => line.item === item)?.count ?? 0);
      return product;
    }));
  }

  function drawBasket(focusControl) {
    rows.replaceChildren();
    if (!state.cart.length) rows.append(node('li', 'kiosk-empty', '담은 상품이 없어요.'));
    let focused;
    for (const { item, count } of state.cart) {
      const row = node('li', 'kiosk-line');
      const copy = node('div', 'kiosk-line-copy');
      copy.append(node('strong', '', item.name), node('span', '', won(item.price * count)));
      const controls = node('div', 'kiosk-stepper');
      const decrease = button('−', () => adjust(item, -1, true));
      const increase = button('+', () => adjust(item, 1, true));
      decrease.setAttribute('aria-label', item.name + ' 수량 줄이기');
      increase.setAttribute('aria-label', item.name + ' 수량 늘리기');
      controls.append(decrease, node('span', '', count + ' ' + item.unit), increase);
      row.append(photo(item.image), copy, controls);
      rows.append(row);
      if (focusControl?.item === item) focused = focusControl.delta < 0 ? decrease : increase;
    }
    jump.textContent = '주문 금액 · ' + won(orderTotal(state.cart));
    checkout.disabled = resetOrder.disabled = state.cart.length === 0;
    if (focusControl) (focused || rows.querySelector('button') || products.querySelector('button'))?.focus();
  }

  drawProducts();
  drawBasket();
}

function kioskTicket(cart, payment) {
  const ticket = node('section', 'kiosk-ticket');
  ticket.setAttribute('aria-labelledby', 'kiosk-ticket-title');
  const title = node('h2', '', '연습용 영수증');
  title.id = 'kiosk-ticket-title';
  const number = node('p', 'kiosk-order-number', '주문 번호 ' + payment.orderNumber);
  const list = node('ul', 'kiosk-ticket-items');
  for (const { item, count } of cart) {
    const row = node('li');
    row.append(node('span', '', wording(item, count)), node('strong', '', won(item.price * count)));
    list.append(row);
  }
  ticket.append(title, number, list, node('p', 'kiosk-total', '현금 결제 ' + won(orderTotal(cart))),
    node('p', '', '받은 돈 ' + won(payment.tendered) + ' · 거스름돈 ' + won(payment.change)));
  app.append(ticket);
}

function paymentScreen(shop) {
  const { view, cart, payment } = state;
  const due = orderTotal(cart);
  if (view === 'change') {
    const prompt = won(payment.tendered) + '을 냈어요. 거스름돈 ' + won(payment.change) + '을 받아요.';
    heading('거스름돈 받기', prompt, shop.name);
    let remaining = payment.change;
    const returned = node('div', 'pay-cash-summary');
    for (const value of [...noteValues].reverse()) {
      const count = Math.floor(remaining / value);
      if (count) returned.append(node('span', '', won(value) + ' 지폐 ' + count + '장'));
      remaining %= value;
    }
    app.append(returned);
    group('single action', card('거스름돈 받기', 'bank-6', () => changeShop('receive')));
    return;
  }

  if (!Array.isArray(state.cash)) state = { ...state, cash: [] };
  const prompt = '낼 금액은 ' + won(due) + '이에요. 낼 지폐를 골라 보세요.';
  heading('현금으로 결제', prompt, shop.name);
  const paidLabel = node('p', 'pay-total');
  paidLabel.setAttribute('aria-live', 'polite');
  const counters = new Map();
  const choices = group('grid actions pay-notes', ...noteValues.map(value => {
    const label = won(value) + ' 담기';
    const choice = card(label, notes[value].image, () => {
      if (state.cash.length >= 20) {
        feedback('‘다시 선택’을 눌러 다시 골라 보세요.');
        return;
      }
      state = { ...state, cash: [...state.cash, value] };
      app.querySelector('.problem-feedback').textContent = '';
      updateCash();
    });
    counters.set(value, selectionCounter(choice, label, '장'));
    return choice;
  }));
  feedbackLine();
  const resetCash = button('다시 선택', () => {
    state = { ...state, cash: [] };
    feedback('');
    updateCash();
    choices.querySelector('button').focus();
  });
  const selection = node('div', 'cash-selection');
  selection.append(paidLabel, resetCash);
  choices.before(selection);
  const submitCash = button('현금 내기', () => {
    const tendered = total(state.cash);
    if (tendered < due) {
      feedback(won(due - tendered) + '이 더 필요해요. 지폐를 더 담아 보세요.');
      return;
    }
    const change = tendered - due;
    finishPayment('현금', tendered, change);
  }, true);
  submitCash.classList.add('payment-end-action');
  app.append(submitCash);

  function updateCash() {
    for (const [value, updateCount] of counters) {
      updateCount(state.cash.filter(note => note === value).length);
    }
    paidLabel.textContent = '담은 금액 ' + won(total(state.cash));
    resetCash.disabled = state.cash.length === 0;
  }
  updateCash();
}

function receipt(cart, editable) {
  const rows = cart.map(({ item, count }) => {
    const row = node('li', 'receipt-row');
    const label = wording(item, count);
    row.append(repeated(item, count), node('span', 'receipt-label', label), node('span', 'receipt-price', won(item.price * count)));
    if (editable) {
      const edit = button('수량 바꾸기', () => changeShop('quantity', { item, count }));
      edit.setAttribute('aria-label', item.name + ' 수량 바꾸기');
      const remove = button('빼기', () => {
        const updated = cart.filter(line => line.item !== item);
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
  if (cart.length) app.append(node('p', 'pay-total', '합계 ' + won(orderTotal(cart))));
}

function showPickup(cart, menu) {
  const list = node('ul', 'goods-pickup');
  list.setAttribute('aria-label', menu ? '받은 메뉴' : '받은 상품');
  const wholeProduce = { 'fruit-10': 'whole-kiwi', 'vegetable-5': 'whole-napa-cabbage' };
  for (const { item, count } of cart) {
    const line = node('li', 'goods-pickup-line');
    const pictures = node('div', 'goods-pickup-photos');
    const image = wholeProduce[item.image] ?? item.image;
    for (let index = 0; index < count; index++) pictures.append(photo('pickup/' + image));
    line.append(pictures, node('p', '', wording(item, count)));
    list.append(line);
  }
  app.append(list);
}

function shopScreen(shop) {
  const { view, category, cart, item, count, notice } = state;
  const kiosk = usesOrderScreen;
  const menu = shop.submit === '주문하기';
  if (view === 'kiosk-order') {
    kioskOrder(shop);
    return;
  }
  if (view === 'entrance') {
    const prompt = shop.name + '에 왔어요.';
    const label = menu ? '메뉴판 보기' : '진열대 보기';
    heading(shop.name, prompt);
    group('single', card(label, shop.image, () => changeShop('items')));
    return;
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
    group('grid items', ...shop.groups[category][1].map(product => {
      const count = cart.find(line => line.item === product)?.count ?? 0;
      const choice = card(product.name, product.image, () => {
        changeShop('quantity', { item: product, count: count || 1 });
      }, won(product.price));
      selectionCounter(choice, product.name + ' ' + won(product.price), product.unit)(count);
      return choice;
    }));
    if (cart.length) group('controls', button(shop.container + ' 보기', () => changeShop('cart', { notice: '' })));
    return;
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
    return;
  }
  if (view === 'confirm') {
    const label = wording(item, count);
    heading(label, label + ' 주세요.', shop.name);
    group('quantity-photo', repeated(item, count));
    group('controls', card(shop.add, shop.containerImage, saveQuantity));
    return;
  }
  if (view === 'cart') {
    const prompt = cart.length ? shop.confirm : '아직 고른 것이 없어요.';
    heading(shop.container, notice || prompt, shop.name);
    receipt(cart, true);
    feedbackLine();
    const actions = [button(shop.more, () => changeShop('items', { notice: '' })), button(shop.submit, submitCart, true)];
    group('controls', ...actions);
    return;
  }
  /* 결제는 현금만. 예전 기록에 남은 'pay-method'·'card' 화면도 현금 결제로 연다 */
  if (['pay-method', 'cash', 'card', 'change'].includes(view)) {
    paymentScreen(shop);
    return;
  }
  if (view === 'receive') {
    const { payment } = state;
    const text = '현금으로 ' + won(orderTotal(cart)) + '을 결제했어요.';
    heading('결제했어요', text, shop.name);
    if (kiosk) kioskTicket(cart, payment);
    else receipt(cart, false);
    const receive = button(shop.receive, () => changeShop('shop-done'), true);
    receive.classList.add('payment-end-action');
    app.append(receive);
    return;
  }
  heading('문제를 해결했어요', shop.done, shop.name, 'cheer');
  rewardOnce();
  showPickup(cart, menu);
}

/* 하루랑 보상 — 주문·결제를 끝까지 하면 별 하나. 같은 완료 화면이 다시 그려져도 한 번만 */
function rewardOnce() {
  if (state.rewarded) return;
  state.rewarded = true;
  window.HaruRewards?.award(state.id);
}

function atmScreen(step, scene, values, choose) {
  const cardAction = step === 'card' || step === 'returnCard';
  const cashAction = step === 'takeCash' || (step === 'transaction' && values.deposit);
  heading('ATM');
  const machine = node('section', 'atm-machine');
  machine.setAttribute('aria-label', '연습용 ATM');
  const panel = node('section', 'atm-display');
  panel.setAttribute('aria-label', '거래 화면');

  if (cardAction || cashAction) {
    const message = {
      card: '카드를 넣어 주세요.',
      returnCard: '카드를 가져가세요.',
      transaction: '현금을 넣어 주세요.',
      takeCash: '현금을 가져가세요.'
    }[step];
    panel.append(node('p', 'atm-screen-message', message));
  } else {
    panel.append(node('p', 'atm-screen-message', scene.prompt));
    const buttons = node('div', 'atm-screen-buttons');
    for (const option of scene.options) {
      const image = step === 'choice' ? (option.values.deposit ? 'bank-10' : 'bank-11') :
        notes[option.values?.amount]?.image;
      const action = () => choose(option);
      const control = image ? card(option.label, image, action) : button(option.label, action);
      control.classList.add('atm-screen-action');
      buttons.append(control);
    }
    panel.append(buttons);
  }
  feedbackLine(panel);

  function slot(title, image, active) {
    const option = scene.options[0];
    const control = button('', () => {
      if (active) choose(option);
      else feedback('지금은 이곳을 사용할 차례가 아니에요. 거래 화면을 확인해 보세요.');
    });
    control.classList.add('atm-slot');
    control.append(node('strong', '', title));
    if (active) {
      control.classList.add('atm-slot-active');
      control.append(photo(image), node('span', 'atm-slot-action', option.label));
    } else {
      const opening = node('span', 'atm-opening');
      opening.setAttribute('aria-hidden', 'true');
      control.append(opening);
    }
    return control;
  }

  const slots = node('div', 'atm-slots');
  slots.append(
    slot('카드 투입구', step === 'returnCard' ? 'bank-12' : 'bank-9', cardAction),
    slot('현금 투입·수령', step === 'takeCash' ? 'bank-11' : 'bank-10', cashAction)
  );
  machine.append(panel, slots);
  app.append(machine);
}

function atmActivityScreen() {
  const { step, values } = state;
  const nextStep = atm.steps[step];
  if (!nextStep) {
    heading('문제를 해결했어요', atm.done, atm.name, 'cheer');
    rewardOnce();
    const card = photo('bank-12');
    card.alt = '돌려받은 카드';
    group('scene', card);
    if (!values.deposit) {
      const cash = photo(notes[values.amount].image);
      cash.alt = '받은 현금 ' + won(values.amount);
      group('atm-pickup-cash', cash, node('p', '', cash.alt));
    }
    return;
  }

  const scene = typeof nextStep === 'function' ? nextStep(values) : nextStep;
  atmScreen(step, scene, values, option => {
    if (step === 'choice' && option.values.deposit !== state.target.deposit) {
      feedback('문제에서 돈을 넣으라고 했나요, 꺼내라고 했나요? 다시 골라 보세요.');
      return;
    }
    if (step === 'amount' && option.values.amount !== state.target.amount) {
      feedback('문제에 나온 금액을 다시 확인하고 골라 보세요.');
      return;
    }
    show({ ...state, step: option.next, values: { ...values, ...option.values } });
  });
}

function render() {
  app.replaceChildren();
  const { id, view } = state;
  app.classList.toggle('kiosk-session', usesOrderScreen && Boolean(shops[id]));
  app.classList.toggle('kiosk-order-screen', view === 'kiosk-order');
  const showGoal = view === 'kiosk-order' || (id === 'atm' && state.step === atm.start);
  back.hidden = !navigation.hasPrevious && !area;
  home.hidden = view === 'home';
  replay.hidden = !showGoal;
  home.parentElement.hidden = home.hidden;
  if (view === 'home') {
    if (area) {
      heading(area.title, area.prompt, undefined, 'guide');
      if (area.id === 'kiosk') {
        const stores = places.filter(([key]) => key === 'mart' || Object.hasOwn(shops, key));
        group('grid places kiosk-menu',
          ...stores.map(([key, name, desc, image]) => card(name, image, () => startPlace(key), desc)),
          card('ATM', atm.image, () => openAtm(), '입금과 출금 연습'));
      }
      return;
    }
    heading('생활학습', '어디에 가 볼까요?');
    group('grid places', ...places.map(([key, name, desc, image]) =>
      card(name, image, () => startPlace(key), desc)));
    return;
  }
  if (view === 'places') {
    heading('마트', '어느 가게에 갈까요?');
    group('grid places', ...['fruit', 'vegetable'].map(key =>
      card(shops[key].name, shops[key].image, () => openShop(key))));
    return;
  }
  if (view === 'problem') {
    problemScreen();
    return;
  }
  if (showGoal) showProblemGoal();
  if (view === 'action') atmActivityScreen();
  else shopScreen(shops[id]);
}

back.addEventListener('click', () => navigation.back());
home.addEventListener('click', reset);
replay.addEventListener('click', readProblem);
if (area?.id === 'burger') openShop('burger', false);
else render();
