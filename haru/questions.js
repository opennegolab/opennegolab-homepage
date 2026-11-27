// 이미 풀고 있는 문제가 있으면 다음 선택에서 제외합니다.
export function randomQuestion(questions, previous) {
  const choices = questions.filter(question => question !== previous);
  const pool = choices.length ? choices : questions;
  return pool[Math.floor(Math.random() * pool.length)];
}
