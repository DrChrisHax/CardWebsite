(function () {
  const token = localStorage.getItem("token");

  let gameId = null;
  let aiPlayersList = [];
  let activeGameState = null;
  let playerData = {};
  let currentToCall = 0;

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
  // Card helpers
  // Card set is hardcoded to Kenny Cards for now.
  // Future: read from user settings (localStorage key "cardSet") and allow switching mid-session.
  // ============================================================

  const CARD_SET_SMALL = "Kenny Cards Small";
  const CARD_SET_LARGE = "Kenny Cards Large";

  function cardUrl(code, large) {
    const set = large ? CARD_SET_LARGE : CARD_SET_SMALL;
    return (
      "/res/" + encodeURIComponent(set) + "/" + code.replace("T", "10") + ".png"
    );
  }

  function cardBackUrl() {
    return "/res/" + encodeURIComponent(CARD_SET_SMALL) + "/CardBack.png";
  }

  // Dealer button positions within #table-surface for each seat
  const DEALER_POS = {
    0: { left: "50%", top: "82%" },
    1: { left: "20%", top: "73%" },
    2: { left: "20%", top: "27%" },
    3: { left: "50%", top: "12%" },
    4: { left: "80%", top: "27%" },
    5: { left: "80%", top: "73%" },
  };

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

    if (activeGameState) showSeats(activeGameState);
    renderWelcomePopup();
  }

  // ============================================================
  // showSeats — unhide seats and set static info (name, model tip)
  // ============================================================

  function showSeats(gameState) {
    gameState.aiSeats.forEach(function (ai) {
      const el = document.getElementById("seat-" + ai.seat);
      if (!el) return;
      el.querySelector(".seat-name").textContent = ai.displayName;
      el.querySelector(".seat-chips").textContent =
        "$" + ai.chips.toLocaleString("en-US");
      el.querySelector(".seat-model-tip").textContent = ai.model || "";
      el.hidden = false;
    });

    const playerEl = document.getElementById("seat-0");
    playerEl.querySelector(".seat-name").textContent = playerData.username;
    playerEl.querySelector(".seat-chips").textContent =
      "$" + playerData.chips.toLocaleString("en-US");
    playerEl.hidden = false;
  }

  // ============================================================
  // renderState — update all dynamic DOM from server state snapshot
  // ============================================================

  function renderState(state) {
    activeGameState = state;
    if (state.playerChips !== undefined) playerData.chips = state.playerChips;

    const hand = state.currentHand;

    // AI seats
    state.aiSeats.forEach(function (ai) {
      const el = document.getElementById("seat-" + ai.seat);
      if (!el) return;

      el.querySelector(".seat-chips").textContent =
        "$" + ai.chips.toLocaleString("en-US");

      const isFolded = hand
        ? hand.foldedSeats.includes(ai.seat) ||
          hand.foldedSeats.includes(String(ai.seat))
        : false;
      const isAllin = hand
        ? hand.allInSeats.includes(ai.seat) ||
          hand.allInSeats.includes(String(ai.seat))
        : false;
      el.classList.toggle("seat-folded", isFolded);
      el.classList.toggle("seat-allin", isAllin);

      const bet = hand
        ? hand.seatBets[String(ai.seat)] || hand.seatBets[ai.seat] || 0
        : 0;
      el.querySelector(".seat-bet").textContent = bet > 0 ? "$" + bet : "";

      const cardsEl = el.querySelector(".seat-cards");
      cardsEl.innerHTML = "";
      if (hand && !isFolded) {
        for (let i = 0; i < 2; i++) {
          const img = document.createElement("img");
          img.src = cardBackUrl();
          img.className = "card-img";
          cardsEl.appendChild(img);
        }
      }
    });

    // Player seat
    const playerEl = document.getElementById("seat-0");
    playerEl.querySelector(".seat-chips").textContent =
      "$" + (state.playerChips || 0).toLocaleString("en-US");

    const playerBet = hand ? hand.seatBets["0"] || hand.seatBets[0] || 0 : 0;
    playerEl.querySelector(".seat-bet").textContent =
      playerBet > 0 ? "$" + playerBet : "";

    const playerCardsEl = playerEl.querySelector(".seat-cards");
    playerCardsEl.innerHTML = "";
    if (hand && hand.playerCards && hand.playerCards.length) {
      hand.playerCards.forEach(function (code) {
        const img = document.createElement("img");
        img.src = cardUrl(code, false);
        img.className = "card-img";
        playerCardsEl.appendChild(img);
      });
    }

    // Community cards
    document
      .querySelectorAll("#community-cards .card-slot")
      .forEach(function (slot, i) {
        const code = hand && hand.communityCards && hand.communityCards[i];
        if (code) {
          let img = slot.querySelector("img");
          if (!img) {
            img = document.createElement("img");
            img.style.cssText =
              "width:100%;height:100%;object-fit:contain;border-radius:4px;display:block;";
            slot.appendChild(img);
          }
          img.src = cardUrl(code, true);
          slot.classList.add("has-card");
        } else {
          slot.innerHTML = "";
          slot.classList.remove("has-card");
        }
      });

    // Pot
    const potEl = document.getElementById("pot-display");
    if (hand && hand.pot > 0) {
      potEl.textContent = "Pot: $" + hand.pot;
      potEl.hidden = false;
    } else {
      potEl.hidden = true;
    }

    // Dealer button
    const pos = DEALER_POS[state.dealerSeat];
    if (pos) {
      const btn = document.getElementById("dealer-btn");
      btn.style.left = pos.left;
      btn.style.top = pos.top;
    }

    // Action area
    const actionArea = document.getElementById("action-area");
    if (hand && hand.activeSeat === 0) {
      currentToCall =
        hand.currentBet - (hand.seatBets["0"] || hand.seatBets[0] || 0);

      const checkCallBtn = document.getElementById("btn-check-call");
      checkCallBtn.textContent =
        currentToCall > 0 ? "Call $" + currentToCall : "Check";

      const minRaise = hand.currentBet + hand.lastRaiseAmount;
      const maxRaise = Math.min(state.playerChips || 0, 150);
      const slider = document.getElementById("raise-slider");
      slider.min = minRaise;
      slider.max = maxRaise;
      slider.value = minRaise;
      document.getElementById("raise-amount").textContent = "$" + minRaise;
      document.getElementById("btn-raise-open").hidden = minRaise > maxRaise;

      document.getElementById("action-base").hidden = false;
      document.getElementById("action-raise").hidden = true;
      setActionsDisabled(false);
      actionArea.hidden = false;
    } else {
      actionArea.hidden = true;
    }
  }

  // ============================================================
  // Deal hand
  // ============================================================

  async function dealHand() {
    try {
      const result = await apiFetch("/api/poker/deal", "POST");
      renderState(result.state);
      // Action log animation will be added in a later step
      if (result.handResult) showHandResult(result.handResult);
    } catch (err) {
      console.error("deal failed:", err);
    }
  }

  // ============================================================
  // Send player action
  // ============================================================

  async function sendAction(body) {
    setActionsDisabled(true);
    try {
      const result = await apiFetch("/api/poker/action", "POST", body);
      renderState(result.state);
      // Action log animation will be added in a later step
      if (result.handResult) showHandResult(result.handResult);
    } catch (err) {
      console.error("action failed:", err);
      setActionsDisabled(false);
    }
  }

  function setActionsDisabled(disabled) {
    [
      "btn-fold",
      "btn-check-call",
      "btn-raise-open",
      "btn-raise-confirm",
    ].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.disabled = disabled;
    });
  }

  // ============================================================
  // Show hand result
  // ============================================================

  function showHandResult(handResult) {
    const resultEl = document.getElementById("result-text");

    if (handResult.winners && handResult.winners.length > 1) {
      const total = handResult.winners.reduce(function (s, w) {
        return s + w.amount;
      }, 0);
      resultEl.innerHTML = "<strong>Split pot</strong> — $" + total + " shared";
    } else if (handResult.winners && handResult.winners.length === 1) {
      const w = handResult.winners[0];
      let name;
      if (w.seat === 0) {
        name = "You";
      } else if (activeGameState && activeGameState.aiSeats) {
        const ai = activeGameState.aiSeats.find(function (a) {
          return a.seat === w.seat;
        });
        name = ai ? ai.displayName : "Seat " + w.seat;
      } else {
        name = "Seat " + w.seat;
      }
      const handDesc = w.handType ? " with <em>" + w.handType + "</em>" : "";
      resultEl.innerHTML =
        "<strong>" + name + "</strong> wins $" + w.amount + handDesc;
    }

    // Reveal AI cards on showdown
    if (handResult.revealedHands) {
      Object.keys(handResult.revealedHands).forEach(function (seatKey) {
        const cards = handResult.revealedHands[seatKey];
        const el = document.getElementById("seat-" + seatKey);
        if (!el) return;
        const cardsEl = el.querySelector(".seat-cards");
        cardsEl.innerHTML = "";
        cards.forEach(function (code) {
          const img = document.createElement("img");
          img.src = cardUrl(code, false);
          img.className = "card-img";
          cardsEl.appendChild(img);
        });
      });
    }

    // Winning card highlight will be added in a later step

    document.getElementById("result-overlay").hidden = false;

    document
      .getElementById("result-overlay")
      .addEventListener("click", function handler() {
        document
          .getElementById("result-overlay")
          .removeEventListener("click", handler);
        document.getElementById("result-overlay").hidden = true;

        if (handResult.playerEliminated || handResult.gameOver) {
          window.location.replace("/home");
          return;
        }

        // Clear dynamic state for next hand
        document.querySelectorAll(".seat-cards").forEach(function (el) {
          el.innerHTML = "";
        });
        document
          .querySelectorAll("#community-cards .card-slot")
          .forEach(function (slot) {
            slot.innerHTML = "";
            slot.classList.remove("has-card");
          });
        document.querySelectorAll(".seat-bet").forEach(function (el) {
          el.textContent = "";
        });
        document
          .querySelectorAll(".seat-folded, .seat-allin")
          .forEach(function (el) {
            el.classList.remove("seat-folded", "seat-allin");
          });
        document.getElementById("pot-display").hidden = true;

        dealHand();
      });
  }

  // ============================================================
  // Action button event handlers
  // ============================================================

  document.getElementById("btn-fold").addEventListener("click", function () {
    sendAction({ action: "fold" });
  });

  document
    .getElementById("btn-check-call")
    .addEventListener("click", function () {
      if (currentToCall > 0) {
        sendAction({ action: "call", amount: currentToCall });
      } else {
        sendAction({ action: "check" });
      }
    });

  document
    .getElementById("btn-raise-open")
    .addEventListener("click", function () {
      document.getElementById("action-base").hidden = true;
      document.getElementById("action-raise").hidden = false;
    });

  document
    .getElementById("btn-raise-back")
    .addEventListener("click", function () {
      document.getElementById("action-raise").hidden = true;
      document.getElementById("action-base").hidden = false;
    });

  document
    .getElementById("raise-slider")
    .addEventListener("input", function () {
      document.getElementById("raise-amount").textContent = "$" + this.value;
    });

  document
    .getElementById("btn-raise-confirm")
    .addEventListener("click", function () {
      const amount = parseInt(
        document.getElementById("raise-slider").value,
        10,
      );
      sendAction({ action: "raise", amount });
    });

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

    for (let i = 1; i <= 5; i++) {
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

    for (let i = 1; i <= 5; i++) {
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
        await dealHand();
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
    if (activeGameState && activeGameState.currentHand) {
      renderState(adaptRawState(activeGameState, playerData.chips));
    } else {
      dealHand();
    }
  }

  // Adapts the raw gameState document (shape from /api/poker/state) to
  // the buildStateResponse shape that renderState expects
  function adaptRawState(raw, playerChips) {
    const hand = raw.currentHand;
    return {
      dealerSeat: raw.dealerSeat,
      handCount: raw.handCount,
      playerChips: playerChips,
      aiSeats: raw.aiSeats.map(function (a) {
        return {
          seat: a.seat,
          displayName: a.displayName,
          chips: a.chips,
          active: a.active,
        };
      }),
      currentHand: hand
        ? {
            phase: hand.phase,
            communityCards: hand.communityCards || [],
            pot: hand.pot || 0,
            currentBet: hand.currentBet || 0,
            lastRaiseAmount: hand.lastRaiseAmount || 0,
            activeSeat: hand.activeSeat,
            playerCards:
              (hand.holeCards && (hand.holeCards["0"] || hand.holeCards[0])) ||
              [],
            seatBets: hand.seatBets || {},
            foldedSeats: hand.foldedSeats || [],
            allInSeats: hand.allInSeats || [],
          }
        : null,
    };
  }

  // ============================================================
  // Helpers
  // ============================================================

  function hideOverlay() {
    document.getElementById("popup-overlay").hidden = true;
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
