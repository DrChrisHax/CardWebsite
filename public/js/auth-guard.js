(function () {
  const token = localStorage.getItem('token');
  const redirect = encodeURIComponent(window.location.pathname);

  if (!token) {
    window.location.replace('/login?redirect=' + redirect);
    return;
  }

  // Hide the page until the token is validated to prevent a flash of protected content
  document.documentElement.style.visibility = 'hidden';

  fetch('/api/auth/me', {
    headers: { Authorization: 'Bearer ' + token },
  }).then(function (res) {
    if (res.ok) {
      document.documentElement.style.visibility = '';
    } else {
      localStorage.removeItem('token');
      window.location.replace('/login?redirect=' + redirect);
    }
  }).catch(function () {
    document.documentElement.style.visibility = '';
  });
})();
