export const places = [
  ['mart', '마트', '과일과 채소 사기', 'places-1'],
  ['stationery', '문구점', '학용품 사기', 'places-2'],
  ['cafe', '카페', '음료와 디저트 주문하기', 'places-3'],
  ['food', '음식점', '먹고 싶은 음식 주문하기', 'places-4']
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
  burger: { name: '패스트푸드', image: 'burger-2', ...order, groups: (() => {
    const menu = items('burger', [
      ['햄채소 샌드위치'], ['치즈버거'], ['치킨버거'], ['불고기버거'],
      ['감자튀김', '팩'], ['치킨 조각', '팩'],
      ['콜라', '잔'], ['레몬소다', '잔'], ['오렌지주스', '잔']
    ]);
    const sandwiches = [
      menu[0],
      { name: '햄치즈 샌드위치', unit: '개', image: 'ham-cheese-sandwich', price: 4500 },
      { name: '에그 샌드위치', unit: '개', image: 'egg-sandwich', price: 4500 }
    ];
    const pizzas = [
      { name: '치즈 피자', unit: '판', image: 'cheese-pizza', price: prices.food[7] },
      { name: '페퍼로니 피자', unit: '판', image: 'food-8', price: 16000 },
      { name: '고구마 피자', unit: '판', image: 'sweet-potato-pizza', price: 16000 }
    ];
    const friedChicken = { name: '프라이드 치킨', unit: '팩', image: 'food-7', price: prices.food[6] };
    return [
      ['햄버거', [menu[2], menu[3], menu[1]]],
      ['샌드위치', sandwiches],
      ['피자', pizzas],
      ['치킨', [menu[5], friedChicken]],
      ['사이드', [menu[4]]],
      ['음료', menu.slice(6)]
    ];
  })() },
  food: { name: '음식점', image: 'places-4', ...order, prompt: '무엇을 먹을까요?',
    receive: '음식 받기', done: '음식을 받았어요. 잘 먹겠습니다.', groups: (() => {
      const menu = items('food', list('햄버거 돈가스 제육볶음 짜장면 짬뽕 볶음밥 치킨 피자 떡볶이 김밥 우동 라면 카레라이스 불고기 만두 스파게티')
        .map(([name]) => [name, '인분']));
      return [['식사', menu.slice(0, 6).concat(menu.slice(10, 14), menu.slice(15))],
        ['간식과 함께 먹는 음식', menu.slice(6, 10).concat(menu.slice(14, 15))]];
    })() }
};

const action = (label, next, values) => ({ label, next, values });
const step = (prompt, ...options) => ({ prompt, options });
const amountLabel = amount => amount.toLocaleString('ko-KR') + '원';

export const atm = {
  name: 'ATM',
  image: 'bank-8',
  start: 'card',
  done: 'ATM 이용을 마쳤어요.',
  steps: {
    card: step('카드를 넣어 주세요.', action('카드 넣기', 'choice')),
    choice: step('돈을 넣을까요, 꺼낼까요?',
      action('입금하기', 'amount', { deposit: true }),
      action('출금하기', 'amount', { deposit: false })),
    amount: step('연습할 금액을 골라요.', ...[1000, 5000, 10000].map(amount =>
      action(amountLabel(amount), 'transaction', { amount }))),
    transaction: ({ deposit, amount }) => step(amountLabel(amount) + (deposit ? ' 입금해 주세요.' : ' 출금해 주세요.'),
      action(deposit ? '돈 넣기' : '출금 요청하기', 'confirm')),
    confirm: ({ deposit, amount }) => step(
      (deposit ? '입금 금액 ' : '출금 금액 ') + amountLabel(amount), action('거래 확인', 'result')),
    result: ({ deposit, amount }) => step(amountLabel(amount) + (deposit ? ' 입금했어요.' : ' 출금했어요.'),
      action('결과 확인', 'returnCard')),
    returnCard: ({ deposit }) => step('카드를 챙겨요.', action('카드 받기', deposit ? 'leave' : 'takeCash')),
    takeCash: step('현금 수령구가 열렸어요.', action('현금 받기', 'leave')),
    leave: step('받은 물건을 챙기고 나와요.', action('ATM에서 나오기', 'done'))
  }
};

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
    { items: [['햄채소 샌드위치', 1], ['감자튀김', 2], ['오렌지주스', 1]] },
    { items: [['치즈 피자', 1], ['프라이드 치킨', 1], ['콜라', 2]] },
    { items: [['햄치즈 샌드위치', 1], ['페퍼로니 피자', 1]] },
    { items: [['에그 샌드위치', 1], ['고구마 피자', 1]] }
  ],
  food: [{ items: [['돈가스', 1]] }, { items: [['김밥', 2], ['우동', 1]] }]
};

export const atmProblems = [1000, 5000, 10000].flatMap(amount => [
  { deposit: false, amount }, { deposit: true, amount }
]);
