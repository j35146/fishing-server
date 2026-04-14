const bcrypt = require('bcrypt');
const db = require('../db');
const authenticate = require('../middleware/auth');

// 登录请求 schema
const loginSchema = {
  body: {
    type: 'object',
    required: ['username', 'password'],
    properties: {
      username: { type: 'string' },
      password: { type: 'string' },
    },
  },
};

// 修改密码请求 schema
const changePasswordSchema = {
  body: {
    type: 'object',
    required: ['oldPassword', 'newPassword'],
    properties: {
      oldPassword: { type: 'string' },
      newPassword: { type: 'string', minLength: 6 },
    },
  },
};

async function authRoutes(fastify) {
  // POST /api/v1/auth/login — 用户登录
  fastify.post('/api/v1/auth/login', { schema: loginSchema }, async (request, reply) => {
    const { username, password } = request.body;

    const result = await db.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return reply.code(401).send({ success: false, error: '用户名或密码错误' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ success: false, error: '用户名或密码错误' });
    }

    const token = fastify.jwt.sign({ id: user.id, username: user.username });
    return { success: true, data: { token, expiresIn: '30d' } };
  });

  // POST /api/v1/auth/change-password — 修改密码（需认证）
  fastify.post('/api/v1/auth/change-password', {
    schema: changePasswordSchema,
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { oldPassword, newPassword } = request.body;
    const userId = request.user.id;

    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return reply.code(404).send({ success: false, error: '用户不存在' });
    }

    const valid = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
    if (!valid) {
      return reply.code(400).send({ success: false, error: '旧密码错误' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);

    return { success: true, data: { message: '密码修改成功' } };
  });
}

module.exports = authRoutes;
