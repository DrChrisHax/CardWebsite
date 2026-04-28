(function () {
  const token = localStorage.getItem("token");

  let gameId = null;
  let aiPlayersList = [];
  let activeGameState = null;
  let playerData = {};

  // ============================================================
  // API helper
  // ============================================================

  function apiFetch(path, method, body) {
    method = method || "GET";
    const opts = {
      method,
      headers: { Authorization: "Bearer " + token },
    };
    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch(path, opts).then(function (r) {
      if (r.status === 401) {
        window.location.replace(
          "/login?redirect=" + encodeURIComponent(window.location.pathname),
        );
        throw new Error("Unauthorized");
      }
      return r.json();
    });
  }

  // ============================================================
  // Init
  // ============================================================

  async function init() {
    const games = await apiFetch("/api/user/mygames");
    const thGame = games.find(function (g) {
      return g.path === "/games/texas_holdem";
    });

    if (!thGame) {
      window.location.replace("/home");
      return;
    }
    gameId = thGame._id;

    const data = await apiFetch("/api/poker/state?gameId=" + gameId);
    activeGameState = data.gameState;
    playerData = { username: data.username, chips: data.playerChips };

    if (activeGameState) {
      showSeats(activeGameState);
    }

    renderWelcomePopup();
  }

  // ============================================================
  // Seat rendering
  // ============================================================

  function showSeats(gameState) {
    gameState.aiSeats.forEach(function (ai) {
      var el = document.getElementById("seat-" + ai.seat);
      if (!el) return;
      el.querySelector(".seat-name").textContent = ai.displayName;
      el.querySelector(".seat-chips").textContent =
        "$" + ai.chips.toLocaleString("en-US");
      el.querySelector(".seat-model-tip").textContent = ai.model || "";
      el.hidden = false;
    });

    var playerEl = document.getElementById("seat-0");
    playerEl.querySelector(".seat-name").textContent = playerData.username;
    playerEl.querySelector(".seat-chips").textContent =
      "$" + playerData.chips.toLocaleString("en-US");
    playerEl.hidden = false;
  }

  // ============================================================
  // Welcome popup
  // ============================================================

  function renderWelcomePopup() {
    const container = document.getElementById("welcome-actions");

    if (activeGameState) {
      const names = activeGameState.aiSeats
        .map(function (s) {
          return s.displayName;
        })
        .join(", ");

      container.innerHTML =
        '<p class="welcome-info">' +
        activeGameState.handCount +
        " hand(s) played</p>" +
        '<p class="welcome-opponents">Opponents: ' +
        names +
        "</p>" +
        '<div class="th-btn-group">' +
        '<button id="btn-continue" class="th-btn th-btn-secondary">Continue Game</button>' +
        '<button id="btn-new-game-welcome" class="th-btn th-btn-primary">New Game</button>' +
        "</div>";

      document
        .getElementById("btn-continue")
        .addEventListener("click", continueGame);
      document
        .getElementById("btn-new-game-welcome")
        .addEventListener("click", openAISelect);
    } else {
      container.innerHTML =
        '<p class="welcome-info">No active game. Start a new one!</p>' +
        '<div class="th-btn-group">' +
        '<button id="btn-new-game-welcome" class="th-btn th-btn-primary">New Game</button>' +
        "</div>";

      document
        .getElementById("btn-new-game-welcome")
        .addEventListener("click", openAISelect);
    }
  }

  // ============================================================
  // AI selection popup
  // ============================================================

  async function openAISelect() {
    if (aiPlayersList.length === 0) {
      aiPlayersList = await apiFetch("/api/ai-players?gameId=" + gameId);
    }
    buildAISelects();
    document.getElementById("popup-welcome").hidden = true;
    document.getElementById("popup-ai-select").hidden = false;
  }

  function buildAISelects() {
    const container = document.getElementById("ai-seat-selects");
    container.innerHTML = "";

    for (var i = 1; i <= 5; i++) {
      const row = document.createElement("div");
      row.className = "ai-select-row";

      const label = document.createElement("label");
      label.textContent = "Seat " + i;
      label.htmlFor = "ai-seat-" + i;

      const select = document.createElement("select");
      select.id = "ai-seat-" + i;

      const defaultOpt = document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.textContent = "- None -";
      select.appendChild(defaultOpt);

      aiPlayersList.forEach(function (ai) {
        const opt = document.createElement("option");
        opt.value = ai._id;
        opt.textContent = ai.playerName;
        select.appendChild(opt);
      });

      row.appendChild(label);
      row.appendChild(select);
      container.appendChild(row);
    }
  }

  document.getElementById("btn-back").addEventListener("click", function () {
    document.getElementById("popup-ai-select").hidden = true;
    document.getElementById("popup-welcome").hidden = false;
    clearError();
  });

  document
    .getElementById("btn-start-game")
    .addEventListener("click", startNewGame);

  async function startNewGame() {
    clearError();

    const rawConfigs = [];
    const nameCounts = {};

    for (var i = 1; i <= 5; i++) {
      const select = document.getElementById("ai-seat-" + i);
      if (!select.value) {
        showError("Please select an AI for Seat " + i + ".");
        return;
      }
      const name = select.options[select.selectedIndex].textContent;
      nameCounts[name] = (nameCounts[name] || 0) + 1;
      rawConfigs.push({ aiPlayerId: select.value, baseName: name });
    }

    const nameCounters = {};
    const aiConfigs = rawConfigs.map(function (c) {
      if (nameCounts[c.baseName] > 1) {
        nameCounters[c.baseName] = (nameCounters[c.baseName] || 0) + 1;
        return {
          aiPlayerId: c.aiPlayerId,
          displayName: c.baseName + " " + nameCounters[c.baseName],
        };
      }
      return { aiPlayerId: c.aiPlayerId, displayName: c.baseName };
    });

    // Close the popup immediately, don't block on the API
    hideOverlay();

    try {
      const result = await apiFetch("/api/poker/new-game", "POST", {
        gameId,
        aiConfigs,
      });

      if (!result.error) {
        activeGameState = result.gameState;
        playerData = { username: result.username, chips: result.playerChips };
        showSeats(activeGameState);
      }
    } catch (err) {
      console.error("newGame failed:", err);
    }
  }

  // ============================================================
  // Continue game
  // ============================================================

  function continueGame() {
    hideOverlay();
    showSeats(activeGameState);
  }

  // ============================================================
  // Helpers
  // ============================================================

  function hideOverlay() {
    document.getElementById("popup-overlay").style.display = "none";
  }

  function showError(msg) {
    const el = document.getElementById("ai-select-error");
    el.textContent = msg;
    el.hidden = false;
  }

  function clearError() {
    const el = document.getElementById("ai-select-error");
    el.hidden = true;
    el.textContent = "";
  }

  // ============================================================
  // Start
  // ============================================================

  init().catch(console.error);
})();
