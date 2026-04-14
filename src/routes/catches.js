const db = require('../db');
const authenticate = require('../middleware/auth');

// 创建渔获 schema
const createCatchSchema = {
  body: {
    type: 'object',
    properties: {
      species: { type: 'string' },
      weight_g: { type: 'integer' },
      length_cm: { type: 'number' },
      count: { type: 'integer', minimum: 1 },
      is_released: { type: 'boolean' },
      caught_at: { type: 'string' },
      notes: { type: 'string' },
      style_id: { type: 'integer' },
      local_id: { type: 'string' },
    },
  },
};

// 更新渔获 schema
const updateCatchSchema = {
  body: {
    type: 'object',
    properties: {
      species: { type: 'string' },
      weight_g: { type: 'integer' },
      length_cm: { type: 'number' },
      count: { type: 'integer', minimum: 1 },
      is_released: { type: 'boolean' },
      caught_at: { type: 'string' },
      notes: { type: 'string' },
      style_id: { type: 'integer' },
    },
  },
};

async function catchRoutes(fastify) {
  // 所有渔获路由需要认证
  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/trips/:tripId/catches — 查询出行的所有渔获
  fastify.get('/api/v1/trips/:tripId/catches', async (request) => {
    const { tripId } = request.params;

    const result = await db.query(
      'SELECT * FROM fish_catches WHERE trip_id = $1 ORDER BY created_at',
      [tripId]
    );

    return { success: true, data: result.rows };
  });

  // POST /api/v1/trips/:tripId/catches — 创建渔获
  fastify.post('/api/v1/trips/:tripId/catches', { schema: createCatchSchema }, async (request, reply) => {
    const { tripId } = request.params;
    const { species, weight_g, length_cm, count, is_released, caught_at, notes, style_id, local_id } = request.body;

    const result = await db.query(
      `INSERT INTO fish_catches
        (trip_id, style_id, species, weight_g, length_cm, count, is_released, caught_at, notes, local_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [tripId, style_id || null, species || null, weight_g || null,
       length_cm || null, count || 1, is_released || false,
       caught_at || null, notes || null, local_id || null]
    );

    reply.code(201);
    return { success: true, data: result.rows[0] };
  });

  // PUT /api/v1/catches/:id — 更新渔获
  fastify.put('/api/v1/catches/:id', { schema: updateCatchSchema }, async (request, reply) => {
    const { id } = request.params;
    const { species, weight_g, length_cm, count, is_released, caught_at, notes, style_id } = request.body;

    const result = await db.query(
      `UPDATE fish_catches SET
        species = COALESCE($1, species),
        weight_g = COALESCE($2, weight_g),
        length_cm = COALESCE($3, length_cm),
        count = COALESCE($4, count),
        is_released = COALESCE($5, is_released),
        caught_at = COALESCE($6, caught_at),
        notes = COALESCE($7, notes),
        style_id = COALESCE($8, style_id)
       WHERE id = $9
       RETURNING *`,
      [species, weight_g, length_cm, count, is_released, caught_at, notes, style_id, id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ success: false, error: '渔获记录不存在' });
    }

    return { success: true, data: result.rows[0] };
  });

  // DELETE /api/v1/catches/:id — 删除渔获
  fastify.delete('/api/v1/catches/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await db.query('DELETE FROM fish_catches WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return reply.code(404).send({ success: false, error: '渔获记录不存在' });
    }

    return { success: true, data: { id } };
  });
}

module.exports = catchRoutes;
