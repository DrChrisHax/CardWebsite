(function () {
  let overlay = null;
  let allGames = [];
  let sortField = "price";
  let sortDir = "asc";

  // ============================================================
  // Overlay init
  // ============================================================

  function init() {
    overlay = document.createElement("div");
    overlay.className = "store-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="store-modal" role="dialog" aria-modal="true" aria-label="Game Store">
        <div class="store-header">
          <h2>Store</h2>
          <button class="store-close" aria-label="Close store">&#x2715;</button>
        </div>
        <div class="store-body"></div>
      </div>
    `;
    overlay.querySelector(".store-close").addEventListener("click", closeStore);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeStore();
    });
    document.body.appendChild(overlay);
  }

  // ============================================================
  // Sorting
  // ============================================================

  function getSortedGames() {
    return allGames.slice().sort(function (a, b) {
      const valA = sortField === "price" ? a.price : a.gameName.toLowerCase();
      const valB = sortField === "price" ? b.price : b.gameName.toLowerCase();
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  function getSortIndicator(field) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  function handleSort(field) {
    if (sortField === field) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortField = field;
      sortDir = "asc";
    }
    renderGames();
  }

  // ============================================================
  // Render
  // ============================================================

  function renderGames() {
    const body = overlay.querySelector(".store-body");
    body.innerHTML = "";

    if (!allGames.length) {
      const p = document.createElement("p");
      p.className = "store-empty";
      p.textContent = "No games left to buy.";
      body.appendChild(p);
      return;
    }

    const table = document.createElement("table");
    table.className = "store-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const thName = document.createElement("th");
    const btnName = document.createElement("button");
    btnName.className = "store-col-header";
    btnName.textContent = "Name" + getSortIndicator("gameName");
    btnName.addEventListener("click", function () {
      handleSort("gameName");
    });
    thName.appendChild(btnName);

    const thPrice = document.createElement("th");
    thPrice.className = "col-price";
    const btnPrice = document.createElement("button");
    btnPrice.className = "store-col-header";
    btnPrice.textContent = "Cost" + getSortIndicator("price");
    btnPrice.addEventListener("click", function () {
      handleSort("price");
    });
    thPrice.appendChild(btnPrice);

    const thAction = document.createElement("th");
    thAction.className = "col-action";

    headerRow.appendChild(thName);
    headerRow.appendChild(thPrice);
    headerRow.appendChild(thAction);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    getSortedGames().forEach(function (game) {
      const tr = document.createElement("tr");
      const priceText =
        game.price === 0 ? "Free" : "$" + game.price.toLocaleString("en-US");

      const tdName = document.createElement("td");
      tdName.className = "store-item-name";
      tdName.textContent = game.gameName;

      const tdPrice = document.createElement("td");
      tdPrice.className = "store-item-price";
      tdPrice.textContent = priceText;

      const tdAction = document.createElement("td");
      tdAction.className = "col-action";
      const btn = document.createElement("button");
      btn.className = "store-item-buy";
      btn.textContent = "Buy";
      btn.addEventListener("click", function () {
        confirmBuy(game);
      });
      tdAction.appendChild(btn);

      tr.appendChild(tdName);
      tr.appendChild(tdPrice);
      tr.appendChild(tdAction);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    body.appendChild(table);
  }

  // ============================================================
  // Confirm / alert popups
  // ============================================================

  function showConfirm(title, message, onConfirm) {
    const el = document.createElement("div");
    el.className = "confirm-overlay";
    el.innerHTML = `
      <div class="confirm-modal">
        <h3 class="confirm-title">${title}</h3>
        <p class="confirm-message">${message}</p>
        <div class="confirm-buttons">
          <button class="confirm-cancel">Cancel</button>
          <button class="confirm-ok">Buy</button>
        </div>
      </div>
    `;
    el.querySelector(".confirm-cancel").addEventListener("click", function () {
      el.remove();
    });
    el.querySelector(".confirm-ok").addEventListener("click", function () {
      el.remove();
      onConfirm();
    });
    document.body.appendChild(el);
  }

  function showAlert(title, message) {
    const el = document.createElement("div");
    el.className = "confirm-overlay";
    el.innerHTML = `
      <div class="confirm-modal">
        <h3 class="confirm-title">${title}</h3>
        <p class="confirm-message">${message}</p>
        <div class="confirm-buttons">
          <button class="confirm-ok">OK</button>
        </div>
      </div>
    `;
    el.querySelector(".confirm-ok").addEventListener("click", function () {
      el.remove();
    });
    document.body.appendChild(el);
  }

  // ============================================================
  // Buy flow
  // ============================================================

  function confirmBuy(game) {
    const priceText =
      game.price === 0 ? "Free" : "$" + game.price.toLocaleString("en-US");
    showConfirm(
      "Confirm Purchase",
      "Buy <strong>" +
        game.gameName +
        "</strong> for <strong>" +
        priceText +
        "</strong>?",
      function () {
        executeBuy(game);
      },
    );
  }

  async function executeBuy(game) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/store/buy/" + game._id, {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400) {
          showAlert(
            "Insufficient Funds",
            "You don't have enough balance to buy <strong>" +
              game.gameName +
              "</strong>.",
          );
        }
        return;
      }
      window.dispatchEvent(
        new CustomEvent("balancechange", { detail: { balance: data.balance } }),
      );
      window.dispatchEvent(
        new CustomEvent("gamepurchased", { detail: { game: game } }),
      );
      allGames = allGames.filter(function (g) {
        return g._id !== game._id;
      });
      renderGames();
    } catch {
      showAlert("Error", "Something went wrong. Please try again.");
    }
  }

  // ============================================================
  // Open / close
  // ============================================================

  async function openStore() {
    if (!overlay) init();
    allGames = [];
    sortField = "price";
    sortDir = "asc";
    const body = overlay.querySelector(".store-body");
    body.innerHTML = '<p class="store-empty">Loading…</p>';
    overlay.hidden = false;
    document.body.style.overflow = "hidden";

    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/store", {
        headers: { Authorization: "Bearer " + token },
      });
      allGames = res.ok ? await res.json() : [];
    } catch {
      allGames = [];
    }
    renderGames();
  }

  function closeStore() {
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = "";
  }

  window.openStore = openStore;
})();
