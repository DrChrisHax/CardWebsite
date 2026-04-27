const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SALT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function checkUsername(req, res) {
  const value = (req.query.value || '').trim();
  if (!value) return res.status(400).json({ error: 'Value required' });
  try {
    const taken = await User.usernameExists(value);
    return res.json({ available: !taken });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
}

async function checkEmail(req, res) {
  const value = (req.query.value || '').trim();
  if (!value) return res.status(400).json({ error: 'Value required' });
  try {
    const taken = await User.emailExists(value);
    return res.json({ available: !taken });
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
}

async function register(req, res) {
  const { username, email, password, confirmPassword } = req.body;

  if (!username || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (username.trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
    });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ token });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ error: `That ${field} is already taken` });
    }
    return res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { checkUsername, checkEmail, register };
