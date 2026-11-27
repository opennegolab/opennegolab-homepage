const form = document.querySelector('#guardianLogin');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button');
  const password = document.querySelector('#password');
  const status = document.querySelector('#loginStatus');
  button.disabled = true;
  status.textContent = '';
  try {
    const response = await fetch('/api/typing/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value })
    });
    if (!response.ok) throw new Error((await response.json()).message);
    location.reload();
  } catch (error) {
    status.textContent = error.message;
    password.focus();
  } finally {
    password.value = '';
    button.disabled = false;
  }
});
