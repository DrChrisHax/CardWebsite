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
    return "/res/cards/" + encodeURIComponent(set) + "/" + code + ".png";
  }

  function cardBackUrl() {
    // CardBackBlue only exists in Large and Medium sets, not Small
    return (
      "/res/cards/" + encodeURIComponent(CARD_SET_LARGE) + "/CardBackBlue.png"
    );
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
  // Animation helpers
  // ============================================================

  // Deliberate UX pause (e.g. between last bot action and card reveal).
  function pause(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  // Wait for a CSS animation to end on an element.
  // Safety cap so a missed animationend never hangs the game.
  function waitForAnimation(el, capMs) {
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (!done) {
          done = true;
          resolve();
        }
      }
      el.addEventListener("animationend", finish, { once: true });
      setTimeout(finish, capMs || 800);
    });
  }

  // Wait for a CSS transition to end on an element.
  function waitForTransition(el, capMs) {
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (!done) {
          done = true;
          resolve();
        }
      }
      el.addEventListener("transitionend", finish, { once: true });
      setTimeout(finish, capMs || 800);
    });
  }

  // Flash a bet badge text at a seat, awaiting the entry animation.
  async function showBetBadge(seat, text) {
    const betEl = document.querySelector("#seat-" + seat + " .seat-bet");
    if (!betEl) return;
    betEl.textContent = text;
    betEl.classList.remove("flash");
    void betEl.offsetWidth; // force reflow to restart animation
    betEl.classList.add("flash");
    await waitForAnimation(betEl, 400);
    betEl.classList.remove("flash");
  }

  // Append a card back to a seat's card area and wait for its deal animation.
  async function dealCardBack(seat) {
    const el = document.getElementById("seat-" + seat);
    if (!el || el.hidden) return;
    const cardsEl = el.querySelector(".seat-cards");
    const img = document.createElement("img");
    img.src = cardBackUrl();
    img.className = "card-img dealing";
    cardsEl.appendChild(img);
    await waitForAnimation(img, 400);
    img.classList.remove("dealing");
  }

  // Reveal one community card slot and wait for its deal animation.
  async function revealCommunityCard(slot, code) {
    let img = slot.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      img.style.cssText =
        "width:100%;height:100%;object-fit:contain;border-radius:4px;display:block;";
      slot.appendChild(img);
    }
    img.src = cardUrl(code, true);
    img.classList.add("dealing");
    slot.classList.add("has-card");
    await waitForAnimation(img, 400);
    img.classList.remove("dealing");
  }

  // Fade a seat to folded opacity, then clear its cards.
  async function animateFold(seatNum) {
    const el = document.getElementById("seat-" + seatNum);
    if (!el) return;
    el.classList.add("seat-folded");
    await waitForTransition(el, 500);
    el.querySelector(".seat-cards").innerHTML = "";
  }

  // Deal card backs to all active seats (two rounds), then flip player cards face-up.
  async function animateDeal(state) {
    const hand = state.currentHand;
    if (!hand) return;

    const activeSeats = hand.activeSeats;
    const dealerIdx = activeSeats.indexOf(state.dealerSeat);
    const dealOrder = [];
    for (let i = 1; i <= activeSeats.length; i++) {
      dealOrder.push(activeSeats[(dealerIdx + i) % activeSeats.length]);
    }

    // Two cards dealt one at a time around the table — each waits for its animation
    for (let round = 0; round < 2; round++) {
      for (const seat of dealOrder) {
        await dealCardBack(seat);
      }
    }

    // Replace player's card backs with face-up cards
    const playerCardsEl = document.querySelector("#seat-0 .seat-cards");
    if (playerCardsEl && hand.playerCards && hand.playerCards.length) {
      playerCardsEl.innerHTML = "";
      const flips = hand.playerCards.map(function (code) {
        const img = document.createElement("img");
        img.src = cardUrl(code, false);
        img.className = "card-img dealing";
        playerCardsEl.appendChild(img);
        return waitForAnimation(img, 400).then(function () {
          img.classList.remove("dealing");
        });
      });
      await Promise.all(flips);
    }
  }

  // Step through action log entries sequentially, driving each step by animation completion.
  // commCardsStart = how many community cards were already visible before this log.
  async function animateActionLog(log, commCardsStart) {
    let commCardsRevealed = commCardsStart || 0;

    // Seed running totals from the last known state so chip/pot updates are accurate
    const hand = activeGameState && activeGameState.currentHand;
    let runningCurrentBet = hand ? hand.currentBet || 0 : 0;
    let runningPot = hand ? hand.pot || 0 : 0;

    const runningChips = {};
    const runningSeatBets = {};
    if (activeGameState) {
      (activeGameState.aiSeats || []).forEach(function (ai) {
        runningChips[ai.seat] = ai.chips || 0;
        runningSeatBets[String(ai.seat)] = hand
          ? hand.seatBets[String(ai.seat)] || 0
          : 0;
      });
      runningChips[0] = playerData.chips || 0;
      runningSeatBets["0"] = hand
        ? hand.seatBets["0"] || hand.seatBets[0] || 0
        : 0;
    }

    function updateSeatChips(seat) {
      const el = document.getElementById("seat-" + seat);
      if (!el) return;
      const chips = runningChips[seat];
      if (chips !== undefined)
        el.querySelector(".seat-chips").textContent =
          "$" + chips.toLocaleString("en-US");
    }

    function updatePot() {
      const potEl = document.getElementById("pot-display");
      if (runningPot > 0) {
        potEl.textContent = "Pot: $" + runningPot;
        potEl.hidden = false;
      }
    }

    for (const entry of log) {
      if (entry.type === "blind") {
        const chipsMoved = entry.amount || 0;
        runningPot += chipsMoved;
        runningChips[entry.seat] = (runningChips[entry.seat] || 0) - chipsMoved;
        runningSeatBets[String(entry.seat)] =
          (runningSeatBets[String(entry.seat)] || 0) + chipsMoved;
        runningCurrentBet = Math.max(
          runningCurrentBet,
          runningSeatBets[String(entry.seat)],
        );
        const label =
          entry.action === "smallBlind"
            ? "SB $" + entry.amount
            : "BB $" + entry.amount;
        await showBetBadge(entry.seat, label);
        updateSeatChips(entry.seat);
        updatePot();
      } else if (entry.type === "action") {
        const el = document.getElementById("seat-" + entry.seat);
        if (!el) continue;

        const seat = entry.seat;
        const seatKey = String(seat);
        const prevBet = runningSeatBets[seatKey] || 0;
        const chips = runningChips[seat] || 0;

        if (entry.action === "fold") {
          await Promise.all([showBetBadge(seat, "Fold"), animateFold(seat)]);
        } else if (entry.action === "check") {
          await showBetBadge(seat, "Check");
        } else if (entry.action === "call") {
          const toCall = Math.max(0, runningCurrentBet - prevBet);
          const chipsMoved = Math.min(toCall, chips);
          runningPot += chipsMoved;
          runningChips[seat] -= chipsMoved;
          runningSeatBets[seatKey] = prevBet + chipsMoved;
          await showBetBadge(seat, "Call $" + chipsMoved);
          updateSeatChips(seat);
          updatePot();
        } else if (entry.action === "raise") {
          const newBetLevel = runningCurrentBet + (entry.amount || 0);
          const additional = newBetLevel - prevBet;
          const chipsMoved = Math.min(additional, chips);
          runningPot += chipsMoved;
          runningChips[seat] -= chipsMoved;
          runningSeatBets[seatKey] = prevBet + chipsMoved;
          runningCurrentBet = newBetLevel;
          await showBetBadge(seat, "Raise to $" + newBetLevel);
          updateSeatChips(seat);
          updatePot();
        } else if (entry.action === "all_in") {
          const chipsMoved = chips;
          runningPot += chipsMoved;
          runningChips[seat] = 0;
          runningSeatBets[seatKey] = prevBet + chipsMoved;
          if (runningSeatBets[seatKey] > runningCurrentBet)
            runningCurrentBet = runningSeatBets[seatKey];
          el.classList.add("seat-allin");
          await showBetBadge(seat, "All In");
          updateSeatChips(seat);
          updatePot();
        }
      } else if (entry.type === "deal") {
        runningCurrentBet = 0;
        Object.keys(runningSeatBets).forEach(function (k) {
          runningSeatBets[k] = 0;
        });
        document.querySelectorAll(".seat-bet").forEach(function (el) {
          el.textContent = "";
        });
        await pause(500);
        const slots = document.querySelectorAll("#community-cards .card-slot");
        for (let i = 0; i < entry.cards.length; i++) {
          const slot = slots[commCardsRevealed];
          if (!slot) continue;
          await revealCommunityCard(slot, entry.cards[i]);
          commCardsRevealed++;
        }
      }
    }
  }

  // ============================================================
  // Table visual reset (called before dealing a new hand)
  // ============================================================

  function clearTableVisuals() {
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
    document.querySelectorAll(".seat").forEach(function (el) {
      el.classList.remove("seat-folded", "seat-allin");
    });
    document.getElementById("pot-display").hidden = true;
    document.getElementById("action-area").hidden = true;
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
      el.hidden = ai.chips === 0;
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

      const inCurrentHand = hand && (hand.activeSeats || []).includes(ai.seat);
      el.hidden = ai.chips === 0 && !inCurrentHand;
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
      // Only overwrite badge when there's a real chip amount, animated labels
      // (Check, Fold, etc.) persist until the next street clears them.
      if (bet > 0) el.querySelector(".seat-bet").textContent = "$" + bet;

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

      // Slider represents raise-by amount (increment above the call).
      // Server receives this increment directly.
      const minRaiseBy = state.minHandBet || 2;
      const maxRaiseBy = Math.min(
        state.maxHandBet || 150,
        Math.max(0, (state.playerChips || 0) - currentToCall),
      );
      const slider = document.getElementById("raise-slider");
      slider.min = minRaiseBy;
      slider.max = Math.max(minRaiseBy, maxRaiseBy);
      slider.value = minRaiseBy;
      document.getElementById("raise-amount").textContent = "$" + minRaiseBy;
      document.getElementById("btn-raise-open").hidden =
        minRaiseBy >= maxRaiseBy;

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
      const result = await apiFetch("/api/poker/deal", "POST", { gameId });

      clearTableVisuals();

      // Position dealer button immediately (no animation needed per spec)
      const pos = DEALER_POS[result.state.dealerSeat];
      if (pos) {
        const btn = document.getElementById("dealer-btn");
        btn.style.left = pos.left;
        btn.style.top = pos.top;
      }

      await animateDeal(result.state);
      await animateActionLog(result.actionLog, 0);

      if (result.handResult) {
        // Hand ended without a player turn (extremely rare) — store state and show result
        activeGameState = result.state;
        playerData.chips = result.state.playerChips;
        showHandResult(result.handResult);
      } else {
        renderState(result.state);
      }
    } catch (err) {
      console.error("deal failed:", err);
    }
  }

  // ============================================================
  // Send player action
  // ============================================================

  async function sendAction(body) {
    document.getElementById("action-area").hidden = true;
    setActionsDisabled(true);

    // Remember how many community cards were showing before this action
    const commCardsBefore =
      activeGameState &&
      activeGameState.currentHand &&
      activeGameState.currentHand.communityCards
        ? activeGameState.currentHand.communityCards.length
        : 0;

    try {
      const result = await apiFetch(
        "/api/poker/action",
        "POST",
        Object.assign({ gameId }, body),
      );

      // Animate everything that happened: AI moves, community card reveals, etc.
      // This also plays out the rest of the hand if the player folded.
      await animateActionLog(result.actionLog, commCardsBefore);

      if (result.handResult) {
        // Hand is over — store updated state for showHandResult to reference
        activeGameState = result.state;
        playerData.chips = result.state.playerChips;
        showHandResult(result.handResult);
      } else {
        renderState(result.state);
      }
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

  async function showHandResult(handResult) {
    const resultEl = document.getElementById("result-text");

    // Build winner text
    function seatName(seat) {
      if (seat === 0) return "You";
      if (activeGameState && activeGameState.aiSeats) {
        const ai = activeGameState.aiSeats.find(function (a) {
          return a.seat === seat;
        });
        if (ai) return ai.displayName;
      }
      return "Seat " + seat;
    }

    if (handResult.winners && handResult.winners.length > 0) {
      const lines = handResult.winners.map(function (w) {
        const name = "<strong>" + seatName(w.seat) + "</strong>";
        const verb = w.seat === 0 ? "win" : "wins";
        const handDesc = w.handName ? " with <em>" + w.handName + "</em>" : "";
        return name + " " + verb + " $" + w.amount + handDesc;
      });
      resultEl.innerHTML = lines.join("<br>");
    }

    // Reveal AI cards on showdown (revealedHands = { seatKey: { cards, handName } })
    const isShowdown =
      handResult.revealedHands &&
      Object.keys(handResult.revealedHands).length > 0;

    if (isShowdown) {
      Object.keys(handResult.revealedHands).forEach(function (seatKey) {
        const entry = handResult.revealedHands[seatKey];
        const cards = entry && entry.cards ? entry.cards : entry;
        const el = document.getElementById("seat-" + seatKey);
        if (!el || !cards) return;
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

    // Show result overlay — CSS drives its fade-in; wait for that to complete
    const overlay = document.getElementById("result-overlay");
    overlay.hidden = false;
    await waitForAnimation(overlay, 600);

    overlay.addEventListener("click", function handler() {
      overlay.removeEventListener("click", handler);
      overlay.hidden = true;

      if (handResult.playerEliminated || handResult.gameOver) {
        window.location.replace("/home");
        return;
      }

      // Update chip counts immediately so the player sees their new balance
      // before the next deal animation starts.
      if (activeGameState) {
        document.querySelector("#seat-0 .seat-chips").textContent =
          "$" + (activeGameState.playerChips || 0).toLocaleString("en-US");
        (activeGameState.aiSeats || []).forEach(function (ai) {
          const el = document.getElementById("seat-" + ai.seat);
          if (!el) return;
          el.hidden = ai.chips === 0;
          el.querySelector(".seat-chips").textContent =
            "$" + ai.chips.toLocaleString("en-US");
        });
      }

      clearTableVisuals();
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
      const raiseBy = parseInt(
        document.getElementById("raise-slider").value,
        10,
      );
      sendAction({ action: "raise", amount: raiseBy });
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
            activeSeats: hand.activeSeats || [],
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
