let selectedGame = null;
let chartInstance = null;

function authHeader() {
  return { Authorization: "Bearer " + localStorage.getItem("token") };
}

async function api(path) {
  const res = await fetch(path, { headers: authHeader() });
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

  const sessionSelect = document.getElementById("session-select");
  sessionSelect.innerHTML = '<option value="all">All Sessions</option>';
  game.sessions.forEach((s, i) => {
    const opt = document.createElement("option");
    opt.value = s._id;
    opt.textContent = `Session ${i + 1} - ${s.handCount} hand${s.handCount !== 1 ? "s" : ""}`;
    sessionSelect.appendChild(opt);
  });

  loadChart();
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

document.getElementById("session-select").addEventListener("change", loadChart);
document.getElementById("graph-type").addEventListener("change", loadChart);

init();
