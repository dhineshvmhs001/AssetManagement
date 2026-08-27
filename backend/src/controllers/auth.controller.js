const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { JWT_SECRET } = require('../config/env');
const { roleLabel } = require('../constants/roles');

const INVALID = 'Invalid email or password';

function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    roleLabel: roleLabel(row.role),
  };
}

function signToken(user, remember) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: remember ? '7d' : '12h' },
  );
}

async function login(req, res) {
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');
  const remember = Boolean(req.body?.remember);

  if (!email || !password) {
    return res.status(401).json({ ok: false, error: INVALID });
  }

  const result = await query(
    `SELECT id, name, email, password_hash, role, is_active
     FROM users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email],
  );
  const user = result.rows[0];

  if (!user || !user.is_active) {
    return res.status(401).json({ ok: false, error: INVALID });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ ok: false, error: INVALID });
  }

  res.json({
    ok: true,
    token: signToken(user, remember),
    user: toPublicUser(user),
  });
}

async function me(req, res) {
  const result = await query(
    `SELECT id, name, email, role, is_active
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [req.user.id],
  );
  const user = result.rows[0];

  if (!user || !user.is_active) {
    return res.status(401).json({ ok: false, error: 'Login required' });
  }

  res.json({ ok: true, user: toPublicUser(user) });
}

function logout(req, res) {
  res.json({ ok: true });
}

module.exports = { login, me, logout };
