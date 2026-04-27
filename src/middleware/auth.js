const jwt = require("jsonwebtoken");
const sessionManager = require("../utils/sessionManager");

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (!sessionManager.isValid(payload.userId, token)) {
    return res.status(401).json({ error: "Session not found or expired" });
  }

  sessionManager.touch(payload.userId);
  req.userId = payload.userId;
  req.token = token;
  next();
}

module.exports = { requireAuth };
