import { banks, places, shops, trips } from './content.js?v=1';
import { speak } from './speech.js?v=1';

const app = document.querySelector('#app');
const back = document.querySelector('#back');
const home = document.querySelector('#home');
const room = document.querySelector('.room');
const voiceStatus = document.querySelector('#voice-status');

const welcome = '어디에 가 볼까요? 가 보고 싶은 곳의 사진을 눌러요.';
let state = { view: 'home' };
let trail = [];
let narration = welcome;

function say(text) {
  narration = text;
  voiceStatus.hidden = true;
  speak(text, () => {
    voiceStatus.textContent = '소리가 들리지 않으면 기기의 음량과 한국어 음성 설정을 확인해 주세요.';
    voiceStatus.hidden = false;
  });
}

function show(next, remember = true) {
  if (remember) trail.push(state);
  state = next;
  const text = render();
  app.querySelector('h1').focus({ preventScroll: true });
  window.scrollTo(0, 0);
  say(text);
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

function heading(title, prompt, detail) {
  const header = node('div', 'heading');
  if (detail) header.append(node('p', 'context', detail));
  const titleElement = node('h1', '', title);
  titleElement.tabIndex = -1;
  header.append(titleElement);
  if (prompt) header.append(node('p', 'prompt', prompt));
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
  trail = parent ? [start] : [];
  state = parent ? { view: 'places', id: parent } : start;
}

function restartShop(id) {
  resetActivity(['fruit', 'vegetable'].includes(id) ? 'mart' : null);
  openShop(id);
}

function openShop(id) {
  show({ view: 'entrance', id, category: 0, cart: [] });
}

function openActivity(id, place, activity) {
  show({ view: 'action', id, place, activity, step: activity.start ?? 0, values: {} });
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

function finishActions(repeat, other = reset) {
  group('controls', button('다시 하기', repeat, true), button('다른 활동 하기', other),
    button('처음으로 돌아가기', reset));
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
    const actions = [button(shop.more, () => changeShop('items', { notice: '' }))];
    if (cart.length) actions.push(button(shop.submit, () => changeShop('receive'), true));
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
  heading('활동을 마쳤어요', shop.done, shop.name);
  receipt(cart, false);
  finishActions(() => restartShop(id), id === 'fruit' || id === 'vegetable' ? () => { trail = []; show({ view: 'places', id: 'mart' }); } : reset);
  return shop.done + ' ' + cart.map(line => wording(line.item, line.count) + ' 받았어요.').join(' ');
}

function activityScreen() {
  const { activity, step, place, id, values } = state;
  const steps = activity.steps;
  const nextStep = steps[step];
  if (!nextStep) {
    heading('활동을 마쳤어요', activity.done, activity.name);
    group('scene', photo(activity.image));
    finishActions(() => {
      resetActivity(place);
      openActivity(id, place, activity);
    }, () => {
      trail = [];
      show({ view: 'places', id: place });
    });
    return activity.done;
  }
  const scene = typeof nextStep === 'function' ? nextStep(values) : nextStep;
  heading(activity.name, scene.prompt, typeof step === 'number'
    ? (step + 1) + ' / ' + steps.length : '가상 은행 연습');
  if (scene.image) {
    const picture = photo(scene.image);
    picture.alt = scene.alt || '';
    group('scene', picture);
  }
  const choices = scene.options.map(option => card(option.label, option.image, () => {
    if (option.next === undefined) {
      const feedback = option.hint || scene.prompt;
      app.querySelector('.prompt').textContent = feedback;
      say(feedback);
      return;
    }
    show({ ...state, step: option.next, values: { ...values, ...option.values } });
  }));
  group(choices.length === 1 ? 'single action' : 'grid actions', ...choices);
  return scene.prompt;
}

function render() {
  app.replaceChildren();
  const { id, view } = state;
  back.hidden = trail.length === 0;
  home.hidden = view === 'home';
  room.hidden = view !== 'home';
  if (view === 'home') {
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
  return view === 'action' ? activityScreen() : shopScreen(shops[id]);
}

back.addEventListener('click', previous);
home.addEventListener('click', reset);
document.querySelector('#listen').addEventListener('click', () => say(narration));
render();
