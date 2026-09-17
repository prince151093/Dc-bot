const { MongoClient } = require("mongodb");
const config = require("./config");

if (!config.mongoUri) {
  console.error("Missing MONGODB_URI environment variable.");
  process.exit(1);
}

const client = new MongoClient(config.mongoUri);
let collection;
const data = { users: {} };
let saveQueue = Promise.resolve();

function key(userId, guildId) {
  return `${guildId}:${userId}`;
}

function userDoc(user) {
  return {
    _id: key(user.user_id, user.guild_id),
    user_id: user.user_id,
    guild_id: user.guild_id,
    messages: user.messages,
    vc_seconds: user.vc_seconds,
    vehicle_index: user.vehicle_index,
    last_vc_join: user.last_vc_join,
    updated_at: user.updated_at
  };
}

function queueSave(user) {
  const snapshot = { ...user };
  saveQueue = saveQueue
    .then(() => collection.replaceOne({ _id: key(snapshot.user_id, snapshot.guild_id) }, userDoc(snapshot), { upsert: true }))
    .catch(err => console.error("Could not save MongoDB user:", err.message));
  return saveQueue;
}

async function init() {
  await client.connect();
  const db = client.db(config.mongoDb);
  collection = db.collection("users");
  await collection.createIndex({ guild_id: 1, vehicle_index: -1, vc_seconds: -1, messages: -1 });

  const rows = await collection.find({}).toArray();
  for (const row of rows) {
    const { _id, ...user } = row;
    data.users[_id] = user;
  }

  console.log(`MongoDB connected. Database: ${config.mongoDb}, users loaded: ${rows.length}`);
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
    queueSave(data.users[k]);
  }
  return data.users[k];
}

function getUser(userId, guildId) {
  return { ...ensureUser(userId, guildId) };
}

function update(userId, guildId, changes) {
  const user = ensureUser(userId, guildId);
  Object.assign(user, changes, { updated_at: Math.floor(Date.now() / 1000) });
  queueSave(user);
  return { ...user };
}

function addMessage(userId, guildId, count = 1) {
  const user = ensureUser(userId, guildId);
  user.messages += Math.max(0, Math.floor(count));
  user.updated_at = Math.floor(Date.now() / 1000);
  queueSave(user);
}

function addVcSeconds(userId, guildId, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const user = ensureUser(userId, guildId);
  user.vc_seconds += Math.floor(seconds);
  user.updated_at = Math.floor(Date.now() / 1000);
  queueSave(user);
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

async function close() {
  for (const user of Object.values(data.users)) {
    if (user.last_vc_join !== null) {
      user.last_vc_join = null;
      user.updated_at = Math.floor(Date.now() / 1000);
      queueSave(user);
    }
  }

  await saveQueue;
  await client.close();
}

module.exports = {
  init,
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
