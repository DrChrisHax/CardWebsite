async function logout() {
  const token = localStorage.getItem('token');
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } finally {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
}

function createNavbar() {
  const nav = document.createElement('nav');
  nav.className = 'navbar';
  nav.innerHTML = `
    <div class="navbar-left">
      <button class="navbar-home-btn" aria-label="Home">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
          <polyline points="9 21 9 12 15 12 15 21"/>
        </svg>
        <span>Home</span>
      </button>
    </div>
    <div class="navbar-right">
      <span class="navbar-balance">$1,000</span>
      <div class="navbar-profile-wrapper">
        <button class="navbar-profile-btn" aria-label="Profile" aria-expanded="false">
          <div class="navbar-avatar"></div>
        </button>
        <div class="navbar-dropdown" hidden>
          <button class="dropdown-item" id="dd-profile">Profile</button>
          <button class="dropdown-item" id="dd-settings">Settings</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item dropdown-item--danger" id="dd-logout">Log Out</button>
        </div>
      </div>
    </div>
  `;

  document.body.prepend(nav);

  const homeBtn = nav.querySelector('.navbar-home-btn');
  const profileBtn = nav.querySelector('.navbar-profile-btn');
  const dropdown = nav.querySelector('.navbar-dropdown');

  homeBtn.addEventListener('click', () => {
    window.location.href = '/home';
  });

  profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !dropdown.hidden;
    dropdown.hidden = isOpen;
    profileBtn.setAttribute('aria-expanded', String(!isOpen));
  });

  document.addEventListener('click', () => {
    dropdown.hidden = true;
    profileBtn.setAttribute('aria-expanded', 'false');
  });

  nav.querySelector('#dd-profile').addEventListener('click', () => {
    window.location.href = '/profile';
  });

  nav.querySelector('#dd-logout').addEventListener('click', logout);
}

createNavbar();
