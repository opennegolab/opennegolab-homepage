export const places = [
  ['mart', '마트', '과일과 채소 사기', 'places-1'],
  ['stationery', '문구점', '학용품 사기', 'places-2'],
  ['cafe', '카페', '음료와 디저트 주문하기', 'places-3'],
  ['food', '음식점', '먹고 싶은 음식 주문하기', 'places-4'],
  ['bank', '은행', '은행 창구 이용하기', 'places-5']
];

// 금액은 결제 체험에 사용하는 가상의 판매가입니다.
const prices = {
  fruit: [2000, 1000, 1000, 4000, 10000, 1000, 3000, 3000, 2000, 1000],
  vegetable: [1000, 1000, 1000, 1000, 3000, 2000, 1000, 2000, 2000, 3000],
  stationery: [1000, 1000, 2000, 1000, 3000, 2000, 1000, 3000, 5000, 2000],
  cafe: [4000, 4000, 4000, 3000, 3000, 4000, 5000, 3000, 5000, 2000, 4000],
  burger: [4000, 5000, 6000, 5000, 2000, 3000, 2000, 2000, 3000],
  food: [6000, 9000, 9000, 7000, 8000, 8000, 12000, 15000, 4000, 3000, 6000, 5000, 8000, 10000, 5000, 9000]
};

function items(image, entries) {
  return entries.map(([name, unit = '개'], i) => ({
    name, unit, image: image + '-' + (i + 1), price: prices[image][i]
  }));
}
const list = names => names.split(' ').map(name => [name]);

const purchase = {
  prompt: '어떤 물건을 살까요?', container: '장바구니', containerImage: 'vehicles-6',
  add: '장바구니에 담기', more: '더 고르기', submit: '구매하기',
  confirm: '구매할 물건을 확인해요.', receive: '물건 받기', done: '물건을 받았어요.'
};
const order = {
  prompt: '무엇을 주문할까요?', container: '주문 목록', containerImage: 'cafe-12',
  add: '주문 목록에 담기', more: '더 고르기', submit: '주문하기',
  confirm: '주문할 메뉴를 확인해요.', receive: '메뉴 받기', done: '메뉴를 받았어요. 감사합니다.'
};

export const shops = {
  fruit: { name: '과일가게', image: 'places-7', ...purchase, groups: [
    ['과일', items('fruit', list('사과 바나나 딸기 포도 수박 귤 배 복숭아 오렌지 키위').map(([name]) => [name, name === '포도' ? '송이' : '개']))]
  ] },
  vegetable: { name: '채소가게', image: 'places-8', ...purchase, groups: [
    ['채소', items('vegetable', list('당근 오이 감자 양파 배추 무 고추 토마토 가지 호박').map(([name]) => [name, name === '배추' ? '포기' : '개']))]
  ] },
  stationery: { name: '문구점', image: 'places-2', ...purchase, groups: [
    ['학용품', items('stationery', [
      ['연필', '자루'], ['지우개'], ['공책', '권'], ['색연필', '자루'], ['가위'],
      ['풀'], ['자'], ['스케치북', '권'], ['필통'], ['색종이', '장']
    ])]
  ] },
  cafe: { name: '카페', image: 'places-3', ...order, groups: (() => {
    const menu = items('cafe', [
      ...list('딸기주스 오렌지주스 사과주스 초코우유 딸기우유 레모네이드').map(([name]) => [name, '잔']),
      ['과일 스무디', '잔'], ['아이스크림', '스쿱'], ['케이크', '조각'], ['쿠키'], ['와플']
    ]);
    return [['음료', menu.slice(0, 7)], ['디저트', menu.slice(7)]];
  })() },
  burger: { name: '햄버거 가게', image: 'burger-2', ...order, groups: (() => {
    const menu = items('burger', [
      ['샌드위치'], ['치즈버거'], ['치킨버거'], ['불고기버거'],
      ['감자튀김', '팩'], ['치킨 조각', '팩'],
      ['콜라', '잔'], ['레몬소다', '잔'], ['오렌지주스', '잔']
    ]);
    return [['버거·샌드위치', [menu[2], menu[3], menu[1], menu[0]]], ['사이드', menu.slice(4, 6)], ['음료', menu.slice(6)]];
  })() },
  food: { name: '음식점', image: 'places-4', ...order, prompt: '무엇을 먹을까요?',
    receive: '음식 받기', done: '음식을 받았어요. 잘 먹겠습니다.', groups: (() => {
      const menu = items('food', list('햄버거 돈가스 제육볶음 짜장면 짬뽕 볶음밥 치킨 피자 떡볶이 김밥 우동 라면 카레라이스 불고기 만두 스파게티')
        .map(([name]) => [name, '인분']));
      return [['식사', menu.slice(0, 6).concat(menu.slice(10, 14), menu.slice(15))],
        ['간식과 함께 먹는 음식', menu.slice(6, 10).concat(menu.slice(14, 15))]];
    })() }
};

const action = (label, image, next, values) => ({ label, image, next, values });
const step = (prompt, ...options) => ({ prompt, options });

