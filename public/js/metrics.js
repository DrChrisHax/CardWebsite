let selectedGame = null;
let chartInstance = null;
let winRecords = [];
let lossRecords = [];

const HAND_RANKS = {
  "straight flush": 9,
  "four of a kind": 8,
  "full house": 7,
  "flush": 6,
  "straight": 5,
  "three of a kind": 4,
  "two pairs": 3,
  "one pair": 2,
  "high card": 1,
};

const gridSortState = {
  wins:   { col: "amount", dir: "desc" },
  losses: { col: "amount", dir: "asc" },
};

function authHeader() {
  return { Authorization: "Bearer " + localStorage.getItem("token") };
}

async function api(path) {
  const res = await fetch(path, { headers: authHeader() });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(path, { method: "DELETE", headers: authHeader() });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

async function init() {
  let games;
  try {
    games = await api("/api/metrics/games");
  } catch {
    window.location.href = "/home";
    return;
  }

  if (!games.length) {
    window.location.href = "/home";
    return;
  }

  renderSidebar(games);
  selectGame(games[0]);
}

function renderSidebar(games) {
  const list = document.getElementById("game-list");
  list.innerHTML = "";
  games.forEach((game) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "sidebar-game-btn";
    btn.textContent = game.gameName;
    btn.dataset.gameId = String(game._id);
    btn.addEventListener("click", () => selectGame(game));
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function selectGame(game) {
  selectedGame = game;

  document.querySelectorAll(".sidebar-game-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.gameId === String(game._id));
  });

  document.getElementById("sidebar-footer").hidden = false;

  const sessionSelect = document.getElementById("session-select");
  sessionSelect.innerHTML = '<option value="all">All Sessions</option>';
  game.sessions.forEach((s, i) => {
    const opt = document.createElement("option");
    opt.value = s._id;
    opt.textContent = `Session ${i + 1} - ${s.handCount} hand${s.handCount !== 1 ? "s" : ""}`;
    sessionSelect.appendChild(opt);
  });

  loadChart();
  loadHandRecords();
}

async function loadChart() {
  if (!selectedGame) return;

  const graphType = document.getElementById("graph-type").value;
  const gameStateId = document.getElementById("session-select").value;
  const gameId = selectedGame._id;

  if (graphType === "balance-per-hand") {
    await loadBalancePerHand(gameId, gameStateId);
  } else if (graphType === "net-profit-per-hand") {
    await loadNetProfitPerHand(gameId, gameStateId);
  } else if (graphType === "results-breakdown") {
    await loadResultsBreakdown(gameId, gameStateId);
  }
}

// ── Balance Per Hand ──────────────────────────────────────────

async function loadBalancePerHand(gameId, gameStateId) {
  let data;
  try {
    data = await api(
      `/api/metrics/texas-holdem/balance-per-hand?gameId=${gameId}&gameStateId=${gameStateId}`,
    );
  } catch {
    showEmpty(true);
    return;
  }

  if (!data.hands.length) {
    showEmpty(true);
    return;
  }

  showEmpty(false);
  renderLineChart({
    hands: data.hands,
    sessionBoundaries: data.sessionBoundaries,
    valueKey: "balance",
    color: "#22c55e",
    bgColor: "rgba(34, 197, 94, 0.08)",
    tooltipLabel: (v) => " Balance: $" + v.toLocaleString(),
    yTickFormat: (v) => "$" + v.toLocaleString(),
  });
}

// ── Net Profit Per Hand ───────────────────────────────────────

async function loadNetProfitPerHand(gameId, gameStateId) {
  let data;
  try {
    data = await api(
      `/api/metrics/texas-holdem/net-profit-per-hand?gameId=${gameId}&gameStateId=${gameStateId}`,
    );
  } catch {
    showEmpty(true);
    return;
  }

  if (!data.hands.length) {
    showEmpty(true);
    return;
  }

  showEmpty(false);
  renderLineChart({
    hands: data.hands,
    sessionBoundaries: data.sessionBoundaries,
    valueKey: "netChange",
    color: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.08)",
    tooltipLabel: (v) => {
      const sign = v >= 0 ? "+" : "";
      return ` Net: ${sign}$${v.toLocaleString()}`;
    },
    yTickFormat: (v) => {
      const sign = v >= 0 ? "+" : "";
      return sign + "$" + v.toLocaleString();
    },
    zeroLine: true,
  });
}

// ── Results Breakdown ─────────────────────────────────────────

async function loadResultsBreakdown(gameId, gameStateId) {
  let data;
  try {
    data = await api(
      `/api/metrics/texas-holdem/results-breakdown?gameId=${gameId}&gameStateId=${gameStateId}`,
    );
  } catch {
    showEmpty(true);
    return;
  }

  const total = data.win + data.loss + data.fold + data.split;
  if (!total) {
    showEmpty(true);
    return;
  }

  showEmpty(false);
  renderResultsChart(data);
}

// ── Shared helpers ────────────────────────────────────────────

function showEmpty(empty) {
  document.getElementById("chart-empty").style.display = empty ? "flex" : "none";
  document.getElementById("chart-container").style.display = empty ? "none" : "block";
}

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

// Custom plugin: dashed vertical lines at session boundaries
const sessionBoundaryPlugin = {
  id: "sessionBoundaries",
  afterDraw(chart) {
    const boundaries = chart.options.sessionBoundaries;
    if (!boundaries || !boundaries.length) return;
    const { ctx, chartArea, scales } = chart;
    boundaries.forEach((idx) => {
      const x1 = scales.x.getPixelForValue(idx - 1);
      const x2 = scales.x.getPixelForValue(idx);
      const x = (x1 + x2) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.strokeStyle = "rgba(168, 85, 247, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    });
  },
};

function sharedScales(yTickFormat) {
  return {
    x: {
      grid: { color: "rgba(255, 255, 255, 0.05)" },
      ticks: { color: "#94a3b8", maxTicksLimit: 12, maxRotation: 0 },
    },
    y: {
      grid: { color: "rgba(255, 255, 255, 0.05)" },
      ticks: { color: "#94a3b8", callback: yTickFormat },
    },
  };
}

function sharedTooltip(labelFn) {
  return {
    backgroundColor: "rgba(8, 10, 18, 0.95)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    titleColor: "#94a3b8",
    bodyColor: "#f1f5f9",
    padding: 10,
    callbacks: { label: (item) => labelFn(item.raw) },
  };
}

// ── Chart renderers ───────────────────────────────────────────

function renderLineChart({ hands, sessionBoundaries, valueKey, color, bgColor, tooltipLabel, yTickFormat, zeroLine = false }) {
  destroyChart();

  const datasets = [
    {
      label: valueKey,
      data: hands.map((h) => h[valueKey]),
      borderColor: color,
      backgroundColor: bgColor,
      fill: true,
      tension: 0.2,
      pointRadius: hands.length > 60 ? 0 : 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    },
  ];

  if (zeroLine) {
    datasets.push({
      data: hands.map(() => 0),
      borderColor: "rgba(255, 255, 255, 0.15)",
      borderWidth: 1,
      borderDash: [4, 4],
      pointRadius: 0,
      fill: false,
    });
  }

  chartInstance = new Chart(document.getElementById("metrics-chart"), {
    type: "line",
    plugins: [sessionBoundaryPlugin],
    data: {
      labels: hands.map((h) => `Hand ${h.hand}`),
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      sessionBoundaries,
      scales: sharedScales(yTickFormat),
      plugins: {
        legend: { display: false },
        tooltip: sharedTooltip(tooltipLabel),
      },
      interaction: { mode: "index", intersect: false },
    },
  });
}

function renderResultsChart(counts) {
  destroyChart();

  const labels = ["Win", "Loss", "Fold", "Split"];
  const values = [counts.win, counts.loss, counts.fold, counts.split];
  const colors = {
    border: ["#22c55e", "#ef4444", "#64748b", "#a855f7"],
    bg: [
      "rgba(34, 197, 94, 0.6)",
      "rgba(239, 68, 68, 0.6)",
      "rgba(100, 116, 139, 0.4)",
      "rgba(168, 85, 247, 0.6)",
    ],
  };

  chartInstance = new Chart(document.getElementById("metrics-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#94a3b8" },
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#94a3b8", stepSize: 1 },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: sharedTooltip((v) => ` ${v} hand${v !== 1 ? "s" : ""}`),
      },
    },
  });
}

