const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity

const sessions = new Map(); // userId (string) -> { token, lastActive }

function create(userId, token) {
  sessions.set(String(userId), { token, lastActive: Date.now() });
}

function remove(userId) {
  sessions.delete(String(userId));
}

function get(userId) {
  return sessions.get(String(userId)) || null;
}

function touch(userId) {
  const session = sessions.get(String(userId));
  if (session) session.lastActive = Date.now();
}

function isValid(userId, token) {
  const session = sessions.get(String(userId));
  if (!session || session.token !== token) return false;
  if (Date.now() - session.lastActive > SESSION_TIMEOUT_MS) {
    sessions.delete(String(userId));
    return false;
  }
  return true;
}

// Prune inactive sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of sessions) {
    if (now - session.lastActive > SESSION_TIMEOUT_MS) sessions.delete(userId);
  }
}, 5 * 60 * 1000);

module.exports = { create, remove, get, touch, isValid };