function bankActivity(atm) {
  const steps = {
    ticket: step('번호표 기계에서 내 번호를 뽑아요.', action('번호표 뽑기', 'bank-2', 'wait')),
    wait: step('내 번호는 12번이에요. 의자에 앉아 차례를 기다려요.', action('차례 기다리기', 'bank-3', 'call')),
    call: { ...step('12번 손님, 창구로 오세요.', action('창구로 가기', 'bank-1', 'passbook')), image: 'bank-4', alt: '호출 번호 12번' },
    passbook: step('창구 직원에게 통장을 건네요.', action('통장 건네기', 'bank-5', 'choice')),
    card: { ...step('ATM에 연습용 카드를 넣어요.', action('카드 넣기', 'bank-9', 'choice')), image: 'bank-7', alt: '연습용 카드' },
    choice: step('돈을 넣을까요, 꺼낼까요?',
      action('입금하기', 'bank-10', 'amount', { deposit: true }),
      action('출금하기', 'bank-11', 'amount', { deposit: false })),
    amount: step('연습할 금액을 골라요.', ...[1000, 5000, 10000].map((amount, index) =>
      action(amount.toLocaleString('ko-KR') + '원', 'details-' + (index + 4), 'transaction', { amount }))),
    transaction: ({ deposit, amount }) => {
      const sum = amount.toLocaleString('ko-KR') + '원';
      const text = deposit ? '입금해 주세요.' : '출금해 주세요.';
      return step(sum + ' ' + text, action(deposit ? '돈 넣기' : '출금 요청하기',
        deposit ? 'bank-10' : atm ? 'bank-8' : 'bank-1', atm ? 'confirm' : 'result'));
    },
    confirm: ({ deposit, amount }) => step(
      (deposit ? '입금 금액 ' : '출금 금액 ') + amount.toLocaleString('ko-KR') + '원',
      action('거래 확인', 'bank-8', 'result')),
    result: ({ deposit, amount }) => step(amount.toLocaleString('ko-KR') + '원 ' + (deposit ? '입금했어요.' : '출금했어요.'),
      atm || deposit
        ? action('결과 확인', 'bank-6', atm ? 'returnCard' : 'returnBook')
        : action('현금 받기', 'details-3', 'returnBook')),
    returnCard: ({ deposit }) => step('카드를 챙겨요.', action('카드 받기', 'bank-12', deposit ? 'leave' : 'takeCash')),
    takeCash: step('현금 수령구가 열렸어요.', action('현금 받기', 'bank-11', 'leave')),
    returnBook: step('통장을 다시 받아요.', action('통장 받기', 'bank-5', 'leave')),
    leave: step(atm ? '받은 물건을 챙기고 나와요.' : '직원에게 감사 인사를 하고 나와요.',
      action(atm ? 'ATM에서 나오기' : '감사합니다', atm ? 'bank-8' : 'bank-1', 'done'))
  };
  return { name: atm ? 'ATM' : '은행 창구', image: atm ? 'bank-8' : 'bank-1',
    start: atm ? 'card' : 'ticket', steps, done: '은행 이용을 마쳤어요.' };
}

export const banks = { counter: bankActivity(false), atm: bankActivity(true) };

// 문제는 기존 품목과 활동을 참조합니다. 품목 이름과 수량이 모두 맞아야 주문할 수 있습니다.
export const shopProblems = {
  fruit: [{ items: [['사과', 2]] }, { items: [['바나나', 1], ['귤', 3]] }],
  vegetable: [{ items: [['당근', 2]] }, { items: [['오이', 1], ['감자', 3]] }],
  stationery: [{ items: [['연필', 2]] }, { items: [['공책', 1], ['지우개', 2]] }],
  cafe: [{ items: [['딸기주스', 1]] }, { items: [['레모네이드', 2], ['쿠키', 1]] }],
  burger: [
    { items: [['치즈버거', 1], ['감자튀김', 1], ['콜라', 1]] },
    { items: [['치킨버거', 1], ['치킨 조각', 1], ['레몬소다', 2]] },
    { items: [['불고기버거', 2], ['오렌지주스', 1]] },
    { items: [['샌드위치', 1], ['감자튀김', 2], ['오렌지주스', 1]] }
  ],
  food: [{ items: [['돈가스', 1]] }, { items: [['김밥', 2], ['우동', 1]] }]
};

export const bankProblems = {
  counter: [{ deposit: true, amount: 5000 }, { deposit: false, amount: 1000 }],
  atm: [{ deposit: false, amount: 10000 }, { deposit: true, amount: 5000 }]
};

export const bankContexts = {
  ticket: ['은행에 도착했어요. 창구에 다른 손님들이 있어요.', 'call'],
  wait: ['내 번호는 12번이에요. 아직 12번을 부르지 않았어요.', 'call'],
  call: ['12번 손님을 불렀어요.', 'wait'],
  passbook: ['창구 직원이 인사를 해요. 통장이 손에 있어요.', 'returnBook'],
  card: ['ATM 앞에 도착했어요. 연습용 카드를 가지고 있어요.', 'returnCard'],
  choice: ['거래 종류를 고르는 화면이에요. 문제를 다시 확인해 보세요.'],
  amount: ['금액을 고르는 화면이에요. 얼마인지 기억하나요?'],
  transaction: ['종류와 금액을 골랐어요. 이제 거래를 진행할 차례예요.', 'leave'],
  result: ['거래가 끝났다는 안내가 나왔어요.', 'leave'],
  returnCard: ['거래를 마쳤어요. ATM에 넣어 둔 것이 있어요.', 'leave'],
  returnBook: ['거래를 마쳤어요. 창구에 건넨 것이 있어요.', 'leave'],
  leave: ['받을 물건을 다 챙겼어요.', 'choice']
};
