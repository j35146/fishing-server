const db = require('../db');
const authenticate = require('../middleware/auth');
const { getPresignedUrl } = require('../utils/minio');

// 创建出行 schema
const createTripSchema = {
  body: {
    type: 'object',
    required: ['trip_date'],
    properties: {
      title: { type: 'string' },
      trip_date: { type: 'string', format: 'date' },
      start_time: { type: 'string' },
      end_time: { type: 'string' },
      location_name: { type: 'string' },
      spot_id: { type: 'string' },
      weather_temp: { type: 'number' },
      weather_wind: { type: 'string' },
      weather_condition: { type: 'string' },
      companions: { type: 'array', items: { type: 'string' } },
      notes: { type: 'string' },
      style_ids: { type: 'array', items: { type: 'integer' } },
      local_id: { type: 'string' },
    },
  },
};

// 更新出行 schema
const updateTripSchema = {
  body: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      trip_date: { type: 'string', format: 'date' },
      start_time: { type: 'string' },
      end_time: { type: 'string' },
      location_name: { type: 'string' },
      spot_id: { type: 'string' },
      weather_temp: { type: 'number' },
      weather_wind: { type: 'string' },
      weather_condition: { type: 'string' },
      companions: { type: 'array', items: { type: 'string' } },
      notes: { type: 'string' },
      style_ids: { type: 'array', items: { type: 'integer' } },
    },
  },
};

// 批量同步 schema
const syncSchema = {
  body: {
    type: 'object',
    required: ['trips'],
    properties: {
      trips: {
        type: 'array',
        items: {
          type: 'object',
          required: ['trip_date'],
          properties: {
            title: { type: 'string' },
            trip_date: { type: 'string', format: 'date' },
            start_time: { type: 'string' },
            end_time: { type: 'string' },
            location_name: { type: 'string' },
            weather_temp: { type: 'number' },
            weather_wind: { type: 'string' },
            weather_condition: { type: 'string' },
            companions: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string' },
            style_ids: { type: 'array', items: { type: 'integer' } },
            local_id: { type: 'string' },
          },
        },
      },
    },
  },
};

// 插入出行-钓法关联
async function insertTripStyles(tripId, styleIds) {
  if (!styleIds || styleIds.length === 0) return;
  for (const styleId of styleIds) {
    await db.query(
      'INSERT INTO trip_fishing_styles (trip_id, style_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [tripId, styleId]
    );
  }
}

