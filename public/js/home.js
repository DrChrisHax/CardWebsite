// TODO: replace with real API calls once backend is ready
const MOCK_PURCHASED_GAMES = [
  { id: 1, gameName: "Texas Hold'em" },
];

function createGameTile(game) {
  const tile = document.createElement('div');
  tile.className = 'game-tile';
  tile.innerHTML = `
    <div class="tile-art">
      <span class="tile-placeholder">♠</span>
    </div>
    <div class="tile-info">
      <span class="tile-name">${game.gameName}</span>
    </div>
  `;
  tile.addEventListener('click', () => {
    // TODO: route to game page via routes.js
    console.log('Navigate to game:', game.gameName);
  });
  return tile;
}

function createPlusTile() {
  const tile = document.createElement('div');
  tile.className = 'game-tile tile-plus';
  tile.innerHTML = `
    <div class="tile-art">
      <span class="tile-plus-icon">+</span>
    </div>
    <div class="tile-info">
      <span class="tile-name">Buy a Game</span>
    </div>
  `;
  tile.addEventListener('click', () => {
    // TODO: open purchase dialog
    console.log('Open purchase dialog');
  });
  return tile;
}

function renderGrid(games) {
  const grid = document.getElementById('games-grid');
  grid.innerHTML = '';
  games.forEach(game => grid.appendChild(createGameTile(game)));
  grid.appendChild(createPlusTile());
}

renderGrid(MOCK_PURCHASED_GAMES);
