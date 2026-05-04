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
    opt.textContent = `Session ${i + 1} — ${s.handCount} hand${s.handCount !== 1 ? "s" : ""}`;
    sessionSelect.appendChild(opt);
  });

  loadChart();
}

async function loadChart() {
  if (!selectedGame) return;

  const graphType = document.getElementById("graph-type").value;
  const gameStateId = document.getElementById("session-select").value;

  if (graphType === "balance-per-hand") {
    await loadBalancePerHand(selectedGame._id, gameStateId);
  }
}

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
  renderBalanceChart(data.hands, data.sessionBoundaries);
}

function showEmpty(empty) {
  document.getElementById("chart-empty").hidden = !empty;
  document.getElementById("chart-container").hidden = empty;
}

// Custom plugin that draws dashed vertical lines at session boundaries
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

function renderBalanceChart(hands, sessionBoundaries) {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const canvas = document.getElementById("metrics-chart");

  chartInstance = new Chart(canvas, {
    type: "line",
    plugins: [sessionBoundaryPlugin],
    data: {
      labels: hands.map((h) => `Hand ${h.hand}`),
      datasets: [
        {
          label: "Balance",
          data: hands.map((h) => h.balance),
          borderColor: "#22c55e",
          backgroundColor: "rgba(34, 197, 94, 0.08)",
          fill: true,
          tension: 0.2,
          pointRadius: hands.length > 60 ? 0 : 3,
          pointHoverRadius: 5,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      sessionBoundaries,
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: {
            color: "#94a3b8",
            maxTicksLimit: 12,
            maxRotation: 0,
          },
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: {
            color: "#94a3b8",
            callback: (v) => "$" + v.toLocaleString(),
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(8, 10, 18, 0.95)",
          borderColor: "rgba(255, 255, 255, 0.1)",
          borderWidth: 1,
          titleColor: "#94a3b8",
          bodyColor: "#f1f5f9",
          padding: 10,
          callbacks: {
            label: (item) => " Balance: $" + item.raw.toLocaleString(),
          },
        },
      },
      interaction: { mode: "index", intersect: false },
    },
  });
}

document
  .getElementById("session-select")
  .addEventListener("change", loadChart);
document.getElementById("graph-type").addEventListener("change", loadChart);

init();
