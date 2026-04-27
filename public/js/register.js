const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmInput = document.getElementById('confirm-password');
const usernameHint = document.getElementById('username-hint');
const emailHint = document.getElementById('email-hint');
const confirmHint = document.getElementById('confirm-hint');
const formError = document.getElementById('form-error');
const submitBtn = document.getElementById('submit-btn');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function setHint(el, message, type) {
  el.textContent = message;
  el.className = 'field-hint ' + type;
}

const checkUsername = debounce(async (value) => {
  if (value.length === 0) { setHint(usernameHint, '', ''); return; }
  if (value.length < 3) { setHint(usernameHint, 'Must be at least 3 characters', 'error'); return; }
  setHint(usernameHint, 'Checking…', 'checking');
  try {
    const res = await fetch(`/api/auth/check/username?value=${encodeURIComponent(value)}`);
    const data = await res.json();
    data.available
      ? setHint(usernameHint, 'Username is available', 'available')
      : setHint(usernameHint, 'Username is already taken', 'taken');
  } catch {
    setHint(usernameHint, '', '');
  }
}, 400);

const checkEmail = debounce(async (value) => {
  if (value.length === 0) { setHint(emailHint, '', ''); return; }
  if (!EMAIL_REGEX.test(value)) { setHint(emailHint, 'Enter a valid email (x@x.x)', 'error'); return; }
  setHint(emailHint, 'Checking…', 'checking');
  try {
    const res = await fetch(`/api/auth/check/email?value=${encodeURIComponent(value)}`);
    const data = await res.json();
    data.available
      ? setHint(emailHint, 'Email is available', 'available')
      : setHint(emailHint, 'Email is already registered', 'taken');
  } catch {
    setHint(emailHint, '', '');
  }
}, 400);

usernameInput.addEventListener('input', (e) => checkUsername(e.target.value.trim()));
emailInput.addEventListener('input', (e) => checkEmail(e.target.value.trim()));

confirmInput.addEventListener('input', () => {
  if (!confirmInput.value) { setHint(confirmHint, '', ''); return; }
  confirmInput.value === passwordInput.value
    ? setHint(confirmHint, 'Passwords match', 'available')
    : setHint(confirmHint, 'Passwords do not match', 'error');
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account…';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passwordInput.value,
        confirmPassword: confirmInput.value,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      formError.textContent = data.error || 'Registration failed';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Register';
      return;
    }
    localStorage.setItem('token', data.token);
    window.location.href = '/home';
  } catch {
    formError.textContent = 'Network error. Please try again.';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Register';
  }
});
