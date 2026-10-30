import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import config from './config.js';

/**
 * 文件持久化存储（单实例 Demo）。
 * 数据保存在 data/db.json，写入采用「临时文件 + rename」原子替换，避免写坏。
 * 说明：这是面向演示的轻量存储；生产环境应替换为 Postgres / SQLite 等数据库。
 */

const file = path.join(config.dataDir, 'db.json');

let data = { users: [], sessions: [], records: {} };
let loaded = false;
let writeQueue = Promise.resolve();

function ensureLoaded() {
  if (loaded) return;
  fs.mkdirSync(config.dataDir, { recursive: true });
  try {
    const raw = fs.readFileSync(file, 'utf8');
    data = { users: [], sessions: [], records: {}, ...JSON.parse(raw) };
  } catch {
    // 首次运行或文件损坏时从空开始
  }
  loaded = true;
}

function persist() {
  const snapshot = JSON.stringify(data);
  writeQueue = writeQueue
    .then(() =>
      fs.promises
        .writeFile(file + '.tmp', snapshot)
        .then(() => fs.promises.rename(file + '.tmp', file)),
    )
    .catch((e) => console.error('[store] 写入失败', e));
  return writeQueue;
}

export function genId() {
  return crypto.randomBytes(12).toString('hex');
}

export function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ---- users ----

export function findUserByEmail(email) {
  ensureLoaded();
  return data.users.find((u) => u.email === email);
}

export function findUserById(id) {
  ensureLoaded();
  return data.users.find((u) => u.id === id);
}

export function addUser(user) {
  ensureLoaded();
  data.users.push(user);
  return persist();
}

export function updateUser(id, patch) {
  ensureLoaded();
  const u = findUserById(id);
  if (u) Object.assign(u, patch);
  return persist();
}

// ---- sessions ----

export function findSession(token) {
  ensureLoaded();
  return data.sessions.find((s) => s.token === token);
}

export function addSession(session) {
  ensureLoaded();
  data.sessions.push(session);
  return persist();
}

export function removeSession(token) {
  ensureLoaded();
  data.sessions = data.sessions.filter((s) => s.token !== token);
  return persist();
}

// ---- records（按 userId 存储训练/饮食/身体测量/手动补充） ----

const EMPTY_RECORDS = { workouts: [], foods: [], measurements: [], manualBurns: [] };

export function getRecords(userId) {
  ensureLoaded();
  const r = data.records[userId];
  return r && typeof r === 'object'
    ? { ...EMPTY_RECORDS, ...r }
    : { ...EMPTY_RECORDS };
}

export function putRecords(userId, records) {
  ensureLoaded();
  data.records[userId] = records;
  return persist();
}

export function deleteRecords(userId) {
  ensureLoaded();
  delete data.records[userId];
  return persist();
}
