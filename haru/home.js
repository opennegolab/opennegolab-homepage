import { speak } from '/typing/learn/speech.js?v=1';

const listen = document.querySelector('#greeting-audio');
const message = document.querySelector('#speech-message');
listen.hidden = false;
listen.addEventListener('click', () => {
  const greeting = document.querySelector('#greeting').textContent;
  message.hidden = true;
  listen.querySelector('span').textContent = '다시 듣기';
  speak(greeting + ' 타자 연습, 키오스크, 은행 이용, 교통수단 중에서 골라요.', () => {
    message.textContent = '소리가 들리지 않으면 음량과 한국어 음성 설정을 확인해 주세요.';
    message.hidden = false;
  });
});
