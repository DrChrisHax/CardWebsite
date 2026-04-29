// Maps userId string -> GameManager instance (one active game per user)
const registry = new Map();
module.exports = registry;
