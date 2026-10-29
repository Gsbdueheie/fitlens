import bcrypt from 'bcryptjs';
import {
  addUser,
  findUserByEmail,
  findUserById,
  addSession,
  findSession,
  removeSession,
  genId,
  genToken,
} from './store.js';
import config from './config.js';

export async function register({ email, password, nickname }) {
  const existing = findUserByEmail(email);
  if (existing) return { error: '该邮箱已注册' };

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: genId(),
    email,
    passwordHash,
    nickname: (nickname || '').trim() || email.split('@')[0],
    createdAt: new Date().toISOString(),
  };
  await addUser(user);

  const token = await createSession(user.id);
  return { token, user: publicUser(user) };
}

export async function login({ email, password }) {
  const user = findUserByEmail(email);
  // 统一提示，不泄露账号是否存在
  if (!user) return { error: '邮箱或密码错误' };
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { error: '邮箱或密码错误' };

  const token = await createSession(user.id);
  return { token, user: publicUser(user) };
}

export async function logout(token) {
  if (token) await removeSession(token);
  return { ok: true };
}

async function createSession(userId) {
  const token = genToken();
  await addSession({
    token,
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + config.sessionTtlMs,
  });
  return token;
}

/** 从请求中取 session（成功返回 { user, session }，失败返回 null）。 */
export function authenticate(token) {
  if (!token) return null;
  const session = findSession(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    removeSession(token);
    return null;
  }
  const user = findUserById(session.userId);
  if (!user) return null;
  return { user, session };
}

export function publicUser(u) {
  return { id: u.id, email: u.email, nickname: u.nickname, createdAt: u.createdAt };
}
