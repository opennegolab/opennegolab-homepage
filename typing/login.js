const form = document.querySelector('#guardianLogin');
const username = document.querySelector('#username');
const password = document.querySelector('#password');
const status = document.querySelector('#loginStatus');
const button = document.querySelector('#loginSubmit');
const switchMode = document.querySelector('#loginSwitch');
const upgrade = document.querySelector('#loginUpgrade');
const newPin = document.querySelector('#newPin');
let mode = 'login';

function selectMode(next) {
  mode = next;
  const registering = mode === 'register';
  const upgrading = mode === 'upgrade';
  document.querySelector('#loginTitle').textContent = upgrading ? '비밀번호 바꾸기' :
    registering ? '보호자 계정 만들기' : '보호자 로그인';
  button.textContent = upgrading ? '변경하고 로그인' : registering ? '계정 만들기' : '로그인';
  switchMode.textContent = mode === 'login' ? '계정 만들기' : '로그인으로 돌아가기';
  upgrade.hidden = mode !== 'login';
  password.autocomplete = registering ? 'new-password' : 'current-password';
  password.inputMode = upgrading ? 'text' : 'numeric';
  password.maxLength = upgrading ? 128 : 4;
  password.pattern = upgrading ? '.{12,128}' : '[0-9]{4}';
  document.querySelector('#passwordLabel').textContent = upgrading ? '기존 비밀번호' : '비밀번호 (숫자 4자리)';
  document.querySelector('#newPinFields').hidden = !upgrading;
  newPin.disabled = !upgrading;
  newPin.required = upgrading;
  password.value = newPin.value = '';
  status.textContent = '';
  username.focus();
}

switchMode.addEventListener('click', () => selectMode(mode === 'login' ? 'register' : 'login'));
upgrade.addEventListener('click', () => selectMode('upgrade'));

form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = switchMode.disabled = upgrade.disabled = true;
  status.textContent = '';
  try {
    const response = await fetch(mode === 'register' ? '/api/typing/register' : '/api/typing/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value,
        newPin: mode === 'upgrade' ? newPin.value : undefined })
    });
    if (!response.ok) throw new Error((await response.json()).message);
    location.reload();
  } catch (error) {
    status.textContent = error.message;
    password.focus();
  } finally {
    password.value = newPin.value = '';
    button.disabled = switchMode.disabled = upgrade.disabled = false;
  }
});
