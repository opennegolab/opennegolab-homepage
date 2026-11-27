const form = document.querySelector('#guardianLogin');
const username = document.querySelector('#username');
const password = document.querySelector('#password');
const status = document.querySelector('#loginStatus');
const button = document.querySelector('#loginSubmit');
const switchMode = document.querySelector('#loginSwitch');
let registering = false;

switchMode.addEventListener('click', () => {
  registering = !registering;
  document.querySelector('#loginTitle').textContent = registering ? '보호자 계정 만들기' : '보호자 로그인';
  button.textContent = registering ? '계정 만들기' : '로그인';
  switchMode.textContent = registering ? '로그인으로 돌아가기' : '보호자 계정 만들기';
  password.autocomplete = registering ? 'new-password' : 'current-password';
  password.value = '';
  status.textContent = registering ? '아이디는 영문·숫자·밑줄 4~24자, 비밀번호는 12자 이상으로 정해 주세요.' : '';
  username.focus();
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = switchMode.disabled = true;
  status.textContent = '';
  try {
    const response = await fetch(registering ? '/api/typing/register' : '/api/typing/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value })
    });
    if (!response.ok) throw new Error((await response.json()).message);
    location.reload();
  } catch (error) {
    status.textContent = error.message;
    password.focus();
  } finally {
    password.value = '';
    button.disabled = switchMode.disabled = false;
  }
});
