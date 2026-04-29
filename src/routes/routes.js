const express = require("express");
const path = require("path");
const router = express.Router();

const {
  checkUsername,
  checkEmail,
  register,
  login,
  logout,
  getMe,
} = require("../controllers/authController");
const {
  getStore,
  buyGame,
  getMyGames,
} = require("../controllers/storeController");
const {
  getSettings,
  updateSetting,
} = require("../controllers/settingsController");
const {
  getAIPlayers,
  getState,
  newGame,
} = require("../controllers/games/texasHoldemController");
const {
  deactivateAccount,
  deleteAccount,
  reactivateAccount,
} = require("../controllers/profileController");
const { requireAuth } = require("../middleware/auth");

const page = (filePath) => path.join(__dirname, "../../public/pages", filePath);

// ============================================================
// Pages
// ============================================================

router.get("/", (req, res) => res.redirect("/home"));

router.get("/login", (req, res) => res.sendFile(page("auth/login.html")));
router.get("/register", (req, res) => res.sendFile(page("auth/register.html")));
router.get("/forgot-password", (req, res) =>
  res.sendFile(page("auth/forgot-password.html")),
);
router.get("/forgot-password-sent", (req, res) =>
  res.sendFile(page("auth/forgot-password-sent.html")),
);
router.get("/reset-password", (req, res) =>
  res.sendFile(page("auth/reset-password.html")),
);

router.get("/home", (req, res) => res.sendFile(page("home.html")));
router.get("/profile", (req, res) => res.sendFile(page("profile.html")));
router.get("/games/texas_holdem", (req, res) =>
  res.sendFile(page("games/texas_holdem.html")),
);

// ============================================================
// Auth
// ============================================================

router.get("/api/auth/check/username", checkUsername);
router.get("/api/auth/check/email", checkEmail);
router.post("/api/auth/register", register);
router.post("/api/auth/login", login);
router.post("/api/auth/logout", requireAuth, logout);
router.get("/api/auth/me", requireAuth, getMe);

// ============================================================
// Store
// ============================================================

router.get("/api/store", requireAuth, getStore);
router.post("/api/store/buy/:gameId", requireAuth, buyGame);
router.get("/api/user/mygames", requireAuth, getMyGames);

// ============================================================
// Settings
// ============================================================

router.get("/api/user/settings", requireAuth, getSettings);
router.patch("/api/user/settings/:name", requireAuth, updateSetting);

// ============================================================
// Profile
// ============================================================

router.patch("/api/user/deactivate", requireAuth, deactivateAccount);
router.delete("/api/user/delete", requireAuth, deleteAccount);
router.post("/api/user/reactivate", reactivateAccount);

// ============================================================
// Texas Hold'em
// ============================================================

router.get("/api/ai-players", requireAuth, getAIPlayers);
router.get("/api/poker/state", requireAuth, getState);
router.post("/api/poker/new-game", requireAuth, newGame);

router.use((req, res) => {
  if (req.path.startsWith("/api/"))
    return res.status(404).json({ error: "Not found" });
  res.redirect("/home");
});

module.exports = router;