async function tripRoutes(fastify) {
  // 所有出行路由需要认证
  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/trips — 分页列表
  fastify.get('/api/v1/trips', async (request) => {
    const { page = 1, pageSize = 20, styleCode, startDate, endDate } = request.query;
    const offset = (page - 1) * pageSize;

    let where = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // 钓法筛选
    if (styleCode) {
      where += ` AND t.id IN (
        SELECT tfs.trip_id FROM trip_fishing_styles tfs
        JOIN fishing_styles fs ON fs.id = tfs.style_id
        WHERE fs.code = $${paramIndex}
      )`;
      params.push(styleCode);
      paramIndex++;
    }

    // 日期范围筛选
    if (startDate) {
      where += ` AND t.trip_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      where += ` AND t.trip_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // 查询总数
    const countResult = await db.query(
      `SELECT COUNT(*) FROM fishing_trips t ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // 查询列表
    const listParams = [...params, pageSize, offset];
    const listResult = await db.query(
      `SELECT t.id, t.title, t.trip_date, t.location_name, t.created_at,
              COALESCE(
                (SELECT json_agg(json_build_object('id', fs.id, 'name', fs.name, 'code', fs.code))
                 FROM trip_fishing_styles tfs
                 JOIN fishing_styles fs ON fs.id = tfs.style_id
                 WHERE tfs.trip_id = t.id),
                '[]'::json
              ) AS styles,
              (SELECT COUNT(*) FROM fish_catches fc WHERE fc.trip_id = t.id)::int AS catch_count
       FROM fishing_trips t
       ${where}
       ORDER BY t.trip_date DESC, t.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      listParams
    );

    return {
      success: true,
      data: listResult.rows,
      pagination: { page: parseInt(page, 10), pageSize: parseInt(pageSize, 10), total },
    };
  });

  // GET /api/v1/trips/:id — 出行详情
  fastify.get('/api/v1/trips/:id', async (request, reply) => {
    const { id } = request.params;

    const tripResult = await db.query('SELECT * FROM fishing_trips WHERE id = $1', [id]);
    if (tripResult.rows.length === 0) {
      return reply.code(404).send({ success: false, error: '出行记录不存在' });
    }

    const trip = tripResult.rows[0];

    // 查询关联钓法
    const stylesResult = await db.query(
      `SELECT fs.id, fs.name, fs.code
       FROM trip_fishing_styles tfs
       JOIN fishing_styles fs ON fs.id = tfs.style_id
       WHERE tfs.trip_id = $1`,
      [id]
    );

    // 查询渔获
    const catchesResult = await db.query(
      'SELECT * FROM fish_catches WHERE trip_id = $1 ORDER BY created_at',
      [id]
    );

    // 查询装备
    const equipmentResult = await db.query(
      `SELECT te.id AS te_id, te.notes AS te_notes, el.*
       FROM trip_equipment te
       JOIN equipment_library el ON el.id = te.equipment_id
       WHERE te.trip_id = $1`,
      [id]
    );

    // 将 media_keys 转换为预签名 URL
    let mediaUrls = [];
    const mediaKeys = trip.media_keys || [];
    if (mediaKeys.length > 0) {
      mediaUrls = await Promise.all(
        mediaKeys.map((key) => getPresignedUrl(key))
      );
    }

    return {
      success: true,
      data: {
        ...trip,
        media_urls: mediaUrls,
        styles: stylesResult.rows,
        catches: catchesResult.rows,
        equipment: equipmentResult.rows,
      },
    };
  });

  // POST /api/v1/trips — 创建出行
  fastify.post('/api/v1/trips', { schema: createTripSchema }, async (request, reply) => {
    const {
      title, trip_date, start_time, end_time, location_name, spot_id,
      weather_temp, weather_wind, weather_condition, companions, notes,
      style_ids, local_id,
    } = request.body;

    const result = await db.query(
      `INSERT INTO fishing_trips
        (title, trip_date, start_time, end_time, location_name, spot_id,
         weather_temp, weather_wind, weather_condition, companions, notes, local_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [title, trip_date, start_time || null, end_time || null, location_name,
       spot_id || null, weather_temp || null, weather_wind || null,
       weather_condition || null, companions || null, notes || null, local_id || null]
    );

    const trip = result.rows[0];
    await insertTripStyles(trip.id, style_ids);

    reply.code(201);
    return { success: true, data: trip };
  });

  // PUT /api/v1/trips/:id — 更新出行
  fastify.put('/api/v1/trips/:id', { schema: updateTripSchema }, async (request, reply) => {
    const { id } = request.params;
    const {
      title, trip_date, start_time, end_time, location_name, spot_id,
      weather_temp, weather_wind, weather_condition, companions, notes,
      style_ids,
    } = request.body;

    const result = await db.query(
      `UPDATE fishing_trips SET
        title = COALESCE($1, title),
        trip_date = COALESCE($2, trip_date),
        start_time = COALESCE($3, start_time),
        end_time = COALESCE($4, end_time),
        location_name = COALESCE($5, location_name),
        spot_id = COALESCE($6, spot_id),
        weather_temp = COALESCE($7, weather_temp),
        weather_wind = COALESCE($8, weather_wind),
        weather_condition = COALESCE($9, weather_condition),
        companions = COALESCE($10, companions),
        notes = COALESCE($11, notes),
        updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [title, trip_date, start_time, end_time, location_name, spot_id,
       weather_temp, weather_wind, weather_condition, companions, notes, id]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ success: false, error: '出行记录不存在' });
    }

    // style_ids 全量替换
    if (style_ids) {
      await db.query('DELETE FROM trip_fishing_styles WHERE trip_id = $1', [id]);
      await insertTripStyles(id, style_ids);
    }

    return { success: true, data: result.rows[0] };
  });

  // DELETE /api/v1/trips/:id — 删除出行
  fastify.delete('/api/v1/trips/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await db.query('DELETE FROM fishing_trips WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return reply.code(404).send({ success: false, error: '出行记录不存在' });
    }

    return { success: true, data: { id } };
  });

  // POST /api/v1/trips/sync — 批量同步
  fastify.post('/api/v1/trips/sync', { schema: syncSchema }, async (request) => {
    const { trips } = request.body;
    const results = [];

    for (const trip of trips) {
      const {
        title, trip_date, start_time, end_time, location_name,
        weather_temp, weather_wind, weather_condition, companions, notes,
        style_ids, local_id,
      } = trip;

      // 检查 local_id 是否已存在
      const existing = await db.query(
        'SELECT id FROM fishing_trips WHERE local_id = $1',
        [local_id]
      );

      if (existing.rows.length > 0) {
        // 更新
        const tripId = existing.rows[0].id;
        await db.query(
          `UPDATE fishing_trips SET
            title = COALESCE($1, title),
            trip_date = COALESCE($2, trip_date),
            start_time = COALESCE($3, start_time),
            end_time = COALESCE($4, end_time),
            location_name = COALESCE($5, location_name),
            weather_temp = COALESCE($6, weather_temp),
            weather_wind = COALESCE($7, weather_wind),
            weather_condition = COALESCE($8, weather_condition),
            companions = COALESCE($9, companions),
            notes = COALESCE($10, notes),
            sync_status = 'synced',
            updated_at = NOW()
           WHERE id = $11`,
          [title, trip_date, start_time, end_time, location_name,
           weather_temp, weather_wind, weather_condition, companions, notes, tripId]
        );
        if (style_ids) {
          await db.query('DELETE FROM trip_fishing_styles WHERE trip_id = $1', [tripId]);
          await insertTripStyles(tripId, style_ids);
        }
        results.push({ local_id, action: 'updated', id: tripId });
      } else {
        // 新建
        const result = await db.query(
          `INSERT INTO fishing_trips
            (title, trip_date, start_time, end_time, location_name,
             weather_temp, weather_wind, weather_condition, companions, notes, local_id, sync_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'synced')
           RETURNING id`,
          [title, trip_date, start_time || null, end_time || null, location_name || null,
           weather_temp || null, weather_wind || null, weather_condition || null,
           companions || null, notes || null, local_id || null]
        );
        const newId = result.rows[0].id;
        await insertTripStyles(newId, style_ids);
        results.push({ local_id, action: 'created', id: newId });
      }
    }

    return { success: true, data: results };
  });
}

module.exports = tripRoutes;