// ── Hand Record Grids ─────────────────────────────────────────

async function loadHandRecords() {
  if (!selectedGame) return;
  const gameId = selectedGame._id;
  const gameStateId = document.getElementById("session-select").value;
  const base = `/api/metrics/texas-holdem/hand-records?gameId=${gameId}&gameStateId=${gameStateId}`;

  try {
    const [wins, losses] = await Promise.all([
      api(base + "&type=wins"),
      api(base + "&type=losses"),
    ]);
    winRecords = wins;
    lossRecords = losses;
    renderGrid("wins");
    renderGrid("losses");
    document.getElementById("hand-records").removeAttribute("hidden");
  } catch {
    // charts still work even if grids fail
  }
}

function sortRecords(records, col, dir) {
  const m = dir === "asc" ? 1 : -1;
  return [...records].sort((a, b) => {
    if (col === "session") return (a.sessionNumber - b.sessionNumber) * m;
    if (col === "hand")    return (a.handNumber - b.handNumber) * m;
    if (col === "amount")  return (a.netChange - b.netChange) * m;
    if (col === "handType") {
      const ra = HAND_RANKS[a.winningHandType] || 0;
      const rb = HAND_RANKS[b.winningHandType] || 0;
      const diff = (ra - rb) * m;
      return diff !== 0 ? diff : (a.netChange - b.netChange) * m;
    }
    return 0;
  });
}

