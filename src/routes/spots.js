const db = require('../db');
const authenticate = require('../middleware/auth');
const { getPresignedUrl } = require('../utils/minio');

// 创建钓点 schema
const createSpotSchema = {
  body: {
    type: 'object',
    required: ['name', 'latitude', 'longitude'],
    properties: {
      name: { type: 'string', maxLength: 200 },
      description: { type: 'string' },
      latitude: { type: 'number', minimum: -90, maximum: 90 },
      longitude: { type: 'number', minimum: -180, maximum: 180 },
      spot_type: { type: 'string', enum: ['river', 'lake', 'reservoir', 'sea', 'other'] },
      is_public: { type: 'boolean' },
      photo_key: { type: 'string' },
    },
  },
};

// 更新钓点 schema
const updateSpotSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', maxLength: 200 },
      description: { type: 'string' },
      latitude: { type: 'number', minimum: -90, maximum: 90 },
      longitude: { type: 'number', minimum: -180, maximum: 180 },
      spot_type: { type: 'string', enum: ['river', 'lake', 'reservoir', 'sea', 'other'] },
      is_public: { type: 'boolean' },
      photo_key: { type: 'string' },
    },
  },
};

async function spotRoutes(fastify) {
  // 所有钓点路由需要认证
  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/spots/nearby — 附近钓点（放在 :id 路由前避免冲突）
  fastify.get('/api/v1/spots/nearby', async (request) => {
    const { lat, lng, radius = 10 } = request.query;

    const result = await db.query(
      `SELECT *,
        6371 * acos(
          LEAST(1.0, cos(radians($1)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(latitude)))
        ) AS distance_km
       FROM spots
       WHERE 6371 * acos(
          LEAST(1.0, cos(radians($1)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(latitude)))
        ) < $3
       ORDER BY distance_km`,
      [parseFloat(lat), parseFloat(lng), parseFloat(radius)]
    );

    return { success: true, data: result.rows };
  });

  // POST /api/v1/spots — 创建钓点
  fastify.post('/api/v1/spots', { schema: createSpotSchema }, async (request, reply) => {
    const userId = request.user.id;
    const { name, description, latitude, longitude, spot_type, is_public, photo_key } = request.body;

    const result = await db.query(
      `INSERT INTO spots (user_id, name, description, latitude, longitude, spot_type, is_public, photo_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [userId, name, description || null, latitude, longitude,
       spot_type || 'other', is_public || false, photo_key || null]
    );

    reply.code(201);
    return { success: true, data: result.rows[0] };
  });

  // GET /api/v1/spots — 钓点列表（分页 + 筛选）
  fastify.get('/api/v1/spots', async (request) => {
    const { page = 1, pageSize = 20, spot_type, is_public } = request.query;
    const offset = (page - 1) * pageSize;

    let where = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (spot_type) {
      where += ` AND spot_type = $${paramIndex}`;
      params.push(spot_type);
      paramIndex++;
    }
    if (is_public !== undefined && is_public !== '') {
      where += ` AND is_public = $${paramIndex}`;
      params.push(is_public === 'true' || is_public === true);
      paramIndex++;
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM spots ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const listParams = [...params, parseInt(pageSize, 10), offset];
    const result = await db.query(
      `SELECT * FROM spots ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      listParams
    );

    return {
      success: true,
      data: result.rows,
      pagination: { page: parseInt(page, 10), pageSize: parseInt(pageSize, 10), total },
    };
  });

  // GET /api/v1/spots/:id — 钓点详情
  fastify.get('/api/v1/spots/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await db.query('SELECT * FROM spots WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return reply.code(404).send({ success: false, error: '钓点不存在' });
    }

    const spot = result.rows[0];
    // photo_key 转为预签名 URL
    if (spot.photo_key) {
      spot.photo_url = await getPresignedUrl(spot.photo_key);
    }

    return { success: true, data: spot };
  });

  // PUT /api/v1/spots/:id — 更新钓点（仅限本人）
  fastify.put('/api/v1/spots/:id', { schema: updateSpotSchema }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.id;
    const { name, description, latitude, longitude, spot_type, is_public, photo_key } = request.body;

    // 检查是否本人
    const existing = await db.query('SELECT user_id FROM spots WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.code(404).send({ success: false, error: '钓点不存在' });
    }
    if (existing.rows[0].user_id !== userId) {
      return reply.code(403).send({ success: false, error: '无权修改他人的钓点' });
    }

    const result = await db.query(
      `UPDATE spots SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        latitude = COALESCE($3, latitude),
        longitude = COALESCE($4, longitude),
        spot_type = COALESCE($5, spot_type),
        is_public = COALESCE($6, is_public),
        photo_key = COALESCE($7, photo_key),
        updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [name, description, latitude, longitude, spot_type, is_public, photo_key, id]
    );

    return { success: true, data: result.rows[0] };
  });

  // DELETE /api/v1/spots/:id — 删除钓点（仅限本人）
  fastify.delete('/api/v1/spots/:id', async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.id;

    const existing = await db.query('SELECT user_id FROM spots WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.code(404).send({ success: false, error: '钓点不存在' });
    }
    if (existing.rows[0].user_id !== userId) {
      return reply.code(403).send({ success: false, error: '无权删除他人的钓点' });
    }

    await db.query('DELETE FROM spots WHERE id = $1', [id]);
    return { success: true };
  });
}

module.exports = spotRoutes;
