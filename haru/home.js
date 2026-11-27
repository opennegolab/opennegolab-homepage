import { showSpeechHelp, speak } from '/typing/learn/speech.js?v=2';

const listen = document.querySelector('#greeting-audio');
const message = document.querySelector('#speech-message');
listen.hidden = false;
listen.addEventListener('click', () => {
  const greeting = document.querySelector('#greeting').textContent;
  message.hidden = true;
  listen.querySelector('span').textContent = '다시 듣기';
  speak(greeting, () => showSpeechHelp(message));
});