function renderGrid(gridType) {
  const records = gridType === "wins" ? winRecords : lossRecords;
  const { col, dir } = gridSortState[gridType];
  const sorted = sortRecords(records, col, dir);

  const tbody   = document.getElementById(gridType === "wins" ? "wins-body"  : "losses-body");
  const emptyEl = document.getElementById(gridType === "wins" ? "wins-empty" : "losses-empty");
  const tableEl = document.getElementById(gridType === "wins" ? "wins-table" : "losses-table");

  // Sync header sort indicators
  tableEl.querySelectorAll("th[data-col]").forEach((th) => {
    const arrow = th.querySelector(".sort-arrow");
    if (th.dataset.col === col) {
      th.classList.add("sort-active");
      arrow.textContent = dir === "asc" ? "▲" : "▼";
    } else {
      th.classList.remove("sort-active");
      arrow.textContent = "";
    }
  });

  if (!sorted.length) {
    tbody.innerHTML = "";
    tableEl.hidden = true;
    emptyEl.removeAttribute("hidden");
    return;
  }

  tableEl.hidden = false;
  emptyEl.setAttribute("hidden", "");

  tbody.innerHTML = sorted
    .map((r) => {
      const amountCell =
        gridType === "wins"
          ? `<span class="amount-win">+$${r.netChange.toLocaleString("en-US")}</span>`
          : `<span class="amount-loss">-$${Math.abs(r.netChange).toLocaleString("en-US")}</span>`;
      const handType = r.winningHandType || "No showdown";
      return `<tr>
        <td>${r.sessionNumber}</td>
        <td>${r.handNumber}</td>
        <td>${amountCell}</td>
        <td>${handType}</td>
      </tr>`;
    })
    .join("");
}

function initGridSort() {
  document.querySelectorAll(".record-table th[data-col]").forEach((th) => {
    th.addEventListener("click", () => {
      const grid = th.dataset.grid;
      const col  = th.dataset.col;
      const state = gridSortState[grid];
      if (state.col === col) {
        state.dir = state.dir === "asc" ? "desc" : "asc";
      } else {
        state.col = col;
        // Default direction per column and grid
        if (col === "amount") {
          state.dir = grid === "losses" ? "asc" : "desc";
        } else if (col === "handType") {
          state.dir = "desc";
        } else {
          state.dir = "asc";
        }
      }
      renderGrid(grid);
    });
  });
}

initGridSort();

document.getElementById("session-select").addEventListener("change", () => {
  loadChart();
  loadHandRecords();
});
document.getElementById("graph-type").addEventListener("change", loadChart);

// ── Reset game data ───────────────────────────────────────────

const modalReset = document.getElementById("modal-reset");

document.getElementById("btn-reset-data").addEventListener("click", function () {
  if (!selectedGame) return;
  document.getElementById("reset-game-name").textContent = selectedGame.gameName;
  modalReset.removeAttribute("hidden");
});

document.getElementById("btn-reset-cancel").addEventListener("click", function () {
  modalReset.setAttribute("hidden", "");
});

modalReset.addEventListener("click", function (e) {
  if (e.target === modalReset) modalReset.setAttribute("hidden", "");
});

document.getElementById("btn-reset-confirm").addEventListener("click", async function () {
  if (!selectedGame) return;
  try {
    await apiDelete("/api/metrics/game/" + selectedGame._id + "/history");
  } finally {
    modalReset.setAttribute("hidden", "");
    loadChart();
    loadHandRecords();
  }
});

init();
