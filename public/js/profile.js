async function loadProfile() {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { username } = await res.json();
  document.getElementById('profile-username').textContent = username;
}

loadProfile();
