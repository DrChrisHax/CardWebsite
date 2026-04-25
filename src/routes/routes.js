const express = require('express');
const path = require('path');
const router = express.Router();

const page = (filePath) => path.join(__dirname, '../../public/pages', filePath);

router.get('/', (req, res) => res.redirect('/login'));

router.get('/login', (req, res) => res.sendFile(page('auth/login.html')));
router.get('/register', (req, res) => res.sendFile(page('auth/register.html')));
router.get('/forgot-password', (req, res) => res.sendFile(page('auth/forgot-password.html')));
router.get('/forgot-password-sent', (req, res) => res.sendFile(page('auth/forgot-password-sent.html')));
router.get('/reset-password', (req, res) => res.sendFile(page('auth/reset-password.html')));

router.get('/home', (req, res) => res.sendFile(page('home.html')));

module.exports = router;
