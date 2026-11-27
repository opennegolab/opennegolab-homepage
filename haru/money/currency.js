export const notes = {
  1000: { image: 'details-4', spoken: '천 원' },
  5000: { image: 'details-5', spoken: '오천 원' },
  10000: { image: 'details-6', spoken: '만 원' }
};

export const values = Object.keys(notes).map(Number);
const formatted = new Intl.NumberFormat('ko-KR');
export const won = value => formatted.format(value) + '원';
export const total = group => group.reduce((sum, value) => sum + value, 0);
