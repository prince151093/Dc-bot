const fs = require("node:fs");
const path = require("node:path");

const dbPath = path.resolve(process.env.DB_PATH || "vehicle-life.json");
const data = { users: {} };

function load() {
  try {
    if (fs.existsSync(dbPath)) {
      const parsed = JSON.parse(fs.readFileSync(dbPath, "utf8"));
      if (parsed && typeof parsed === "object" && parsed.users && typeof parsed.users === "object") {
        data.users = parsed.users;
      }
    }
  } catch (err) {
    console.error("Could not load database file:", err.message);
  }
}

function save() {
  try {
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${dbPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmp, dbPath);
  } catch (err) {
    console.error("Could not save database file:", err.message);
  }
}

load();

function key(userId, guildId) {
  return `${guildId}:${userId}`;
}

function ensureUser(userId, guildId) {
  const k = key(userId, guildId);
  if (!data.users[k]) {
    data.users[k] = {
      user_id: userId,
      guild_id: guildId,
      messages: 0,
      vc_seconds: 0,
      vehicle_index: 0,
      last_vc_join: null,
      updated_at: Math.floor(Date.now() / 1000)
    };
    save();
  }
  return data.users[k];
}

function getUser(userId, guildId) {
  return { ...ensureUser(userId, guildId) };
}

function update(userId, guildId, changes) {
  const user = ensureUser(userId, guildId);
  Object.assign(user, changes, { updated_at: Math.floor(Date.now() / 1000) });
  save();
  return { ...user };
}

function addMessage(userId, guildId, count = 1) {
  const user = ensureUser(userId, guildId);
  user.messages += Math.max(0, Math.floor(count));
  user.updated_at = Math.floor(Date.now() / 1000);
  save();
}

function addVcSeconds(userId, guildId, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const user = ensureUser(userId, guildId);
  user.vc_seconds += Math.floor(seconds);
  user.updated_at = Math.floor(Date.now() / 1000);
  save();
}

function setVcJoin(userId, guildId, timestamp) {
  update(userId, guildId, { last_vc_join: timestamp });
}

function clearVcJoin(userId, guildId) {
  update(userId, guildId, { last_vc_join: null });
}

function setVehicleIndex(userId, guildId, index) {
  update(userId, guildId, { vehicle_index: Math.max(0, Math.floor(index)) });
}

function topUsers(guildId, limit = 10) {
  return Object.values(data.users)
    .filter(user => user.guild_id === guildId)
    .sort((a, b) => b.vehicle_index - a.vehicle_index || b.vc_seconds - a.vc_seconds || b.messages - a.messages)
    .slice(0, Math.max(1, Math.floor(limit)))
    .map(user => ({ ...user }));
}

function close() {
  // Clear active voice timestamps so a restart cannot count downtime as voice time.
  for (const user of Object.values(data.users)) {
    if (user.last_vc_join !== null) user.last_vc_join = null;
  }
  save();
}

module.exports = {
  ensureUser,
  getUser,
  addMessage,
  addVcSeconds,
  setVcJoin,
  clearVcJoin,
  setVehicleIndex,
  topUsers,
  close
};
