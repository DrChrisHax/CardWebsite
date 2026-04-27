const express = require('express');
const path = require('path');
const router = express.Router();

const { checkUsername, checkEmail, register, login } = require('../controllers/authController');

const page = (filePath) => path.join(__dirname, '../../public/pages', filePath);

// ============================================================
// Pages
// ============================================================

router.get('/', (req, res) => res.redirect('/login'));

router.get('/login', (req, res) => res.sendFile(page('auth/login.html')));
router.get('/register', (req, res) => res.sendFile(page('auth/register.html')));
router.get('/forgot-password', (req, res) => res.sendFile(page('auth/forgot-password.html')));
router.get('/forgot-password-sent', (req, res) => res.sendFile(page('auth/forgot-password-sent.html')));
router.get('/reset-password', (req, res) => res.sendFile(page('auth/reset-password.html')));

router.get('/home', (req, res) => res.sendFile(page('home.html')));

// ============================================================
// Auth
// ============================================================

router.get('/api/auth/check/username', checkUsername);
router.get('/api/auth/check/email', checkEmail);
router.post('/api/auth/register', register);
router.post('/api/auth/login', login);

module.exports = router;
