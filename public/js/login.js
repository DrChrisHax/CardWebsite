const identifierInput = document.getElementById('identifier');
const passwordInput = document.getElementById('password');
const formError = document.getElementById('form-error');
const submitBtn = document.getElementById('submit-btn');

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in…';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: identifierInput.value.trim(),
        password: passwordInput.value,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      formError.textContent = data.error || 'Login failed';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Login';
      return;
    }
    localStorage.setItem('token', data.token);
    window.location.href = '/home';
  } catch {
    formError.textContent = 'Network error. Please try again.';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';
  }
});
