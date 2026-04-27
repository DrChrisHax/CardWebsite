const express = require('express');
const path = require('path');
const router = express.Router();

const { checkUsername, checkEmail, register, login, logout, getMe } = require('../controllers/authController');
const { getStore, buyGame, getMyGames } = require('../controllers/storeController');
const { requireAuth } = require('../middleware/auth');

const page = (filePath) => path.join(__dirname, '../../public/pages', filePath);

// ============================================================
// Pages
// ============================================================

router.get('/', (req, res) => res.redirect('/home'));

router.get('/login', (req, res) => res.sendFile(page('auth/login.html')));
router.get('/register', (req, res) => res.sendFile(page('auth/register.html')));
router.get('/forgot-password', (req, res) => res.sendFile(page('auth/forgot-password.html')));
router.get('/forgot-password-sent', (req, res) => res.sendFile(page('auth/forgot-password-sent.html')));
router.get('/reset-password', (req, res) => res.sendFile(page('auth/reset-password.html')));

router.get('/home', (req, res) => res.sendFile(page('home.html')));
router.get('/profile', (req, res) => res.sendFile(page('profile.html')));

// ============================================================
// Auth
// ============================================================

router.get('/api/auth/check/username', checkUsername);
router.get('/api/auth/check/email', checkEmail);
router.post('/api/auth/register', register);
router.post('/api/auth/login', login);
router.post('/api/auth/logout', requireAuth, logout);
router.get('/api/auth/me', requireAuth, getMe);

// ============================================================
// Store
// ============================================================

router.get('/api/store', requireAuth, getStore);
router.post('/api/store/buy/:gameId', requireAuth, buyGame);
router.get('/api/user/mygames', requireAuth, getMyGames);

router.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.redirect('/home');
});

module.exports = router;
