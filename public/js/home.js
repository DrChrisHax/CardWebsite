const token = localStorage.getItem('token');

function createGameTile(game) {
  const tile = document.createElement('div');
  tile.className = 'game-tile';
  tile.innerHTML = `
    <div class="tile-art">
      <span class="tile-placeholder">&#9824;</span>
    </div>
    <div class="tile-info">
      <span class="tile-name">${game.gameName}</span>
    </div>
  `;
  tile.addEventListener('click', function () {
    window.location.href = game.path;
  });
  return tile;
}

function createPlusTile() {
  const tile = document.createElement('div');
  tile.className = 'game-tile tile-plus';
  tile.setAttribute('aria-label', 'Open store to buy games');
  tile.innerHTML = `
    <div class="tile-art">
      <span class="tile-plus-icon">+</span>
    </div>
    <div class="tile-info">
      <span class="tile-name">Buy a Game</span>
    </div>
  `;
  tile.addEventListener('click', function () {
    window.openStore();
  });
  return tile;
}

async function loadGames() {
  try {
    const res = await fetch('/api/user/mygames', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function init() {
  const grid = document.getElementById('games-grid');
  grid.innerHTML = '';
  const games = await loadGames();
  const plusTile = createPlusTile();
  games.forEach(function (game) {
    grid.appendChild(createGameTile(game));
  });
  grid.appendChild(plusTile);
}

window.addEventListener('gamepurchased', function (e) {
  const grid = document.getElementById('games-grid');
  const plusTile = grid.querySelector('.tile-plus');
  grid.insertBefore(createGameTile(e.detail.game), plusTile);
});

init();
